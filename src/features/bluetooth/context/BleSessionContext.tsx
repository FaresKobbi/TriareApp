import React, { createContext, ReactNode, useContext, useState } from "react";
import { BleSession } from "../services/BleSession";

type BleSessionContextValue = {
  session: BleSession | null;
  setSession: (session: BleSession | null) => void;
};

const BleSessionContext = createContext<BleSessionContextValue>({
  session: null,
  setSession: () => {},
});

export function BleSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<BleSession | null>(null);
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
