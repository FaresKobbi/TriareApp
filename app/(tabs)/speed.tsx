import { CommandToast } from "@/src/components/ui/CommandToast";
import { TelemetryPanel } from "@/src/components/telemetry/TelemetryPanel";
import { PedalDial } from "@/src/components/ui/PedalDial";
import {
  useBleSession,
  useBleSessionContext,
} from "@/src/features/bluetooth/context/BleSessionContext";
import { useMotorControl } from "@/src/features/bluetooth/hooks/useMotorControl";
import { useTelemetryPolling } from "@/src/features/bluetooth/hooks/useTelemetryPolling";
import { useTelemetryStream } from "@/src/features/bluetooth/hooks/useTelemetryStream";
import { TelemetryData } from "@/src/features/bluetooth/protocol/TriareFrames";
import { CommandName, SystemState } from "@/src/features/bluetooth/utils/commandFeedback";
import { erpmToCrankRpm, toErpm } from "@/src/features/bluetooth/utils/motorUnits";
import { useI18n } from "@/src/i18n";
import { useTelemetryHistory } from "@/src/features/telemetry/useTelemetryHistory";
import { useThrottledValue } from "@/src/features/telemetry/useThrottledValue";
import { colors } from "@/src/theme";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

// The board announces its own state changes (the B3 emergency button, a fault),
// so nothing is polled for the badge. Telemetry numbers and the pedal dial only
// update while the "Live telemetry" switch is on: the board pushes a sample
// every STREAM_MS, or, on firmware that cannot stream, the app asks for one
// every LIVE_POLL_MS.
const STREAM_MS = 50;
const LIVE_POLL_MS = 150;
/** The numbers in the telemetry panel refresh this often (the dial uses every sample). */
const PANEL_REFRESH_MS = 250;

/** "0,08" and "0.08" both work; empty or non-numeric text gives null. */
function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const STATE_COLOR: Record<SystemState, string> = {
  unknown: colors.textLight,
  armed: colors.success,
  running: colors.primary,
  disarmed: colors.textMuted,
  emergency: colors.danger,
};

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  /** This button's command is in flight: shows a spinner in place of the label. */
  loading?: boolean;
  /** Another command is in flight: ignore taps. */
  disabled?: boolean;
  /** Looks unavailable but stays tappable, so a tap can explain why. */
  dim?: boolean;
  danger?: boolean;
};

function ActionButton({ label, onPress, loading, disabled, dim, danger }: ActionButtonProps) {
  const inert = disabled === true || loading === true;
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading === true }}
      style={({ pressed }) => [
        styles.button,
        danger && styles.buttonDanger,
        dim && styles.buttonDim,
        disabled && !loading && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, loading && styles.buttonTextHidden]}>{label}</Text>
      {loading && <ActivityIndicator size="small" color="#fff" style={styles.buttonSpinner} />}
    </Pressable>
  );
}

export default function SpeedScreen() {
  const { t } = useI18n();
  const session = useBleSession();
  const { setSession } = useBleSessionContext();
  const {
    enable,
    disable,
    stop,
    setRpm,
    setDuty,
    calibrateCrank,
    setGearRatio,
    requestTelemetry,
    telemetry,
    isConnected,
    systemState,
    pending,
    feedback,
    dismissFeedback,
    observeStatus,
  } = useMotorControl(session);

  // Live telemetry (numbers + pedal dial) is opt-in: the system state does not
  // need it, the board sends that on its own.
  const [live, setLive] = useState(false);
  const [pollRestart, setPollRestart] = useState(0);
  const { telemetry: streamedTelemetry, supported: streamSupported } = useTelemetryStream(
    session,
    isConnected && live,
  );
  // Polling is only the fallback for firmware that does not stream.
  const streaming = live && streamSupported === true;
  const polling = live && streamSupported === false;
  const sampleMs = streaming ? STREAM_MS : LIVE_POLL_MS;
  const {
    telemetry: polledTelemetry,
    error: pollError,
    stopped: pollStopped,
  } = useTelemetryPolling(
    () => session!.commands.requestTelemetry(),
    isConnected && polling,
    LIVE_POLL_MS,
    pollRestart,
  );

  // One silent read when the screen opens: fills the numbers and, on firmware
  // that reports its state in telemetry, settles the badge right away.
  const [firstSample, setFirstSample] = useState<TelemetryData | null>(null);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setFirstSample(null);
    session.commands
      .requestTelemetry()
      .then((sample) => {
        if (!cancelled) setFirstSample(sample);
      })
      .catch(() => {
        // No toast: the badge keeps saying it is waiting, and Request telemetry still works.
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const shownTelemetry =
    (live ? streamedTelemetry : null) ?? polledTelemetry ?? telemetry ?? firstSample;

  // History for the mini charts lives outside React state (see the hook); the
  // numbers are throttled so 20 Hz samples stay readable and cheap to draw.
  const { history, version } = useTelemetryHistory(shownTelemetry, live);
  const panelSample = useThrottledValue(shownTelemetry, PANEL_REFRESH_MS);

  // Board-side changes (emergency button, faults) arrive in the status byte.
  useEffect(() => {
    observeStatus(streamedTelemetry?.status);
  }, [streamedTelemetry, observeStatus]);
  useEffect(() => {
    observeStatus(polledTelemetry?.status);
  }, [polledTelemetry, observeStatus]);
  useEffect(() => {
    observeStatus(telemetry?.status);
  }, [telemetry, observeStatus]);
  useEffect(() => {
    observeStatus(firstSample?.status);
  }, [firstSample, observeStatus]);

  const [rpmInput, setRpmInput] = useState("500");
  const [dutyInput, setDutyInput] = useState("0.08");
  const [ratioInput, setRatioInput] = useState("1.0");
  const [fieldError, setFieldError] = useState<{
    rpm?: string;
    duty?: string;
    ratio?: string;
  }>({});
  const [devEui, setDevEui] = useState<string | null>(null);
  const [devEuiError, setDevEuiError] = useState<string | null>(null);

  // One command at a time: the protocol has no correlation IDs, so overlapping
  // taps would only queue behind a 3 s timeout.
  const busy = pending !== null;
  const loading = (name: CommandName) => pending === name;
  const motionBlocked = systemState === "disarmed" || systemState === "emergency";
  // Firmware that predates the status byte answers telemetry with 22 bytes and
  // never announces anything: the state can only be learned from commands.
  const legacyFirmware = shownTelemetry != null && shownTelemetry.status === undefined;
  const badge = {
    label: t(`state.${systemState}.label` as const),
    hint:
      systemState === "unknown" && legacyFirmware
        ? t("state.unknown.legacyHint")
        : t(`state.${systemState}.hint` as const),
    color: STATE_COLOR[systemState],
  };

  // Motor revolutions per crank revolution, as typed in the gear-ratio field
  // (firmware default is 1.0 until SET_GEAR_RATIO is sent).
  const ratioValue = parseNumber(ratioInput);
  const totalRatio = ratioValue != null && ratioValue > 0 ? ratioValue : 1;
  const rpmValue = parseNumber(rpmInput);

  // The firmware only understands ERPM, so convert before sending.
  const sendSpeed = () => {
    if (rpmValue == null) {
      setFieldError((e) => ({ ...e, rpm: t("speed.error.rpm") }));
      return;
    }
    setFieldError((e) => ({ ...e, rpm: undefined }));
    setRpm(toErpm(rpmValue, "motorRpm"));
  };

  const sendDuty = () => {
    const value = parseNumber(dutyInput);
    if (value == null || value < -1 || value > 1) {
      setFieldError((e) => ({ ...e, duty: t("speed.error.duty") }));
      return;
    }
    setFieldError((e) => ({ ...e, duty: undefined }));
    setDuty(value);
  };

  const sendRatio = () => {
    if (ratioValue == null || ratioValue <= 0) {
      setFieldError((e) => ({ ...e, ratio: t("speed.error.ratio") }));
      return;
    }
    setFieldError((e) => ({ ...e, ratio: undefined }));
    setGearRatio(ratioValue);
  };

  // Disarm first (best effort), then close the BLE link so the board is free
  // to be found again without a reset.
  const disconnect = async () => {
    setLive(false);
    try {
      await session?.commands.disable();
    } catch {
      // Not acknowledged: still close the link below.
    }
    setSession(null);
    router.replace("/");
  };

  const readDevEui = async () => {
    if (!session) return;
    setDevEuiError(null);
    try {
      const bytes = await session.commands.getDevEui();
      setDevEui(
        Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
          .join(":")
      );
    } catch (e) {
      setDevEuiError(e instanceof Error ? e.message : t("speed.deveuiFailed"));
    }
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{t("common.notConnected")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.section}>{t("speed.system")}</Text>
        <View style={styles.stateRow}>
          <View style={[styles.stateDot, { backgroundColor: badge.color }]} />
          <Text style={[styles.stateLabel, { color: badge.color }]}>{badge.label}</Text>
        </View>
        <Text style={styles.label}>{badge.hint}</Text>
        <View style={styles.row}>
          <ActionButton
            label={t("speed.enable")}
            onPress={enable}
            loading={loading("enable")}
            disabled={busy}
          />
          <ActionButton
            label={t("speed.disable")}
            onPress={disable}
            loading={loading("disable")}
            disabled={busy}
            danger
          />
          <ActionButton label={t("speed.stop")} onPress={stop} loading={loading("stop")} disabled={busy} />
        </View>

        <Text style={styles.section}>{t("speed.targetTitle")}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, fieldError.rpm != null && styles.inputError]}
            value={rpmInput}
            onChangeText={(t) => {
              setRpmInput(t);
              setFieldError((e) => ({ ...e, rpm: undefined }));
            }}
            keyboardType="numeric"
          />
          <ActionButton
            label={t("speed.setSpeed")}
            onPress={sendSpeed}
            loading={loading("setRpm")}
            disabled={busy}
            dim={motionBlocked}
          />
        </View>
        {rpmValue != null && (
          <Text style={styles.label}>
            {t("speed.sentAs", {
              erpm: Math.round(toErpm(rpmValue, "motorRpm")),
              crank: erpmToCrankRpm(toErpm(rpmValue, "motorRpm"), totalRatio).toFixed(1),
            })}
          </Text>
        )}
        {fieldError.rpm != null && <Text style={styles.error}>{fieldError.rpm}</Text>}

        <Text style={styles.section}>{t("speed.dutyTitle")}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, fieldError.duty != null && styles.inputError]}
            value={dutyInput}
            onChangeText={(t) => {
              setDutyInput(t);
              setFieldError((e) => ({ ...e, duty: undefined }));
            }}
            keyboardType="numeric"
          />
          <ActionButton
            label={t("speed.setDuty")}
            onPress={sendDuty}
            loading={loading("setDuty")}
            disabled={busy}
            dim={motionBlocked}
          />
        </View>
        {fieldError.duty != null && <Text style={styles.error}>{fieldError.duty}</Text>}

        <Text style={styles.section}>{t("speed.ratioTitle")}</Text>
        <View style={styles.row}>
          <ActionButton
            label={t("speed.calibrate")}
            onPress={calibrateCrank}
            loading={loading("calibrateCrank")}
            disabled={busy}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, fieldError.ratio != null && styles.inputError]}
            value={ratioInput}
            onChangeText={(t) => {
              setRatioInput(t);
              setFieldError((e) => ({ ...e, ratio: undefined }));
            }}
            keyboardType="numeric"
          />
          <ActionButton
            label={t("speed.setRatio")}
            onPress={sendRatio}
            loading={loading("setGearRatio")}
            disabled={busy}
          />
        </View>
        {fieldError.ratio != null && <Text style={styles.error}>{fieldError.ratio}</Text>}

        <Text style={styles.section}>{t("speed.telemetry")}</Text>
        <View style={styles.row}>
          <Switch value={live} onValueChange={setLive} />
          <Text style={styles.label}>
            {t("speed.live", {
              mode: streaming
                ? t("speed.mode.streamed")
                : polling
                  ? t("speed.mode.polled")
                  : t("speed.mode.starting"),
            })}
          </Text>
        </View>
        <Text style={styles.label}>{t("speed.liveHint")}</Text>
        {pollStopped && (
          <>
            <Text style={styles.error}>
              {pollError != null
                ? t("speed.liveStoppedWithReason", { reason: pollError.message })
                : t("speed.liveStopped")}
            </Text>
            <ActionButton label={t("speed.retry")} onPress={() => setPollRestart((k) => k + 1)} />
          </>
        )}
        <View style={styles.dialBox}>
          <PedalDial
            angleDeg={shownTelemetry?.crankAngleDeg ?? null}
            sampleId={shownTelemetry}
            sampleTimeMs={shownTelemetry?.timestampMs}
            intervalMs={sampleMs}
          />
        </View>
        <ActionButton
          label={t("speed.requestTelemetry")}
          onPress={requestTelemetry}
          loading={loading("telemetry")}
          disabled={busy}
        />
        <TelemetryPanel
          sample={panelSample}
          history={history}
          version={version}
          totalRatio={totalRatio}
          live={live}
        />

        <Text style={styles.section}>{t("speed.deveui")}</Text>
        <Pressable style={styles.button} onPress={readDevEui}>
          <Text style={styles.buttonText}>{t("speed.readDeveui")}</Text>
        </Pressable>
        {devEuiError != null && <Text style={styles.error}>{devEuiError}</Text>}
        {devEui != null && <Text style={styles.hex}>{devEui}</Text>}

        <Text style={styles.section}>{t("speed.connection")}</Text>
        <Pressable style={[styles.button, styles.buttonDanger]} onPress={disconnect}>
          <Text style={styles.buttonText}>{t("speed.disconnect")}</Text>
        </Pressable>

        {/* Room so the toast never covers the last controls. */}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    alignItems: "stretch",
    padding: 24,
    gap: 8,
  },
  section: {
    fontSize: 13,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    color: "#888",
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stateLabel: {
    fontSize: 16,
    fontWeight: "bold",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  inputError: {
    borderColor: "#e53935",
  },
  hex: {
    fontSize: 16,
    fontFamily: "monospace",
    marginTop: 4,
  },
  error: {
    color: "#e53935",
    fontSize: 14,
  },
  button: {
    backgroundColor: "#1976D2",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDanger: {
    backgroundColor: "#c62828",
  },
  buttonDim: {
    opacity: 0.45,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  // Keeps the button's width while its spinner is showing.
  buttonTextHidden: {
    opacity: 0,
  },
  buttonSpinner: {
    position: "absolute",
  },
  dialBox: {
    alignItems: "center",
    paddingVertical: 12,
  },
  telemetryBox: {
    marginTop: 8,
    gap: 2,
  },
  telemetryLine: {
    fontFamily: "monospace",
    fontSize: 14,
  },
  toastSpace: {
    height: 96,
  },
});
