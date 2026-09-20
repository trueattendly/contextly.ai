"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Trophy, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Player {
  id: string;
  display_name: string | null;
  current_level: number;
}

export default function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlayers() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, current_level")
        .order("current_level", { ascending: false })
        .limit(5);

      if (!error && data) {
        setPlayers(data);
      }
      setLoading(false);
    }
    fetchPlayers();
  }, []);

  return (
    <section
      className="glass rounded-xl p-5 border border-slateDark-600/[0.04] bg-slateDark-700/[0.003] w-full"
      aria-label="Top Players Leaderboard"
    >
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slateDark-600/[0.04]">
        <div className="w-6 h-6 rounded-md bg-peach/10 border border-peach/20 flex items-center justify-center">
          <Trophy size={12} className="text-peach" />
        </div>
        <h3
          className="text-[11px] font-bold text-peach tracking-widest uppercase"
          style={{ textShadow: "0 0 12px rgba(254, 218, 184, 0.4)" }}
        >
          Top Crawlers
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={16} className="text-peach animate-spin" />
        </div>
      ) : players.length === 0 ? (
        <p className="text-[10px] text-peach/40 text-center py-6 font-mono uppercase tracking-wider">
          No players yet
        </p>
      ) : (
        <div className="space-y-2">
          {players.map((player, idx) => {
            const isTop = idx === 0;
            const isSecond = idx === 1;
            const isThird = idx === 2;
            
            const rankColor = isTop 
              ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" 
              : isSecond 
                ? "text-slate-300 bg-slate-300/10 border-slate-300/20" 
                : isThird
                  ? "text-amber-600 bg-amber-600/10 border-amber-600/20"
                  : "text-peach/40 bg-slateDark-700/[0.02] border-slateDark-600/[0.04]";

            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slateDark-700/[0.015] border border-slateDark-600/[0.03] hover:border-peach/20 hover:bg-slateDark-700/[0.03] transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold border ${rankColor}`}>
                    {idx + 1}
                  </div>
                  <span className="text-[11px] font-medium text-peach/75 group-hover:text-peach-light transition-colors truncate max-w-[100px] sm:max-w-[140px]">
                    {player.display_name || "Player_" + Math.floor(Math.random() * 9000 + 1000)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className="text-[10px] font-mono font-bold text-peach shadow-peach/10"
                    style={{ textShadow: "0 0 8px rgba(254, 218, 184, 0.3)" }}
                  >
                    Lvl {player.current_level}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {!loading && players.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slateDark-600/[0.04] text-center">
          <Link href="/leaderboard" className="text-[10px] text-peach/55 hover:text-peach font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-1 group">
            View Complete Board <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      )}
    </section>
  );
}
