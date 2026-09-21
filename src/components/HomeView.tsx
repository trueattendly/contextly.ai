// ─────────────────────────────────────────────────────────────────────────────
//  components/HomeView.tsx
//  Client-side safety net for the root route: the server already renders
//  GameClientView directly whenever cookies() shows a session (no flash for
//  the common case). This wrapper only reacts when the client discovers a
//  session the server render missed - e.g. a soft (client-side) navigation
//  back to "/" serving a stale cached RSC payload from before sign-in - so an
//  authenticated user is never left stuck on the marketing landing page.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import LandingPage from "@/components/LandingPage";
import GameClientView from "@/components/GameClientView";

export default function HomeView({ initialUser }: { initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);

  useEffect(() => {
    const supabase = createClient();

    if (!initialUser) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) setUser(session.user);
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GameClientView already renders its own centered Loader2 while it syncs
  // the profile for a freshly-detected user, so no separate transition
  // loader is needed here - adding one would only introduce a second spinner
  // and a layout flash for the far more common signed-out visitor.
  return user ? <GameClientView initialUser={user} /> : <LandingPage user={null} />;
}
