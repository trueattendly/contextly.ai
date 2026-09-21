# Changelog

All notable changes to this project are documented in this file, per the Strict Changelog & Audit Trail Protocol defined in `agent.md`.

### [2026-09-21 09:40 UTC] - Resolved Opponent Display Names in Multiplayer HUD, Lobby, and Victory Screen
- Action: MODIFIED
- Files Affected: `src/app/api/multiplayer/room/[code]/route.ts` (new), `src/app/battle/[code]/page.tsx`
- Description: New `GET /api/multiplayer/room/[code]` replaces the battle page's direct `battle_rooms` table select with a route that also resolves both players' display names against `profiles`, using the caller's own session-scoped client for both queries (existing RLS - "Players can view their own battle room" and "Public profiles are viewable by everyone." - already covers this, so no service-role client is needed). Fallback order: `profiles.username` -> `profiles.display_name` (this schema has no separate `full_name` column; `display_name` is already the resolved Google full_name/name, populated at signup in `auth/callback/route.ts`) -> the local part of `profiles.email` -> a positional `"Player 1"`/`"Player 2"` label - always a non-empty string, never null/undefined. The battle page now shows a "You (Name) / VS / <User icon> Opponent Name" bar under the rank HUD, a transient "[Opponent Name] has joined the arena!" banner (client-side only, ~1.8s) when the Realtime subscription observes a waiting-to-active transition, and the victory modal now reads "You Defeated [Name]!" / "[Name] Won" / "[Name] forfeited the match. You win!". Realtime `postgres_changes` payloads are raw table rows with no joined name, so a detected waiting-to-active transition also triggers a `fetchRoom()` call to pick up the newly-joined opponent's resolved name.
- Breaking Changes / Migrations: None - no schema change required, since `profiles.username` and `profiles.display_name` already exist.

### [2026-09-21 09:05 UTC] - Battle Lobby Fallback Polling and Mutual-Consensus Rematch Engine
- Action: FIXED, ADDED
- Files Affected: `save_data_migration.sql`, `src/app/battle/[code]/page.tsx`, `src/app/api/multiplayer/rematch/route.ts` (new)
- Description: `battle_rooms` was already in the `supabase_realtime` publication with `REPLICA IDENTITY FULL` and a player-scoped SELECT policy (added alongside the original battle room feature), and the host's page already had a `postgres_changes` UPDATE subscription that syncs `room` state directly into the lobby/HUD conditional render - so the host already auto-transitioned off the "Waiting for an opponent..." screen without a refresh in the normal case. FIXED: added a 3-second fallback poll (`fetchRoom()`) that runs only while `status === "waiting"`, so the transition is guaranteed even if the WebSocket connection drops or never fully establishes. ADDED: a mutual-consensus rematch engine. New `rematch_p1`/`rematch_p2` boolean columns on `battle_rooms` (idempotent additions in `save_data_migration.sql`). `POST /api/multiplayer/rematch` derives the caller from their session, flips their own flag on a finished room, and once both flags are true, generates a fresh secret word for the room's existing category/difficulty (excluding the just-solved word), resets all rank/guess-count/quota columns and `battle_secrets`, and flips `status` back to `active` - guarded by `.eq("status", "finished")` on both the flag write and the reset write so a simultaneous request from both players can't double-reset. The victory modal's "New Battle" link was replaced with a three-state Rematch button (Request Rematch / Waiting for opponent - animated spinner / Opponent requested a rematch - pulsing accept button), all driven by `room.rematch_p1`/`room.rematch_p2` from the same existing Realtime subscription; a "Back to Lobby" link was kept alongside it as the opt-out. No separate close/reset logic was needed for the modal or HUD - since the modal is already gated on `room.status === "finished"`, the reset write flipping `status` to `active` closes it and repaints the reset ranks/guesses automatically.
- Breaking Changes / Migrations: Run the appended `rematch_p1`/`rematch_p2` block in `save_data_migration.sql` in the Supabase SQL Editor before deploying. The rematch route reuses `generateGameContent`, the same word-generation call `create/route.ts` makes, so it has the same AI-provider latency/fallback behavior as starting a fresh room.

### [2026-09-21 08:20 UTC] - Client-Side Auth Fallback to Prevent Landing Page Trap on Root Route
- Action: FIXED
- Files Affected: `src/app/page.tsx`, `src/components/HomeView.tsx` (new)
- Description: `src/app/page.tsx` already rendered `GameClientView` directly whenever the server-side session check via `@supabase/ssr` cookies found a user, with no client-side branching or hydration flash. Added `HomeView`, a thin client wrapper that also subscribes to `supabase.auth.onAuthStateChange` and calls `getSession()` as a fallback for the one real gap: a client-side (soft) navigation back to `/` that reuses a stale cached RSC payload rendered before sign-in. If a session is detected client-side that the server render missed, the view swaps to `GameClientView` immediately via React state, no full reload required. Verified `src/app/auth/callback/route.ts` against the Next.js Route Handler cookie docs: `exchangeCodeForSession` writes cookies via `cookies().set()` inside the handler, which Next.js attaches to the outgoing `NextResponse.redirect` automatically, so no separate cookie-flush fix was needed there.
- Breaking Changes / Migrations: None. Deliberately did not add a full-page loader gating the initial render, since `initialUser` is null for the overwhelming majority of visits (anonymous traffic) and gating the landing page's SEO content (FAQ/HowTo JSON-LD, marketing copy) behind a client-only spinner would regress crawlability, LCP, and CLS for that path. `GameClientView` already renders its own centered loader while it syncs the profile for a freshly-detected user, which covers the actual transition moment without a redundant second spinner.

### [2026-09-21 07:45 UTC] - Resolved Google OAuth Subdomain Resolution and Mobile Landing Page Visibility
- Action: FIXED
- Files Affected: `src/utils/getURL.ts`, `src/components/PlayDailyButton.tsx`, `src/app/auth/callback/route.ts`, `src/app/layout.tsx`, `src/components/LandingPage.tsx`
- Description: Resolved Google OAuth redirect failures (`ERR_NAME_NOT_RESOLVED`) by replacing hardcoded `www.contextle.online` fallbacks with a canonical `getURL()` resolver that dynamically selects `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_VERCEL_URL`, or client-side origin. Resolved blank/invisible landing page content on mobile devices by introducing `gsap.matchMedia()`: desktop viewports retain smooth ScrollTrigger animations while mobile viewports (< 768px) bypass `opacity: 0` scroll trapping with `clearProps: "all"`. In addition, eliminated transforms on `<tr>` elements in the comparison matrix that previously caused WebKit/iOS Safari table rendering collapse.
- Breaking Changes / Migrations: None. Ensure Supabase Dashboard Redirect URLs whitelist contains both apex and www domains as documented.

### [2026-09-21 06:10 UTC] - 1v1 Battle Forfeit and Resignation Engine
- Action: ADDED
- Files Affected: `save_data_migration.sql`, `src/app/api/multiplayer/forfeit/route.ts`, `src/app/battle/[code]/page.tsx`
- Description: Added a forfeit flow for active battle rooms. New `win_reason` (`solve` / `quota_best_rank` / `forfeit`) and `forfeit_by_id` columns on `battle_rooms` (the real 1v1 table; no `multiplayer_rooms` table exists in this codebase). The new `POST /api/multiplayer/forfeit` route derives the resigning player from their authenticated session (never a client-supplied id), verifies the room is active, awards the win to the opponent, records the secret word and a `game_sessions` win row for them, and finalizes with a `status = "active"` race guard matching the existing guess route's pattern. The battle page adds a `useModal()`-driven confirm dialog and a header Forfeit button, and the existing generic Realtime finish-detection (`status === "finished"`, already present) now also renders forfeit-specific victory copy.
- Breaking Changes / Migrations: Run the appended block in `save_data_migration.sql` in the Supabase SQL Editor before deploying. Also updated `src/app/api/multiplayer/guess/route.ts` to set `win_reason` explicitly (`solve` or `quota_best_rank`) on finish, since it previously relied on the column's default and would have mislabeled quota-resolved wins as `solve`.

### [2026-09-21 05:40 UTC] - Centralized Promise-Based Modal System
- Action: ADDED
- Files Affected: `src/components/ui/ModalProvider.tsx`, `src/app/layout.tsx`
- Description: Added a `ModalProvider` context exposing `useModal()` with `showAlert()` and `showConfirm()`, rendering an accessible (`role="alertdialog"`, focus-managed, Escape-to-dismiss) animated modal styled to the Slate Gray and Peach Fuzz palette, with semantic icon/color mapping for info, warning, error, and success. Wired into `layout.tsx` so it wraps the whole app.
- Breaking Changes / Migrations: None.

### [2026-09-21 05:40 UTC] - Removed the Only Native Browser Dialog and Added a Prohibition Rule
- Action: MODIFIED
- Files Affected: `src/app/stats/page.tsx`, `agent.md`
- Description: Audited the full codebase for `alert()`, `confirm()`, and `prompt()`. Found exactly one: a clipboard-copy `alert()` in `stats/page.tsx`, now replaced with `showAlert()`. No `confirm()` or `prompt()` existed anywhere. Added a Strict Prohibitions rule to `agent.md` banning native dialogs going forward.
- Breaking Changes / Migrations: None. No battle-forfeit or single-player-forfeit confirmation was added, since no such feature exists yet to gate; see summary for details.

### [2026-09-21 05:10 UTC] - Progressive Web App Setup and Mobile Viewport Ergonomics
- Action: ADDED
- Files Affected: `src/app/manifest.ts` (not created; existing `public/site.webmanifest` updated instead, see description), `src/components/PWAInstallBanner.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `public/sw.js`, `public/site.webmanifest`, `src/components/FeedbackWidget.tsx`, `next.config.ts`
- Description: Implemented full PWA setup: a caching service worker (`public/sw.js`, excludes `/api/`, `/auth/`, and `/admin` from caching to avoid serving stale game state), a dismissible "Install App" bottom banner (`PWAInstallBanner.tsx`) handling `beforeinstallprompt` on Chromium and an iOS Safari "Add to Home Screen" hint, `appleWebApp` and `interactiveWidget: resizes-content` metadata in `layout.tsx` to stop the virtual keyboard from covering the HUD, safe-area (`pt-safe`/`pb-safe`) and `tap-target` (44x44 minimum) utility classes in `globals.css`, a mobile-scoped 16px minimum input font size to stop iOS auto-zoom on focus, and updated `site.webmanifest` colors/name to the Slate Gray and Peach Fuzz brand. Nudged the existing feedback widget up via a shared `pwa-banner-open` class so it does not overlap the install banner.
- Breaking Changes / Migrations: None. Existing `public/site.webmanifest` (already linked via `metadata.manifest` in `layout.tsx`) was updated in place rather than adding a parallel `app/manifest.ts` route, to avoid two competing manifest URLs. Full-app 44x44 touch-target compliance was not audited component-by-component beyond the new banner and the feedback widget; flagged as follow-up work.

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
