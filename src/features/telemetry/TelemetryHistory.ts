import { TelemetryData } from "../bluetooth/protocol/TriareFrames";

/** One stored sample. `t` is the phone's clock (ms) when it arrived. */
export type HistorySample = {
  t: number;
  erpm: number;
  current: number;
  voltage: number;
  temp: number;
  angle: number;
  fault: number;
};

export type HistoryField = "erpm" | "current" | "voltage" | "temp";

/** What a chart needs: one mean per time bucket (null = no data) and the range. */
export type HistorySeries = {
  values: (number | null)[];
  min: number | null;
  max: number | null;
};

/** 60 s at the 20 Hz stream rate. */
export const DEFAULT_HISTORY_CAPACITY = 1200;

/**
 * Fixed-size ring buffer of recent telemetry.
 *
 * It lives outside React state on purpose: the stream delivers 20 samples a
 * second, and re-rendering the screen for each one just to keep a history
 * would waste the phone's battery. Charts read it at a slower rate through
 * {@link series}, which averages the samples into a few dozen buckets (that
 * also smooths the noise of the motor controller's readings).
 */
export class TelemetryHistory {
  private readonly items: (HistorySample | undefined)[];
  private head = 0; // next write position
  private count = 0;

  constructor(readonly capacity = DEFAULT_HISTORY_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError("capacity must be a positive integer");
    }
    this.items = new Array(capacity);
  }

  get length(): number {
    return this.count;
  }

  push(sample: TelemetryData, t: number = Date.now()): void {
    this.items[this.head] = {
      t,
      erpm: sample.rpm,
      current: sample.current,
      voltage: sample.voltage,
      temp: sample.temp,
      angle: sample.crankAngleDeg,
      fault: sample.fault,
    };
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count += 1;
  }

  clear(): void {
    this.items.fill(undefined);
    this.head = 0;
    this.count = 0;
  }

  /** Newest sample, or null when empty. */
  latest(): HistorySample | null {
    if (this.count === 0) return null;
    return this.items[(this.head - 1 + this.capacity) % this.capacity] ?? null;
  }

  /** Calls `fn` from the oldest to the newest sample. */
  forEach(fn: (sample: HistorySample) => void): void {
    const start = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) {
      const sample = this.items[(start + i) % this.capacity];
      if (sample) fn(sample);
    }
  }

  /**
   * Averages `field` into `buckets` equal slices of the last `windowMs`
   * (ending at `now`). Slices without samples are null, so pauses show up as
   * gaps instead of a line that invents data.
   */
  series(
    field: HistoryField,
    windowMs: number,
    buckets: number,
    now: number = Date.now(),
  ): HistorySeries {
    const sums = new Array<number>(buckets).fill(0);
    const counts = new Array<number>(buckets).fill(0);
    const start = now - windowMs;
    const bucketMs = windowMs / buckets;

    this.forEach((sample) => {
      if (sample.t < start || sample.t > now) return;
      const idx = Math.min(buckets - 1, Math.floor((sample.t - start) / bucketMs));
      const value = sample[field];
      if (!Number.isFinite(value)) return;
      sums[idx] += value;
      counts[idx] += 1;
    });

    let min: number | null = null;
    let max: number | null = null;
    const values = sums.map((sum, i) => {
      if (counts[i] === 0) return null;
      const mean = sum / counts[i];
      if (min === null || mean < min) min = mean;
      if (max === null || mean > max) max = mean;
      return mean;
    });
    return { values, min, max };
  }
}
