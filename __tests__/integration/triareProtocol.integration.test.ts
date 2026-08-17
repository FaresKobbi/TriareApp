/**
 * Integration test: the full protocol stack (TriareCommandService +
 * TriareVescCodec) driving the MockBleCharacteristicManager firmware
 * simulator end-to-end, mirroring a real ride session.
 */
import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import {
  AckTimeoutError,
  TriareCommandService,
} from "@/src/features/bluetooth/services/TriareCommandService";

describe("TRIARE protocol end-to-end against the firmware simulator", () => {
  it("runs a full session: validate → enable → set RPM/duty → telemetry → stop → disable", async () => {
    const firmware = new MockBleCharacteristicManager();
    const service = new TriareCommandService(firmware, new TriareVescCodec());

    // Validation step (equivalent of `triare_host_ble.py validate`)
    const devEuiRead = await service.readDevEui();
    const devEuiCmd = await service.getDevEui();
    expect(devEuiCmd).toEqual(devEuiRead);
    const echoPayload = new TextEncoder().encode("triare-ble");
    expect(await service.echo(echoPayload)).toEqual(echoPayload);

    // Arm the system
    await service.enable();
    expect(firmware.systemEnabled).toBe(true);

    // Closed-loop RPM mode
    await service.setRpm(1000);
    expect(firmware.lastTargetErpm).toBe(1000);

    // Telemetry reflects firmware state
    firmware.telemetry = { rpm: 995.5, current: 3.25, voltage: 36.75, temp: 40.5, crankAngleDeg: 180, fault: 0 };
    const telemetry = await service.requestTelemetry();
    expect(telemetry).toEqual(firmware.telemetry);

    // Duty mode, reverse direction
    await service.setDuty(-0.08);
    expect(firmware.lastTargetDuty).toBeCloseTo(-0.08, 6);

    // Stop: freewheel, still armed
    await service.stop();
    expect(firmware.lastTargetErpm).toBeNull();
    expect(firmware.lastTargetDuty).toBeNull();
    expect(firmware.systemEnabled).toBe(true);

    // Disarm
    await service.disable();
    expect(firmware.systemEnabled).toBe(false);

    service.dispose();
  });

  it("surfaces firmware silence as AckTimeoutError and recovers on the next command", async () => {
    const firmware = new MockBleCharacteristicManager();
    // Short timeout to keep the test fast; production uses ACK_TIMEOUT_MS.
    const service = new TriareCommandService(firmware, new TriareVescCodec(), 50);

    firmware.respondToCommands = false;
    await expect(service.enable()).rejects.toBeInstanceOf(AckTimeoutError);

    firmware.respondToCommands = true;
    await expect(service.enable()).resolves.toBeUndefined();
    expect(firmware.systemEnabled).toBe(true);

    service.dispose();
  });
});
