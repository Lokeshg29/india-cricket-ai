"use client";

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

function Bar({ label, p, tone }: { label: string; p: number; tone: "accent" | "red" | "muted" }) {
  const bg = tone === "accent" ? "var(--accent)" : tone === "red" ? "var(--accent-red)" : "rgba(255,255,255,0.45)";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="font-mono text-sm text-foreground">{pct(p)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: bg }} />
      </div>
    </div>
  );
}

function predictionStatus(m: Upcoming) {
  const p = m.probabilities;
  if (p && Number.isFinite(p.india) && Number.isFinite(p.opponent)) return "Prediction available";
  return "No prediction available";
}

export default function PredictionCards({ matches }: { matches: Upcoming[] }) {
  const list = matches.filter(Boolean);
  if (list.length === 0) {
    return <p className="text-sm text-foreground/50">No upcoming fixtures in this view.</p>;
  }
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((m) => (
          <article key={m.match_id} className="sports-card glass-card rounded-lg p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{m.format}</span>
              <DataBadge label={m.data_label} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold uppercase text-foreground">
              <span className="flex items-center gap-2"><Flag team="India" /> India</span>
              <span className="text-xs font-normal text-foreground/40">vs</span>
              <span className="flex items-center gap-2"><Flag team={m.opponent} /> {m.opponent}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-foreground/50">
              <span>{m.date}</span><span>{m.venue}</span><span className="capitalize">{m.venue_type}</span>
            </div>
            <div className="font-mono mt-4 flex items-center gap-2 border-t border-card-border pt-3 text-[10px] uppercase tracking-[0.12em] text-foreground/55">
              <span className={`h-1.5 w-1.5 rounded-full ${predictionStatus(m) === "Prediction available" ? "bg-accent-red" : "bg-foreground/25"}`} />
              {predictionStatus(m)}
            </div>
            {predictionStatus(m) === "Prediction available" && (
              <div className="mt-4 space-y-3">
                <Bar label="India" p={m.probabilities.india} tone="accent" />
                {m.probabilities.draw !== undefined && <Bar label="Draw" p={m.probabilities.draw} tone="muted" />}
                <Bar label={m.opponent} p={m.probabilities.opponent} tone="red" />
              </div>
            )}
            {m.explanation?.length > 0 && (
              <details className="mt-4 border-t border-card-border pt-3 text-sm">
                <summary className="cursor-pointer text-xs text-foreground/55 transition-colors hover:text-foreground">
                  Feature contributions
                </summary>
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
            )}
          </article>
        ))}
      </div>
      <p className="font-mono mt-4 text-[11px] text-foreground/40">{DISCLAIMER}</p>
    </div>
  );
}
