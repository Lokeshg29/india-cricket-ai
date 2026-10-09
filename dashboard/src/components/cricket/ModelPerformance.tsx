import DataBadge from "./DataBadge";
import { historicalEvaluation, metricOrPending, pct, type FormatData } from "@/lib/cricket";

function cells(data: FormatData) {
  const evaluation = historicalEvaluation.formats[data.slug];
  const metrics = evaluation?.metrics;
  const rows = [
    { label: "Accuracy", value: metricOrPending(metrics?.accuracy, (n) => pct(n)) },
  ];
  if (data.has_draw) {
    rows.push({ label: "Macro F1", value: metricOrPending(metrics?.macro_f1, (n) => n.toFixed(3)) });
  } else {
    rows.push(
      { label: "Precision", value: metricOrPending(metrics?.precision, (n) => n.toFixed(3)) },
      { label: "Recall", value: metricOrPending(metrics?.recall, (n) => n.toFixed(3)) },
      { label: "F1", value: metricOrPending(metrics?.f1, (n) => n.toFixed(3)) },
    );
  }
  rows.push(
    { label: "Log loss", value: metricOrPending(metrics?.log_loss, (n) => n.toFixed(3)) },
    { label: "Brier score", value: metricOrPending(metrics?.brier, (n) => n.toFixed(3)) },
  );
  return rows;
}

export default function ModelPerformance({ formats }: { formats: FormatData[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {formats.map((f) => {
        const evaluation = historicalEvaluation.formats[f.slug];
        return (
        <article key={f.slug} className="glass-card rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">
              {f.format}
            </h3>
            <DataBadge label={evaluation?.data_label ?? "HISTORICAL BACKTEST"} />
          </div>
          <dl className="font-mono space-y-1.5 text-sm text-foreground/70">
            {cells(f).map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt>{row.label}</dt>
                <dd className="text-right text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-foreground/40">
            {evaluation?.status === "EVALUATED" ? `${evaluation.n_evaluated} chronological holdout predictions. Historical backtest, not live-match accuracy.` : "Evaluation pending. No reliable chronological backtest is available."}
            {f.has_draw ? " Test uses a three-way outcome (including draw)." : ""}
          </p>
        </article>
        );
      })}
    </div>
  );
}
