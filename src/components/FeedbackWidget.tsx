"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X, Loader2, Check } from "lucide-react";

// Global, always-available feedback entry point - works for signed-in and
// anonymous visitors alike (the API route attaches a user id when present,
// but doesn't require one).
export default function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pathname?.startsWith("/admin")) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email: email.trim() || undefined, page: pathname }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
        setMessage("");
        setEmail("");
      } else {
        setError(data.error ?? "Failed to send feedback.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeAndReset = () => {
    setOpen(false);
    setTimeout(() => setSubmitted(false), 300);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="tap-target fixed bottom-3 left-3 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full bg-slateDark-700/4 border border-slateDark-600/10 text-peach/75 text-[11px] font-semibold backdrop-blur-sm hover:border-peach/30 hover:text-peach transition-all cursor-pointer [.pwa-banner-open_&]:bottom-20"
      >
        <MessageSquarePlus size={13} />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 modal-backdrop" onClick={closeAndReset}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm glass rounded-2xl border border-slateDark-600/8 p-5 shadow-[0_30px_70px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm text-peach-light">Send Feedback</h2>
              <button onClick={closeAndReset} aria-label="Close feedback form" className="text-peach/40 hover:text-peach-light transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-6">
                <Check size={22} className="text-peach mx-auto mb-2" />
                <p className="text-sm text-peach/75">Thanks - got it!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind? Bugs, ideas, anything."
                  maxLength={2000}
                  rows={4}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg bg-slateDark-900 border border-slateDark-600 text-peach placeholder:text-slateDark-600 text-xs outline-none focus:border-peach focus:ring-1 focus:ring-peach resize-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional, if you want a reply)"
                  className="w-full px-3 py-2.5 rounded-lg bg-slateDark-900 border border-slateDark-600 text-peach placeholder:text-slateDark-600 text-xs outline-none focus:border-peach focus:ring-1 focus:ring-peach"
                />
                {error && <p className="text-[11px] text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={!message.trim() || submitting}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold text-slateDark-900 bg-peach hover:bg-peach-light active:bg-peach-dark shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : null}
                  {submitting ? "Sending..." : "Send Feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
