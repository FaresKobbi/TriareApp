import { describeFault, tempLevel, voltageLevel } from "@/src/features/telemetry/telemetryInfo";

describe("voltageLevel", () => {
  it.each([
    [25, "ok"],
    [22, "ok"],
    [21.9, "warn"],
    [20.5, "warn"],
    [20, "danger"],
    [15, "danger"],
    [28, "ok"],
    [28.5, "warn"],
    [30, "danger"],
    [31, "danger"],
  ])("%f V is %s", (volts, level) => {
    expect(voltageLevel(volts)).toBe(level);
  });

  it("does not alarm on a non-finite reading", () => {
    expect(voltageLevel(NaN)).toBe("ok");
  });
});

describe("tempLevel", () => {
  it.each([
    [25, "ok"],
    [69.9, "ok"],
    [70, "warn"],
    [84.9, "warn"],
    [85, "danger"],
  ])("%f °C is %s", (c, level) => {
    expect(tempLevel(c)).toBe(level);
  });
});

describe("describeFault", () => {
  it("describes code 0 as no fault", () => {
    expect(describeFault(0).name).toBe("No fault");
  });

  it("names the common codes", () => {
    expect(describeFault(1).name).toBe("Over voltage");
    expect(describeFault(2).name).toBe("Under voltage");
    expect(describeFault(5).name).toBe("Controller too hot");
  });

  it("falls back to the number for codes that vary between VESC versions", () => {
    const f = describeFault(17);
    expect(f.name).toBe("Fault code 17");
    expect(f.hint).toMatch(/VESC Tool/);
  });
});
