import { BarSparkline } from "@/src/components/telemetry/BarSparkline";
import { TelemetryPanel } from "@/src/components/telemetry/TelemetryPanel";
import { TelemetryData } from "@/src/features/bluetooth/protocol/TriareFrames";
import { TelemetryHistory } from "@/src/features/telemetry/TelemetryHistory";
import React, { act } from "react";
import { create, ReactTestInstance } from "react-test-renderer";

// Icon fonts load asynchronously and would trigger act() warnings; icons are irrelevant here.
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const sample = (overrides: Partial<TelemetryData> = {}): TelemetryData => ({
  rpm: 400, // 100 motor RPM, 10 pedal RPM with a 10:1 ratio
  current: 3.25,
  voltage: 25.3,
  temp: 41.5,
  crankAngleDeg: 90,
  fault: 0,
  ...overrides,
});

function texts(root: ReactTestInstance): string[] {
  return root
    .findAllByType("Text" as never)
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.join("") : String(n.props.children)));
}

function render(el: React.ReactElement) {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(el);
  });
  return r;
}

describe("TelemetryPanel", () => {
  it("explains what to do when there is no sample yet", () => {
    const h = new TelemetryHistory(10);
    const off = render(<TelemetryPanel sample={null} history={h} version={0} totalRatio={10} live={false} />);
    expect(texts(off.root).join(" ")).toMatch(/Turn on Live telemetry/);
    const on = render(<TelemetryPanel sample={null} history={h} version={0} totalRatio={10} live />);
    expect(texts(on.root).join(" ")).toMatch(/Waiting for the first sample/);
  });

  it("shows pedal speed from ERPM and the gear ratio, plus the other readings", () => {
    const h = new TelemetryHistory(10);
    h.push(sample(), Date.now());
    const r = render(<TelemetryPanel sample={sample()} history={h} version={1} totalRatio={10} live />);
    const all = texts(r.root).join(" | ");
    expect(all).toContain("10.0"); // pedal RPM
    expect(all).toContain("Motor 100 RPM");
    expect(all).toContain("400 ERPM");
    expect(all).toContain("3.3"); // current (one decimal)
    expect(all).toContain("25.3");
    expect(all).toContain("41.5");
    expect(all).toContain("No fault");
  });

  it("uses the gear ratio field for the pedal speed", () => {
    const h = new TelemetryHistory(10);
    const r = render(<TelemetryPanel sample={sample()} history={h} version={1} totalRatio={5} live />);
    expect(texts(r.root).join(" | ")).toContain("20.0");
  });

  it("names a controller fault in plain words", () => {
    const h = new TelemetryHistory(10);
    const r = render(
      <TelemetryPanel sample={sample({ fault: 2 })} history={h} version={1} totalRatio={10} live />,
    );
    expect(texts(r.root).join(" | ")).toContain("Under voltage");
  });

  it("reveals an explanation when a tile is tapped", () => {
    const h = new TelemetryHistory(10);
    const r = render(<TelemetryPanel sample={sample()} history={h} version={1} totalRatio={10} live />);
    expect(texts(r.root).join(" ")).not.toMatch(/Negative: it is braking/);
    const tile = r.root.findAll(
      (n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Motor current"),
    )[0];
    act(() => {
      tile.props.onPress();
    });
    expect(texts(r.root).join(" ")).toMatch(/Negative: it is braking/);
  });

  it("draws one chart per trend tile", () => {
    const h = new TelemetryHistory(10);
    h.push(sample(), Date.now());
    const r = render(<TelemetryPanel sample={sample()} history={h} version={1} totalRatio={10} live />);
    expect(r.root.findAllByType(BarSparkline)).toHaveLength(4);
  });
});

describe("BarSparkline", () => {
  it("renders one bar per non-null value and skips gaps", () => {
    const r = render(<BarSparkline values={[1, null, 3, 4]} min={0} max={5} />);
    // The root box plus one wrapper View per bar (each wrapper has one child bar).
    const wrappers = r.root.findAll(
      (n) => (n.type as unknown) === "View" && n.props.style && n.props.style.position === "absolute" && n.props.style.width,
    );
    expect(wrappers).toHaveLength(3);
  });

  it("draws the zero line only when zero is inside the range and fromZero is set", () => {
    const withLine = render(<BarSparkline values={[1, -1]} min={-2} max={2} fromZero />);
    const noLine = render(<BarSparkline values={[1, 2]} min={0} max={3} fromZero />);
    const count = (r: ReturnType<typeof create>) =>
      r.root.findAll(
        (n) =>
          (n.type as unknown) === "View" &&
          Array.isArray(n.props.style) &&
          n.props.style.some((st: { height?: number } | undefined) => st && st.height === 1),
      ).length;
    expect(count(withLine)).toBeGreaterThan(0);
    expect(count(noLine)).toBe(0);
  });
});
