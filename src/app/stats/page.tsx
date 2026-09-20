"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Share2, Flame, Target, Trophy } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";

export default function StatsPage() {
  const { showAlert } = useModal();
  const [stats] = useState(() => {
    let streak = 5;
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("contextle_daily_streak");
      if (s) streak = parseInt(s, 10);
    }
    return { streak, winRate: 85, played: 42 };
  });

  const handleShare = () => {
    const text = `Contextle: I'm on a ${stats.streak}-day streak! Can you beat my semantic guessing skills? Play now: https://contextle.online`;
    if (navigator.share) {
      navigator.share({ text }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      showAlert({ title: "Copied", message: "Streak copied to clipboard.", type: "success" });
    }
  };

  return (
    <main className="min-h-dvh bg-slateDark-800 text-peach-light flex flex-col p-4 md:p-8 relative items-center justify-center">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-peach/[0.02] blur-[140px]" />
      </div>

      <div className="max-w-2xl w-full flex flex-col z-10">
        <Link href="/" className="self-start flex items-center gap-2 text-peach hover:text-peach-light text-sm mb-8 transition-colors">
          <ArrowLeft size={16} /> Back to Game
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-10 text-center tracking-tight">Your Stats & Streak</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="glass bg-slateDark-700/[0.02] border border-slateDark-600/[0.05] rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden group hover:border-peach-dark/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-b from-peach-dark/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Flame size={40} className="text-peach-dark mb-4 drop-shadow-[0_0_15px_rgba(226,189,150,0.4)]" />
            <div className="text-4xl font-bold text-peach-light mb-2">{stats.streak}</div>
            <div className="text-xs text-peach/40 uppercase tracking-widest font-semibold">Current Streak</div>
          </div>

          <div className="glass bg-slateDark-700/[0.02] border border-slateDark-600/[0.05] rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden group hover:border-peach/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-b from-peach/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Target size={40} className="text-peach mb-4 drop-shadow-[0_0_15px_rgba(254,218,184,0.4)]" />
            <div className="text-4xl font-bold text-peach-light mb-2">{stats.winRate}%</div>
            <div className="text-xs text-peach/40 uppercase tracking-widest font-semibold">Win Rate</div>
          </div>

          <div className="glass bg-slateDark-700/[0.02] border border-slateDark-600/[0.05] rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden group hover:border-peach-light/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-b from-peach-light/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Trophy size={40} className="text-peach-light mb-4 drop-shadow-[0_0_15px_rgba(255,240,222,0.4)]" />
            <div className="text-4xl font-bold text-peach-light mb-2">{stats.played}</div>
            <div className="text-xs text-peach/40 uppercase tracking-widest font-semibold">Games Played</div>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="w-full py-4 rounded-xl bg-peach text-slateDark-900 font-semibold flex items-center justify-center gap-3 transition-all shadow-md hover:bg-peach-light active:bg-peach-dark hover:scale-[1.02] active:scale-[0.98]"
        >
          <Share2 size={20} />
          Share Streak & Challenge Friends
        </button>
      </div>
    </main>
  );
}
