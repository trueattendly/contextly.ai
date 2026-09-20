"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  Swords,
  Trophy,
  HelpCircle,
  Cpu,
  BookOpen,
  Check,
  X,
  Search,
  Compass,
  Flame,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import PlayDailyButton from "@/components/PlayDailyButton";
import InteractiveHudDemo from "@/components/InteractiveHudDemo";
import type { User } from "@supabase/supabase-js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface LandingPageProps {
  user?: User | null;
  onPlay?: () => void;
}

const FAQ_ITEMS = [
  {
    question: "How does Contextle calculate semantic distance?",
    answer:
      "Contextle utilizes high-dimensional semantic vector embeddings and a 6-tier AI inference pipeline. Instead of looking at spelling or letter counts, our models evaluate conceptual relatedness and contextual proximity in real time, scoring each guess between Rank 1 (exact match) and Rank 1000 (conceptually distant).",
  },
  {
    question: "Can I play against friends in real time?",
    answer:
      "Yes. Contextle features synchronized 1v1 battle rooms with turn quotas (Easy: 10, Medium: 15, Hard: 20 guesses). Players race on identical secret words while viewing blind opponent rank progress without spoiling the target concept.",
  },
  {
    question: "Is Contextle completely free to play?",
    answer:
      "Yes. Contextle is 100% free to play daily with zero paywalls, zero subscription fees, and no required credit card. You can play solo rounds or challenge friends without restrictions.",
  },
  {
    question: "How does the weekly leaderboard calculate winners?",
    answer:
      "The weekly leaderboard ranks players based on speed and efficiency: solving daily mysteries in the fewest guesses and shortest elapsed time. Synchronized timestamps ensure verifiable and competitive scoring.",
  },
];

const COMPARISON_ROWS = [
  {
    criteria: "Game Objective",
    contexto: "Random dictionary word guessing",
    contextle: "Thematic concept deduction with real-world context",
  },
  {
    criteria: "Feedback Type",
    contexto: "Raw numerical rank only",
    contextle: "Semantic proximity tiers: Ice, Warm, Scorching + insights",
  },
  {
    criteria: "Educational Value",
    contexto: "None: purely mechanical guess loops",
    contextle: "Thematic case briefing + 3-bullet Aha! takeaway card",
  },
  {
    criteria: "Multiplayer Experience",
    contexto: "None: solo play only",
    contextle: "Synchronized live 1v1 duel with timers and quota caps",
  },
  {
    criteria: "Guess Format",
    contexto: "Unlimited guesses (leads to player fatigue)",
    contextle: "Strategic quota matches (10, 15, or 20 turns)",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": ["WebApplication", "VideoGame"],
  name: "Contextle",
  url: "https://contextle.online",
  description:
    "Crack concepts, not just letters. Contextle is the futuristic AI-powered semantic word deduction game with real-time vector proximity ranks, 1v1 duels, and daily concept takeaways.",
  applicationCategory: ["GameApplication", "EducationalApplication"],
  operatingSystem: "Any (Web Browser)",
  browserRequirements: "Requires HTML5.",
  genre: "Puzzle, Word Game, Educational",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to deduce daily mystery concepts on Contextle",
  step: [
    { "@type": "HowToStep", text: "Input any related word or idea to search the semantic vector space." },
    { "@type": "HowToStep", text: "The engine evaluates contextual semantic distance in sub-500ms." },
    { "@type": "HowToStep", text: "Narrow your path using hot, warm, and cool distance tiers." },
    { "@type": "HowToStep", text: "Reach Rank 1 to unlock the mystery card and submit your score to the leaderboard." },
  ],
};

export default function LandingPage({ user, onPlay }: LandingPageProps) {
  const isAuthenticated = Boolean(user);
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const matrixRef = useRef<HTMLElement>(null);
  const explainerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // 1. Hero Reveal: elements fade and float upwards on initial load
      if (heroRef.current) {
        gsap.from(heroRef.current.querySelectorAll(".gsap-hero-item"), {
          y: 35,
          opacity: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: "power3.out",
        });
      }

      // 2. Feature Cards Stagger on Scroll
      if (featuresRef.current) {
        gsap.from(featuresRef.current.querySelectorAll(".gsap-feature-card"), {
          scrollTrigger: {
            trigger: featuresRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
          y: 40,
          opacity: 0,
          duration: 0.7,
          stagger: 0.15,
          ease: "power2.out",
        });
      }

      // 3. Comparison Matrix Rows Highlight on Scroll
      if (matrixRef.current) {
        const rows = matrixRef.current.querySelectorAll(".gsap-matrix-row");
        rows.forEach((row) => {
          gsap.fromTo(
            row,
            { opacity: 0.5, y: 15 },
            {
              opacity: 1,
              y: 0,
              duration: 0.5,
              ease: "power2.out",
              scrollTrigger: {
                trigger: row,
                start: "top 85%",
                toggleActions: "play reverse play reverse",
              },
            }
          );
        });
      }

      // 4. Visual Explainer Step Cards Stagger
      if (explainerRef.current) {
        gsap.from(explainerRef.current.querySelectorAll(".gsap-step-card"), {
          scrollTrigger: {
            trigger: explainerRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
          y: 30,
          opacity: 0,
          duration: 0.6,
          stagger: 0.12,
          ease: "power2.out",
        });
      }
    }, containerRef);

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <>
      {/* Structured Data for Search Engines, Perplexity & GEO Crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      <div
        ref={containerRef}
        className="min-h-dvh flex flex-col bg-[#203C3D] text-[#FEDAB8] selection:bg-[#FEDAB8]/20 selection:text-[#FEDAB8]"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-[#FEDAB8]/10 bg-[#203C3D]/95 backdrop-blur-md">
          <nav
            aria-label="Primary Navigation"
            className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="h-8 flex items-center hover:opacity-90 transition-opacity"
                aria-label="Contextle Home"
              >
                <Logo className="h-7 w-auto" />
              </Link>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <Link
                href="/battle"
                className="min-h-[44px] px-2 flex items-center gap-1.5 text-xs font-semibold text-[#FEDAB8]/80 hover:text-[#FEDAB8] uppercase tracking-wider transition-colors"
                aria-label="1v1 Battle mode"
              >
                <Swords size={15} aria-hidden="true" />
                <span className="hidden sm:inline">1v1 Battle</span>
              </Link>
              <Link
                href="/leaderboard"
                className="min-h-[44px] px-2 flex items-center gap-1.5 text-xs font-semibold text-[#FEDAB8]/80 hover:text-[#FEDAB8] uppercase tracking-wider transition-colors"
                aria-label="Leaderboard"
              >
                <Trophy size={15} aria-hidden="true" />
                <span className="hidden sm:inline">Leaderboard</span>
              </Link>
              <Link
                href="/how-to-play"
                className="min-h-[44px] px-2 flex items-center gap-1.5 text-xs font-semibold text-[#FEDAB8]/80 hover:text-[#FEDAB8] uppercase tracking-wider transition-colors"
                aria-label="How to Play"
              >
                <HelpCircle size={15} aria-hidden="true" />
                <span className="hidden sm:inline">How to Play</span>
              </Link>

              {isAuthenticated ? (
                <div className="flex items-center gap-2 border-l border-[#FEDAB8]/15 pl-4">
                  <span className="px-2.5 py-1 rounded-full bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 text-[11px] font-semibold text-[#FEDAB8] tracking-wide">
                    {user?.user_metadata?.full_name?.split(" ")[0] ?? "Player"}
                  </span>
                </div>
              ) : (
                <div className="border-l border-[#FEDAB8]/15 pl-4">
                  <PlayDailyButton
                    isAuthenticated={false}
                    label="Sign In"
                    className="min-h-[38px] px-4 py-1.5 text-xs !shadow-none"
                  />
                </div>
              )}
            </div>
          </nav>
        </header>

        {/* ── Main Showcase Content ────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center">
          {/* ── Section 1: Dynamic Hero (Above the Fold) ───────────────────── */}
          <section
            ref={heroRef}
            aria-labelledby="hero-title"
            className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 text-center flex flex-col items-center relative"
          >
            {/* Ambient Background Glow */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[400px] rounded-full bg-[#FEDAB8]/5 blur-[140px] pointer-events-none"
              aria-hidden="true"
            />

            {/* Status Badge */}
            <div className="gsap-hero-item inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 text-xs font-semibold text-[#FEDAB8] tracking-wide uppercase mb-6">
              <Sparkles size={14} className="text-[#FEDAB8]" aria-hidden="true" />
              <span>Daily Semantic Deduction - Zero Mechanical Guessing</span>
            </div>

            {/* Headline (H1) */}
            <h1
              id="hero-title"
              className="gsap-hero-item font-bold text-4xl sm:text-6xl md:text-7xl text-[#FEDAB8] tracking-tight leading-[1.08] max-w-4xl mb-5 font-space-grotesk"
            >
              Crack Concepts, Not Just Letters.
            </h1>

            {/* Subheadline */}
            <p className="gsap-hero-item text-base sm:text-lg md:text-xl text-[#FEDAB8]/80 max-w-2xl leading-relaxed mb-9 font-normal">
              Contextle maps your guesses in high-dimensional semantic space. Move
              from Ice Cold to Scorching Hot using AI-calculated contextual
              proximity.
            </p>

            {/* Dual CTA Buttons */}
            <div className="gsap-hero-item flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md z-10 mb-12">
              <PlayDailyButton
                isAuthenticated={isAuthenticated}
                onPlay={onPlay}
                label="Play Today's Mystery"
                className="w-full sm:w-auto"
              />
              <Link
                href="/battle"
                className="w-full sm:w-auto min-h-[48px] px-7 py-3.5 rounded-xl border border-[#FEDAB8]/40 hover:border-[#FEDAB8] hover:bg-[#FEDAB8]/10 text-[#FEDAB8] font-semibold text-sm sm:text-base transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98]"
                aria-label="1v1 Duel a Friend"
              >
                <Swords size={16} aria-hidden="true" />
                <span>1v1 Duel a Friend</span>
              </Link>
            </div>

            {/* Hero Visual: Interactive Micro-HUD Demo */}
            <div className="gsap-hero-item w-full flex justify-center z-10">
              <InteractiveHudDemo />
            </div>
          </section>

          {/* ── Section 2: Why Contextle? (Feature Grid) ───────────────────── */}
          <section
            ref={featuresRef}
            aria-labelledby="features-title"
            className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-20 border-t border-[#FEDAB8]/10"
          >
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2
                id="features-title"
                className="text-xs font-bold uppercase tracking-widest text-[#FEDAB8]/60 mb-2"
              >
                Why Contextle
              </h2>
              <p className="font-bold text-2xl sm:text-3xl text-[#FEDAB8] font-space-grotesk tracking-tight">
                Architected for Semantic Discovery, Not Rote Word Lists.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1: Multi-Tier AI Inference */}
              <article className="gsap-feature-card p-6 sm:p-7 rounded-2xl bg-[#1b3334] border border-[#FEDAB8]/15 hover:border-[#FEDAB8]/35 transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8] mb-5">
                    <Cpu size={22} aria-label="AI Inference pipeline icon" />
                  </div>
                  <h3 className="font-bold text-lg text-[#FEDAB8] mb-2.5 tracking-tight">
                    Multi-Tier AI Inference
                  </h3>
                  <p className="text-xs sm:text-sm text-[#FEDAB8]/75 leading-relaxed">
                    Sub-500ms semantic proximity scoring via a dedicated 6-tier
                    fallback pipeline. Contextle never hallucinates or halts:
                    every guess resolves against genuine contextual embeddings.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#FEDAB8]/10 flex items-center gap-2 text-[11px] font-mono text-[#FEDAB8]/60">
                  <Check size={13} className="text-emerald-400" />
                  <span>Sub-500ms response time</span>
                </div>
              </article>

              {/* Feature 2: Concept Briefing & Aha Takeaways */}
              <article className="gsap-feature-card p-6 sm:p-7 rounded-2xl bg-[#1b3334] border border-[#FEDAB8]/15 hover:border-[#FEDAB8]/35 transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8] mb-5">
                    <BookOpen size={22} aria-label="Concept briefing icon" />
                  </div>
                  <h3 className="font-bold text-lg text-[#FEDAB8] mb-2.5 tracking-tight">
                    Concept Briefing &amp; Aha Takeaways
                  </h3>
                  <p className="text-xs sm:text-sm text-[#FEDAB8]/75 leading-relaxed">
                    Every mystery begins with a thematic case brief and concludes
                    with a curated 3-bullet takeaway card explaining real-world
                    connections, ensuring you learn every single round.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#FEDAB8]/10 flex items-center gap-2 text-[11px] font-mono text-[#FEDAB8]/60">
                  <Check size={13} className="text-emerald-400" />
                  <span>3-bullet educational reveal</span>
                </div>
              </article>

              {/* Feature 3: Turn-Capped 1v1 Duels */}
              <article className="gsap-feature-card p-6 sm:p-7 rounded-2xl bg-[#1b3334] border border-[#FEDAB8]/15 hover:border-[#FEDAB8]/35 transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8] mb-5">
                    <Swords size={22} aria-label="Turn-capped duels icon" />
                  </div>
                  <h3 className="font-bold text-lg text-[#FEDAB8] mb-2.5 tracking-tight">
                    Turn-Capped 1v1 Duels
                  </h3>
                  <p className="text-xs sm:text-sm text-[#FEDAB8]/75 leading-relaxed">
                    Compete head-to-head with strict quota limits (Easy: 10,
                    Medium: 15, Hard: 20 guesses). Watch live blind opponent
                    proximity shifts in real time without word spoilers.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#FEDAB8]/10 flex items-center gap-2 text-[11px] font-mono text-[#FEDAB8]/60">
                  <Check size={13} className="text-emerald-400" />
                  <span>Live synchronized multiplayer</span>
                </div>
              </article>
            </div>
          </section>

          {/* ── Section 3: The Competitive Matrix (Contexto vs Contextle) ─── */}
          <section
            ref={matrixRef}
            aria-labelledby="matrix-title"
            className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-20 border-t border-[#FEDAB8]/10"
          >
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2
                id="matrix-title"
                className="text-xs font-bold uppercase tracking-widest text-[#FEDAB8]/60 mb-2"
              >
                Competitive Matrix
              </h2>
              <p className="font-bold text-2xl sm:text-3xl text-[#FEDAB8] font-space-grotesk tracking-tight">
                Contextle vs Legacy Word Games
              </p>
            </div>

            <div className="rounded-2xl border border-[#FEDAB8]/20 bg-[#142728] overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#FEDAB8]/15 bg-[#1b3334]">
                      <th className="p-4 sm:p-5 font-bold text-[#FEDAB8] uppercase tracking-wider text-[11px]">
                        Criteria
                      </th>
                      <th className="p-4 sm:p-5 font-bold text-neutral-400 uppercase tracking-wider text-[11px]">
                        Legacy Contexto
                      </th>
                      <th className="p-4 sm:p-5 font-bold text-[#FEDAB8] uppercase tracking-wider text-[11px] bg-[#FEDAB8]/10">
                        Contextle
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FEDAB8]/10">
                    {COMPARISON_ROWS.map((row, idx) => (
                      <tr
                        key={idx}
                        className="gsap-matrix-row hover:bg-[#203C3D]/50 transition-colors"
                      >
                        <td className="p-4 sm:p-5 font-semibold text-[#FEDAB8]/90">
                          {row.criteria}
                        </td>
                        <td className="p-4 sm:p-5 text-neutral-400">
                          <div className="flex items-center gap-2">
                            <X size={14} className="text-rose-400 flex-shrink-0" />
                            <span>{row.contexto}</span>
                          </div>
                        </td>
                        <td className="p-4 sm:p-5 font-semibold text-[#FEDAB8] bg-[#FEDAB8]/5">
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-emerald-400 flex-shrink-0" />
                            <span>{row.contextle}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── Section 4: Visual Explainer (Proximity Engine Workflow) ───── */}
          <section
            ref={explainerRef}
            aria-labelledby="explainer-title"
            className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-20 border-t border-[#FEDAB8]/10"
          >
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2
                id="explainer-title"
                className="text-xs font-bold uppercase tracking-widest text-[#FEDAB8]/60 mb-2"
              >
                Workflow
              </h2>
              <p className="font-bold text-2xl sm:text-3xl text-[#FEDAB8] font-space-grotesk tracking-tight">
                How the Proximity Engine Works
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Step 1 */}
              <div className="gsap-step-card p-5 rounded-2xl bg-[#1b3334] border border-[#FEDAB8]/15 flex flex-col justify-between">
                <div>
                  <span className="font-mono text-xs text-[#FEDAB8]/50 uppercase tracking-widest block mb-2">
                    Step 01
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8] mb-4">
                    <Search size={18} aria-label="Input word icon" />
                  </div>
                  <h3 className="font-bold text-base text-[#FEDAB8] mb-1.5">Input Any Idea</h3>
                  <p className="text-xs text-[#FEDAB8]/70 leading-relaxed">
                    Type any English word, noun, or concept related to the active case brief.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="gsap-step-card p-5 rounded-2xl bg-[#1b3334] border border-[#FEDAB8]/15 flex flex-col justify-between">
                <div>
                  <span className="font-mono text-xs text-[#FEDAB8]/50 uppercase tracking-widest block mb-2">
                    Step 02
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8] mb-4">
                    <Compass size={18} aria-label="AI evaluation icon" />
                  </div>
                  <h3 className="font-bold text-base text-[#FEDAB8] mb-1.5">AI Evaluates Distance</h3>
                  <p className="text-xs text-[#FEDAB8]/70 leading-relaxed">
                    The 6-tier pipeline calculates high-dimensional conceptual proximity in milliseconds.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="gsap-step-card p-5 rounded-2xl bg-[#1b3334] border border-[#FEDAB8]/15 flex flex-col justify-between">
                <div>
                  <span className="font-mono text-xs text-[#FEDAB8]/50 uppercase tracking-widest block mb-2">
                    Step 03
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8] mb-4">
                    <Flame size={18} aria-label="Temperature tiers icon" />
                  </div>
                  <h3 className="font-bold text-base text-[#FEDAB8] mb-1.5">Follow The Tiers</h3>
                  <p className="text-xs text-[#FEDAB8]/70 leading-relaxed">
                    Navigate from Ice Cold to Warm to Scorching to home in on the secret concept.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="gsap-step-card p-5 rounded-2xl bg-[#1b3334] border border-[#FEDAB8]/15 flex flex-col justify-between">
                <div>
                  <span className="font-mono text-xs text-[#FEDAB8]/50 uppercase tracking-widest block mb-2">
                    Step 04
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[#FEDAB8]/10 border border-[#FEDAB8]/20 flex items-center justify-center text-[#FEDAB8] mb-4">
                    <Trophy size={18} aria-label="Victory and takeaways icon" />
                  </div>
                  <h3 className="font-bold text-base text-[#FEDAB8] mb-1.5">Win &amp; Unlock</h3>
                  <p className="text-xs text-[#FEDAB8]/70 leading-relaxed">
                    Hit Rank 1 to unlock the 3-bullet takeaway card and submit your time to the leaderboard.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 5: Semantic FAQ Section (AEO / GEO Optimized) ─────── */}
          <section
            aria-labelledby="faq-title"
            className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-20 border-t border-[#FEDAB8]/10 text-xs sm:text-sm text-[#FEDAB8]/80"
          >
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2
                id="faq-title"
                className="text-xs font-bold uppercase tracking-widest text-[#FEDAB8]/60 mb-2"
              >
                Frequently Asked Questions
              </h2>
              <p className="font-bold text-2xl sm:text-3xl text-[#FEDAB8] font-space-grotesk tracking-tight">
                Everything You Need to Know About Contextle
              </p>
            </div>

            <div className="space-y-3">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-xl border border-[#FEDAB8]/15 bg-[#1b3334] px-5 py-4 transition-all"
                >
                  <summary className="font-semibold text-[#FEDAB8] cursor-pointer list-none flex items-center justify-between gap-3 text-sm sm:text-base">
                    <span>{item.question}</span>
                    <span className="text-[#FEDAB8]/50 group-open:rotate-180 transition-transform flex-shrink-0">
                      ▾
                    </span>
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm leading-relaxed text-[#FEDAB8]/75 pt-2 border-t border-[#FEDAB8]/10">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </main>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t border-[#FEDAB8]/10 py-8 mt-auto bg-[#142728]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FEDAB8]/60">
            <p className="font-medium text-[#FEDAB8]/70">
              Contextle - Futuristic AI Semantic Word Game
            </p>
            <div className="flex items-center gap-6">
              <Link href="/about" className="hover:text-[#FEDAB8] transition-colors">
                About
              </Link>
              <Link href="/contact" className="hover:text-[#FEDAB8] transition-colors">
                Contact
              </Link>
              <Link href="/privacy" className="hover:text-[#FEDAB8] transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-[#FEDAB8] transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
