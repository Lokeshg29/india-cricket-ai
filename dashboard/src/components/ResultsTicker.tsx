"use client";

import type { FormatData } from "@/lib/cricket";

type Row = FormatData["results"][number] & { fmt: string };

const WORD = { india: "India won", opponent: "lost to", draw: "drew with" } as const;

function TickerRow({ rows, copy }: { rows: Row[]; copy: number }) {
  return (
    <div className="flex flex-none gap-3.5">
      {rows.map((r, i) => (
        <div
          key={`${copy}-${r.date}-${r.fmt}-${i}`}
          className="font-mono glass-card flex flex-none items-center gap-3 whitespace-nowrap rounded-[10px] px-5 py-3.5 text-[13px]"
        >
          <span className="text-[10px] text-saffron">{r.fmt}</span>
          <span className="text-foreground/70">India</span>
          <span className={`font-semibold ${r.result === "opponent" ? "text-foreground/60" : "text-accent"}`}>
            {r.result === "india" ? "W" : r.result === "draw" ? "D" : "L"}
          </span>
          <span className="text-foreground/70">{r.opponent}</span>
          <span className="sr-only">{WORD[r.result]}</span>
        </div>
      ))}
    </div>
  );
}

export default function ResultsTicker({ results }: { results: Row[] }) {
  const recent = results.slice(0, 16);
  if (recent.length === 0) return null;
  return (
    <div className="w-full overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)" }}>
      <div className="flex w-max gap-3.5" style={{ animation: "wc-marquee 42s linear infinite" }}>
        <TickerRow rows={recent} copy={0} />
        <TickerRow rows={recent} copy={1} />
      </div>
    </div>
  );
}
