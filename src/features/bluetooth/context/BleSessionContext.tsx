import { t } from "@/src/i18n";
import { router } from "expo-router";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import { BleSession } from "../services/BleSession";

type BleSessionContextValue = {
  session: BleSession | null;
  /**
   * Installs the active session (or clears it with `null`). Replacing or
   * clearing a session disconnects the previous one, so the board is released.
   */
  setSession: (session: BleSession | null) => void;
};

const BleSessionContext = createContext<BleSessionContextValue>({
  session: null,
  setSession: () => {},
});

/**
 * Where the user lands when the link drops without them asking for it: the
 * BLE scan screen, so reconnecting is one tap away (same place Disconnect goes).
 */
const SCAN_ROUTE = "/";

export function BleSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<BleSession | null>(null);
  // Mirrors `session` so callbacks see the current one, not a stale closure.
  const currentRef = useRef<BleSession | null>(null);

  const setSession = useCallback((next: BleSession | null) => {
    const previous = currentRef.current;
    if (previous === next) return;

    currentRef.current = next;
    setSessionState(next);
    // Closes the previous link; without this the board stays "connected"
    // and does not advertise, so the app can only find it again after a reset.
    if (previous) void previous.disconnect();

    next?.onLinkLost(() => {
      if (currentRef.current !== next) return;
      currentRef.current = null;
      setSessionState(null);
      void next.disconnect(); // release local resources; the link is already down
      router.replace(SCAN_ROUTE);
      // The screen they were on is gone, so say why the app moved.
      Alert.alert(t("connection.lostTitle"), t("connection.lostBody"));
    });
  }, []);

  // Provider going away (app closing) must not leave the link open.
  useEffect(
    () => () => {
      void currentRef.current?.disconnect();
      currentRef.current = null;
    },
    [],
  );

  return (
    <BleSessionContext.Provider value={{ session, setSession }}>
      {children}
    </BleSessionContext.Provider>
  );
}

export function useBleSession(): BleSession | null {
  return useContext(BleSessionContext).session;
}

export function useBleSessionContext(): BleSessionContextValue {
  return useContext(BleSessionContext);
}
