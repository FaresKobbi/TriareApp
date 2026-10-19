import { EffortMap } from "@/src/components/resistance/EffortMap";
import { ZoneEditor, ZoneFields } from "@/src/components/resistance/ZoneEditor";
import { CommandToast } from "@/src/components/ui/CommandToast";
import { PedalDial } from "@/src/components/ui/PedalDial";
import { useBleSession } from "@/src/features/bluetooth/context/BleSessionContext";
import {
  HOLD_MAX_CURRENT_A,
  RESIST_MAX_ZONES,
  ResistLimit,
  ResistMode,
  TelemetryStatus,
} from "@/src/features/bluetooth/constants/triareProtocol";
import { useMotorControl } from "@/src/features/bluetooth/hooks/useMotorControl";
import { useTelemetryStream } from "@/src/features/bluetooth/hooks/useTelemetryStream";
import { CommandName, SystemState } from "@/src/features/bluetooth/utils/commandFeedback";
import {
  assistFactorAt,
  boardAngleToLeg,
  crankRpmToErpm,
  DEFAULT_EDGE_DEG,
  effortMap,
  Leg,
  parseDecimal,
  toBoardZones,
  ZoneDraft,
  zonesProblem,
} from "@/src/features/resistance/zones";
import { hasTranslation, TranslationKey, useI18n } from "@/src/i18n";
import { colors, spacing } from "@/src/theme";
import { useIsFocused } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const STREAM_MS = 50;
const MAP_CELLS = 72;
const DEFAULT_RATIO = "10";

type PickedMode = "A" | "C";

const STATE_COLOR: Record<SystemState, string> = {
  unknown: colors.textLight,
  armed: colors.success,
  running: colors.primary,
  disarmed: colors.textMuted,
  emergency: colors.danger,
};

/** A translated name for a numeric code from the board, or the number itself if this app does not know it. */
function codeName(prefix: string, code: number, t: (key: TranslationKey) => string): string {
  const key = `${prefix}.${code}`;
  return hasTranslation(key) ? t(key) : String(code);
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Looks unavailable but stays tappable so a tap can explain why. */
  dim?: boolean;
  danger?: boolean;
  outline?: boolean;
};

function Button({ label, onPress, loading, disabled, dim, danger, outline }: ButtonProps) {
  const inert = disabled === true || loading === true;
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading === true }}
      style={({ pressed }) => [
        styles.button,
        outline && styles.buttonOutline,
        danger && styles.buttonDanger,
        dim && styles.buttonDim,
        disabled && !loading && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, outline && styles.buttonTextOutline, loading && styles.hidden]}>
        {label}
      </Text>
      {loading && <ActivityIndicator size="small" color="#fff" style={styles.spinner} />}
    </Pressable>
  );
}

export default function ResistanceScreen() {
  const { t, tp } = useI18n();
  const session = useBleSession();
  const focused = useIsFocused();
  const {
    enable,
    stop,
    setRpm,
    setGearRatio,
    setResistMode,
    applyResistZones,
    readResistZones,
    engageHold,
    releaseHold,
    tuneResist,
    resistance,
    boardStatus,
    isConnected,
    systemState,
    pending,
    feedback,
    dismissFeedback,
    observeStatus,
  } = useMotorControl(session);

  // The pedal angle and the resistance frames come with the stream; it only
  // runs while this tab is on screen.
  const { telemetry: streamed } = useTelemetryStream(session, isConnected && focused);
  React.useEffect(() => {
    observeStatus(streamed?.status);
  }, [streamed, observeStatus]);

  const [picked, setPicked] = useState<PickedMode>("A");
  const [leg, setLeg] = useState<Leg>("left");
  const [ratioInput, setRatioInput] = useState(DEFAULT_RATIO);
  const [cadenceInput, setCadenceInput] = useState("20");
  const [holdInput, setHoldInput] = useState("1.0");
  const [zones, setZones] = useState<ZoneFields[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTune, setShowTune] = useState(false);
  const [gains, setGains] = useState({ kpSpeed: "0.0003", kiSpeed: "0.001", kpPos: "0.02", kdPos: "0.002" });

  const busy = pending !== null;
  const loading = (name: CommandName) => pending === name;
  const disarmed = systemState === "disarmed" || systemState === "emergency";

  const ratio = parseDecimal(ratioInput);
  const effectiveRatio = ratio != null && ratio > 0 ? ratio : Number(DEFAULT_RATIO);

  // Zones as the physiotherapist typed them (angles of the leg's pedal).
  const parsed = useMemo(
    () =>
      zones.map((z) => {
        const start = parseDecimal(z.start);
        const end = parseDecimal(z.end);
        const percent = parseDecimal(z.percent);
        const ok = start != null && end != null && percent != null;
        return ok ? ({ startDeg: start, endDeg: end, valuePercent: percent, edgeDeg: DEFAULT_EDGE_DEG } as ZoneDraft) : null;
      }),
    [zones],
  );
  const drafts = useMemo(() => parsed.filter((z): z is ZoneDraft => z !== null), [parsed]);
  const factors = useMemo(() => effortMap(drafts, MAP_CELLS), [drafts]);

  // Board state.
  const active = boardStatus != null && (boardStatus & TelemetryStatus.RESISTANCE) !== 0;
  const frame = active ? resistance : null;
  const angle = streamed?.crankAngleDeg ?? null;
  const legAngle = angle == null ? null : boardAngleToLeg(angle, leg);
  const helpNow = frame ? frame.assistFactor : legAngle != null ? assistFactorAt(drafts, legAngle) : null;

  const badge = {
    label: t(`state.${systemState}.label` as const),
    color: STATE_COLOR[systemState],
  };

  const fail = (text: string) => {
    setMessage(null);
    setError(text);
  };

  const sendRatio = async () => {
    if (ratio == null || ratio <= 0) return fail(t("resist.ratio.error"));
    setError(null);
    await setGearRatio(ratio);
  };

  const validateZones = (): string | null => {
    if (parsed.some((z) => z === null)) return t("resist.zones.error.angle");
    const problem = zonesProblem(drafts);
    return problem ? t(`resist.zones.error.${problem}` as const) : null;
  };

  const sendZones = async (): Promise<boolean> => {
    const problem = validateZones();
    if (problem) {
      fail(problem);
      return false;
    }
    setError(null);
    const result = await applyResistZones(toBoardZones(drafts, leg));
    return result !== null;
  };

  const startAssist = async () => {
    const cadence = parseDecimal(cadenceInput);
    if (cadence == null || cadence <= 0) return fail(t("resist.cadence.error"));
    if (!(await sendZones())) return;
    if ((await setResistMode(ResistMode.ASSIST_VALLEY)) === null) return;
    await setRpm(crankRpmToErpm(cadence, effectiveRatio));
  };

  const startHold = async () => {
    const amps = parseDecimal(holdInput);
    if (amps == null || amps < 0.1 || amps > HOLD_MAX_CURRENT_A) return fail(t("resist.hold.error"));
    setError(null);
    await engageHold(amps);
  };

  const readZones = async () => {
    const result = await readResistZones();
    if (result === null) return;
    setError(null);
    setMessage(result.length === 0 ? t("resist.zones.readNone") : tp("resist.zones.readResult", result.length, { count: result.length }));
    // Show what the board has, in the angles of the leg being worked.
    setZones(
      result.map((z) => ({
        start: String(Math.round(boardAngleToLeg(z.startDeg, leg) * 10) / 10),
        end: String(Math.round(boardAngleToLeg(z.endDeg, leg) * 10) / 10),
        percent: String(Math.round(z.valuePercent * 10) / 10),
      })),
    );
  };

  const sendGains = async () => {
    const values = [gains.kpSpeed, gains.kiSpeed, gains.kpPos, gains.kdPos].map(parseDecimal);
    if (values.some((v) => v == null || v < 0)) return fail(t("resist.tune.error"));
    setError(null);
    await tuneResist({
      kpSpeed: values[0] as number,
      kiSpeed: values[1] as number,
      kpPos: values[2] as number,
      kdPos: values[3] as number,
    });
  };

  if (!isConnected) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t("common.notConnected")}</Text>
      </View>
    );
  }

  const limitText: string[] = [];
  if (frame) {
    if (frame.limitFlags & ResistLimit.THERMAL) limitText.push(t("resist.limit.thermal"));
    if (frame.limitFlags & ResistLimit.YIELD) limitText.push(t("resist.limit.yield"));
    if (frame.limitFlags & ResistLimit.TIMEOUT) limitText.push(t("resist.limit.timeout"));
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t("resistance.title")}</Text>
        <Text style={styles.bench}>{t("resist.bench")}</Text>

        {/* ---- what the board is doing; Release is always here ---- */}
        <View style={styles.card}>
          <Text style={styles.section}>{t("resist.status.title")}</Text>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: badge.color }]} />
            <Text style={[styles.stateLabel, { color: badge.color }]}>{badge.label}</Text>
          </View>
          {disarmed && <Text style={styles.muted}>{t("resist.notArmed")}</Text>}
          {frame ? (
            <>
              <Text style={styles.value}>
                {codeName("resist.mode", frame.mode, t)} · {codeName("resist.phase", frame.phase, t)}
              </Text>
              <View style={styles.metrics}>
                <Metric label={t("resist.metric.angle")} value={legAngle != null ? `${legAngle.toFixed(0)}°` : "—"} />
                <Metric label={t("resist.metric.current")} value={`${frame.commandedCurrent.toFixed(2)} A`} />
                <Metric label={t("resist.metric.assist")} value={`${Math.round((helpNow ?? 0) * 100)} %`} />
                <Metric label={t("resist.metric.load")} value={`${Math.round(frame.thermalPercent)} %`} />
              </View>
              {limitText.map((text) => (
                <Text key={text} style={styles.warn}>
                  {text}
                </Text>
              ))}
            </>
          ) : (
            <Text style={styles.muted}>{t("resist.status.idle")}</Text>
          )}
          <View style={styles.row}>
            <Button label={t("speed.enable")} onPress={enable} loading={loading("enable")} disabled={busy} outline />
            <Button label={t("speed.stop")} onPress={stop} loading={loading("stop")} disabled={busy} outline />
          </View>
          <Button
            label={t("resist.releaseNow")}
            onPress={releaseHold}
            loading={loading("holdRelease")}
            disabled={pending !== null && pending !== "holdRelease"}
            danger
          />
        </View>

        {/* ---- setup ---- */}
        <View style={styles.card}>
          <Text style={styles.section}>{t("resist.setup.title")}</Text>
          <Text style={styles.label}>{t("resist.ratio.label")}</Text>
          <View style={styles.row}>
            <TextInput style={styles.input} value={ratioInput} onChangeText={setRatioInput} keyboardType="numeric" />
            <Button label={t("resist.ratio.set")} onPress={sendRatio} loading={loading("setGearRatio")} disabled={busy} />
          </View>
          <Text style={styles.muted}>{t("resist.ratio.hint")}</Text>
          <Text style={styles.label}>{t("resist.leg.title")}</Text>
          <View style={styles.row}>
            {(["left", "right"] as const).map((side) => (
              <Pressable
                key={side}
                accessibilityRole="button"
                accessibilityState={{ selected: leg === side }}
                onPress={() => setLeg(side)}
                style={[styles.segment, leg === side && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, leg === side && styles.segmentTextOn]}>{t(`resist.leg.${side}` as const)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.muted}>{t("resist.leg.hint")}</Text>
        </View>

        {/* ---- mode picker ---- */}
        <Text style={styles.section}>{t("resist.pick.title")}</Text>
        <ModeCard
          title={t("resist.pick.A.title")}
          text={t("resist.pick.A.desc")}
          selected={picked === "A"}
          onPress={() => setPicked("A")}
        />
        <ModeCard
          title={t("resist.pick.C.title")}
          text={t("resist.pick.C.desc")}
          selected={picked === "C"}
          onPress={() => setPicked("C")}
        />
        <ModeCard title={t("resist.pick.B.title")} text={t("resist.pick.B.desc")} selected={false} disabled />

        {picked === "A" ? (
          <View style={styles.card}>
            <Text style={styles.section}>{t("resist.cadence.title")}</Text>
            <View style={styles.row}>
              <TextInput style={styles.input} value={cadenceInput} onChangeText={setCadenceInput} keyboardType="numeric" accessibilityLabel={t("resist.cadence.label")} />
              <Text style={styles.unit}>{t("resist.cadence.label")}</Text>
            </View>
            {parseDecimal(cadenceInput) != null && (
              <Text style={styles.muted}>
                {t("resist.cadence.sentAs", { erpm: Math.round(crankRpmToErpm(parseDecimal(cadenceInput) as number, effectiveRatio)) })}
              </Text>
            )}

            <Text style={styles.section}>{t("resist.zones.title")}</Text>
            <ZoneEditor zones={zones} onChange={setZones} max={RESIST_MAX_ZONES} disabled={busy} />
            <Text style={styles.section}>{t("resist.map.title")}</Text>
            <EffortMap factors={factors} markerDeg={legAngle} />

            <View style={styles.row}>
              <Button label={t("resist.zones.send")} onPress={sendZones} loading={loading("resistZones")} disabled={busy} outline />
              <Button label={t("resist.zones.read")} onPress={readZones} loading={loading("resistRead")} disabled={busy} outline />
            </View>
            <View style={styles.row}>
              <Button label={t("resist.start")} onPress={startAssist} loading={loading("resistMode")} disabled={busy} dim={disarmed} />
              <Button label={t("resist.end")} onPress={() => setResistMode(ResistMode.NONE)} disabled={busy} outline />
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.section}>{t("resist.hold.title")}</Text>
            <Text style={styles.label}>{t("resist.hold.label")}</Text>
            <TextInput style={styles.input} value={holdInput} onChangeText={setHoldInput} keyboardType="numeric" />
            <Text style={styles.muted}>{t("resist.hold.hint")}</Text>
            <Button label={t("resist.hold.engage")} onPress={startHold} loading={loading("holdEngage")} disabled={busy} dim={disarmed} />
          </View>
        )}

        <View style={styles.dialBox}>
          <PedalDial angleDeg={angle} sampleId={streamed} sampleTimeMs={streamed?.timestampMs} intervalMs={STREAM_MS} size={170} />
        </View>

        {message != null && <Text style={styles.ok}>{message}</Text>}
        {error != null && <Text style={styles.error}>{error}</Text>}

        {/* ---- bench tuning ---- */}
        <Pressable onPress={() => setShowTune((v) => !v)} accessibilityRole="button">
          <Text style={styles.section}>{(showTune ? "▾ " : "▸ ") + t("resist.tune.title")}</Text>
        </Pressable>
        {showTune && (
          <View style={styles.card}>
            <Text style={styles.muted}>{t("resist.tune.hint")}</Text>
            {(
              [
                ["kpSpeed", "resist.tune.kpSpeed"],
                ["kiSpeed", "resist.tune.kiSpeed"],
                ["kpPos", "resist.tune.kpPos"],
                ["kdPos", "resist.tune.kdPos"],
              ] as const
            ).map(([field, key]) => (
              <View key={field} style={styles.tuneRow}>
                <Text style={styles.tuneLabel}>{t(key)}</Text>
                <TextInput
                  style={[styles.input, styles.tuneInput]}
                  value={gains[field]}
                  onChangeText={(text) => setGains((g) => ({ ...g, [field]: text }))}
                  keyboardType="numeric"
                />
              </View>
            ))}
            <Button label={t("resist.tune.send")} onPress={sendGains} loading={loading("resistTune")} disabled={busy} />
          </View>
        )}

        <View style={styles.toastSpace} />
      </ScrollView>

      <CommandToast
        feedback={feedback}
        onDismiss={dismissFeedback}
        onAction={(action) => {
          if (action === "enable") enable();
        }}
      />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ModeCard(props: { title: string; text: string; selected: boolean; disabled?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected, disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.modeCard, props.selected && styles.modeCardOn, props.disabled && styles.modeCardOff]}
    >
      <Text style={styles.modeTitle}>{props.title}</Text>
      <Text style={styles.muted}>{props.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  container: { padding: spacing.screenPadding, gap: 10 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  bench: {
    fontSize: 13,
    color: colors.text,
    backgroundColor: "#FFF4DB",
    borderRadius: 10,
    padding: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { fontSize: 13, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 },
  label: { fontSize: 14, color: colors.text, fontWeight: "600" },
  muted: { fontSize: 13, color: colors.textMuted },
  unit: { fontSize: 14, color: colors.textMuted },
  value: { fontSize: 16, fontWeight: "700", color: colors.text },
  warn: { fontSize: 13, color: colors.dangerDark },
  ok: { fontSize: 14, color: colors.text },
  error: { fontSize: 14, color: colors.dangerDark },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stateLabel: { fontSize: 16, fontWeight: "700" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { minWidth: "45%", flexGrow: 1 },
  metricValue: { fontSize: 18, fontWeight: "700", color: colors.text },
  metricLabel: { fontSize: 12, color: colors.textMuted },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.text,
  },
  tuneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tuneLabel: { flex: 1, fontSize: 13, color: colors.text },
  tuneInput: { flex: 0, width: 110 },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
  },
  segmentOn: { backgroundColor: colors.primary },
  segmentText: { color: colors.primaryDark, fontWeight: "600" },
  segmentTextOn: { color: colors.onPrimary },
  modeCard: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.surface,
    gap: 2,
  },
  modeCardOn: { borderColor: colors.primary },
  modeCardOff: { opacity: 0.5 },
  modeTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  button: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  buttonDanger: { backgroundColor: colors.dangerDark },
  buttonDim: { opacity: 0.5 },
  buttonDisabled: { opacity: 0.6 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  buttonTextOutline: { color: colors.primaryDark },
  hidden: { opacity: 0 },
  spinner: { position: "absolute" },
  dialBox: { alignItems: "center", paddingVertical: 8 },
  toastSpace: { height: 96 },
});
