"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut, Loader2, Activity, Gamepad2, Target, RefreshCw,
  CheckCircle2, XCircle, MinusCircle, MessageSquare, Sparkles,
} from "lucide-react";

interface Metrics {
  gamesPlayedToday: number;
  activeUsersToday: number;
  avgGuessesPerSolve: number | null;
  totalRegisteredUsers: number | null;
}

interface HealthResult {
  tier: string;
  configured: boolean;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface TelemetrySummary {
  tier: string;
  attempts: number;
  failures: number;
  avgLatencyMs: number;
}

interface TelemetryEvent {
  timestamp: number;
  context: string;
  tier: string;
  success: boolean;
  latencyMs: number;
  error?: string;
}

interface FeedbackEntry {
  id: string;
  timestamp: number;
  message: string;
  email: string | null;
  page: string | null;
  userId: string | null;
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl border border-white/[0.05] p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-[11px] font-bold text-neutral-300 uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3.5">
      <p className="text-lg font-mono font-bold text-emerald-400">{value}</p>
      <p className="text-[9px] text-neutral-500 uppercase tracking-wider font-semibold mt-1">{label}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [health, setHealth] = useState<HealthResult[] | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [telemetrySummary, setTelemetrySummary] = useState<TelemetrySummary[]>([]);
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [metricsRes, telemetryRes, feedbackRes] = await Promise.all([
      fetch("/api/admin/metrics").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/telemetry").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/feedback").then((r) => r.json()).catch(() => null),
    ]);
    if (metricsRes?.success) setMetrics(metricsRes);
    if (telemetryRes?.success) {
      setTelemetrySummary(telemetryRes.summary ?? []);
      setTelemetryEvents(telemetryRes.events ?? []);
    }
    if (feedbackRes?.success) setFeedback(feedbackRes.feedback ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/admin/provider-health", { method: "POST" });
      const data = await res.json();
      if (data.success) setHealth(data.results);
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#09090b]">
        <Loader2 size={16} className="text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-[#09090b] text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-neutral-300 text-xs font-semibold hover:border-white/20 transition-all cursor-pointer"
            >
              <RefreshCw size={12} /> Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-red-400 text-xs font-semibold hover:border-red-500/30 transition-all cursor-pointer"
            >
              <LogOut size={12} /> Logout
            </button>
          </div>
        </div>

        {/* Traffic & Session Metrics */}
        <Card title="Core Traffic & Session Metrics" icon={<Activity size={14} className="text-emerald-400" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Games Today" value={metrics?.gamesPlayedToday ?? "-"} />
            <StatTile label="Active Users Today" value={metrics?.activeUsersToday ?? "-"} />
            <StatTile label="Avg Guesses / Solve" value={metrics?.avgGuessesPerSolve ?? "-"} />
            <StatTile label="Total Registered" value={metrics?.totalRegisteredUsers ?? "-"} />
          </div>
        </Card>

        {/* AI Provider Health */}
        <Card title="AI Provider Health & Tier Matrix" icon={<Gamepad2 size={14} className="text-emerald-400" />}>
          <button
            onClick={runHealthCheck}
            disabled={checkingHealth}
            className="mb-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {checkingHealth ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {checkingHealth ? "Pinging all tiers..." : "Run Health Check"}
          </button>
          {!health ? (
            <p className="text-xs text-neutral-500 font-mono">Not checked yet this session.</p>
          ) : (
            <div className="space-y-1.5">
              {health.map((r) => (
                <div key={r.tier} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.015] border border-white/[0.03] text-xs">
                  <div className="flex items-center gap-2">
                    {!r.configured ? (
                      <MinusCircle size={13} className="text-neutral-600" />
                    ) : r.ok ? (
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    ) : (
                      <XCircle size={13} className="text-red-400" />
                    )}
                    <span className="text-neutral-300 font-medium">{r.tier}</span>
                  </div>
                  <span className="text-neutral-500 font-mono">
                    {!r.configured ? "Not configured" : r.ok ? `${r.latencyMs}ms` : (r.error ?? "Failed")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Telemetry & Error Log */}
        <Card title="Telemetry & Error Log Feed" icon={<Target size={14} className="text-emerald-400" />}>
          <p className="text-[10px] text-neutral-600 mb-3">
            In-memory, per server instance - resets on cold start. Not a persistent log.
          </p>
          {telemetrySummary.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {telemetrySummary.map((s) => (
                <div key={s.tier} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2.5">
                  <p className="text-[10px] font-semibold text-neutral-300">{s.tier}</p>
                  <p className="text-[10px] text-neutral-500 font-mono mt-1">
                    {s.attempts} calls · {s.failures} failed · {s.avgLatencyMs}ms avg
                  </p>
                </div>
              ))}
            </div>
          )}
          {telemetryEvents.length === 0 ? (
            <p className="text-xs text-neutral-500 font-mono">No AI calls recorded yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {telemetryEvents.slice(0, 40).map((e, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-white/[0.01] text-[10px] font-mono">
                  <span className="text-neutral-500">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className="text-neutral-400">{e.context}</span>
                  <span className="text-neutral-300">{e.tier}</span>
                  <span className={e.success ? "text-emerald-400" : "text-red-400"}>
                    {e.success ? `${e.latencyMs}ms` : "fail"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* User Feedback */}
        <Card title="User Feedback" icon={<MessageSquare size={14} className="text-emerald-400" />}>
          {feedback.length === 0 ? (
            <p className="text-xs text-neutral-500 font-mono">No feedback submitted yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {feedback.map((f) => (
                <div key={f.id} className="rounded-lg bg-white/[0.015] border border-white/[0.03] p-3">
                  <p className="text-xs text-neutral-200 leading-relaxed mb-1.5">{f.message}</p>
                  <p className="text-[9px] text-neutral-500 font-mono">
                    {new Date(f.timestamp).toLocaleString()}
                    {f.page ? ` · ${f.page}` : ""}
                    {f.email ? ` · ${f.email}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
