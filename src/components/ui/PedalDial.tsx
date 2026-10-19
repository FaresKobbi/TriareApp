import { useI18n } from "@/src/i18n";
import { colors } from "@/src/theme";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

type PedalDialProps = {
  /**
   * Crank angle in degrees from telemetry (`crankAngleDeg`). 0° is the top,
   * increasing clockwise; the left pedal sits at this angle and the right
   * pedal at +180°. `null` (no data yet) leaves the dial dimmed and still.
   */
  angleDeg: number | null;
  size?: number;
  /**
   * Changes on every telemetry sample (pass the sample object itself). Needed
   * because two consecutive samples can carry the same angle (crank stopped),
   * and the dial must still register that as "no motion" rather than keep
   * coasting. Falls back to `angleDeg` changes when omitted.
   */
  sampleId?: unknown;
  /**
   * The board's own clock (ms, wraps at 2^32) when this sample was taken, for
   * streamed samples. With it the crank speed is estimated from the real time
   * between motor-controller readings instead of the time the sample reached
   * the phone, which removes the jitter of the radio link. Omit it for polled
   * or manual samples (the phone's clock is used).
   */
  sampleTimeMs?: number;
  /** Expected time between samples; only the starting guess, it self-adjusts. */
  intervalMs?: number;
  /**
   * Keep moving at the estimated crank speed until the next sample arrives
   * (dead reckoning), so the dial looks real-time even at low poll rates.
   * Extrapolates for one interval at most, so it never spins on stale data.
   */
  extrapolate?: boolean;
  leftColor?: string;
  rightColor?: string;
  showAngle?: boolean;
};

const MIN_DT_MS = 20; // closer samples are noise for a speed estimate
const STALE_MS = 1000; // longer gap: forget the old speed
const MAX_STEP_DEG = 150; // bigger step per sample is probably aliasing
const VELOCITY_ALPHA = 0.5;
const MIN_GLIDE_MS = 40; // at most one 20 Hz stream interval
const MAX_GLIDE_MS = 400;

/** Smallest signed difference `to - from` on a 360° circle, in (-180, 180]. */
export function shortestDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * Animated crank/pedal indicator.
 *
 * The animated value is an *unwrapped* angle that keeps accumulating, so a
 * jump from 350° to 10° glides +20° forward instead of spinning back 340°.
 *
 * On each sample it estimates the crank speed from the last two samples and
 * animates toward where the pedal should be when the *next* sample is due
 * (dead reckoning). The next sample then corrects the position smoothly,
 * because every new animation starts from the current displayed value.
 * Only transforms are animated, so it runs on the native thread.
 */
export function PedalDial({
  angleDeg,
  size = 160,
  sampleId,
  sampleTimeMs,
  intervalMs = 150,
  extrapolate = true,
  leftColor = colors.warning,
  rightColor = colors.primary,
  showAngle = true,
}: PedalDialProps) {
  const { t } = useI18n();
  const valid = angleDeg != null && Number.isFinite(angleDeg);

  const unwrapped = useRef(new Animated.Value(0)).current;
  const lastRaw = useRef<number | null>(null);
  const lastAt = useRef(0);
  const sampleAngle = useRef(0); // unwrapped angle of the latest sample
  const velocity = useRef(0); // smoothed, degrees per second
  const interval = useRef(intervalMs); // smoothed ms between samples
  const lastClockIsBoard = useRef(false); // which clock `lastAt` is on

  useEffect(() => {
    if (!valid) return;
    const raw = (((angleDeg as number) % 360) + 360) % 360;
    const boardClock = sampleTimeMs != null;
    const now = boardClock ? (sampleTimeMs as number) : Date.now();
    // Switching between streamed and polled samples changes the clock: the
    // difference between the two is meaningless, so start the speed over.
    const clockChanged = lastRaw.current != null && lastClockIsBoard.current !== boardClock;
    lastClockIsBoard.current = boardClock;

    if (lastRaw.current == null) {
      // First sample: snap, don't spin from 0°.
      sampleAngle.current = raw;
      unwrapped.setValue(raw);
    } else {
      // `>>> 0` keeps the difference right when the board's 32-bit clock wraps.
      const dtMs = clockChanged ? 0 : boardClock ? (now - lastAt.current) >>> 0 : now - lastAt.current;
      const delta = shortestDelta(lastRaw.current, raw);
      sampleAngle.current += delta;

      const plausible =
        dtMs >= MIN_DT_MS && dtMs <= STALE_MS && Math.abs(delta) < MAX_STEP_DEG;
      let duration = intervalMs;
      if (plausible) {
        velocity.current =
          velocity.current * (1 - VELOCITY_ALPHA) +
          ((delta / dtMs) * 1000) * VELOCITY_ALPHA;
        interval.current = interval.current * 0.7 + dtMs * 0.3;
        duration = Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, interval.current));
      } else if (clockChanged || dtMs > STALE_MS || Math.abs(delta) >= MAX_STEP_DEG) {
        // Gap or aliased jump: don't trust the old speed.
        velocity.current = 0;
      }

      const ahead = extrapolate ? (velocity.current * duration) / 1000 : 0;
      Animated.timing(unwrapped, {
        toValue: sampleAngle.current + ahead,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    }
    lastRaw.current = raw;
    lastAt.current = now;
  }, [angleDeg, sampleId, sampleTimeMs, valid, intervalMs, extrapolate, unwrapped]);

  useEffect(() => () => unwrapped.stopAnimation(), [unwrapped]);

  const rotate = unwrapped.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  const r = size / 2;
  const pedal = size * 0.2;
  const armWidth = Math.max(4, size * 0.05);
  const hub = size * 0.12;
  const armLength = r - pedal / 2;

  // One arm drawn pointing up from the centre; the second is the same arm
  // rotated 180°.
  const arm = (color: string) => (
    <>
      <View
        style={{
          position: "absolute",
          left: r - armWidth / 2,
          top: pedal / 2,
          width: armWidth,
          height: armLength,
          borderRadius: armWidth / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: r - pedal / 2,
          top: 0,
          width: pedal,
          height: pedal,
          borderRadius: pedal / 2,
          backgroundColor: color,
        }}
      />
    </>
  );

  const label =
    valid && showAngle ? `${Math.round(((angleDeg as number) % 360 + 360) % 360)}°` : "--";

  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityLabel={
        valid ? t("dial.position", { angle: label }) : t("dial.unavailable")
      }
    >
      <View style={{ width: size, height: size, opacity: valid ? 1 : 0.35 }}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: r,
              borderWidth: 2,
              borderColor: colors.border,
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        />
        {/* 12 o'clock reference tick */}
        <View
          style={{
            position: "absolute",
            left: r - 1,
            top: 2,
            width: 2,
            height: size * 0.06,
            backgroundColor: colors.textLight,
          }}
        />
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
          {arm(leftColor)}
          <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: "180deg" }] }]}>
            {arm(rightColor)}
          </View>
        </Animated.View>
        <View
          style={{
            position: "absolute",
            left: r - hub / 2,
            top: r - hub / 2,
            width: hub,
            height: hub,
            borderRadius: hub / 2,
            backgroundColor: colors.text,
          }}
        />
      </View>
      {showAngle && <Text style={styles.angle}>{label}</Text>}
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: leftColor }]} />
        <Text style={styles.legendText}>{t("dial.left")}</Text>
        <View style={[styles.dot, { backgroundColor: rightColor }]} />
        <Text style={styles.legendText}>{t("dial.right")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 6 },
  angle: {
    fontFamily: "monospace",
    fontSize: 16,
    color: colors.text,
  },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textMuted, marginRight: 8 },
});
