"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error ?? "Login failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#09090b] text-white flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs glass rounded-2xl border border-white/[0.05] p-6">
        <div className="w-11 h-11 mb-5 mx-auto rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
          <Lock size={18} className="text-emerald-400" />
        </div>
        <h1 className="text-center font-bold text-lg mb-5">Admin Access</h1>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Admin username"
          autoFocus
          autoComplete="username"
          className="w-full mb-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.08] text-white placeholder-neutral-600 text-sm outline-none focus:border-emerald-500/30"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          autoComplete="current-password"
          className="w-full mb-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.08] text-white placeholder-neutral-600 text-sm outline-none focus:border-emerald-500/30"
        />
        {error && <p className="text-xs text-red-400 mb-3 text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {loading ? "Checking..." : "Enter"}
        </button>
      </form>
    </main>
  );
}
