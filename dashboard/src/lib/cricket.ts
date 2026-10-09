import testRaw from "../../data/cricket/test.json";
import odiRaw from "../../data/cricket/odi.json";
import t20iRaw from "../../data/cricket/t20i.json";
import registryRaw from "../../data/cricket/model_registry.json";
import healthRaw from "../../data/cricket/system_health.json";
import qualityRaw from "../../data/cricket/data_quality.json";
import driftRaw from "../../data/cricket/drift.json";
import trainingRaw from "../../data/cricket/training.json";
import historicalEvaluationRaw from "../../data/cricket/historical_evaluation.json";

// Every exported file carries a data_label so the UI can't present demo
// numbers as real. LIVE DATA / HISTORICAL DATA are only used once a real
// ingestion source is wired in (see src/sports/cricket/demo_data.py).
export type DataLabel = "LIVE DATA" | "HISTORICAL DATA" | "HISTORICAL BACKTEST" | "MODEL PREDICTION" | "DEMO DATA" | "UNAVAILABLE";
export type AnalyticsSources = Record<string, { status: DataLabel; source: string | null; note?: string }>;
export type Outcome = "india" | "opponent" | "draw";

export type Upcoming = {
  match_id: string;
  opponent: string;
  venue: string;
  venue_type: string;
  date: string;
  format: string;
  probabilities: { india: number; opponent: number; draw?: number } | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  explanation: { feature: string; contribution: number }[];
  explanation_method: string;
  data_label: DataLabel;
  fixture_source?: "OFFICIAL_FIXTURE_FEED" | null;
  prediction_status?: "available" | "unavailable";
};

export type LedgerRow = {
  match_id: string; format: string; date: string; opponent: string;
  prediction_timestamp: string | null; evaluation_timestamp?: string; model_version: string;
  india_probability: number; opponent_probability: number; draw_probability?: number | null;
  actual_result: Outcome; predicted_result?: Outcome; model_correct: boolean; hash?: string;
  verified_pre_match: boolean; data_label: DataLabel;
};

export type FormatData = {
  format: string; slug: string; has_draw: boolean; outcomes: Outcome[];
  data_label: DataLabel; data_source: string; model_version: string; generated_at: string; features: string[];
  data_sources: AnalyticsSources;
  summary: { matches_tracked: number; predictions_generated: number; accuracy: number | null; holdout_accuracy: number | null };
  upcoming: Upcoming[];
  results: { date: string; opponent: string; venue: string; result: Outcome; data_label: DataLabel }[];
  h2h: { opponent: string; played: number; india_wins: number; opponent_wins: number; draws: number }[];
  venues: { venue: string; played: number; win_rate: number }[];
  form: { date: string; form: number }[];
  trend: { match_id: string; step: number; india: number }[];
  players: {
    player: string; role: string; recent_matches: number; runs: number; average: number;
    strike_rate: number | null; wickets: number; economy: number | null; data_label: DataLabel;
  }[];
  validation: {
    n_evaluated: number; accuracy: number | null; brier: number | null; log_loss: number | null;
    precision?: number | null; recall?: number | null; f1?: number | null; macro_f1?: number | null;
    confusion_matrix: { labels: string[]; matrix: Record<string, Record<string, number>> };
    calibration: { bin: string; n: number; mean_confidence: number; accuracy: number }[];
    data_label?: DataLabel;
  };
  ledger: LedgerRow[];
};

export type HistoricalFormatEvaluation = {
  format: string;
  slug: string;
  status: "EVALUATED" | "EVALUATION_PENDING";
  data_label: DataLabel;
  model_version?: string;
  model_type?: string;
  feature_version?: string;
  n_evaluated: number;
  metrics?: { accuracy: number | null; precision: number | null; recall: number | null; f1: number | null; macro_f1: number | null; log_loss: number | null; brier: number | null };
  validation?: {
    n_evaluated: number;
    accuracy?: number | null; precision?: number | null; recall?: number | null; f1?: number | null; macro_f1?: number | null;
    log_loss?: number | null; brier?: number | null;
    confusion_matrix?: { labels: string[]; matrix: Record<string, Record<string, number>> };
    calibration: { bin: string; n: number; mean_confidence: number; accuracy: number }[];
  };
  ledger: LedgerRow[];
};

export const historicalEvaluation = historicalEvaluationRaw as {
  generated_at: string;
  source: string;
  data_label: DataLabel;
  formats: Record<string, HistoricalFormatEvaluation>;
};

export const FORMATS: Record<string, FormatData> = {
  test: testRaw as unknown as FormatData,
  odi: odiRaw as unknown as FormatData,
  t20i: t20iRaw as unknown as FormatData,
};

export const formatData = (slug: string) => FORMATS[slug];
export const allFormats = () => Object.values(FORMATS);

export function aggregateDataLabel(formats: FormatData[]): DataLabel {
  if (formats.length === 0) return "DEMO DATA";
  if (formats.every((f) => f.data_label === "LIVE DATA")) return "LIVE DATA";
  if (formats.every((f) => f.data_label === "HISTORICAL DATA")) return "HISTORICAL DATA";
  if (formats.some((f) => f.data_label === "DEMO DATA")) return "DEMO DATA";
  return "HISTORICAL DATA";
}

export const modelRegistry = registryRaw as {
  format: string; version: string; stage: string; backend: string;
  accuracy: number | null; brier: number | null; log_loss: number | null; data_label: DataLabel;
}[];
export const systemHealth = healthRaw as Record<string, string>;
export const dataQuality = qualityRaw as { checks: { name: string; status: string }[]; data_label: DataLabel };
export const drift = driftRaw as { status: string; data_label: DataLabel };
export const training = trainingRaw as { last_trained: string | null; status: string; data_label: DataLabel };

export const pct = (p: number, d = 1) => `${(p * 100).toFixed(d)}%`;

/** Show a formatted metric, or "Evaluation pending" when the value is missing. */
export function metricOrPending(
  value: number | undefined | null,
  format: (n: number) => string,
): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "Evaluation pending";
  }
  return format(value);
}

export const resultLabel = (result: Outcome) =>
  result === "india" ? "India won" : result === "draw" ? "Drew" : "India lost";
