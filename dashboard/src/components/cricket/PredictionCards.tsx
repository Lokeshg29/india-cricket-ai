"use client";

import { useRef, useState } from "react";
import Flag from "../Flag";
import DataBadge from "./DataBadge";
import { pct, type Upcoming } from "@/lib/cricket";
import { DISCLAIMER } from "@/lib/site";
import { formatIstDateTime } from "@/lib/datetime";

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

type FixturePredictionState = {
  status: "loading" | "available" | "unavailable";
  prediction?: ModelPrediction;
  reason?: string;
};

function isEligibleFixture(match: Upcoming) {
  return match.fixture_source === "VERIFIED_FIXTURE_REGISTRY"
    && match.data_label === "VERIFIED FIXTURE"
    && match.status === "scheduled"
    && typeof match.start_time === "string"
    && /(Z|[+-]\d{2}:\d{2})$/.test(match.start_time)
    && Number.isFinite(Date.parse(match.start_time))
    && Date.parse(match.start_time) > Date.now();
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
  const bg = tone === "accent" ? "var(--accent)" : tone === "red" ? "var(--accent-red)" : "color-mix(in srgb, var(--foreground) 45%, transparent)";
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
  const [predictions, setPredictions] = useState<Record<string, FixturePredictionState>>({});
  const requestsInFlight = useRef(new Set<string>());

  async function getPrediction(match: Upcoming) {
    if (requestsInFlight.current.has(match.match_id)
      || predictions[match.match_id]?.status === "available") return;

    requestsInFlight.current.add(match.match_id);
    setPredictions((current) => ({
      ...current,
      [match.match_id]: { status: "loading" },
    }));

    try {
      const response = await fetch("/api/cricket/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: match.format.toLowerCase(), match_id: match.match_id }),
      });
      const payload = await response.json() as { reason?: unknown };
      const prediction = toPredictionPayload(payload, match.format.toLowerCase() === "test");
      if (!response.ok || !prediction) {
        setPredictions((current) => ({
          ...current,
          [match.match_id]: {
            status: "unavailable",
            reason: typeof payload.reason === "string" ? payload.reason : "Prediction is unavailable right now.",
          },
        }));
        return;
      }
      setPredictions((current) => ({
        ...current,
        [match.match_id]: { status: "available", prediction },
      }));
    } catch {
      setPredictions((current) => ({
        ...current,
        [match.match_id]: { status: "unavailable", reason: "Prediction service could not be reached." },
      }));
    } finally {
      requestsInFlight.current.delete(match.match_id);
    }
  }

  const list = matches.filter(isEligibleFixture);
  if (list.length === 0) {
    return <p className="text-sm text-foreground/50">No verified upcoming India international fixtures are configured. Schedule and model probabilities are unavailable.</p>;
  }
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((m) => {
          const predictionState = predictions[m.match_id];
          const prediction = predictionState?.prediction;
          const probability = prediction?.probabilities;
          const status = predictionState?.status === "loading"
            ? "Getting prediction…"
            : predictionState?.status === "available"
              ? "Prediction available"
              : predictionState?.status === "unavailable"
                ? "Prediction unavailable"
                : "Prediction not requested";
          return (
          <article key={m.match_id} className="fixture-card sports-card glass-card rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-accent/20 bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                  {m.format}
                </span>
                {m.status && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-card-border bg-background-raised/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    {m.status}
                  </span>
                )}
              </div>
              <DataBadge label={probability ? "MODEL PREDICTION" : m.data_label} />
            </div>

            <div className="mt-7 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <Flag team="India" className="h-5 w-7 shrink-0 sm:h-6 sm:w-8" />
                <span className="min-w-0 break-words text-base font-semibold leading-tight text-foreground sm:text-xl">India</span>
              </div>
              <span className="rounded-full border border-card-border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-secondary sm:px-2.5">vs</span>
              <div className="flex min-w-0 items-center justify-end gap-2.5 text-right sm:gap-3">
                <span className="min-w-0 break-words text-base font-semibold leading-tight text-foreground sm:text-xl">{m.opponent}</span>
                <Flag team={m.opponent} className="h-5 w-7 shrink-0 sm:h-6 sm:w-8" />
              </div>
            </div>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              <div className="fixture-info min-w-0 rounded-xl p-3.5">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-secondary">Match time</div>
                <div className="mt-1.5 text-sm font-medium text-foreground sm:text-[15px]">
                  {m.start_time ? formatIstDateTime(m.start_time) : m.date}
                </div>
              </div>
              <div className="fixture-info min-w-0 rounded-xl p-3.5">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-secondary">Venue</div>
                <div className="mt-1.5 break-words text-sm font-medium text-foreground sm:text-[15px]">{m.venue}</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-card-border pt-4">
              <div className="font-mono flex items-center gap-2 text-[10px] uppercase tracking-[0.11em] text-secondary" role="status" aria-live="polite">
                <span className={`h-1.5 w-1.5 rounded-full ${predictionState?.status === "available" ? "bg-accent-red" : predictionState?.status === "unavailable" ? "bg-saffron" : "bg-foreground/25"}`} />
                {status}
              </div>
              <button
                type="button"
                onClick={() => void getPrediction(m)}
                disabled={predictionState?.status === "loading" || predictionState?.status === "available"}
                aria-busy={predictionState?.status === "loading"}
                className="min-h-10 rounded-lg border border-accent/30 bg-accent px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-background shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55"
              >
                {predictionState?.status === "loading"
                  ? "Getting prediction…"
                  : predictionState?.status === "available"
                    ? "Prediction ready"
                    : "Get prediction"}
              </button>
            </div>

            {m.data_source && (
              <p className="mt-3 font-mono text-[10px] text-secondary/80">Source: {m.data_source}</p>
            )}
            {predictionState?.status === "unavailable" && predictionState.reason && (
              <p className="mt-2 text-xs text-foreground/60">{predictionState.reason}</p>
            )}
            {probability && (
              <div className="mt-5 space-y-3 border-t border-card-border pt-4">
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
