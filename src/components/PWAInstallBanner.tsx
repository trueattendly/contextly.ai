"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "pwa_banner_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PWAInstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-critical: the app works fully without offline caching.
      });
    }
  }, []);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      // Private browsing / blocked storage: fall through, treat as not dismissed.
    }
    if (dismissed) return;

    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    setIsIOS(iOS);

    if (iOS) {
      setVisible(true);
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("pwa-banner-open", visible);
    return () => document.documentElement.classList.remove("pwa-banner-open");
  }, [visible]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // Ignore: worst case the banner reappears next visit.
    }
  }

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    dismiss();
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Contextle"
      className="fixed inset-x-0 bottom-0 z-40 pb-safe px-4 pointer-events-none"
    >
      <div className="mx-auto mb-4 max-w-md flex items-center gap-3 rounded-xl border border-peach/30 bg-slateDark-900/95 p-3 shadow-xl backdrop-blur-md pointer-events-auto">
        <Download size={20} className="text-peach flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-peach-light">Install Contextle</p>
          {isIOS ? (
            <p className="text-xs text-peach/55 truncate">Tap Share, then Add to Home Screen</p>
          ) : (
            <p className="text-xs text-peach/55 truncate">Play offline and quick launch</p>
          )}
        </div>
        {!isIOS && (
          <button
            type="button"
            onClick={handleInstall}
            className="tap-target flex-shrink-0 rounded-lg bg-peach px-3 py-1.5 text-sm font-semibold text-slateDark-900 hover:bg-peach-light active:bg-peach-dark transition-colors cursor-pointer"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="tap-target flex-shrink-0 flex items-center justify-center text-peach/60 hover:text-peach transition-colors cursor-pointer"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
