"use client";

import { useEffect, useState } from "react";
import DataBadge from "./DataBadge";
import { pct } from "@/lib/cricket";
import { formatUtcDateTime } from "@/lib/datetime";

type PredictionEvent = {
  provider_fixture_id: string;
  teams: string[];
  format: "TEST" | "ODI" | "T20I";
  scheduled_start: string;
  predicted_at: string;
  model_version: string;
  predicted_class: "india" | "opponent" | "draw";
  probabilities: Record<string, number>;
  data_source: string;
  match_status: string;
  actual_outcome: "india" | "opponent" | "draw" | null;
};

type HistoryResponse = {
  status: "available" | "empty" | "unavailable";
  reason?: string | null;
  records: PredictionEvent[];
};

function parseHistory(value: unknown): HistoryResponse | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (!["available", "empty", "unavailable"].includes(String(payload.status)) || !Array.isArray(payload.records)) return null;
  const records = payload.records.filter((row): row is PredictionEvent => {
    if (!row || typeof row !== "object") return false;
    const event = row as Record<string, unknown>;
    const format = event.format;
    if (!["TEST", "ODI", "T20I"].includes(String(format))
      || typeof event.provider_fixture_id !== "string" || typeof event.model_version !== "string"
      || typeof event.data_source !== "string" || !Array.isArray(event.teams) || event.teams.some((team) => typeof team !== "string")
      || typeof event.scheduled_start !== "string" || !Number.isFinite(Date.parse(event.scheduled_start))
      || typeof event.predicted_at !== "string" || !Number.isFinite(Date.parse(event.predicted_at))
      || !["scheduled", "live", "finished", "postponed", "cancelled"].includes(String(event.match_status))) return false;
    const probs = event.probabilities;
    const labels = format === "TEST" ? ["india", "draw", "opponent"] : ["india", "opponent"];
    if (!probs || typeof probs !== "object" || Array.isArray(probs)) return false;
    const probabilities = probs as Record<string, unknown>;
    const values = labels.map((label) => probabilities[label]);
    if (Object.keys(probabilities).length !== labels.length
      || values.some((probability) => typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1)
      || Math.abs((values as number[]).reduce((sum, probability) => sum + probability, 0) - 1) > 1e-6) return false;
    const outcomes = labels;
    return outcomes.includes(String(event.predicted_class))
      && (event.actual_outcome === null || outcomes.includes(String(event.actual_outcome)));
  });
  return {
    status: payload.status as HistoryResponse["status"],
    reason: typeof payload.reason === "string" ? payload.reason : null,
    records,
  };
}

export default function StoredPredictionHistory() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/cricket/predictions/history", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload: unknown) => setData(parseHistory(payload) ?? { status: "unavailable", records: [], reason: "Prediction history response was invalid." }))
      .catch(() => setData({ status: "unavailable", records: [], reason: "Prediction history service could not be reached." }));
    return () => controller.abort();
  }, []);

  if (!data) return <p className="text-sm text-foreground/45">Loading stored prediction events…</p>;
  if (data.records.length === 0) return <p className="text-sm text-foreground/45">{data.reason ?? "No stored model prediction events."}</p>;

  return (
    <div className="space-y-3">
      {data.records.map((event) => (
        <article key={`${event.provider_fixture_id}:${event.model_version}:${event.predicted_at}`} className="glass-card rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase text-foreground">{event.teams.join(" vs ")} · {event.format}</span>
            <DataBadge label="MODEL PREDICTION" />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-foreground/50">
            <span>Scheduled {formatUtcDateTime(event.scheduled_start)}</span>
            <span>Predicted {formatUtcDateTime(event.predicted_at)}</span>
            <span>Source {event.data_source}</span>
            <span>Model {event.model_version}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-foreground/75">
            {Object.entries(event.probabilities).map(([outcome, probability]) => (
              <span key={outcome}>{outcome}: {pct(probability)}</span>
            ))}
            <span>Predicted: {event.predicted_class}</span>
            <span>Actual: {event.actual_outcome ?? "Not verified yet"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
