"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="relative min-h-dvh bg-slateDark-800 text-peach-light">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-5 py-16">
        {/* Back link */}
        <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-peach/40 hover:text-peach transition-colors mb-10"
          >
            <span>←</span> Back to Game
          </Link>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="text-3xl font-bold tracking-tight mb-2"
        >
          Contact <span className="text-transparent bg-clip-text bg-gradient-to-r from-peach via-peach-light to-peach-dark">Us</span>
        </motion.h1>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="h-px w-16 bg-gradient-to-r from-peach to-peach-dark mb-8"
        />

        {/* Email Card */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeUp}
          className="rounded-xl border border-slateDark-600/6 bg-slateDark-700/2 p-5 mb-8"
        >
          <p className="text-sm text-peach/55 mb-3">
            For any bugs, game issues, or feedback, please reach out to us directly at:
          </p>
          <a
            href="mailto:sharafathabi.personal@gmail.com"
            className="inline-flex items-center gap-2 text-sm font-medium text-peach hover:text-peach-light transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            sharafathabi.personal@gmail.com
          </a>
        </motion.div>

        {/* Contact Form */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={4}
          variants={fadeUp}
        >
          <h2 className="text-sm font-semibold text-peach/90 mb-4">Send Us a Message</h2>

          {submitted ? (
            <div className="rounded-xl border border-peach/20 bg-peach/5 p-6 text-center">
              <p className="text-peach text-sm font-medium">Thank you for your message!</p>
              <p className="text-peach/40 text-xs mt-1">We&apos;ll get back to you as soon as possible.</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
              className="space-y-4"
            >
              {/* Name */}
              <div>
                <label htmlFor="contact-name" className="block text-[11px] font-semibold uppercase tracking-wider text-peach/40 mb-1.5">
                  Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  placeholder="Your name"
                  className="w-full rounded-lg bg-slateDark-900 border border-slateDark-600 px-3.5 py-2.5 text-sm text-peach placeholder:text-slateDark-600 outline-none focus:border-peach focus:ring-1 focus:ring-peach transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="contact-email" className="block text-[11px] font-semibold uppercase tracking-wider text-peach/40 mb-1.5">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-lg bg-slateDark-900 border border-slateDark-600 px-3.5 py-2.5 text-sm text-peach placeholder:text-slateDark-600 outline-none focus:border-peach focus:ring-1 focus:ring-peach transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="contact-message" className="block text-[11px] font-semibold uppercase tracking-wider text-peach/40 mb-1.5">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  placeholder="Tell us what's on your mind..."
                  className="w-full rounded-lg bg-slateDark-900 border border-slateDark-600 px-3.5 py-2.5 text-sm text-peach placeholder:text-slateDark-600 outline-none focus:border-peach focus:ring-1 focus:ring-peach transition-all resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full rounded-lg bg-peach text-slateDark-900 font-semibold hover:bg-peach-light active:bg-peach-dark shadow-md px-4 py-2.5 text-sm transition-all active:scale-[0.98]"
              >
                Send Message
              </button>
            </form>
          )}
        </motion.div>

        {/* Footer nav */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={5}
          variants={fadeUp}
          className="mt-12 pt-6 border-t border-slateDark-600/4 flex flex-wrap gap-4 text-[11px] text-peach/35"
        >
          <Link href="/about" className="hover:text-peach transition-colors">About Us</Link>
          <Link href="/privacy" className="hover:text-peach transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-peach transition-colors">Terms of Service</Link>
        </motion.div>
      </div>
    </div>
  );
}
