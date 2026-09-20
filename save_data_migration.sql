-- ==============================================================================
--  contextle.online - Master Database Migration (100% Idempotent)
--  Fresh-install schema for a brand-new Supabase project, built from the
--  ACTUAL tables/columns this codebase's routes and pages read and write -
--  not a re-derived ideal schema. Safe to run once on an empty project, and
--  equally safe to re-run any number of times on an already-provisioned one.
--
--  Naming note: an earlier spec for this file described a `multiplayer_rooms`
--  table with `player_1_guess_count`-style columns, and a separate
--  precomputed `weekly_leaderboard` table. Neither exists in the app. The
--  real 1v1 battle table is `battle_rooms` (+ `battle_secrets`), with
--  `player1_guess_count` (no underscore), and the weekly leaderboard is
--  computed on read by aggregating `game_sessions` in
--  /api/leaderboard/weekly - there's no separate table for it. This file
--  matches what /src/app/api/**/route.ts and /src/app/**/page.tsx actually
--  query, so running it against a fresh project and pointing this codebase
--  at it works without any code changes.
--
--  Execution: Paste this whole file into the Supabase SQL Editor and run it
--             once. Uses IF NOT EXISTS, pg_policies checks, information_schema
--             checks, and pg_publication_tables guards throughout, so
--             re-running it is always safe.
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ──────────────────────────────────────────────────────────────────────────────
-- gen_random_uuid() (used as the default id on every table below) is provided
-- by pgcrypto; uuid-ossp is enabled alongside it since it's the other
-- commonly-expected UUID extension and costs nothing to have available.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ──────────────────────────────────────────────────────────────────────────────
-- 1. USER RATE LIMITS (Serverless-safe in-database rate limiter)
--    Used by POST /api/generate-word. Default-deny RLS: read/written only by
--    the server-side admin client.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_rate_limits_window ON public.user_rate_limits(user_id, window_start);

ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. PLAYED WORDS (Anti-repetition history per player, solo mode)
--    Used by POST /api/generate-word to avoid repeating a solved word, and by
--    POST /api/guess on a win. Default-deny RLS: admin client only.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.played_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_played_words_user_id ON public.played_words(user_id);
CREATE INDEX IF NOT EXISTS idx_played_words_user_played_at ON public.played_words(user_id, played_at DESC);

ALTER TABLE public.played_words ENABLE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. PROFILES (User Game State, Progression, and Global Leaderboard)
--    Read/written by /api/profile, /api/guess, /api/generate-word, and
--    queried directly (anon key, public SELECT policy) by the all-time
--    leaderboard on the home page and /leaderboard.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  current_level INTEGER DEFAULT 1,
  active_word TEXT,     -- current solo secret word; NULL when no round is active
  current_story TEXT,   -- JSON-stringified GameContent (category/mysteryHook/stories/takeaways) - see src/types/game.ts parseGameContent()
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Defensive column additions if profiles already existed in an earlier form
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'active_word'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN active_word TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'current_story'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN current_story TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'current_level'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN current_level INTEGER DEFAULT 1;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_current_level ON public.profiles(current_level DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Public profiles are viewable by everyone.'
  ) THEN
    CREATE POLICY "Public profiles are viewable by everyone."
      ON public.profiles FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users can update own profile.'
  ) THEN
    CREATE POLICY "Users can update own profile."
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

-- Auto-create a profiles row the moment someone signs up, so every later
-- request (which already has its own lazy-create fallback in
-- /api/profile/route.ts) finds a row instead of racing to create one.
-- SECURITY DEFINER is required here: this function runs as part of the
-- auth.users insert, before the new user's own session/RLS context exists.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, current_level, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Player'),
    1,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ──────────────────────────────────────────────────────────────────────────────
-- 4. GAME SESSIONS (Solo + Battle round history - powers the weekly
--    leaderboard aggregation and the /history page)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo', 'battle')),
  won BOOLEAN NOT NULL DEFAULT true,
  time_taken_seconds INTEGER,
  guess_count INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  secret_word TEXT,
  takeaways JSONB,
  max_guesses INTEGER,  -- only meaningful for mode='battle'; NULL for solo (no quota)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column checks for environments that already had an older version of this table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'time_taken_seconds'
  ) THEN
    ALTER TABLE public.game_sessions ADD COLUMN time_taken_seconds INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'guess_count'
  ) THEN
    ALTER TABLE public.game_sessions ADD COLUMN guess_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'mode'
  ) THEN
    ALTER TABLE public.game_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'solo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'won'
  ) THEN
    ALTER TABLE public.game_sessions ADD COLUMN won BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.game_sessions ADD COLUMN category TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'secret_word'
  ) THEN
    ALTER TABLE public.game_sessions ADD COLUMN secret_word TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'takeaways'
  ) THEN
    ALTER TABLE public.game_sessions ADD COLUMN takeaways JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'max_guesses'
  ) THEN
    ALTER TABLE public.game_sessions ADD COLUMN max_guesses INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_created ON public.game_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_won_created ON public.game_sessions(won, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_weekly_metrics ON public.game_sessions(created_at, won, time_taken_seconds, guess_count);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
-- Default deny: no client-facing policies. Reads/writes go through
-- /api/guess, /api/multiplayer/guess, /api/history, /api/history/sync, and
-- /api/leaderboard/weekly, all via the service-role admin client.


-- ──────────────────────────────────────────────────────────────────────────────
-- 5. BATTLE ROOMS (1v1 Realtime Multiplayer Matchmaking, State & Difficulty-
--    Quota Engine)
--    Only rank/status/guess-count columns live here - the secret word never
--    does (see battle_secrets below), so it cannot leak through a Realtime
--    subscription no matter what a client subscribes to.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.battle_rooms (
  code TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'foundations',
  difficulty VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  max_guesses INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  mystery_hook TEXT,
  stories JSONB,
  takeaways JSONB,
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player1_best_rank INTEGER,
  player1_last_rank INTEGER,
  player1_guess_count INTEGER NOT NULL DEFAULT 0,
  player1_quota_exhausted_at TIMESTAMPTZ,
  player2_best_rank INTEGER,
  player2_last_rank INTEGER,
  player2_guess_count INTEGER NOT NULL DEFAULT 0,
  player2_quota_exhausted_at TIMESTAMPTZ,
  winner_id UUID REFERENCES auth.users(id),
  solved_word TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Defensive column additions for environments with an older version of this table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'finished_at'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN finished_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'mystery_hook'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN mystery_hook TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'stories'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN stories JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'takeaways'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN takeaways JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'solved_word'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN solved_word TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'max_guesses'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN max_guesses INTEGER NOT NULL DEFAULT 15;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'difficulty'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN difficulty VARCHAR(10) NOT NULL DEFAULT 'medium'
      CHECK (difficulty IN ('easy', 'medium', 'hard'));
  END IF;

  -- Timestamps of each player's quota-exhausting guess - what makes the
  -- "faster elapsed time" tie-break possible when both players exhaust their
  -- quota with an identical best rank.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'player1_quota_exhausted_at'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN player1_quota_exhausted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'player2_quota_exhausted_at'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN player2_quota_exhausted_at TIMESTAMPTZ;
  END IF;

  -- How a finished room was won: 'solve' (exact/synonym match), 'quota_best_rank'
  -- (both players exhausted their quota, resolved by closest rank), or
  -- 'forfeit' (an opponent left/resigned mid-match). Read by the battle page
  -- to distinguish a forfeit-triggered win from a genuine solve.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'win_reason'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN win_reason VARCHAR(20) NOT NULL DEFAULT 'solve'
      CHECK (win_reason IN ('solve', 'quota_best_rank', 'forfeit'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'battle_rooms' AND column_name = 'forfeit_by_id'
  ) THEN
    ALTER TABLE public.battle_rooms ADD COLUMN forfeit_by_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_battle_rooms_status ON public.battle_rooms(status);
CREATE INDEX IF NOT EXISTS idx_battle_rooms_players ON public.battle_rooms(player1_id, player2_id);

ALTER TABLE public.battle_rooms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'battle_rooms'
      AND policyname = 'Players can view their own battle room'
  ) THEN
    CREATE POLICY "Players can view their own battle room" ON public.battle_rooms
      FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);
  END IF;
END $$;

-- Full row replica identity required for Supabase Realtime Postgres Changes
-- to include the "old" record on UPDATE events.
ALTER TABLE public.battle_rooms REPLICA IDENTITY FULL;

-- Guarded realtime publication addition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'battle_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_rooms;
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────────────────────
-- 6. BATTLE SECRETS (Word Isolation / Anti-Cheat Store)
-- ──────────────────────────────────────────────────────────────────────────────
-- Intentionally a separate table, excluded from the realtime publication,
-- with RLS enabled and NO policies (default-deny for anon/authenticated).
-- Only the service-role admin client (which bypasses RLS) can ever read or
-- write it - this is the actual enforcement point for "the opponent's
-- guessed word must never be transmitted": the word never appears in any
-- row a client is allowed to select or subscribe to.
CREATE TABLE IF NOT EXISTS public.battle_secrets (
  room_code TEXT PRIMARY KEY REFERENCES public.battle_rooms(code) ON DELETE CASCADE,
  word TEXT NOT NULL
);

ALTER TABLE public.battle_secrets ENABLE ROW LEVEL SECURITY;
-- Default deny: read/written solely by the server-side admin client.
