"use client";

import { useEffect } from "react";

interface PageShortcutHandlers {
  onNew?: () => void;
  onPublish?: () => void;
  onDelete?: () => void;
  onSettings?: () => void;
  disabled?: boolean;
}

export function usePageShortcuts({
  onNew,
  onPublish,
  onDelete,
  onSettings,
  disabled = false,
}: PageShortcutHandlers) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if modifier keys are pressed (Ctrl, Meta/Cmd, Alt)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName?.toLowerCase();
        if (
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox" ||
          target.getAttribute("role") === "combobox"
        ) {
          return;
        }
      }

      // Ignore if a dialog / modal is currently open in the DOM
      const openDialog = document.querySelector('[role="dialog"]');
      if (openDialog) return;

      const key = e.key.toLowerCase();

      if (key === "n" && onNew) {
        e.preventDefault();
        onNew();
      } else if (key === "p" && onPublish) {
        e.preventDefault();
        onPublish();
      } else if (key === "d" && onDelete) {
        e.preventDefault();
        onDelete();
      } else if (key === "," && onSettings) {
        e.preventDefault();
        onSettings();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onNew, onPublish, onDelete, onSettings, disabled]);
}
