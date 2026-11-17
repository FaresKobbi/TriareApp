import { PowerSourceNotice } from "@/src/components/ui/PowerSourceNotice";
import { TelemetryStatus } from "@/src/features/bluetooth/constants/triareProtocol";
import React, { act } from "react";
import { create } from "react-test-renderer";

// Icon fonts load asynchronously and would trigger act() warnings: render the icon as a plain
// element that keeps its props, so the test can check which symbol is shown.
jest.mock("@expo/vector-icons", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use outer imports
  Ionicons: (props: object) => require("react").createElement("Icon", props),
}));

function render(status: number | null) {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(<PowerSourceNotice status={status} />);
  });
  return r;
}

describe("PowerSourceNotice", () => {
  it("shows nothing before the first status", () => {
    expect(render(null).toJSON()).toBeNull();
  });

  it("shows nothing when the bit is clear, whatever the other bits are", () => {
    const others = TelemetryStatus.ARMED | TelemetryStatus.DRIVING | TelemetryStatus.ZERO_VALID;
    expect(render(0).toJSON()).toBeNull();
    expect(render(others).toJSON()).toBeNull();
  });

  it("warns when the board reports the battery is holding the bus", () => {
    const r = render(TelemetryStatus.ARMED | TelemetryStatus.ON_BATTERY);
    const text = r.root
      .findAllByType("Text" as never)
      .map((n) => String(n.props.children))
      .join(" ");
    expect(text).toMatch(/Running on battery/);
    // A battery symbol next to the text, so the warning reads at a glance.
    expect(r.root.findByType("Icon" as never).props.name).toBe("battery-half");
  });

  it("uses a bit that no other status flag uses", () => {
    const others = Object.entries(TelemetryStatus)
      .filter(([name]) => name !== "ON_BATTERY")
      .reduce((acc, [, bit]) => acc | bit, 0);
    expect(others & TelemetryStatus.ON_BATTERY).toBe(0);
    expect(TelemetryStatus.ON_BATTERY).toBe(0x80);
  });
});
