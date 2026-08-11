import { useCallback, useEffect, useState } from "react";
import { BleSession } from "../services/BleSession";

export function useBasicCommunication(session: BleSession | null) {
  const [currentValue, setCurrentValue] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setIsLoading(true);
    session.basicCommunication
      .readValue()
      .then(setCurrentValue)
      .catch(() => setError("Read failed"))
      .finally(() => setIsLoading(false));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const unsubscribe = session.basicCommunication.subscribeToNotifications(
      (bytes) => setCurrentValue(bytes),
    );
    return unsubscribe;
  }, [session]);

  const sendBytes = useCallback(
    (bytes: Uint8Array) => {
      session?.basicCommunication
        .writeValue(bytes)
        .catch(() => setError("Write failed"));
    },
    [session],
  );

  return { currentValue, sendBytes, isLoading, error };
}
