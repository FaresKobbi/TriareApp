import { Feedback, FeedbackAction, FeedbackTone } from "@/src/features/bluetooth/utils/commandFeedback";
import { TranslationKey, useI18n } from "@/src/i18n";
import { colors } from "@/src/theme";
import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  feedback: Feedback | null;
  onDismiss: () => void;
  /** Called when the toast's action button is tapped. The toast closes itself. */
  onAction?: (action: FeedbackAction) => void;
};

const ACTION_LABEL: Record<FeedbackAction, TranslationKey> = {
  enable: "toast.enable",
};

const ACCENT: Record<FeedbackTone, string> = {
  success: colors.success,
  info: colors.warning,
  error: colors.danger,
};

const GLYPH: Record<FeedbackTone, string> = {
  success: "✓",
  info: "i",
  error: "!",
};

/** Errors and toasts with an action stay longer: they need reading, or a tap. */
function visibleMs(feedback: Feedback): number {
  if (feedback.action) return 9000;
  return feedback.tone === "error" ? 6500 : feedback.tone === "info" ? 4500 : 2500;
}

const ENTER_MS = 180;
const EXIT_MS = 150;

/**
 * Transient message for the outcome of a command: what happened, why it could
 * not be done, and (when there is one) a single tap to fix it.
 *
 * Position it absolutely at the bottom of the screen; it renders nothing when
 * there is no feedback. A new `feedback.id` restarts the animation and timer.
 */
export function CommandToast({ feedback, onDismiss, onAction }: Props) {
  const { t } = useI18n();
  const progress = useRef(new Animated.Value(0)).current;
  const dismissing = useRef(false);

  const close = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    Animated.timing(progress, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }).start(
      // An exit interrupted by a newer message (progress.setValue) must not
      // dismiss that new message.
      ({ finished }) => {
        if (finished) onDismiss();
      },
    );
  }, [onDismiss, progress]);

  useEffect(() => {
    if (!feedback) return;
    dismissing.current = false;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: ENTER_MS, useNativeDriver: true }).start();
    const timer = setTimeout(close, visibleMs(feedback));
    return () => clearTimeout(timer);
    // `close` changes with `onDismiss`; the timer must follow only a new message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback?.id]);

  if (!feedback) return null;

  const accent = ACCENT[feedback.tone];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        onPress={close}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={[feedback.title, feedback.detail].filter(Boolean).join(". ")}
        style={styles.toast}
      >
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.badgeText}>{GLYPH[feedback.tone]}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{feedback.title}</Text>
          {feedback.detail != null && <Text style={styles.detail}>{feedback.detail}</Text>}
        </View>
        {feedback.action != null && onAction != null && (
          <Pressable
            onPress={() => {
              close();
              onAction(feedback.action as FeedbackAction);
            }}
            accessibilityRole="button"
            style={styles.action}
          >
            <Text style={styles.actionText}>{t(ACTION_LABEL[feedback.action])}</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.text,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  detail: {
    color: "#D5E6E2",
    fontSize: 13,
  },
  action: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionText: {
    color: colors.onPrimary,
    fontWeight: "bold",
    fontSize: 14,
  },
});
