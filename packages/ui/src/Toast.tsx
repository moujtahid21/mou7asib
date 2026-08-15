"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, ICON_PATHS } from "./icons";

interface ToastContextValue {
  showToast: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Every phase that needs a transient confirmation ("brouillon créé", "lettrage validé", ...)
 * calls this instead of inventing its own toast — one visual and one timing policy. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}

const DISPLAY_MS = 2600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: string) => {
    setText(next);
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setText(null), DISPLAY_MS);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {text !== null && (
        <div
          role="status"
          className="fixed start-1/2 bottom-6 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border-2 bg-fg px-3.5 py-2.5 text-[12.5px] text-bg shadow-lg"
        >
          <Icon path={ICON_PATHS.check} size={16} />
          <span>{text}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}
