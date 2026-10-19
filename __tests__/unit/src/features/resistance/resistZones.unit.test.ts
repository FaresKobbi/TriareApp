import {
  assistFactorAt,
  boardAngleToLeg,
  crankRpmToErpm,
  effortMap,
  legAngleToBoard,
  parseDecimal,
  toBoardZones,
  wrap360,
  zoneProblem,
  zonesProblem,
  ZoneDraft,
} from "@/src/features/resistance/zones";

const valley: ZoneDraft = { startDeg: 90, endDeg: 180, valuePercent: 0, edgeDeg: 15 };

describe("assistFactorAt (same maths as the firmware)", () => {
  it("is 1 everywhere without zones", () => {
    expect(assistFactorAt([], 0)).toBe(1);
    expect(assistFactorAt([], 200)).toBe(1);
  });

  it("is the zone's percentage inside and 1 well outside", () => {
    expect(assistFactorAt([valley], 135)).toBe(0);
    expect(assistFactorAt([valley], 90)).toBe(0);
    expect(assistFactorAt([valley], 180)).toBe(0);
    expect(assistFactorAt([valley], 300)).toBe(1);
    expect(assistFactorAt([{ ...valley, valuePercent: 40 }], 135)).toBeCloseTo(0.4);
  });

  it("ramps smoothly over the edge, halfway at half the edge", () => {
    expect(assistFactorAt([valley], 82.5)).toBeCloseTo(0.5, 5); // 7.5° before the start
    expect(assistFactorAt([valley], 187.5)).toBeCloseTo(0.5, 5); // 7.5° after the end
    expect(assistFactorAt([valley], 75)).toBe(1);
    expect(assistFactorAt([valley], 195)).toBe(1);
  });

  it("works across 0°", () => {
    const wrap: ZoneDraft = { startDeg: 340, endDeg: 20, valuePercent: 0, edgeDeg: 0 };
    expect(assistFactorAt([wrap], 355)).toBe(0);
    expect(assistFactorAt([wrap], 5)).toBe(0);
    expect(assistFactorAt([wrap], 180)).toBe(1);
  });

  it("a full turn applies everywhere, and the strictest zone wins", () => {
    expect(assistFactorAt([{ startDeg: 0, endDeg: 360, valuePercent: 30, edgeDeg: 15 }], 123)).toBeCloseTo(0.3);
    expect(assistFactorAt([{ ...valley, valuePercent: 50 }, valley], 135)).toBe(0);
  });
});

describe("effortMap", () => {
  it("has one value per slice, taken at the centre of the slice", () => {
    const map = effortMap([valley], 72);
    expect(map).toHaveLength(72);
    expect(map[0]).toBe(1); // 2.5°
    expect(map[27]).toBe(0); // 137.5°
  });
});

describe("legs", () => {
  it("the right pedal is half a turn from the left, and the conversion undoes itself", () => {
    expect(legAngleToBoard(30, "left")).toBe(30);
    expect(legAngleToBoard(30, "right")).toBe(210);
    expect(legAngleToBoard(300, "right")).toBe(120);
    expect(boardAngleToLeg(legAngleToBoard(77, "right"), "right")).toBeCloseTo(77);
  });

  it("shifts zones for the right leg and numbers them from 0", () => {
    const zones = toBoardZones([valley, { ...valley, startDeg: 200, endDeg: 300 }], "right");
    expect(zones.map((z) => z.index)).toEqual([0, 1]);
    expect(zones[0]).toMatchObject({ startDeg: 270, endDeg: 0 });
    expect(zones[1]).toMatchObject({ startDeg: 20, endDeg: 120 });
    expect(toBoardZones([valley], "left")[0]).toMatchObject({ startDeg: 90, endDeg: 180 });
  });

  it("keeps a full turn a full turn", () => {
    const full: ZoneDraft = { startDeg: 0, endDeg: 360, valuePercent: 50, edgeDeg: 15 };
    expect(toBoardZones([full], "right")[0]).toMatchObject({ startDeg: 0, endDeg: 360 });
  });
});

describe("validation", () => {
  it("names the problem", () => {
    expect(zoneProblem(valley)).toBeNull();
    expect(zoneProblem({ ...valley, startDeg: -1 })).toBe("angle");
    expect(zoneProblem({ ...valley, endDeg: 400 })).toBe("angle");
    expect(zoneProblem({ ...valley, endDeg: 90.4 })).toBe("length");
    expect(zoneProblem({ ...valley, valuePercent: 120 })).toBe("percent");
    expect(zoneProblem({ ...valley, edgeDeg: 70 })).toBe("edge");
    expect(zoneProblem({ ...valley, startDeg: NaN })).toBe("angle");
    expect(zonesProblem(Array(9).fill(valley))).toBe("count");
    expect(zonesProblem([valley, { ...valley, valuePercent: -5 }])).toBe("percent");
    expect(zonesProblem([valley])).toBeNull();
  });
});

describe("numbers", () => {
  it("converts crank RPM to the ERPM the board wants", () => {
    // ERPM = crank RPM × 4 pole pairs × ratio
    expect(crankRpmToErpm(20, 10)).toBe(800);
    expect(crankRpmToErpm(15, 1)).toBe(60);
  });

  it("parses comma or dot decimals", () => {
    expect(parseDecimal("0,5")).toBe(0.5);
    expect(parseDecimal(" 12.5 ")).toBe(12.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });

  it("wraps angles", () => {
    expect(wrap360(-10)).toBe(350);
    expect(wrap360(370)).toBe(10);
  });
});
