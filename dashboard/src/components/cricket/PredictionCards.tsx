"use client";

import { motion } from "framer-motion";
import Flag from "../Flag";
import DataBadge from "./DataBadge";
import { pct, type Upcoming } from "@/lib/cricket";
import { DISCLAIMER } from "@/lib/site";

const FEATURE_LABEL: Record<string, string> = {
  elo_diff: "Team strength", form_diff: "Recent form", h2h_win_rate: "Head-to-head",
  home_flag: "Home advantage", neutral_flag: "Neutral venue", toss_won: "Toss",
  bat_avg_diff: "Batting average", bowl_avg_diff: "Bowling average", draw_tendency: "Draw tendency",
  run_rate_diff: "Run rate", economy_diff: "Economy rate", bowling_depth_diff: "Bowling depth",
  powerplay_diff: "Powerplay", death_overs_diff: "Death overs",
};

function Bar({ label, p, tone }: { label: string; p: number; tone: "accent" | "saffron" | "muted" }) {
  const bg = tone === "accent" ? "var(--accent)" : tone === "saffron" ? "var(--saffron)" : "rgba(255,255,255,0.45)";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-display text-sm font-bold uppercase text-foreground">{label}</span>
        <span className="font-mono text-lg font-semibold text-foreground">{pct(p)}</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${p * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ background: bg }}
        />
      </div>
    </div>
  );
}

export default function PredictionCards({ matches }: { matches: Upcoming[] }) {
  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        {matches.map((m, i) => (
          <motion.div
            key={m.match_id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: (i % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-saffron">{m.format}</span>
              <DataBadge label={m.data_label} />
            </div>
            <div className="font-display mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-extrabold uppercase text-foreground">
              <span className="flex items-center gap-2"><Flag team="India" /> India</span>
              <span className="text-sm font-normal text-foreground/40">vs</span>
              <span className="flex items-center gap-2"><Flag team={m.opponent} /> {m.opponent}</span>
            </div>
            <div className="font-mono mt-1.5 text-[11px] text-foreground/45">
              {m.venue} &middot; {m.venue_type} &middot; {m.date}
            </div>
            <div className="mt-5 space-y-3.5">
              <Bar label="India win" p={m.probabilities.india} tone="accent" />
              {m.probabilities.draw !== undefined && <Bar label="Draw" p={m.probabilities.draw} tone="muted" />}
              <Bar label={m.opponent} p={m.probabilities.opponent} tone="saffron" />
            </div>
            <div className="font-mono mt-4 text-[11px] uppercase tracking-[0.1em] text-foreground/50">
              Model probability &middot; confidence <span className="text-foreground">{m.confidence}</span>
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs text-foreground/55 hover:text-foreground">What influenced this prediction?</summary>
              <ul className="mt-2 space-y-1">
                {m.explanation.map((e) => (
                  <li key={e.feature} className="font-mono flex justify-between text-xs text-foreground/70">
                    <span>{FEATURE_LABEL[e.feature] ?? e.feature}</span>
                    <span className={e.contribution >= 0 ? "text-accent" : "text-saffron"}>
                      {e.contribution >= 0 ? "+" : ""}{e.contribution.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-foreground/40">
                Method: {m.explanation_method}. Values are model-score contributions, not percentage points.
              </p>
            </details>
          </motion.div>
        ))}
      </div>
      <p className="font-mono mt-5 text-[11px] text-foreground/40">{DISCLAIMER}</p>
    </div>
  );
}
