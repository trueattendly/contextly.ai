import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import LandingPage from "@/components/LandingPage";
import GameClientView from "@/components/GameClientView";

export const metadata: Metadata = {
  title: "Crack Concepts, Not Just Letters | Contextle",
  description:
    "Contextle maps your guesses in high-dimensional semantic space. Move from Ice Cold to Scorching Hot using AI-calculated contextual proximity.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage user={null} />;
  }

  return <GameClientView initialUser={user} />;
}
