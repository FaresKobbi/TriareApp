/**
 * Vertical range for a mini chart.
 *
 * - No data: a harmless default range.
 * - A flat signal gets at least `minSpan` of height, so noise is not stretched
 *   into a fake mountain range.
 * - `includeZero` keeps zero visible (signed values such as current or reverse
 *   speed), which is where the bars start from.
 * - A small margin keeps the extremes off the edges.
 */
export function paddedRange(
  min: number | null,
  max: number | null,
  minSpan: number,
  includeZero = false,
): { min: number; max: number } {
  if (min === null || max === null) return { min: 0, max: minSpan };
  let lo = includeZero ? Math.min(min, 0) : min;
  let hi = includeZero ? Math.max(max, 0) : max;
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = Math.min(lo, mid - minSpan / 2);
    hi = Math.max(hi, mid + minSpan / 2);
  }
  const pad = (hi - lo) * 0.08;
  return { min: lo - pad, max: hi + pad };
}
