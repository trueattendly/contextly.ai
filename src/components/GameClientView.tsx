"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ArrowRight,
  HelpCircle,
  Trophy,
  Flame,
  Zap,
  Snowflake,
  LogOut,
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Activity,
  Award,
  Eye,
  Share2,
  Timer,
  Swords,
  MessageCircle,
  Check,
  Dices,
  Star,
  Compass,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { GuessEntry, GuessResponse, UserProfile, GameCategory, ConceptReveal } from "@/types/game";
import {
  getRankTier,
  getRankBarClass,
  getRankLabel,
  parseGameContent,
  GAME_CATEGORY_LABELS,
  formatDuration,
} from "@/types/game";
import { Logo } from "@/components/Logo";
import Leaderboard from "@/components/Leaderboard";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";

// ─── Countdown Hook ─────────────────────────────────────────────────────────
function useCountdown() {
  const [t, setT] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const tmr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const d = Math.floor((tmr.getTime() - now.getTime()) / 1000);
      setT({ h: Math.floor(d / 3600), m: Math.floor((d % 3600) / 60), s: d % 60 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

// ─── Guess Card ─────────────────────────────────────────────────────────────
function GuessCard({ entry }: { entry: GuessEntry }) {
  const tier = getRankTier(entry.rank);
  const barClass = getRankBarClass(entry.rank);

  let badgeColor = "text-peach/50 bg-slateDark-600/20";
  let iconColor = "text-peach/50";
  let borderStyle = "border-slateDark-600/50";

  if (entry.isCorrect) {
    badgeColor = "text-peach bg-peach/10";
    iconColor = "text-peach";
    borderStyle = "border-peach/40";
  } else if (tier === "hot") {
    badgeColor = "text-peach bg-peach/10";
    iconColor = "text-peach";
    borderStyle = "border-peach/40";
  } else if (tier === "warm") {
    badgeColor = "text-peach-light bg-peach-light/10";
    iconColor = "text-peach-light";
    borderStyle = "border-peach-light/30";
  } else if (tier === "cold") {
    badgeColor = "text-peach/50 bg-slateDark-600/20";
    iconColor = "text-peach/50";
    borderStyle = "border-slateDark-600/50";
  }

  const Icon = tier === "hot" ? Flame : tier === "warm" ? Zap : Snowflake;
  const pct = Math.max(4, entry.similarityPercentage);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={`glass rounded-xl p-3.5 border ${borderStyle} hover:border-slateDark-600/10 transition-all duration-200 group flex flex-col gap-2.5 ${
        entry.isCorrect ? "pulse-ring" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${badgeColor}`}>
            <Icon size={14} className={iconColor} aria-label={`${tier} tier`} />
          </div>
          <div>
            <p className="font-semibold text-sm text-peach/90 tracking-tight group-hover:text-peach-light transition-colors">
              {entry.word}
            </p>
            <p className="text-[10px] text-peach/40 mt-0.5 font-medium uppercase tracking-wider">
              {getRankLabel(entry.rank)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-mono font-bold text-sm ${entry.isCorrect ? "text-peach" : "text-peach/75"}`}>
            #{entry.rank}
          </p>
          <p className="text-[10px] text-peach/40 font-mono mt-0.5">{entry.similarityPercentage}% similarity</p>
        </div>
      </div>
      <div className="w-full h-1 bg-slateDark-700/3 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barClass}`}
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {entry.learningInsight && (
        <p className="text-[10px] text-peach/40 leading-snug flex items-start gap-1.5 pt-0.5">
          <Eye size={11} className="flex-shrink-0 mt-0.5 text-peach/35" aria-label="Learning insight" />
          <span>{entry.learningInsight}</span>
        </p>
      )}
    </motion.div>
  );
}

// ─── Concept Victory Modal ──────────────────────────────────────────────────
const SHARE_URL = "https://contextle.online";

function ConceptVictoryModal({
  word,
  guessCount,
  newLevel,
  elapsedSeconds,
  concept,
  onNext,
}: {
  word: string;
  guessCount: number;
  newLevel: number;
  elapsedSeconds: number;
  concept: ConceptReveal | null;
  onNext: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const categoryLabel = concept ? GAME_CATEGORY_LABELS[concept.category] : null;

  // Spoiler-free share text: avoids raw emojis and em dashes per strict UI standards
  const buildShareText = () => {
    return [
      "Contextle: Daily Concept Mystery Solved",
      categoryLabel ? `Category: ${categoryLabel}` : null,
      `Guesses: ${guessCount}`,
      `Time: ${formatDuration(elapsedSeconds)}`,
      `Rank: 1/1000`,
      "",
      "Can you beat my score?",
      `Play at: ${SHARE_URL}`,
    ]
      .filter((line) => line !== null)
      .join("\n");
  };

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(buildShareText())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="glass rounded-2xl p-6 max-w-sm w-full border border-peach/30 shadow-[0_30px_70px_rgba(0,0,0,0.8)]"
      >
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-xl flex items-center justify-center bg-peach/10 border border-peach/20">
            <Award size={18} className="text-peach" aria-label="Victory badge" />
          </div>
          <h2 className="font-bold text-lg text-peach-light tracking-tight mb-1">Mystery Solved</h2>
          <p className="text-peach/55 text-xs leading-relaxed mb-1">
            The concept was &ldquo;<span className="text-peach font-semibold">{word}</span>&rdquo; - solved in{" "}
            {guessCount} guesses.
          </p>
          {categoryLabel && (
            <span className="inline-block mt-1 mb-4 px-2 py-0.5 rounded-full bg-slateDark-700/4 border border-slateDark-600/6 text-[10px] font-semibold text-peach/55 uppercase tracking-wide">
              {categoryLabel}
            </span>
          )}

          {concept && concept.takeaways.some(Boolean) && (
            <div className="text-left mb-5 mt-3 rounded-xl border border-peach/20 bg-peach/10 p-3.5 space-y-2 text-peach">
              <p className="text-[10px] font-bold text-peach/55 uppercase tracking-widest mb-1.5">
                Key Takeaways
              </p>
              {concept.takeaways.filter(Boolean).map((fact, i) => (
                <p key={i} className="text-xs text-peach/75 leading-relaxed flex gap-2">
                  <span className="text-peach font-bold">{i + 1}.</span>
                  <span>{fact}</span>
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2 mb-2.5">
            <button
              onClick={handleWhatsAppShare}
              style={{ backgroundColor: "#25D366" }}
              className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-xs text-white hover:brightness-110 transition-all duration-150 flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
            >
              <MessageCircle size={14} aria-label="WhatsApp icon" /> Share on WhatsApp
            </button>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-peach/75 bg-slateDark-700/3 hover:bg-slateDark-700/6 border border-slateDark-600/8 transition-all duration-150 active:scale-[0.98] cursor-pointer"
              aria-label="Copy share text"
              title={copied ? "Copied!" : "Copy share text"}
            >
              {copied ? <Check size={14} className="text-peach" /> : <Share2 size={14} />}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onNext}
              className="flex-1 py-2 px-4 rounded-lg font-semibold text-xs text-slateDark-900 bg-peach hover:bg-peach-light active:bg-peach-dark transition-all duration-150 flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98]"
            >
              Continue to Level {newLevel} <ChevronRight size={14} />
            </button>
          </div>
          {copied && <p className="text-[10px] text-peach mt-2">Share text copied!</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

const CATEGORY_OPTIONS: GameCategory[] = ["foundations", "science", "finance", "advanced"];

export default function GameClientView({ initialUser }: { initialUser: User | null }) {
  useCountdown();
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(!initialUser);
  const [inputValue, setInputValue] = useState("");
  const [guesses, setGuesses] = useState<GuessEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingWord, setGeneratingWord] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wonWord, setWonWord] = useState<string | null>(null);
  const [wonLevel, setWonLevel] = useState<number | null>(null);
  const [wonConcept, setWonConcept] = useState<ConceptReveal | null>(null);
  const [activeClueIndex, setActiveClueIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [streak] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("contextle_daily_streak");
      if (s) return parseInt(s, 10);
    }
    return 5;
  });
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>("foundations");
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const gameArenaRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    if (!gameStartedAt || wonWord) return;
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - gameStartedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gameStartedAt, wonWord]);

  // Streak persistence
  useEffect(() => {
    if (!localStorage.getItem("contextle_daily_streak")) {
      localStorage.setItem("contextle_daily_streak", "5");
    }
  }, []);

  const supabase = createClient();
  const sorted = [...guesses].sort((a, b) => a.rank - b.rank);
  const bestRank = sorted[0]?.rank;
  const gameContent = parseGameContent(profile?.current_story);

  // Sync profile
  useEffect(() => {
    const syncProfile = async () => {
      setAuthLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (res.ok && data.success && data.profile) {
          setProfile(data.profile as UserProfile);
        } else {
          console.error("[contextle] Failed to sync profile:", data.error);
          setError(data.error ?? "Failed to initialize user profile.");
        }
      } catch (err) {
        console.error("[contextle] Error during profile sync:", err);
        setError("Network error synchronizing user profile.");
      } finally {
        setAuthLoading(false);
      }
    };

    if (user) {
      syncProfile();
    } else {
      supabase.auth.getUser().then(({ data: { user: u } }) => {
        setUser(u);
        if (u) syncProfile();
        else setAuthLoading(false);
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await syncProfile();
      } else {
        setProfile(null);
        setGuesses([]);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local Storage Guess Persistence
  useEffect(() => {
    if (profile) {
      const savedKey = `contextle_guesses_${profile.id}_${profile.current_level}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          queueMicrotask(() => setGuesses(parsed));
        } catch {
          queueMicrotask(() => setGuesses([]));
        }
      } else {
        queueMicrotask(() => setGuesses([]));
      }
    } else {
      queueMicrotask(() => setGuesses([]));
    }
  }, [profile]);

  useEffect(() => {
    if (profile && guesses.length > 0) {
      const savedKey = `contextle_guesses_${profile.id}_${profile.current_level}`;
      localStorage.setItem(savedKey, JSON.stringify(guesses));
    }
  }, [guesses, profile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setGuesses([]);
    window.location.href = "/";
  };

  const handleGenerateWord = async () => {
    if (!user || generatingWord) return;
    setGeneratingWord(true);
    setError(null);
    try {
      const solvedKey = `contextle_solved_words_${user.id}`;
      const solvedRaw = localStorage.getItem(solvedKey);
      const solvedWords = solvedRaw ? JSON.parse(solvedRaw) : [];

      const res = await fetch("/api/generate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excludeWords: solvedWords,
          level: profile?.current_level ?? 1,
          category: selectedCategory,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setActiveClueIndex(0);
        setDropdownOpen(false);
        setGameStartedAt(null);
        setElapsedSeconds(0);
        const profileRes = await fetch("/api/profile");
        const profileData = await profileRes.json();
        if (profileRes.ok && profileData.success && profileData.profile) {
          setProfile(profileData.profile);
        }
      } else {
        setError(data.error ?? "Failed to generate word.");
      }
    } catch {
      setError("Network error generating word.");
    } finally {
      setGeneratingWord(false);
    }
  };

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!user) return;
      const word = inputValue;
      if (!word.trim() || isLoading || wonWord || !profile?.active_word) return;

      setError(null);
      setIsLoading(true);
      const startedAt = gameStartedAt ?? Date.now();
      if (!gameStartedAt) setGameStartedAt(startedAt);
      const timeTakenSeconds = Math.round((Date.now() - startedAt) / 1000);
      try {
        const res = await fetch("/api/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word,
            level: profile?.current_level,
            guessedWords: guesses.map((g) => g.word),
            timeTakenSeconds,
          }),
        });
        const data: GuessResponse & { error?: string } = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? "Evaluation failed.");
          return;
        }

        const entry: GuessEntry = { ...data, id: `${word}-${Date.now()}`, timestamp: Date.now() };
        setGuesses((prev) => [entry, ...prev]);
        setInputValue("");

        if ((entry.isCorrect || entry.isSynonymWin) && data.newLevel) {
          setWonWord(word);
          setWonLevel(data.newLevel);
          setWonConcept(data.concept ?? null);

          const solvedKey = `contextle_solved_words_${user.id}`;
          const solvedRaw = localStorage.getItem(solvedKey);
          const solvedWords = solvedRaw ? JSON.parse(solvedRaw) : [];
          if (!solvedWords.includes(word)) {
            solvedWords.push(word);
            localStorage.setItem(solvedKey, JSON.stringify(solvedWords));
          }

          if (profile) {
            const savedKey = `contextle_guesses_${profile.id}_${profile.current_level}`;
            localStorage.removeItem(savedKey);
          }
        }
      } catch {
        setError("Network error. Check connection.");
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [inputValue, isLoading, wonWord, guesses, profile, user, gameStartedAt]
  );

  const handleNextLevel = () => {
    if (wonLevel && profile) {
      const savedKey = `contextle_guesses_${profile.id}_${profile.current_level}`;
      localStorage.removeItem(savedKey);
      setProfile({ ...profile, current_level: wonLevel, active_word: null });
    }
    setWonWord(null);
    setWonLevel(null);
    setWonConcept(null);
    setGuesses([]);
    setActiveClueIndex(0);
    setDropdownOpen(false);
    setGameStartedAt(null);
    setElapsedSeconds(0);
  };

  const scrollToPlay = () => {
    if (gameArenaRef.current) {
      gameArenaRef.current.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
    }
  };

  if (authLoading || (user && !profile && !error)) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#203C3D]">
        <Loader2 size={24} className="text-[#FEDAB8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#203C3D] text-[#FEDAB8] selection:bg-[#FEDAB8]/20 selection:text-[#FEDAB8]">
      {/* ── Top Floating Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[#FEDAB8]/10 bg-[#203C3D]/95 backdrop-blur-md">
        <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="h-8 flex items-center hover:opacity-90 transition-opacity" aria-label="Contextle Home">
              <Logo className="h-7 w-auto" />
            </Link>
            {profile && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 text-[#FEDAB8] text-[11px] font-semibold tracking-wide uppercase">
                Level {profile.current_level}
              </span>
            )}
            {profile?.active_word && gameStartedAt && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1b3334] border border-[#FEDAB8]/20 text-[#FEDAB8] text-[11px] font-mono font-semibold"
                aria-label="Elapsed time"
              >
                <Timer size={12} />
                {formatDuration(elapsedSeconds)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/battle"
              className="min-h-[44px] px-2 flex items-center gap-1.5 text-xs font-semibold text-[#FEDAB8]/80 hover:text-[#FEDAB8] uppercase tracking-wider transition-colors"
              aria-label="1v1 Battle"
            >
              <Swords size={15} aria-hidden="true" />
              <span className="hidden md:inline">Battle</span>
            </Link>
            <Link
              href="/leaderboard"
              className="min-h-[44px] px-2 flex items-center gap-1.5 text-xs font-semibold text-[#FEDAB8]/80 hover:text-[#FEDAB8] uppercase tracking-wider transition-colors"
              aria-label="Leaderboard"
            >
              <Trophy size={15} aria-hidden="true" />
              <span className="hidden md:inline">Leaderboard</span>
            </Link>
            <Link
              href="/how-to-play"
              className="min-h-[44px] px-2 flex items-center gap-1.5 text-xs font-semibold text-[#FEDAB8]/80 hover:text-[#FEDAB8] uppercase tracking-wider transition-colors border-l border-[#FEDAB8]/15 pl-3"
              aria-label="How to Play"
            >
              <HelpCircle size={15} aria-hidden="true" />
              <span className="hidden md:inline">How to Play</span>
            </Link>
            {user && (
              <div className="flex items-center gap-2 border-l border-[#FEDAB8]/15 pl-3">
                {user.user_metadata?.avatar_url ? (
                  <Image
                    src={user.user_metadata.avatar_url}
                    alt="User Avatar"
                    width={26}
                    height={26}
                    className="w-6.5 h-6.5 rounded-full border border-[#FEDAB8]/20"
                  />
                ) : (
                  <div className="w-6.5 h-6.5 rounded-full bg-[#FEDAB8]/20 flex items-center justify-center text-[10px] text-[#FEDAB8] font-bold border border-[#FEDAB8]/30">
                    {(user.user_metadata?.full_name?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md text-[#FEDAB8]/60 hover:text-peach transition-colors cursor-pointer"
                  aria-label="Logout"
                >
                  <LogOut size={13} />
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero Section (Slate Gray & Peach Fuzz) ────────────────────────── */}
      <section
        aria-labelledby="hero-title"
        className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 text-center flex flex-col items-center relative"
      >
        <div className="flex items-center gap-1.5 mb-5 px-3.5 py-1 rounded-full bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 text-[#FEDAB8] text-xs font-bold tracking-wide">
          <Flame size={14} aria-label="Streak icon" />
          <span>{streak} Days Streak</span>
        </div>

        <h1
          id="hero-title"
          className="font-bold text-4xl sm:text-6xl md:text-7xl text-[#FEDAB8] tracking-tight leading-[1.08] max-w-4xl mb-4 font-space-grotesk"
        >
          Deduce the Mystery Concept.
        </h1>

        <p className="text-base sm:text-lg text-[#FEDAB8]/80 max-w-2xl leading-relaxed mb-8 font-normal">
          Type any word to probe the semantic vector space. Contextle measures
          conceptual proximity in real time - guiding you from freezing cold
          to scorching hot until you crack the secret idea.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md z-10 mb-10">
          <button
            onClick={scrollToPlay}
            className="w-full sm:w-auto relative group min-h-[48px] px-8 py-3.5 rounded-xl font-bold text-sm sm:text-base text-[#203C3D] bg-[#FEDAB8] hover:bg-[#ffe8d4] active:scale-[0.98] transition-all duration-200 shadow-[0_0_30px_rgba(254,218,184,0.3)] hover:shadow-[0_0_40px_rgba(254,218,184,0.5)] flex items-center justify-center gap-2.5 cursor-pointer"
            aria-label="Play Daily Mystery"
          >
            <span
              className="absolute inset-0 rounded-xl border-2 border-[#FEDAB8] opacity-60 animate-ping pointer-events-none group-hover:opacity-80"
              aria-hidden="true"
              style={{ animationDuration: "2.5s" }}
            />
            <span>Play Daily Mystery</span>
            <ArrowRight size={16} className="text-[#203C3D] group-hover:translate-x-1 transition-transform" />
          </button>
          <Link
            href="/battle"
            className="w-full sm:w-auto min-h-[48px] px-7 py-3.5 rounded-xl border border-[#FEDAB8]/40 hover:border-[#FEDAB8] hover:bg-[#FEDAB8]/10 text-[#FEDAB8] font-semibold text-sm sm:text-base transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98]"
            aria-label="1v1 Battle a Friend"
          >
            <Swords size={16} aria-hidden="true" />
            <span>1v1 Battle a Friend</span>
          </Link>
        </div>

        {/* 3 Micro-Cards inline minimal row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full text-left pt-6 border-t border-[#FEDAB8]/10">
          <div className="p-5 rounded-xl bg-[#1b3334] border border-[#FEDAB8]/15 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8]">
              <Search size={15} aria-label="Search icon" />
            </div>
            <h3 className="font-bold text-sm text-[#FEDAB8]">1. Guess Anything</h3>
            <p className="text-xs text-[#FEDAB8]/70 leading-relaxed">
              Enter any word or concept related to the clue.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#1b3334] border border-[#FEDAB8]/15 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8]">
              <Compass size={15} aria-label="Compass icon" />
            </div>
            <h3 className="font-bold text-sm text-[#FEDAB8]">2. Read the Proximity</h3>
            <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Temperature proximity: Ice to Warm to Scorching">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slateDark-600/20 border border-slateDark-600/50 text-peach/50 text-[11px] font-semibold">
                <Snowflake size={11} aria-label="Ice tier" /> Ice
              </span>
              <span className="text-[#FEDAB8]/40">→</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-peach-light/10 border border-peach-light/30 text-peach-light text-[11px] font-semibold">
                <Zap size={11} aria-label="Warm tier" /> Warm
              </span>
              <span className="text-[#FEDAB8]/40">→</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-peach/10 border border-peach/40 text-peach text-[11px] font-semibold">
                <Flame size={11} aria-label="Scorching tier" /> Scorching
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#1b3334] border border-[#FEDAB8]/15 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8]">
              <Trophy size={15} aria-label="Trophy icon" />
            </div>
            <h3 className="font-bold text-sm text-[#FEDAB8]">3. Win &amp; Learn</h3>
            <p className="text-xs text-[#FEDAB8]/70 leading-relaxed">
              Reach Rank 1 and unlock the daily concept takeaway card.
            </p>
          </div>
        </div>
      </section>

      {/* ── Active Game Arena ─────────────────────────────────────────────── */}
      <div
        id="game-arena"
        ref={gameArenaRef}
        className="flex-1 max-w-5xl mx-auto w-full px-4 pb-24 pt-8 flex flex-col lg:flex-row gap-6 lg:gap-8 items-start scroll-mt-20"
      >
        <main className="flex-1 max-w-2xl mx-auto w-full flex flex-col">
          {/* Mystery Briefing */}
          {profile?.active_word && gameContent?.mysteryHook && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-5 border border-[#FEDAB8]/20 bg-[#1b3334] relative overflow-hidden mb-4 z-10"
            >
              <div className="flex items-center gap-2 mb-2">
                <Eye size={13} className="text-[#FEDAB8]" aria-label="Case briefing" />
                <h3 className="text-[10px] font-bold text-[#FEDAB8] uppercase tracking-widest">
                  Mystery Briefing · {GAME_CATEGORY_LABELS[gameContent.category]}
                </h3>
              </div>
              <p className="text-[#FEDAB8]/90 text-sm leading-relaxed font-medium">
                {gameContent.mysteryHook}
              </p>
            </motion.div>
          )}

          {/* AI Clue Stories */}
          {profile?.active_word && gameContent && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-5 border border-[#FEDAB8]/15 bg-[#1b3334] relative overflow-hidden mb-6 z-20"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#FEDAB8] animate-pulse" />
                <h3 className="text-[10px] font-bold text-[#FEDAB8]/70 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[#FEDAB8]" aria-label="Clues" />
                  AI Clue Stories
                </h3>
              </div>

              {gameContent.stories.length > 1 && (
                <div className="relative mb-4 z-20">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#203C3D] border border-[#FEDAB8]/20 text-[10px] font-bold text-[#FEDAB8] transition-all cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={11} className="text-[#FEDAB8]" />
                      Clue {activeClueIndex + 1}
                    </span>
                    <ChevronDown
                      size={12}
                      className={`text-[#FEDAB8]/60 transition-transform duration-200 ${
                        dropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-[#16292a] border border-[#FEDAB8]/20 shadow-2xl z-30 overflow-hidden py-1">
                      {gameContent.stories.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setActiveClueIndex(idx);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[10px] font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                            activeClueIndex === idx
                              ? "bg-[#FEDAB8]/15 text-[#FEDAB8] font-bold"
                              : "text-[#FEDAB8]/60 hover:bg-[#FEDAB8]/10 hover:text-[#FEDAB8]"
                          }`}
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${
                              activeClueIndex === idx ? "bg-[#FEDAB8]" : "bg-transparent"
                            }`}
                          />
                          Clue {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="text-[#FEDAB8]/90 text-xs leading-relaxed font-medium italic min-h-[50px]">
                {gameContent.stories[activeClueIndex] || ""}
              </p>

              <div className="mt-4 pt-3 border-t border-[#FEDAB8]/10 flex items-center justify-between text-[9px] text-[#FEDAB8]/50 font-mono">
                <span>CLUE ACTIVE</span>
                <span>LEVEL {profile.current_level}</span>
              </div>
            </motion.div>
          )}

          {/* Take the Word Card */}
          {!profile?.active_word ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-14 px-6 border border-[#FEDAB8]/15 rounded-2xl bg-[#1b3334] flex flex-col items-center justify-center relative overflow-hidden"
            >
              <div className="w-12 h-12 mb-4 rounded-xl flex items-center justify-center bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 text-[#FEDAB8]">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <h2 className="text-[#FEDAB8] font-bold text-base mb-1.5">
                Ready for Level {profile?.current_level ?? 1}
              </h2>
              <p className="text-[#FEDAB8]/70 text-xs max-w-sm mb-5 leading-relaxed">
                Choose a case category, then let the AI brief you on a new concept to crack.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-6 w-full max-w-xs" role="radiogroup" aria-label="Mystery category">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="radio"
                    aria-checked={selectedCategory === cat}
                    onClick={() => setSelectedCategory(cat)}
                    disabled={generatingWord}
                    className={`px-3 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border disabled:opacity-50 ${
                      selectedCategory === cat
                        ? "bg-[#FEDAB8]/20 border-[#FEDAB8]/50 text-[#FEDAB8]"
                        : "bg-[#203C3D] border-[#FEDAB8]/15 text-[#FEDAB8]/60 hover:border-[#FEDAB8]/30 hover:text-[#FEDAB8]"
                    }`}
                  >
                    {GAME_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerateWord}
                disabled={generatingWord}
                className="min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-semibold text-[#203C3D] bg-[#FEDAB8] hover:bg-[#ffe8d4] shadow-[0_4px_20px_rgba(254,218,184,0.25)] disabled:opacity-50 disabled:pointer-events-none hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                {generatingWord ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-[#203C3D]" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Dices size={15} aria-label="Roll dice" />
                    Take the Word
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Guess Input */}
              <motion.form
                onSubmit={handleSubmit}
                className="relative"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.3 }}
              >
                <label htmlFor="guess-input" className="sr-only">
                  Enter your guess word
                </label>
                <div className="flex items-center gap-2 p-1.5 rounded-xl border border-[#FEDAB8]/20 bg-[#1b3334] focus-within:border-[#FEDAB8] focus-within:shadow-[0_0_20px_rgba(254,218,184,0.15)] transition-all duration-200">
                  <div className="pl-2.5 text-[#FEDAB8]/60">
                    <Search size={15} aria-hidden="true" />
                  </div>
                  <input
                    ref={inputRef}
                    id="guess-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setError(null);
                    }}
                    placeholder="Type a guess word..."
                    disabled={isLoading || !!wonWord}
                    maxLength={64}
                    className="flex-1 bg-transparent text-[#FEDAB8] placeholder-[#FEDAB8]/40 text-xs outline-none py-2 disabled:opacity-40 font-medium"
                  />
                  <button
                    type="submit"
                    aria-label="Submit guess"
                    disabled={!inputValue.trim() || isLoading || !!wonWord}
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#203C3D] bg-[#FEDAB8] hover:bg-[#ffe8d4] disabled:opacity-30 disabled:bg-[#203C3D] disabled:text-[#FEDAB8]/40 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer"
                  >
                    {isLoading ? <Loader2 size={13} className="animate-spin text-[#203C3D]" /> : <ArrowRight size={13} />}
                  </button>
                </div>
              </motion.form>

              {/* Error Message */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-xs text-red-400 font-medium my-2"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Guess History */}
              <section className="w-full" aria-label="Guess History">
                {guesses.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 border border-dashed border-[#FEDAB8]/15 rounded-2xl bg-[#1b3334] relative overflow-hidden"
                  >
                    <div className="w-10 h-10 mx-auto mb-3.5 rounded-xl flex items-center justify-center bg-[#203C3D] border border-[#FEDAB8]/15">
                      <Activity size={16} className="text-[#FEDAB8]/60" />
                    </div>
                    <p className="text-[#FEDAB8] text-xs font-semibold mb-1">
                      Level {profile?.current_level ?? 1} Word Active
                    </p>
                    <p className="text-[#FEDAB8]/60 text-[11px] mb-4">
                      Type any English noun to search the vector space.
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-[#FEDAB8] text-xs">
                      <Star size={12} className="fill-[#FEDAB8]" />
                      <Star size={12} className="fill-[#FEDAB8]" />
                      <Star size={12} className="fill-[#FEDAB8]" />
                      <Star size={12} className="fill-[#FEDAB8]" />
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[10px] font-bold text-[#FEDAB8]/60 uppercase tracking-widest">History</h2>
                        <div className="flex items-center gap-0.5 text-[9px] text-[#FEDAB8] font-semibold px-1 rounded bg-[#FEDAB8]/10 border border-[#FEDAB8]/20">
                          <Star size={10} className="fill-[#FEDAB8]" />
                          <Star size={10} className="fill-[#FEDAB8]" />
                          <Star size={10} className="fill-[#FEDAB8]" />
                        </div>
                      </div>
                      <span className="text-[10px] text-[#FEDAB8]/60 font-mono">
                        {guesses.length} {guesses.length === 1 ? "guess" : "guesses"}
                      </span>
                    </div>
                    <motion.div layout className="space-y-2.5">
                      <AnimatePresence initial={false}>
                        {sorted.map((e) => (
                          <GuessCard key={e.id} entry={e} />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                )}
              </section>

              {/* Progress Summary */}
              <motion.aside
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 rounded-xl p-4 border border-[#FEDAB8]/15 bg-[#1b3334] flex items-center justify-between"
                aria-label="Player Statistics"
              >
                <div>
                  <p className="text-xs font-semibold text-[#FEDAB8]">Your Progress</p>
                  <p className="text-[10px] text-[#FEDAB8]/60 mt-0.5">Performance tracking this level</p>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs font-mono font-bold text-[#FEDAB8]">{guesses.length}</p>
                    <p className="text-[9px] text-[#FEDAB8]/50 uppercase tracking-wider font-semibold">Guesses</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono font-bold text-peach">#{bestRank ?? "-"}</p>
                    <p className="text-[9px] text-[#FEDAB8]/50 uppercase tracking-wider font-semibold">Best</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono font-bold text-[#FEDAB8]">{profile?.current_level ?? 1}</p>
                    <p className="text-[9px] text-[#FEDAB8]/50 uppercase tracking-wider font-semibold">Level</p>
                  </div>
                </div>
              </motion.aside>
            </div>
          )}
        </main>

        <aside className="w-full lg:w-72 flex-shrink-0 mt-8 lg:mt-0 order-last">
          <Leaderboard />
        </aside>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#FEDAB8]/10 py-6 mt-auto bg-[#1b3334]">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs text-[#FEDAB8]/70 mb-3">Contextle · Semantic AI Word Deduction</p>
          <div className="flex items-center justify-center gap-5 text-xs text-[#FEDAB8]/60">
            <Link href="/about" className="hover:text-[#FEDAB8] transition-colors">
              About
            </Link>
            <span>·</span>
            <Link href="/contact" className="hover:text-[#FEDAB8] transition-colors">
              Contact
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-[#FEDAB8] transition-colors">
              Privacy
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-[#FEDAB8] transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      {/* Victory Modal */}
      <AnimatePresence>
        {wonWord && wonLevel && (
          <ConceptVictoryModal
            word={wonWord}
            guessCount={guesses.length}
            newLevel={wonLevel}
            elapsedSeconds={elapsedSeconds}
            concept={wonConcept}
            onNext={handleNextLevel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

