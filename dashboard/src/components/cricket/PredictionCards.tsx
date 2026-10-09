"use client";

import { useEffect, useState } from "react";
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
  india_elo_pre: "India pre-match rating", opponent_elo_pre: "Opponent pre-match rating",
  india_recent_win_rate: "India recent win rate", h2h_india_win_rate: "Head-to-head win rate",
  india_batting_average: "India batting average", opponent_batting_average: "Opponent batting average",
  india_bowling_average: "India bowling average", opponent_bowling_average: "Opponent bowling average",
  india_run_rate: "India run rate", opponent_run_rate: "Opponent run rate",
  india_bowling_economy: "India bowling economy", opponent_bowling_economy: "Opponent bowling economy",
  india_wickets_lost: "India wickets lost", opponent_wickets_lost: "Opponent wickets lost",
  india_bowling_wickets: "India bowling wickets", opponent_bowling_wickets: "Opponent bowling wickets",
  india_first_innings_runs: "India first-innings runs", opponent_first_innings_runs: "Opponent first-innings runs",
};

type ModelPrediction = {
  probabilities: { india: number; opponent: number; draw?: number };
  model_version: string;
  explanation: { feature: string; contribution: number }[];
  explanation_method: string;
};

function isEligibleFixture(match: Upcoming) {
  return match.fixture_source === "OFFICIAL_FIXTURE_FEED"
    && (match.data_label === "HISTORICAL DATA" || match.data_label === "LIVE DATA")
    && Number.isFinite(Date.parse(`${match.date}T00:00:00Z`))
    && Date.parse(`${match.date}T00:00:00Z`) > Date.now();
}

function toPredictionPayload(value: unknown, hasDraw: boolean): ModelPrediction | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as {
    status?: unknown;
    model_version?: unknown;
    probabilities?: Record<string, unknown>;
    explanation?: {
      method?: unknown;
      positive_factors?: { feature?: unknown; contribution?: unknown }[];
      negative_factors?: { feature?: unknown; contribution?: unknown }[];
    };
  };
  const probs = payload.probabilities;
  if (payload.status !== "available" || typeof payload.model_version !== "string" || !probs) return null;
  const required = hasDraw ? ["india", "draw", "opponent"] : ["india", "opponent"];
  const values = required.map((key) => probs[key]);
  if (values.some((p) => typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1)) return null;
  const sum = (values as number[]).reduce((total, probability) => total + probability, 0);
  if (Math.abs(sum - 1) > 1e-6) return null;
  return {
    probabilities: {
      india: probs.india as number,
      opponent: probs.opponent as number,
      ...(hasDraw ? { draw: probs.draw as number } : {}),
    },
    model_version: payload.model_version,
    explanation: [...(payload.explanation?.positive_factors ?? []), ...(payload.explanation?.negative_factors ?? [])]
      .filter((factor): factor is { feature: string; contribution: number } =>
        typeof factor.feature === "string" && typeof factor.contribution === "number" && Number.isFinite(factor.contribution)),
    explanation_method: typeof payload.explanation?.method === "string" ? payload.explanation.method : "unavailable",
  };
}

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

export default function PredictionCards({ matches }: { matches: Upcoming[] }) {
  const [predictions, setPredictions] = useState<Record<string, ModelPrediction>>({});
  useEffect(() => {
    const eligible = matches.filter(isEligibleFixture);
    if (eligible.length === 0) return;
    const controller = new AbortController();
    void Promise.all(eligible.map(async (match) => {
      try {
        const response = await fetch("/api/cricket/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: match.format.toLowerCase(), match_id: match.match_id }),
          signal: controller.signal,
        });
        const prediction = toPredictionPayload(await response.json(), match.format.toLowerCase() === "test");
        if (prediction && response.ok) {
          setPredictions((current) => ({ ...current, [match.match_id]: prediction }));
        }
      } catch {
        // Leave this verified fixture visible with prediction unavailable.
      }
    }));
    return () => controller.abort();
  }, [matches]);

  const list = matches.filter(isEligibleFixture);
  if (list.length === 0) {
    return <p className="text-sm text-foreground/50">No verified upcoming India international fixtures are configured. Schedule and model probabilities are unavailable.</p>;
  }
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((m) => {
          const prediction = predictions[m.match_id];
          const probability = prediction?.probabilities;
          const status = probability ? "Prediction available" : "Prediction unavailable";
          return (
          <article key={m.match_id} className="sports-card glass-card rounded-lg p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{m.format}</span>
              <DataBadge label={probability ? "MODEL PREDICTION" : m.data_label} />
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
              <span className={`h-1.5 w-1.5 rounded-full ${status === "Prediction available" ? "bg-accent-red" : "bg-foreground/25"}`} />
              {status}
            </div>
            {probability && (
              <div className="mt-4 space-y-3">
                <Bar label="India" p={probability.india} tone="accent" />
                {probability.draw !== undefined && <Bar label="Draw" p={probability.draw} tone="muted" />}
                <Bar label={m.opponent} p={probability.opponent} tone="red" />
                <p className="font-mono text-[10px] text-foreground/40">Model {prediction?.model_version}</p>
              </div>
            )}
            {prediction && prediction.explanation.length > 0 && (
              <details className="mt-4 border-t border-card-border pt-3 text-sm">
                <summary className="cursor-pointer text-xs text-foreground/55 transition-colors hover:text-foreground">
                  Feature contributions
                </summary>
                <ul className="mt-2 space-y-1">
                  {prediction.explanation.map((e) => (
                    <li key={e.feature} className="font-mono flex justify-between text-xs text-foreground/70">
                      <span>{FEATURE_LABEL[e.feature] ?? e.feature}</span>
                      <span className={e.contribution >= 0 ? "text-accent" : "text-saffron"}>
                        {e.contribution >= 0 ? "+" : ""}{e.contribution.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-foreground/40">
                  Method: {prediction.explanation_method}. Values show changes in predicted probability.
                </p>
              </details>
            )}
          </article>
          );
        })}
      </div>
      <p className="font-mono mt-4 text-[11px] text-foreground/40">{DISCLAIMER}</p>
    </div>
  );
}
