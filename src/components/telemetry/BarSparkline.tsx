import { colors } from "@/src/theme";
import React from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  /** One value per bucket, oldest first; null leaves a gap. */
  values: (number | null)[];
  /** Value at the bottom of the chart. */
  min: number;
  /** Value at the top of the chart. */
  max: number;
  /** Draw bars from zero (for signed values such as current) instead of from `min`. */
  fromZero?: boolean;
  height?: number;
  color?: string;
  accessibilityLabel?: string;
};

/**
 * Tiny bar chart for the last ~30 s of a measurement.
 *
 * Bars rather than a line on purpose: it needs no native drawing library (so
 * no new build of the app), costs one small View per bucket, and a gap in the
 * data is visible as a missing bar.
 */
export function BarSparkline({
  values,
  min,
  max,
  fromZero = false,
  height = 40,
  color = colors.primary,
  accessibilityLabel,
}: Props) {
  const span = max - min > 0 ? max - min : 1;
  const yOf = (v: number) => ((max - Math.min(max, Math.max(min, v))) / span) * height;
  const baseValue = fromZero ? Math.min(max, Math.max(min, 0)) : min;
  const yBase = yOf(baseValue);
  const n = values.length;
  const barWidth = `${100 / n}%` as const;

  return (
    <View
      style={[styles.box, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {fromZero && min < 0 && max > 0 && <View style={[styles.zeroLine, { top: yBase }]} />}
      {values.map((v, i) => {
        if (v === null) return null;
        const y = yOf(v);
        const top = Math.min(y, yBase);
        const barHeight = Math.max(1.5, Math.abs(y - yBase));
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: `${(i / n) * 100}%`,
              width: barWidth,
              top: Math.min(top, height - barHeight),
              height: barHeight,
              paddingHorizontal: 0.5,
            }}
          >
            <View style={[styles.bar, { backgroundColor: color }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
    overflow: "hidden",
  },
  zeroLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  bar: {
    flex: 1,
    borderRadius: 1.5,
  },
});
