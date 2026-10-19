import { hasTranslation, t } from "@/src/i18n";

/**
 * What the numbers mean: limits to color them and plain-language text for the
 * motor controller's fault codes.
 *
 * The limits are the values configured for the 24 V / NMC 7S pack on the
 * FSESC 6.7 Pro (VESC Tool: cutoff 22 V start / 20 V end, input maximum 30 V,
 * regeneration limited from 28 V). On the bench supply the cutoffs are lower
 * (18 V / 15 V), so the bar may look conservative there. If the VESC
 * configuration changes, change it here too: this file is the only place.
 */
export type Level = "ok" | "warn" | "danger";

export const TELEMETRY_LIMITS = {
  voltage: { dangerLow: 20, warnLow: 22, warnHigh: 28, dangerHigh: 30 },
  /** FET temperature in °C (VESC derates from about 85 °C by default). */
  tempFet: { warn: 70, danger: 85 },
} as const;

export function voltageLevel(volts: number): Level {
  const v = TELEMETRY_LIMITS.voltage;
  if (!Number.isFinite(volts)) return "ok";
  if (volts <= v.dangerLow || volts >= v.dangerHigh) return "danger";
  if (volts < v.warnLow || volts > v.warnHigh) return "warn";
  return "ok";
}

export function tempLevel(celsius: number): Level {
  const t = TELEMETRY_LIMITS.tempFet;
  if (!Number.isFinite(celsius)) return "ok";
  if (celsius >= t.danger) return "danger";
  if (celsius >= t.warn) return "warn";
  return "ok";
}

export type FaultInfo = { name: string; hint: string };

/**
 * Codes 1 to 13 are the same on every VESC firmware and have names in the
 * language files (`fault.<code>.name` / `.hint`). From 14 on the numbering
 * differs between VESC firmware versions, so those are not named: the screen
 * shows the number and sends the reader to VESC Tool.
 */
export function describeFault(code: number): FaultInfo {
  if (code === 0) {
    return { name: t("fault.none.name"), hint: t("fault.none.hint") };
  }
  const nameKey = `fault.${code}.name`;
  const hintKey = `fault.${code}.hint`;
  if (hasTranslation(nameKey) && hasTranslation(hintKey)) {
    return { name: t(nameKey), hint: t(hintKey) };
  }
  return { name: t("fault.unknown.name", { code }), hint: t("fault.unknown.hint") };
}
