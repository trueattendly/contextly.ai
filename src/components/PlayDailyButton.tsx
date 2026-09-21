"use client";

import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getURL } from "@/utils/getURL";

interface PlayDailyButtonProps {
  isAuthenticated?: boolean;
  onPlay?: () => void;
  className?: string;
  label?: string;
}

export default function PlayDailyButton({
  isAuthenticated = false,
  onPlay,
  className = "",
  label = "Play Daily Mystery",
}: PlayDailyButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (isAuthenticated) {
      if (onPlay) {
        onPlay();
      } else {
        const gameArena = document.getElementById("game-arena");
        if (gameArena) {
          gameArena.scrollIntoView({ behavior: "smooth" });
          const input = gameArena.querySelector("input");
          input?.focus();
        }
      }
      return;
    }

    // Unauthenticated: initiate Google OAuth to establish session with zero friction
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getURL()}auth/callback`,
        },
      });
    } catch (err) {
      console.error("[contextle] OAuth error:", err);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`relative group min-h-[48px] px-8 py-3.5 rounded-xl font-bold text-sm sm:text-base text-[#203C3D] bg-[#FEDAB8] hover:bg-[#ffe8d4] active:scale-[0.98] transition-all duration-200 shadow-[0_0_30px_rgba(254,218,184,0.3)] hover:shadow-[0_0_40px_rgba(254,218,184,0.5)] flex items-center justify-center gap-2.5 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      aria-label="Play Daily Mystery"
    >
      {/* Subtle pulsing ambient ring */}
      <span
        className="absolute inset-0 rounded-xl border-2 border-[#FEDAB8] opacity-60 animate-ping pointer-events-none group-hover:opacity-80"
        aria-hidden="true"
        style={{ animationDuration: "2.5s" }}
      />

      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin text-[#203C3D]" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight
            size={16}
            className="text-[#203C3D] transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </>
      )}
    </button>
  );
}

