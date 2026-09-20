# Changelog

All notable changes to this project are documented in this file, per the Strict Changelog & Audit Trail Protocol defined in `agent.md`.

### [2026-09-21 04:30 UTC] - Overhauled Interactive Showcase Landing Page with GSAP ScrollTrigger
- Action: ADDED
- Files Affected: `src/components/InteractiveHudDemo.tsx`, `package.json`
- Description: Added interactive Micro-HUD demo with auto-cycling simulated vector search (Galaxy -> Star -> Sunlight) with live rank feedback, and installed `gsap` dependency.
- Breaking Changes / Migrations: None.

### [2026-09-21 04:30 UTC] - GSAP ScrollTrigger Showcase, Competitive Matrix, and Semantic AEO Layer
- Action: MODIFIED
- Files Affected: `src/app/page.tsx`, `src/components/LandingPage.tsx`
- Description: Overhauled the landing page into a modern, content-rich showcase powered by GSAP ScrollTrigger. Implemented floating hero elements, staggered feature cards (Multi-Tier AI Inference, Concept Briefing, Turn-Capped Duels), a high-contrast Contexto vs Contextle comparison matrix table, a 4-step proximity engine visual explainer, and an accessible semantic FAQ section optimized for AI search engine crawlers (AEO / GEO).
- Breaking Changes / Migrations: None.

### [2026-09-21 04:15 UTC] - Removed Ad Monetization, Paywall Mock, and Unused Next.js Boilerplate Assets
- Action: MODIFIED
- Files Affected: `src/app/layout.tsx`, `src/app/leaderboard/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/components/admin/AdminDashboard.tsx`
- Description: Removed the Google AdSense script tag and adsense-account metadata from `layout.tsx`, the two "Advertisement Space" placeholder banners from the leaderboard page, the "Monetization Readiness Switch" paywall-preview mock card from the admin dashboard, and updated the Privacy Policy and Terms of Service to drop now-inaccurate references to Google AdSense (Privacy Policy section 6 removed and subsequent sections renumbered 6 through 11).
- Breaking Changes / Migrations: None. The app no longer serves any ads; ad revenue via AdSense on this domain stops until reintroduced.

### [2026-09-21 04:15 UTC] - Reduced Third-Party Script Surface
- Action: SECURITY
- Files Affected: `src/app/layout.tsx`
- Description: Removing the third-party AdSense script (`pagead2.googlesyndication.com`) reduces the number of external, arbitrary-code-executing scripts loaded on every page.
- Breaking Changes / Migrations: None.

### [2026-09-21 04:15 UTC] - Deleted Unused Next.js Starter Assets and Orphaned AdSense Verification File
- Action: FIXED
- Files Affected: `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/globe.svg`, `public/window.svg`, `public/ads.txt`
- Description: Deleted the default Next.js starter template SVGs (unreferenced anywhere in the codebase) and `ads.txt`, which is no longer valid once AdSense is removed.
- Breaking Changes / Migrations: None.

### [2026-09-21 03:50 UTC] - Peach Fuzz and Slate Gray Color Theme Migration
- Action: MODIFIED
- Files Affected: `src/app/globals.css`, `src/app/layout.tsx`, `src/types/game.ts`, `src/components/GameClientView.tsx`, `src/components/PlayDailyButton.tsx`, `src/components/FeedbackWidget.tsx`, `src/components/Leaderboard.tsx`, `src/components/HowToPlayModal.tsx`, `src/components/LandingPage.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/how-to-play/page.tsx`, `src/app/battle/page.tsx`, `src/app/battle/[code]/page.tsx`, `src/app/history/page.tsx`, `src/app/stats/page.tsx`, `src/app/leaderboard/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/about/page.tsx`, `src/app/contact/page.tsx`
- Description: Migrated the full player-facing UI from the prior dark neutral, emerald, and violet palette to a Slate Gray (`#203C3D`) and Peach Fuzz (`#FEDAB8`) system. Added `slateDark` and `peach` tokens via Tailwind v4 CSS-first `@theme` config in `globals.css`, retinted backgrounds, borders, text, buttons, inputs, modals, and rank/temperature tier indicators across every player-facing page. Preserved red for error and incorrect-guess states, gold/silver/bronze leaderboard medal colors, and the WhatsApp share button's brand green for semantic clarity.
- Breaking Changes / Migrations: None. Admin panel (`src/app/admin/`, `src/components/admin/`) was intentionally left out of scope.

### [2026-09-21 03:50 UTC] - Six-Tier AI Fallback Engine
- Action: ADDED
- Files Affected: `src/lib/aiProvider.ts`
- Description: Documenting existing sequential fallback chain for AI word/clue generation across six providers (Cerebras, Groq, SambaNova, Gemini, Mistral, OpenRouter), each attempted in order with a single timeout and no retries per tier, so a downed provider degrades gracefully to the next.
- Breaking Changes / Migrations: None.

### [2026-09-21 03:50 UTC] - Idempotent Migration Architecture
- Action: DATABASE
- Files Affected: `save_data_migration.sql`
- Description: Documenting the standing convention that all schema changes (tables, columns, indexes, realtime publications, policies) are appended to `save_data_migration.sql` as idempotent, re-runnable statements rather than applied directly, per the Strict Database Migration & Schema Protocol in `agent.md`.
- Breaking Changes / Migrations: None. The user runs this file manually in the Supabase SQL Editor.

### [2026-09-21 03:50 UTC] - 1v1 Multiplayer Quota Logic
- Action: ADDED
- Files Affected: `src/types/game.ts`, `src/app/api/multiplayer/create/route.ts`, `src/app/api/multiplayer/guess/route.ts`, `src/app/api/multiplayer/join/route.ts`
- Description: Documenting existing per-difficulty guess quotas for battle mode (Easy: 10, Medium: 15, Hard: 20), mapped in `DIFFICULTY_MAX_GUESSES` and enforced by the multiplayer API routes.
- Breaking Changes / Migrations: None.

### [2026-09-21 03:50 UTC] - SEO, GEO, AEO Structured Discovery and WhatsApp Viral Share Card
- Action: ADDED
- Files Affected: `src/app/robots.ts`, `src/app/sitemap.ts`, `public/llms.txt`, `src/components/GameClientView.tsx`
- Description: Documenting existing structured discovery surfaces for search and AI-agent crawlers (`robots.ts`, `sitemap.ts`, `llms.txt`) and the WhatsApp share card in the game result flow that drives viral, link-based invites.
- Breaking Changes / Migrations: None.
