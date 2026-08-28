"use client";

import { useState, useEffect } from "react";

export function useModifierKey() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const platform =
      // @ts-expect-error userAgentData might be present in newer browsers
      navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
    setIsMac(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  return {
    isMac,
    modifierKey: isMac ? "⌘" : "Ctrl",
    enterKey: "↵",
    deleteKey: isMac ? "⌫" : "Del",
    submitShortcut: isMac ? "⌘↵" : "Ctrl+↵",
    deleteShortcut: isMac ? "⌘⌫" : "Ctrl+Del",
  };
}
