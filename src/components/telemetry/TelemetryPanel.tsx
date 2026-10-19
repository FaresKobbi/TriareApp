import { TelemetryData } from "@/src/features/bluetooth/protocol/TriareFrames";
import { erpmToCrankRpm, erpmToMotorRpm } from "@/src/features/bluetooth/utils/motorUnits";
import { paddedRange } from "@/src/features/telemetry/chartRange";
import { TelemetryHistory } from "@/src/features/telemetry/TelemetryHistory";
import {
  describeFault,
  tempLevel,
  voltageLevel,
} from "@/src/features/telemetry/telemetryInfo";
import { useI18n } from "@/src/i18n";
import { colors, spacing } from "@/src/theme";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BarSparkline } from "./BarSparkline";
import { MetricTile } from "./MetricTile";

/** Time shown by the mini charts, and how many bars they get. */
const WINDOW_MS = 30_000;
const BUCKETS = 40;

type Props = {
  sample: TelemetryData | null;
  history: TelemetryHistory;
  /** Bumped by `useTelemetryHistory` a few times a second; redraws the charts. */
  version: number;
  /** Motor revolutions per crank revolution (the gear ratio field). */
  totalRatio: number;
  /** True while the Live telemetry switch is on. */
  live: boolean;
};

/**
 * Engineering view of the telemetry: one tile per measurement, each with a
 * colored status where there is a known limit, a 30 s mini chart where the
 * trend matters, and a tap-to-explain text. The same data will feed a simpler
 * panel for the physiotherapist later.
 */
export function TelemetryPanel({ sample, history, version, totalRatio, live }: Props) {
  const { t } = useI18n();
  // `version` is the redraw clock: charts are recomputed when it changes.
  const charts = useMemo(() => {
    const now = Date.now();
    const speed = history.series("erpm", WINDOW_MS, BUCKETS, now);
    const current = history.series("current", WINDOW_MS, BUCKETS, now);
    const voltage = history.series("voltage", WINDOW_MS, BUCKETS, now);
    const temp = history.series("temp", WINDOW_MS, BUCKETS, now);
    const toCrank = (v: number | null) => (v === null ? null : erpmToCrankRpm(v, totalRatio));
    const speedValues = speed.values.map(toCrank);
    const present = speedValues.filter((v): v is number => v !== null);
    return {
      speed: {
        values: speedValues,
        range: paddedRange(
          present.length ? Math.min(...present) : null,
          present.length ? Math.max(...present) : null,
          10,
          true,
        ),
      },
      current: { values: current.values, range: paddedRange(current.min, current.max, 2, true) },
      voltage: { values: voltage.values, range: paddedRange(voltage.min, voltage.max, 2) },
      temp: { values: temp.values, range: paddedRange(temp.min, temp.max, 10) },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, version, totalRatio]);

  if (!sample) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {live ? t("telemetry.waiting") : t("telemetry.turnOn")}
        </Text>
      </View>
    );
  }

  const crankRpm = erpmToCrankRpm(sample.rpm, totalRatio);
  const motorRpm = erpmToMotorRpm(sample.rpm);
  const fault = describeFault(sample.fault);

  return (
    <View style={styles.grid}>
      <MetricTile
        wide
        icon="speedometer-outline"
        label={t("tile.speed.label")}
        value={crankRpm.toFixed(1)}
        unit="RPM"
        detail={t("tile.speed.detail", {
          motor: motorRpm.toFixed(0),
          erpm: sample.rpm.toFixed(0),
        })}
        hint={t("tile.speed.hint")}
      >
        <BarSparkline
          values={charts.speed.values}
          min={charts.speed.range.min}
          max={charts.speed.range.max}
          fromZero
          accessibilityLabel={t("tile.speed.chart")}
        />
      </MetricTile>

      <MetricTile
        icon="flash-outline"
        label={t("tile.current.label")}
        value={sample.current.toFixed(1)}
        unit="A"
        hint={t("tile.current.hint")}
      >
        <BarSparkline
          values={charts.current.values}
          min={charts.current.range.min}
          max={charts.current.range.max}
          fromZero
          accessibilityLabel={t("tile.current.chart")}
        />
      </MetricTile>

      <MetricTile
        icon="battery-half-outline"
        label={t("tile.voltage.label")}
        value={sample.voltage.toFixed(1)}
        unit="V"
        level={voltageLevel(sample.voltage)}
        hint={t("tile.voltage.hint")}
      >
        <BarSparkline
          values={charts.voltage.values}
          min={charts.voltage.range.min}
          max={charts.voltage.range.max}
          accessibilityLabel={t("tile.voltage.chart")}
        />
      </MetricTile>

      <MetricTile
        icon="thermometer-outline"
        label={t("tile.temp.label")}
        value={sample.temp.toFixed(1)}
        unit="°C"
        level={tempLevel(sample.temp)}
        hint={t("tile.temp.hint")}
      >
        <BarSparkline
          values={charts.temp.values}
          min={charts.temp.range.min}
          max={charts.temp.range.max}
          accessibilityLabel={t("tile.temp.chart")}
        />
      </MetricTile>

      <MetricTile
        icon={sample.fault === 0 ? "checkmark-circle-outline" : "warning-outline"}
        label={t("tile.fault.label")}
        value={fault.name}
        level={sample.fault === 0 ? "ok" : "danger"}
        detail={sample.fault === 0 ? undefined : fault.hint}
        hint={
          sample.fault === 0
            ? t("tile.fault.okHint")
            : t("tile.fault.withCode", { hint: fault.hint, code: sample.fault })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  empty: {
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  emptyText: { fontSize: 13, color: colors.textMuted },
});
