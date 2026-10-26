import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import { BleSession } from "@/src/features/bluetooth/services/BleSession";
import { TriareCommandService } from "@/src/features/bluetooth/services/TriareCommandService";
import React, { act } from "react";
import { create, ReactTestInstance } from "react-test-renderer";
import ResistanceScreen from "@/app/(tabs)/resistance";

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

/** The pressable whose label is `label` (buttons, chips). */
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

describe("Resistance screen", () => {
  afterEach(() => {
    // Unmounting stops the stream watchdog timer before it fires outside the test.
    act(() => {
      mounted.splice(0).forEach((r) => r.unmount());
    });
    mockSession = null;
  });

  it("asks to connect when there is no session", async () => {
    let r!: ReturnType<typeof create>;
    await act(async () => {
      r = create(<ResistanceScreen />);
    });
    mounted.push(r);
    expect(allText(r.root).join(" ")).toMatch(/Not connected/);
  });

  it("shows the modes, with the brake unavailable, and a Release button", async () => {
    const r = await mount();
    const text = allText(r.root).join(" | ");
    expect(text).toMatch(/Assist valley/);
    expect(text).toMatch(/Static hold/);
    expect(text).toMatch(/Brake/);
    expect(text).toMatch(/Not available yet/);
    expect(text).toMatch(/Release now/);
    // Streaming is requested for the pedal angle and the resistance frames.
    expect(opcodes()).toContain(0x1c);
  });

  it("Release now sends the release command", async () => {
    const r = await mount();
    await press(r.root, "Release now");
    expect(opcodes()).toContain(0x25);
  });

  it("Start sends zones, the mode and the cadence in ERPM, in that order", async () => {
    const r = await mount();
    await press(r.root, "Enable");
    await press(r.root, "Example");
    await press(r.root, "Start");

    const sequence = opcodes().filter((op) => op !== 0x1c && op !== 0x2a);
    expect(sequence).toEqual([0x10, 0x23, 0x21, 0x22, 0x20, 0x12]);
    expect(firmware.activeZones).toHaveLength(1);
    expect(firmware.activeZones[0]).toMatchObject({ startDeg: 60, endDeg: 150, valuePercent: 0 });
    // 20 crank RPM × 4 pole pairs × ratio 10 (the default for the bench box)
    expect(firmware.lastTargetErpm).toBe(800);
  });

  it("does not send anything when a zone is invalid", async () => {
    const r = await mount();
    await press(r.root, "Add zone");
    const inputs = r.root.findAllByType("TextInput" as never);
    // The inputs of the first zone follow the ratio and cadence fields.
    const endField = inputs.find((i) => i.props.accessibilityLabel === "To (°)")!;
    await act(async () => {
      endField.props.onChangeText("0"); // 0° → starts at 0° too: shorter than 1°
    });
    firmware.receivedFrames.length = 0;
    await press(r.root, "Send zones");
    expect(opcodes()).toEqual([]);
    expect(allText(r.root).join(" ")).toMatch(/at least 1°/);
  });
});
