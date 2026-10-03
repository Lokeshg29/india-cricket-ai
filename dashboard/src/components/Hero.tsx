"use client";

import { motion } from "framer-motion";
import IndiaNightMap from "./IndiaNightMap";
import { PRODUCT_NAME } from "@/lib/site";

export default function Hero({
  formatLabel,
  dataLabel,
  tagline,
}: {
  formatLabel?: string;
  dataLabel: string;
  tagline?: string;
}) {
  return (
    <section className="relative isolate flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-36 text-center">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 15%, rgba(75,155,255,0.10), transparent 60%), linear-gradient(180deg, var(--background-raised) 0%, var(--background) 55%, var(--background-deep) 100%)",
        }}
      />
      <IndiaNightMap />
      {/* vignette + readability scrim keeps text above the map */}
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: "radial-gradient(55% 48% at 50% 46%, rgba(5,5,5,0.62), transparent 75%), radial-gradient(90% 90% at 50% 50%, transparent 55%, rgba(5,5,5,0.85) 100%)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 z-[1] h-[40%]"
        style={{ background: "linear-gradient(180deg, transparent, var(--background) 85%)" }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mb-7 inline-flex items-center gap-2 rounded-full border border-foreground/20 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground"
        style={{ background: "linear-gradient(180deg, var(--accent-warm), var(--card-alt))" }}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--saffron)", animation: "wc-pulse 1.8s ease-in-out infinite" }} />
        {PRODUCT_NAME} &middot; {formatLabel ?? "Test / ODI / T20I"} &middot; {dataLabel}
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="font-display relative z-10 text-[clamp(32px,7vw,110px)] font-black uppercase leading-[1.05] tracking-tight text-foreground"
      >
        <div className="whitespace-nowrap">Can India</div>
        <div className="whitespace-nowrap font-extrabold italic text-accent">
          {formatLabel ? `Win The ${formatLabel}?` : "Win?"}
        </div>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="font-serif relative z-10 mt-9 max-w-xl text-[17px] leading-relaxed text-foreground/70"
      >
        {tagline ??
          "AI-powered cricket predictions for the Indian men's team. Separate models for Test, ODI and T20I, calibrated probabilities, and a hash-chained prediction ledger."}
      </motion.p>

      <motion.div
        className="relative z-10 mt-14 font-mono text-[11px] tracking-[0.1em] text-foreground/35"
        style={{ animation: "wc-pulse 2.4s ease-in-out infinite" }}
      >
        &darr; SCROLL
      </motion.div>
    </section>
  );
}
