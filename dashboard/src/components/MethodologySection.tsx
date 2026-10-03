"use client";

import { motion } from "framer-motion";

const STEPS = [
  { num: "01", title: "Data", body: "Match history is validated for schema, result labels and chronology. Today it is DEMO DATA; the loader is built so Cricsheet-style historical data can replace it." },
  { num: "02", title: "Features", body: "Elo-style strength, recent form, head-to-head, venue and toss, plus format-specific batting and bowling indicators. Every feature uses only earlier matches." },
  { num: "03", title: "Model", body: "One model per format: Test is three-way (India / Draw / Opponent), ODI and T20I are two-way. Probabilities are sigmoid-calibrated." },
  { num: "04", title: "Prediction", body: "Each fixture gets a model probability and a confidence band, written to a hash-chained ledger with a timestamp and model version." },
  { num: "05", title: "Explainability", body: "Per-prediction feature contributions from a logistic surrogate. These are coefficient contributions, not SHAP values; SHAP is a planned upgrade." },
  { num: "06", title: "Monitoring", body: "Walk-forward accuracy, Brier score, log loss and calibration are tracked per format, with drift and data-quality checks on the admin page." },
];

export default function MethodologySection() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((step, i) => (
        <motion.div
          key={step.title}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card rounded-2xl p-[26px]"
        >
          <div className="font-mono mb-4 text-[13px] text-accent">{step.num}</div>
          <h3 className="font-display mb-2.5 text-[22px] font-bold uppercase text-foreground">{step.title}</h3>
          <p className="text-sm leading-relaxed text-foreground/55">{step.body}</p>
        </motion.div>
      ))}
    </div>
  );
}
