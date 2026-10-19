import { TelemetryData } from "@/src/features/bluetooth/protocol/TriareFrames";
import { paddedRange } from "@/src/features/telemetry/chartRange";
import { TelemetryHistory } from "@/src/features/telemetry/TelemetryHistory";

function sample(overrides: Partial<TelemetryData> = {}): TelemetryData {
  return { rpm: 0, current: 0, voltage: 25, temp: 30, crankAngleDeg: 0, fault: 0, ...overrides };
}

describe("TelemetryHistory", () => {
  it("rejects an invalid capacity", () => {
    expect(() => new TelemetryHistory(0)).toThrow(RangeError);
    expect(() => new TelemetryHistory(1.5)).toThrow(RangeError);
  });

  it("starts empty", () => {
    const h = new TelemetryHistory(4);
    expect(h.length).toBe(0);
    expect(h.latest()).toBeNull();
  });

  it("stores samples with the given time and exposes the newest", () => {
    const h = new TelemetryHistory(4);
    h.push(sample({ rpm: 100, current: 2 }), 1000);
    h.push(sample({ rpm: 200, current: 3 }), 1050);
    expect(h.length).toBe(2);
    expect(h.latest()).toMatchObject({ t: 1050, erpm: 200, current: 3 });
  });

  it("overwrites the oldest samples once full and iterates oldest to newest", () => {
    const h = new TelemetryHistory(3);
    for (let i = 1; i <= 5; i++) h.push(sample({ rpm: i }), i * 10);
    expect(h.length).toBe(3);
    const seen: number[] = [];
    h.forEach((s) => seen.push(s.erpm));
    expect(seen).toEqual([3, 4, 5]);
    expect(h.latest()?.erpm).toBe(5);
  });

  it("clear() empties the buffer", () => {
    const h = new TelemetryHistory(3);
    h.push(sample(), 1);
    h.clear();
    expect(h.length).toBe(0);
    expect(h.latest()).toBeNull();
    h.push(sample({ rpm: 7 }), 2);
    expect(h.latest()?.erpm).toBe(7);
  });

  describe("series", () => {
    it("averages samples into equal time buckets and leaves gaps as null", () => {
      const h = new TelemetryHistory(100);
      // window 1000 ms, 4 buckets of 250 ms, ending at now = 2000 (start = 1000)
      h.push(sample({ current: 2 }), 1100); // bucket 0
      h.push(sample({ current: 4 }), 1200); // bucket 0
      h.push(sample({ current: 10 }), 1800); // bucket 3 (1750..2000)
      const s = h.series("current", 1000, 4, 2000);
      expect(s.values).toEqual([3, null, null, 10]);
      expect(s.min).toBe(3);
      expect(s.max).toBe(10);
    });

    it("ignores samples outside the window", () => {
      const h = new TelemetryHistory(100);
      h.push(sample({ voltage: 20 }), 500); // too old
      h.push(sample({ voltage: 26 }), 1500);
      h.push(sample({ voltage: 30 }), 2500); // in the future
      const s = h.series("voltage", 1000, 2, 2000);
      expect(s.values).toEqual([null, 26]);
    });

    it("puts a sample taken exactly at `now` in the last bucket", () => {
      const h = new TelemetryHistory(10);
      h.push(sample({ temp: 55 }), 2000);
      expect(h.series("temp", 1000, 5, 2000).values[4]).toBe(55);
    });

    it("reports null min/max when there is no data", () => {
      const h = new TelemetryHistory(10);
      expect(h.series("erpm", 1000, 3, 2000)).toEqual({ values: [null, null, null], min: null, max: null });
    });

    it("skips non-finite readings instead of poisoning the average", () => {
      const h = new TelemetryHistory(10);
      h.push(sample({ current: NaN }), 1500);
      h.push(sample({ current: 6 }), 1600);
      expect(h.series("current", 1000, 1, 2000).values).toEqual([6]);
    });
  });
});

describe("paddedRange", () => {
  it("returns a default range without data", () => {
    expect(paddedRange(null, null, 2)).toEqual({ min: 0, max: 2 });
  });

  it("gives a flat signal at least minSpan of height, centered on it", () => {
    const r = paddedRange(25, 25, 2);
    expect(r.max - r.min).toBeGreaterThanOrEqual(2);
    expect((r.min + r.max) / 2).toBeCloseTo(25, 5);
  });

  it("keeps zero visible when asked, for all-positive and all-negative data", () => {
    const pos = paddedRange(5, 9, 2, true);
    expect(pos.min).toBeLessThanOrEqual(0);
    expect(pos.max).toBeGreaterThanOrEqual(9);
    const neg = paddedRange(-8, -3, 2, true);
    expect(neg.max).toBeGreaterThanOrEqual(0);
    expect(neg.min).toBeLessThanOrEqual(-8);
  });

  it("always returns min < max", () => {
    for (const [a, b] of [[0, 0], [3, 3], [-1, 1], [null, 5]] as const) {
      const r = paddedRange(a, b as number | null, 1, true);
      expect(r.min).toBeLessThan(r.max);
    }
  });
});
