import DataBadge from "./cricket/DataBadge";
import Flag from "./Flag";
import { resultLabel, type FormatData } from "@/lib/cricket";

export type ResultRow = FormatData["results"][number] & { fmt: string };

export default function ResultCards({ results }: { results: ResultRow[] }) {
  if (results.length === 0) {
    return <p className="text-sm text-foreground/50">No completed matches in this view.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((r, i) => (
        <article
          key={`${r.date}-${r.fmt}-${r.opponent}-${i}`}
          className="sports-card glass-card flex flex-col gap-2 rounded-lg p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{r.fmt}</span>
            <DataBadge label={r.data_label} />
          </div>
          <div className="font-mono text-xs text-foreground/45">{r.date}</div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase text-foreground">
            <Flag team="India" />
            <span>India</span>
            <span className="text-xs font-normal text-foreground/40">vs</span>
            <Flag team={r.opponent} />
            <span className="truncate">{r.opponent}</span>
          </div>
          <div
            className={`font-mono text-sm ${
              r.result === "india" ? "text-accent" : r.result === "draw" ? "text-foreground/70" : "text-accent-red"
            }`}
          >
            {resultLabel(r.result)}
          </div>
        </article>
      ))}
    </div>
  );
}
