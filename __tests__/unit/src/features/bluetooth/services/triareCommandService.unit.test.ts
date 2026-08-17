import { TX_CHAR_UUID } from "@/src/features/bluetooth/constants/bleUUIDs";
import { ACK_TIMEOUT_MS, TriareOpcode } from "@/src/features/bluetooth/constants/triareProtocol";
import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import {
  AckTimeoutError,
  TriareCommandService,
  UnexpectedFrameError,
} from "@/src/features/bluetooth/services/TriareCommandService";

let manager: MockBleCharacteristicManager;
let service: TriareCommandService;

beforeEach(() => {
  manager = new MockBleCharacteristicManager();
  service = new TriareCommandService(manager, new TriareVescCodec());
});

afterEach(() => {
  service.dispose();
  jest.useRealTimers();
});

describe("TriareCommandService ACK-framed commands", () => {
  it("enable() writes CMD_SYSTEM_ENABLE without response and resolves on ACK", async () => {
    await service.enable();
    expect(manager.systemEnabled).toBe(true);
    expect(manager.receivedFrames).toEqual([Uint8Array.of(TriareOpcode.SYSTEM_ENABLE)]);
  });

  it("disable() resolves on ACK and disarms the mock firmware", async () => {
    await service.enable();
    await service.disable();
    expect(manager.systemEnabled).toBe(false);
  });

  it("stop() resolves on ACK", async () => {
    await service.enable();
    await service.setRpm(500);
    await service.stop();
    expect(manager.lastTargetErpm).toBeNull();
  });

  it("setRpm() sends the target as little-endian float32", async () => {
    await service.setRpm(1000);
    expect(manager.lastTargetErpm).toBe(1000);
    expect(manager.receivedFrames[0]).toEqual(
      Uint8Array.of(TriareOpcode.SET_RPM, 0x00, 0x00, 0x7a, 0x44)
    );
  });

  it("setDuty() sends the duty as little-endian float32, negative allowed", async () => {
    await service.setDuty(-0.5);
    expect(manager.lastTargetDuty).toBe(-0.5);
  });
  

  it("setDuty() rejects out-of-range values without writing anything", async () => {
    await expect(service.setDuty(1.5)).rejects.toBeInstanceOf(RangeError);
    expect(manager.receivedFrames).toHaveLength(0);
  });
});

 it("calibrateCrank() resolves on ACK and zeroes the crank angle", async () => {
    manager.telemetry = { ...manager.telemetry, crankAngleDeg: 123 };
    await service.calibrateCrank();
    expect(manager.telemetry.crankAngleDeg).toBe(0);
    expect(manager.receivedFrames).toEqual([Uint8Array.of(TriareOpcode.CALIBRATE_CRANK)]);
  });

  it("setGearRatio() sends the ratio as little-endian float32 and resolves on ACK", async () => {
    await service.setGearRatio(2.0);
    expect(manager.gearRatio).toBe(2.0);
    expect(manager.receivedFrames[0]).toEqual(
      Uint8Array.of(TriareOpcode.SET_GEAR_RATIO, 0x00, 0x00, 0x00, 0x40)
    );
  });

  it("setGearRatio() also zeroes the crank angle as a side effect", async () => {
    manager.telemetry = { ...manager.telemetry, crankAngleDeg: 90 };
    await service.setGearRatio(1.5);
    expect(manager.telemetry.crankAngleDeg).toBe(0);
  });

describe("TriareCommandService data commands", () => {
  it("requestTelemetry() resolves with parsed telemetry", async () => {
    manager.telemetry = { rpm: 1200, current: 4.5, voltage: 36.5, temp: 41.25, crankAngleDeg: 45, fault: 2 };
    await expect(service.requestTelemetry()).resolves.toEqual({
      rpm: 1200,
      current: 4.5,
      voltage: 36.5,
      temp: 41.25,
      crankAngleDeg: 45,
      fault: 2,
    });
  });

  it("getDevEui() resolves with the 8-byte DevEUI via the command channel", async () => {
    await expect(service.getDevEui()).resolves.toEqual(manager.devEui);
  });

  it("readDevEui() reads the DevEUI characteristic directly", async () => {
    await expect(service.readDevEui()).resolves.toEqual(manager.devEui);
  });

  it("echo() resolves with the echoed payload", async () => {
    const payload = Uint8Array.of(1, 2, 3, 4);
    await expect(service.echo(payload)).resolves.toEqual(payload);
  });
});

/** Yields microtasks until the mock has received `count` command frames. */
async function flushUntilWritten(m: MockBleCharacteristicManager, count = 1) {
  for (let i = 0; i < 20 && m.receivedFrames.length < count; i++) {
    await Promise.resolve();
  }
}

describe("TriareCommandService error paths", () => {
  it("rejects with AckTimeoutError when the device never responds", async () => {
    jest.useFakeTimers();
    manager.respondToCommands = false;

    const pending = service.enable();
    pending.catch(() => {}); // avoid unhandled rejection before assertion
    await jest.advanceTimersByTimeAsync(ACK_TIMEOUT_MS);

    await expect(pending).rejects.toBeInstanceOf(AckTimeoutError);
    // The write itself did go out — only the response is missing.
    expect(manager.receivedFrames).toHaveLength(1);
  });

    it.each([0, -5, NaN, Infinity, -Infinity])(
    "rejects setGearRatio(%p) with AckTimeoutError — firmware stays silent on invalid values",
    async (invalidRatio) => {
      jest.useFakeTimers();

      const pending = service.setGearRatio(invalidRatio);
      pending.catch(() => {});
      await jest.advanceTimersByTimeAsync(ACK_TIMEOUT_MS);

      await expect(pending).rejects.toBeInstanceOf(AckTimeoutError);
      // The write did go out — only the response is missing, same as real firmware.
      expect(manager.receivedFrames).toHaveLength(1);
      expect(manager.gearRatio).toBe(1.0); // unchanged — the invalid value was rejected
    }
  );

  it("rejects with UnexpectedFrameError when the response is not the expected ACK", async () => {
    manager.respondToCommands = false;

    const pending = service.enable();
    pending.catch(() => {});
    await flushUntilWritten(manager);
    // Firmware ACKs, but for the wrong opcode.
    manager.emitRawFrame(Uint8Array.of(TriareOpcode.ACK, TriareOpcode.STOP));

    await expect(pending).rejects.toBeInstanceOf(UnexpectedFrameError);
  });

  it("rejects with UnexpectedFrameError when requestTelemetry gets a malformed frame", async () => {
    manager.respondToCommands = false;

    const pending = service.requestTelemetry();
    pending.catch(() => {});
    await flushUntilWritten(manager);
    manager.emitRawFrame(Uint8Array.of(0xff, 0x00)); // decodes as "unrecognized"

    await expect(pending).rejects.toBeInstanceOf(UnexpectedFrameError);
  });

  it("propagates write failures instead of waiting for the timeout", async () => {
    const failure = new Error("GATT write failed");
    jest.spyOn(manager, "writeWithoutResponse").mockRejectedValue(failure);

    await expect(service.enable()).rejects.toBe(failure);
  });

  it("recovers after a timeout: the next command still works", async () => {
    jest.useFakeTimers();
    manager.respondToCommands = false;

    const pending = service.enable();
    pending.catch(() => {});
    await jest.advanceTimersByTimeAsync(ACK_TIMEOUT_MS);
    await expect(pending).rejects.toBeInstanceOf(AckTimeoutError);

    manager.respondToCommands = true;
    await expect(service.enable()).resolves.toBeUndefined();
    expect(manager.systemEnabled).toBe(true);
  });
});

describe("TriareCommandService serialization", () => {
  it("serializes concurrent commands so responses match their commands", async () => {
    await Promise.all([service.enable(), service.setRpm(300), service.stop()]);

    expect(manager.receivedFrames.map((f) => f[0])).toEqual([
      TriareOpcode.SYSTEM_ENABLE,
      TriareOpcode.SET_RPM,
      TriareOpcode.STOP,
    ]);
  });

  it("writes command frames to the TX characteristic", async () => {
    const spy = jest.spyOn(manager, "writeWithoutResponse");
    await service.enable();
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      TX_CHAR_UUID,
      expect.any(String)
    );
  });
});
