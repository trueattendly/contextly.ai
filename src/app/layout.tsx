import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import FeedbackWidget from "@/components/FeedbackWidget";
import "./globals.css";

// ─── Fonts ────────────────────────────────────────────────────────────────────
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// ─── Site Constants ───────────────────────────────────────────────────────────
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.contextle.online";
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : undefined;
const SITE_NAME = "Contextle.ai";
const SITE_DESCRIPTION =
  "Play Contextle.ai, the ultimate futuristic AI word game. Guess the secret word using real-time semantic similarity ranks and dynamic AI clue stories. Challenge your brain daily!";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

// ─── Global Metadata ─────────────────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  // ── Core ──────────────────────────────────────────────────────────────────
  title: {
    default: "Contextle - Daily Semantic Word & Concept Guessing Game",
    template: "%s | Contextle",
  },
  description: "Guess the daily secret word or concept using AI semantic similarity ranks and hot/cold clues. Free to play, no signup needed.",
  keywords: [
    "word guessing game",
    "guess word game online",
    "contextle",
    "contextle online",
    "ai word game",
    "daily word puzzle",
    "semantic word game",
    "contextual guessing game",
    "daily vocabulary challenge",
    "concept puzzle",
    "wordle alternative",
    "contextual ai game"
  ],
  authors: [{ name: "Contextle Team", url: SITE_URL }],
  creator: "Contextle",
  publisher: "Contextle",

  // ── Canonical & Robots ────────────────────────────────────────────────────
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Open Graph ────────────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["en_GB", "en_AU"],
    url: SITE_URL,
    siteName: "Contextle",
    title: "Contextle - Ultimate Word Guessing Game Online",
    description: "Crack the daily puzzle in the best word guessing game online using interactive AI context clues.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Contextle - Guess the daily secret word using AI-powered semantic similarity",
        type: "image/png",
      },
    ],
  },

  // ── Twitter / X Cards ─────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    site: "@contextleai",
    creator: "@contextleai",
    title: "Contextle - Word Guessing Game",
    description: "Play the trending AI word guessing game online for free.",
    images: [
      {
        url: OG_IMAGE,
        alt: "Contextle - Daily AI word guessing game",
      },
    ],
  },

  // ── FIX FAVICON BLANK EARTH ICON ISSUE ──
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-48.png', type: 'image/png', sizes: '48x48' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },

  // ── Manifest ──────────────────────────────────────────────────────────────
  manifest: "/site.webmanifest",

  // ── Verification ──────────────────────────────────────────────────────────
  verification: {
    google: 'google-site-verification: google4519ecd0d856ac16.html',
  },

  // ── Category ──────────────────────────────────────────────────────────────
  category: "games",
};

// ─── Viewport ─────────────────────────────────────────────────────────────────
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#203C3D" },
    { media: "(prefers-color-scheme: light)", color: "#203C3D" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect to Supabase - the only third-party origin hit at runtime
            (auth + DB). next/font self-hosts fonts at build time, so there's
            no fonts.googleapis.com/gstatic.com request to preconnect to. */}
        {SUPABASE_ORIGIN && <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />}
        {SUPABASE_ORIGIN && <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />}
      </head>
      <body
        className="font-inter antialiased bg-slateDark-800 text-peach-light selection:bg-peach/35 selection:text-slateDark-900"
        suppressHydrationWarning
      >
        {children}
        <FeedbackWidget />
        <Analytics />
        <GoogleAnalytics gaId="G-QNCFTWNNC6" />
      </body>
    </html>
  );
}
