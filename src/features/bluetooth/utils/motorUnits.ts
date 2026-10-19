import { t } from "@/src/i18n";

/**
 * Speed unit conversions.
 *
 * The VESC (and the VESC Tool's fields labelled "RPM") work in ELECTRICAL RPM
 * (ERPM). Mechanical speed follows from the motor's pole pairs and the total
 * motor→crank ratio:
 *
 *   motor RPM = ERPM / pole pairs
 *   crank RPM = motor RPM / total ratio
 *
 * Triare bench values: 60BLF motor (8 poles = 4 pole pairs), 10:1 reducer
 * => crank RPM = ERPM / 40. Update DEFAULT_TOTAL_RATIO if chain/sprockets
 * change the total ratio.
 */
export const MOTOR_POLE_PAIRS = 4;

/** Motor revolutions per crank revolution (reducer × chain). */
export const DEFAULT_TOTAL_RATIO = 10;

export type SpeedUnit = "erpm" | "motorRpm" | "crankRpm";

/** Name of a unit in the language in use. */
export function speedUnitLabel(unit: SpeedUnit): string {
  return t(`unit.${unit}` as const);
}

export function erpmToMotorRpm(erpm: number, polePairs = MOTOR_POLE_PAIRS): number {
  return erpm / polePairs;
}

export function erpmToCrankRpm(
  erpm: number,
  totalRatio = DEFAULT_TOTAL_RATIO,
  polePairs = MOTOR_POLE_PAIRS,
): number {
  return erpm / (polePairs * totalRatio);
}

/** Converts a value entered in `unit` to the ERPM the firmware expects. */
export function toErpm(
  value: number,
  unit: SpeedUnit,
  totalRatio = DEFAULT_TOTAL_RATIO,
  polePairs = MOTOR_POLE_PAIRS,
): number {
  switch (unit) {
    case "erpm":
      return value;
    case "motorRpm":
      return value * polePairs;
    case "crankRpm":
      return value * polePairs * totalRatio;
  }
}

/** Converts ERPM to the given display unit. */
export function fromErpm(
  erpm: number,
  unit: SpeedUnit,
  totalRatio = DEFAULT_TOTAL_RATIO,
  polePairs = MOTOR_POLE_PAIRS,
): number {
  switch (unit) {
    case "erpm":
      return erpm;
    case "motorRpm":
      return erpmToMotorRpm(erpm, polePairs);
    case "crankRpm":
      return erpmToCrankRpm(erpm, totalRatio, polePairs);
  }
}

/** "1234 ERPM" style label; null/NaN renders as an em dash. */
export function formatSpeed(erpm: number | null | undefined, unit: SpeedUnit, totalRatio = DEFAULT_TOTAL_RATIO): string {
  if (erpm == null || !Number.isFinite(erpm)) return "—";
  const value = fromErpm(erpm, unit, totalRatio);
  const digits = unit === "erpm" ? 0 : 1;
  return `${value.toFixed(digits)} ${speedUnitLabel(unit)}`;
}
