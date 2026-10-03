import DataBadge from "./DataBadge";
import { metricOrPending, pct, type FormatData } from "@/lib/cricket";

function cells(data: FormatData) {
  const v = data.validation;
  const rows = [
    { label: "Accuracy", value: metricOrPending(v?.accuracy, (n) => pct(n)) },
    { label: "Brier score", value: metricOrPending(v?.brier, (n) => n.toFixed(3)) },
    { label: "Log loss", value: metricOrPending(v?.log_loss, (n) => n.toFixed(3)) },
  ];
  if (v?.calibration?.length) rows.push({ label: "Calibration", value: `${v.calibration.length} bins recorded` });
  return rows;
}

export default function ModelPerformance({ formats }: { formats: FormatData[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {formats.map((f) => (
        <article key={f.slug} className="glass-card rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">
              {f.format}
            </h3>
            <DataBadge label={f.data_label} />
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
            Stored evaluation metrics. Not a live-match accuracy claim.
            {f.has_draw ? " Test uses a three-way outcome (including draw)." : ""}
          </p>
        </article>
      ))}
    </div>
  );
}
