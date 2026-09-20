"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Snowflake, Sun, Flame, Sparkles, ArrowRight } from "lucide-react";

interface DemoGuess {
  word: string;
  rank: number;
  similarity: number;
  tier: "ice" | "warm" | "victory";
  insight: string;
}

const DEMO_STEPS: DemoGuess[] = [
  {
    word: "Galaxy",
    rank: 820,
    similarity: 18,
    tier: "ice",
    insight: "Vast cosmic structure - too broad for the daily concept.",
  },
  {
    word: "Star",
    rank: 210,
    similarity: 62,
    tier: "warm",
    insight: "Getting warmer: celestial source of radiation and heat.",
  },
  {
    word: "Sunlight",
    rank: 1,
    similarity: 100,
    tier: "victory",
    insight: "Exact concept match: electromagnetic solar radiation reaching Earth.",
  },
];

export default function InteractiveHudDemo() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [displayedInput, setDisplayedInput] = useState("");
  const [activeGuesses, setActiveGuesses] = useState<DemoGuess[]>([DEMO_STEPS[0]]);
  const [isTyping, setIsTyping] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-cycle simulation through the 3 sample guesses
  useEffect(() => {
    let charIndex = 0;
    const targetGuess = DEMO_STEPS[currentStepIndex];
    let typeInterval: NodeJS.Timeout | null = null;

    const startTimer = setTimeout(() => {
      setDisplayedInput("");
      setIsTyping(true);

      typeInterval = setInterval(() => {
        if (charIndex <= targetGuess.word.length) {
          setDisplayedInput(targetGuess.word.slice(0, charIndex));
          charIndex++;
        } else {
          if (typeInterval) clearInterval(typeInterval);
          setIsTyping(false);

          // Commit guess to stack
          timerRef.current = setTimeout(() => {
            setActiveGuesses((prev) => {
              const exists = prev.some((g) => g.word === targetGuess.word);
              if (exists) return prev;
              return [targetGuess, ...prev].slice(0, 3);
            });

            // Move to next step after a pause
            const nextIndex = (currentStepIndex + 1) % DEMO_STEPS.length;
            const delay = targetGuess.tier === "victory" ? 4000 : 2500;
            timerRef.current = setTimeout(() => {
              if (nextIndex === 0) {
                setActiveGuesses([DEMO_STEPS[0]]);
              }
              setCurrentStepIndex(nextIndex);
            }, delay);
          }, 400);
        }
      }, 90);
    }, 0);

    return () => {
      clearTimeout(startTimer);
      if (typeInterval) clearInterval(typeInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStepIndex]);

  const handleManualSelect = (index: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentStepIndex(index);
  };

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl bg-[#142728]/95 border border-[#FEDAB8]/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden text-left">
      {/* HUD Header Bar */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#FEDAB8]/10 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FEDAB8] animate-pulse" />
          <span className="font-mono uppercase tracking-widest text-[#FEDAB8]/70 text-[10px]">
            Live Simulation HUD
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] text-[#FEDAB8]/50">
          <span>Target Concept:</span>
          <span className="text-[#FEDAB8] font-bold">SOLAR PHENOMENON</span>
        </div>
      </div>

      {/* Mock Input Field */}
      <div className="relative mb-4">
        <div className="flex items-center gap-2.5 p-2 rounded-xl border border-[#FEDAB8]/25 bg-[#203C3D]/80 transition-all focus-within:border-[#FEDAB8] focus-within:shadow-[0_0_20px_rgba(254,218,184,0.15)]">
          <Search size={15} className="text-[#FEDAB8]/60 ml-1 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 font-mono text-xs sm:text-sm text-[#FEDAB8] flex items-center">
            <span>{displayedInput}</span>
            {isTyping && <span className="w-1.5 h-4 bg-[#FEDAB8] ml-0.5 animate-pulse" />}
          </div>
          <button
            type="button"
            aria-label="Submit simulated guess"
            className="w-8 h-8 rounded-lg bg-[#FEDAB8] text-[#203C3D] flex items-center justify-center font-bold flex-shrink-0"
          >
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>

        {/* Quick select chips */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <span className="text-[10px] uppercase font-mono text-[#FEDAB8]/50 mr-1">Try step:</span>
          {DEMO_STEPS.map((step, idx) => (
            <button
              key={step.word}
              type="button"
              onClick={() => handleManualSelect(idx)}
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono transition-all cursor-pointer border ${
                currentStepIndex === idx
                  ? "bg-[#FEDAB8] text-[#203C3D] border-[#FEDAB8] font-bold shadow-[0_0_10px_rgba(254,218,184,0.2)]"
                  : "bg-[#203C3D]/60 text-[#FEDAB8]/70 border-[#FEDAB8]/15 hover:border-[#FEDAB8]/30"
              }`}
            >
              {step.word}
            </button>
          ))}
        </div>
      </div>

      {/* Simulated Ranking Cards Stack */}
      <div className="space-y-2.5">
        {activeGuesses.map((guess) => {
          const isVictory = guess.tier === "victory";
          const isWarm = guess.tier === "warm";

          let badgeBg = "bg-sky-500/10 border-sky-500/30 text-sky-200";
          let barBg = "bg-sky-400";
          let TierIcon = Snowflake;
          let tierLabel = "Ice Cold";

          if (isWarm) {
            badgeBg = "bg-amber-500/10 border-amber-500/30 text-amber-200";
            barBg = "bg-amber-400";
            TierIcon = Sun;
            tierLabel = "Warm Proximity";
          } else if (isVictory) {
            badgeBg = "bg-[#FEDAB8]/20 border-[#FEDAB8] text-[#FEDAB8]";
            barBg = "bg-[#FEDAB8]";
            TierIcon = Flame;
            tierLabel = "Rank 1 Exact Match";
          }

          return (
            <div
              key={guess.word}
              className={`rounded-xl p-3 border transition-all duration-300 ${
                isVictory
                  ? "border-[#FEDAB8] bg-[#203C3D] shadow-[0_0_30px_rgba(254,218,184,0.25)]"
                  : "border-[#FEDAB8]/15 bg-[#1b3334]/80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${badgeBg}`}>
                    <TierIcon size={14} aria-label={`${tierLabel} icon`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-[#FEDAB8] tracking-tight">{guess.word}</p>
                      {isVictory && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#FEDAB8]/20 text-[9px] font-bold text-[#FEDAB8] uppercase tracking-wider">
                          <Sparkles size={10} aria-hidden="true" /> Solved
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#FEDAB8]/60 uppercase tracking-wide font-mono mt-0.5">
                      {tierLabel}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={`font-mono font-bold text-sm ${
                      isVictory ? "text-[#FEDAB8]" : isWarm ? "text-amber-300" : "text-sky-300"
                    }`}
                  >
                    #{guess.rank}
                  </p>
                  <p className="text-[10px] text-[#FEDAB8]/50 font-mono">{guess.similarity}% score</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1 rounded-full bg-[#142728] overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${barBg}`}
                  style={{ width: `${guess.similarity}%` }}
                />
              </div>

              {/* Learning Insight */}
              <p className="text-[10px] text-[#FEDAB8]/70 leading-relaxed font-sans">{guess.insight}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
