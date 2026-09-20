"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

type AlertType = "info" | "warning" | "error" | "success";

interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface ModalContextValue {
  showAlert: (options: AlertOptions) => Promise<void>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

type ModalState =
  | { kind: "alert"; options: AlertOptions; resolve: () => void }
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | null;

const ALERT_ICONS: Record<AlertType, React.ReactNode> = {
  info: <Info className="w-5 h-5 text-peach" aria-hidden="true" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" aria-hidden="true" />,
  error: <AlertCircle className="w-5 h-5 text-rose-400" aria-hidden="true" />,
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />,
};

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModalState>(null);
  const titleId = useId();
  const messageId = useId();

  const showAlert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setState({ kind: "alert", options, resolve });
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", options, resolve });
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    setState((current) => {
      if (!current) return current;
      if (current.kind === "alert") current.resolve();
      else current.resolve(confirmed);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [state, close]);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AnimatePresence>
        {state && (
          <>
            <motion.div
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => close(false)}
            />
            <motion.div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={messageId}
                className="w-full max-w-sm rounded-2xl border border-peach/20 bg-slateDark-800 shadow-2xl p-5"
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <div className="flex items-start gap-3 mb-5">
                  {state.kind === "alert"
                    ? ALERT_ICONS[state.options.type ?? "info"]
                    : state.options.isDestructive && (
                        <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                  <div>
                    <h2 id={titleId} className="text-base font-semibold text-peach-light">
                      {state.options.title}
                    </h2>
                    <p id={messageId} className="text-sm text-peach/70 mt-1">
                      {state.options.message}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {state.kind === "confirm" && (
                    <button
                      type="button"
                      onClick={() => close(false)}
                      className="tap-target bg-slateDark-700 text-peach/80 hover:bg-slateDark-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                      {state.options.cancelText ?? "Cancel"}
                    </button>
                  )}
                  <button
                    type="button"
                    autoFocus
                    onClick={() => close(true)}
                    className={
                      state.kind === "confirm" && state.options.isDestructive
                        ? "tap-target bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                        : "tap-target bg-peach text-slateDark-900 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-peach-light active:bg-peach-dark transition-colors cursor-pointer"
                    }
                  >
                    {state.options.confirmText ?? (state.kind === "confirm" ? "Confirm" : "OK")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within a ModalProvider");
  return ctx;
}
