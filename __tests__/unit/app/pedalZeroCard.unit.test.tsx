import ResistanceScreen from "@/app/(tabs)/resistance";
import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import { BleSession } from "@/src/features/bluetooth/services/BleSession";
import { TriareCommandService } from "@/src/features/bluetooth/services/TriareCommandService";
import React, { act } from "react";
import { Alert, AlertButton } from "react-native";
import { create, ReactTestInstance } from "react-test-renderer";

// The first render loads the whole screen (dial, icons, fonts): slow on a cold cache.
jest.setTimeout(60000);

jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));

let mockSession: BleSession | null = null;
jest.mock("@/src/features/bluetooth/context/BleSessionContext", () => ({
  useBleSession: () => mockSession,
  useBleSessionContext: () => ({ session: mockSession, setSession: jest.fn() }),
}));

function allText(root: ReactTestInstance): string[] {
  return root
    .findAllByType("Text" as never)
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.join("") : String(n.props.children)));
}

function button(root: ReactTestInstance, label: string): ReactTestInstance {
  const match = root
    .findAll((n) => typeof n.props.onPress === "function" && n.props.accessibilityRole === "button")
    .find((n) => {
      try {
        return allText(n).includes(label);
      } catch {
        return false;
      }
    });
  if (!match) throw new Error(`no button "${label}"`);
  return match;
}

const hasButton = (root: ReactTestInstance, label: string) => {
  try {
    button(root, label);
    return true;
  } catch {
    return false;
  }
};

async function press(root: ReactTestInstance, label: string) {
  await act(async () => {
    await button(root, label).props.onPress();
  });
}

let firmware: MockBleCharacteristicManager;
const mounted: ReturnType<typeof create>[] = [];

async function mount() {
  firmware = new MockBleCharacteristicManager();
  mockSession = {
    commands: new TriareCommandService(firmware, new TriareVescCodec()),
    setFastLink: jest.fn().mockResolvedValue(undefined),
  } as unknown as BleSession;
  let r!: ReturnType<typeof create>;
  await act(async () => {
    r = create(<ResistanceScreen />);
  });
  mounted.push(r);
  return r;
}

const opcodes = () => firmware.receivedFrames.map((f) => f[0]);
const text = (r: ReturnType<typeof create>) => allText(r.root).join(" | ");

/** Taps the button of the last confirmation dialog. */
function lastAlertButton(spy: jest.SpyInstance, label: string): AlertButton {
  const buttons = spy.mock.calls[spy.mock.calls.length - 1][2] as AlertButton[];
  const found = buttons.find((b) => b.text === label);
  if (!found) throw new Error(`no dialog button "${label}"`);
  return found;
}

describe("Pedal zero card", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach((r) => r.unmount());
    });
    mockSession = null;
    alertSpy.mockRestore();
  });

  it("shows the card, reads the sensor state and offers both actions", async () => {
    const r = await mount();
    expect(text(r)).toMatch(/Pedal zero/);
    expect(hasButton(r.root, "Calibrate pedal")).toBe(true);
    expect(hasButton(r.root, "Mark zero (left pedal up)")).toBe(true);
    expect(opcodes()).toContain(0x2a);
    expect(text(r)).toMatch(/Zero not confirmed yet/);
    expect(text(r)).toMatch(/✗ Reverse measured/);
    firmware.zeroRevKnown = true;
    await press(r.root, "Read state");
    expect(text(r)).toMatch(/✓ Reverse measured/);
  });

  it("explains that the ratio comes first, and sends nothing to the crank", async () => {
    const r = await mount();
    firmware.receivedFrames.length = 0;
    await press(r.root, "Mark zero (left pedal up)");
    expect(text(r)).toMatch(/Send the gear ratio first/);
    expect(opcodes()).not.toContain(0x17);
  });

  it("explains that the sensor must be learned before the motor searches", async () => {
    const r = await mount();
    await press(r.root, "Set ratio");
    firmware.receivedFrames.length = 0;
    await press(r.root, "Calibrate pedal");
    expect(alertSpy).toHaveBeenCalledTimes(1);
    await act(async () => {
      await lastAlertButton(alertSpy, "Start").onPress!();
    });
    expect(text(r)).toMatch(/Mark the zero first/);
    expect(opcodes()).not.toContain(0x28);
  });

  it("asks before moving the pedals, and does nothing if the user backs out", async () => {
    const r = await mount();
    await press(r.root, "Set ratio");
    await press(r.root, "Mark zero (left pedal up)");
    firmware.fireZeroSensor(90);
    firmware.receivedFrames.length = 0;

    await press(r.root, "Calibrate pedal");
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe("Move the pedals?");
    expect(opcodes()).not.toContain(0x28);

    await act(async () => {
      lastAlertButton(alertSpy, "Not now").onPress?.();
    });
    expect(opcodes()).not.toContain(0x28);
    expect(firmware.zeroSearching).toBe(false);
  });

  it("mark zero → calibrate pedal → sensor fires → zero confirmed", async () => {
    const r = await mount();
    await press(r.root, "Set ratio");
    await press(r.root, "Enable");

    await press(r.root, "Mark zero (left pedal up)");
    expect(firmware.zeroLearning).toBe(true);
    expect(text(r)).toMatch(/Turn the crank, in the pedalling direction/);
    firmware.fireZeroSensor(123.5);
    await press(r.root, "Read state");
    expect(text(r)).toMatch(/✓ Zero marked/);
    expect(text(r)).toMatch(/123\.5°/);

    await press(r.root, "Calibrate pedal");
    await act(async () => {
      await lastAlertButton(alertSpy, "Start").onPress!();
    });
    expect(firmware.zeroSearching).toBe(true);
    expect(text(r)).toMatch(/The motor is turning the pedals/);
    // While the motor turns the card offers Cancel, not a second search.
    expect(hasButton(r.root, "Cancel search")).toBe(true);
    expect(hasButton(r.root, "Calibrate pedal")).toBe(false);

    firmware.fireZeroSensor(123.5);
    await press(r.root, "Read state");
    expect(text(r)).toMatch(/Zero confirmed by the sensor/);
    expect(text(r)).toMatch(/Found: the sensor fired/);
    expect(hasButton(r.root, "Calibrate pedal")).toBe(true);
  });

  it("cancel search releases the motor", async () => {
    const r = await mount();
    await press(r.root, "Set ratio");
    await press(r.root, "Enable");
    await press(r.root, "Mark zero (left pedal up)");
    firmware.fireZeroSensor(10);
    await press(r.root, "Calibrate pedal");
    await act(async () => {
      await lastAlertButton(alertSpy, "Start").onPress!();
    });
    expect(firmware.zeroSearching).toBe(true);

    await press(r.root, "Cancel search");
    expect(firmware.zeroSearching).toBe(false);
    expect(text(r)).toMatch(/Stopped before finding it/);
  });
});
