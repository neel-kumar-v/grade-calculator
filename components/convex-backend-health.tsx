"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ConvexBackendHealthContextValue = {
  reportQueryError: (error: Error) => void;
  outageMessage: string | null;
};

const ConvexBackendHealthContext =
  createContext<ConvexBackendHealthContextValue | null>(null);

function messageFromConvexError(error: Error): string | null {
  const text = error.message;
  if (
    text.includes("exceeded the free plan limits") ||
    text.includes("deployments have been disabled")
  ) {
    return "Live data is paused: the Convex team hit the Free plan limit. Upgrade or reduce usage to turn prod and dev back on.";
  }
  if (text.includes("Server Error")) {
    return "Live data is temporarily unavailable (Convex backend error).";
  }
  return null;
}

export function ConvexBackendHealthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [outageMessage, setOutageMessage] = useState<string | null>(null);

  const reportQueryError = useCallback((error: Error) => {
    const next = messageFromConvexError(error);
    if (!next) {
      return;
    }
    setOutageMessage((prev) => prev ?? next);
  }, []);

  const value = useMemo(
    () => ({ reportQueryError, outageMessage }),
    [reportQueryError, outageMessage]
  );

  return (
    <ConvexBackendHealthContext.Provider value={value}>
      {children}
    </ConvexBackendHealthContext.Provider>
  );
}

export function useConvexBackendHealth() {
  const ctx = useContext(ConvexBackendHealthContext);
  if (!ctx) {
    throw new Error(
      "useConvexBackendHealth must be used within ConvexBackendHealthProvider"
    );
  }
  return ctx;
}
