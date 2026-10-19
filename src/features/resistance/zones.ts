import { ResistZoneInput } from "../bluetooth/protocol/CommandCodec";
import { RESIST_MAX_EDGE_DEG, RESIST_MAX_ZONES } from "../bluetooth/constants/triareProtocol";
import { toErpm } from "../bluetooth/utils/motorUnits";

/**
 * Zones of reduced help, as the physiotherapist thinks of them: angles of the
 * pedal of the leg being worked. The board only knows the crank angle of the
 * left pedal, so `toBoardZones` converts.
 *
 * `assistFactorAt` repeats the firmware's calculation (triare_resist.c) so the
 * app can draw what the board will do. If one changes, change the other.
 */
export type Leg = "left" | "right";

export type ZoneDraft = {
  startDeg: number;
  endDeg: number;
  /** Percentage of the assist kept inside the zone, 0–100. */
  valuePercent: number;
  /** Smooth edge outside the zone, degrees. */
  edgeDeg: number;
};

export const DEFAULT_EDGE_DEG = 15;

export function wrap360(angle: number): number {
  const a = angle % 360;
  return a < 0 ? a + 360 : a;
}

function smoothstep01(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/** How strongly `theta` belongs to the zone: 1 inside, falling smoothly to 0 over `edgeDeg` outside. */
function zoneWeight(zone: ZoneDraft, theta: number): number {
  let length = zone.endDeg - zone.startDeg;
  if (length < 0) length += 360;
  if (length >= 360) return 1;
  const u = wrap360(theta - zone.startDeg);
  if (u <= length) return 1;
  if (zone.edgeDeg <= 0) return 0;
  const after = u - length;
  const before = 360 - u;
  const d = Math.min(after, before);
  if (d >= zone.edgeDeg) return 0;
  return 1 - smoothstep01(d / zone.edgeDeg);
}

/** Fraction of the assist applied at `theta` (0–1). With several zones the strictest wins. */
export function assistFactorAt(zones: readonly ZoneDraft[], theta: number): number {
  let factor = 1;
  for (const zone of zones) {
    const f = 1 - zoneWeight(zone, theta) * (1 - zone.valuePercent / 100);
    if (f < factor) factor = f;
  }
  return factor;
}

/** The assist fraction at the centre of each of `cells` equal slices of the turn. */
export function effortMap(zones: readonly ZoneDraft[], cells = 72): number[] {
  const step = 360 / cells;
  return Array.from({ length: cells }, (_, i) => assistFactorAt(zones, (i + 0.5) * step));
}

/**
 * Angle of the pedal of `leg` ↔ crank angle the board reports. The right pedal
 * is always opposite the left one, so the conversion is a half turn and is its
 * own inverse.
 */
export function legAngleToBoard(angle: number, leg: Leg): number {
  return leg === "right" ? wrap360(angle + 180) : wrap360(angle);
}

export const boardAngleToLeg = legAngleToBoard;

/** Zones ready to send: shifted for the leg, numbered from 0. */
export function toBoardZones(zones: readonly ZoneDraft[], leg: Leg): ResistZoneInput[] {
  return zones.map((zone, index) => {
    const fullTurn = zone.endDeg - zone.startDeg >= 360;
    return {
      index,
      startDeg: fullTurn ? 0 : legAngleToBoard(zone.startDeg, leg),
      endDeg: fullTurn ? 360 : legAngleToBoard(zone.endDeg, leg),
      valuePercent: zone.valuePercent,
      edgeDeg: zone.edgeDeg,
    };
  });
}

/** Why zones cannot be sent. The code is the end of the `resist.zones.error.*` text key. */
export type ZoneProblem = "angle" | "length" | "percent" | "edge" | "count";

/** Why one zone cannot be sent (null = fine). */
export function zoneProblem(zone: ZoneDraft): Exclude<ZoneProblem, "count"> | null {
  const { startDeg, endDeg, valuePercent, edgeDeg } = zone;
  if (![startDeg, endDeg, valuePercent, edgeDeg].every(Number.isFinite)) return "angle";
  if (startDeg < 0 || startDeg > 360 || endDeg < 0 || endDeg > 360) return "angle";
  let length = endDeg - startDeg;
  if (length < 0) length += 360;
  if (length < 1) return "length";
  if (valuePercent < 0 || valuePercent > 100) return "percent";
  if (!Number.isInteger(edgeDeg) || edgeDeg < 0 || edgeDeg > RESIST_MAX_EDGE_DEG) return "edge";
  return null;
}

/** First problem in a list of zones (including too many), or null. */
export function zonesProblem(zones: readonly ZoneDraft[]): ZoneProblem | null {
  if (zones.length > RESIST_MAX_ZONES) return "count";
  for (const zone of zones) {
    const problem = zoneProblem(zone);
    if (problem) return problem;
  }
  return null;
}

/** The ERPM the board needs for a cadence typed in crank RPM. */
export function crankRpmToErpm(crankRpm: number, gearRatio: number): number {
  return toErpm(crankRpm, "crankRpm", gearRatio);
}

/** Parses "12,5" or "12.5"; empty or non-numeric text gives null. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
