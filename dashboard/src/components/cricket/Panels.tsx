import DataBadge from "./DataBadge";
import Flag from "../Flag";
import { pct, type FormatData } from "@/lib/cricket";

const TH = "font-mono px-3 py-2 text-left text-[10px] font-normal uppercase tracking-[0.12em] text-foreground/40";
const TD = "px-3 py-2.5 text-sm text-foreground/80";

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-card overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[520px] border-collapse">{children}</table>
    </div>
  );
}

export function H2H({ rows }: { rows: FormatData["h2h"] }) {
  return (
    <Table>
      <thead><tr className="border-b border-card-border">
        <th className={TH}>Opponent</th><th className={TH}>P</th><th className={TH}>India W</th><th className={TH}>Opp W</th><th className={TH}>Draw</th>
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.opponent} className="border-b border-card-border last:border-0">
            <td className={TD}><span className="flex items-center gap-2"><Flag team={r.opponent} /> {r.opponent}</span></td>
            <td className={TD}>{r.played}</td>
            <td className={`${TD} text-accent`}>{r.india_wins}</td>
            <td className={TD}>{r.opponent_wins}</td>
            <td className={TD}>{r.draws}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Venues({ rows }: { rows: FormatData["venues"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((v) => (
        <div key={v.venue} className="glass-card rounded-xl p-4">
          <div className="font-display text-lg font-bold text-foreground">{v.venue}</div>
          <div className="font-mono mt-1 text-[11px] text-foreground/45">{v.played} matches</div>
          <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full" style={{ width: `${v.win_rate * 100}%`, background: "var(--accent)" }} />
          </div>
          <div className="font-mono mt-1.5 text-sm text-accent">{pct(v.win_rate)} India win rate</div>
        </div>
      ))}
    </div>
  );
}

export function Players({ rows, slug }: { rows: FormatData["players"]; slug: string }) {
  const test = slug === "test";
  return (
    <Table>
      <thead><tr className="border-b border-card-border">
        <th className={TH}>Player</th><th className={TH}>Role</th><th className={TH}>Matches</th><th className={TH}>Runs</th>
        <th className={TH}>Avg</th>{!test && <th className={TH}>SR</th>}<th className={TH}>Wkts</th>
        <th className={TH}>Econ</th><th className={TH}>Source</th>
      </tr></thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.player} className="border-b border-card-border last:border-0">
            <td className={TD}>{p.player}</td><td className={TD}>{p.role}</td><td className={TD}>{p.recent_matches}</td>
            <td className={TD}>{p.runs}</td><td className={TD}>{p.average}</td>
            {!test && <td className={TD}>{p.strike_rate ?? "–"}</td>}
            <td className={TD}>{p.wickets}</td><td className={TD}>{p.economy ?? "–"}</td>
            <td className={TD}><DataBadge label={p.data_label} /></td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Validation({ v, hasDraw }: { v: FormatData["validation"]; hasDraw: boolean }) {
  const labels = v.confusion_matrix.labels;
  const stats = [
    ["Accuracy", pct(v.accuracy)],
    ["Brier score", v.brier.toFixed(3)],
    ["Log loss", v.log_loss.toFixed(3)],
    ["Matches evaluated", String(v.n_evaluated)],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([k, val]) => (
          <div key={k} className="glass-card rounded-xl p-4 text-center">
            <div className="font-mono text-2xl font-semibold text-foreground">{val}</div>
            <div className="mt-1 text-xs text-foreground/50">{k}</div>
          </div>
        ))}
      </div>
      <Table>
        <thead><tr className="border-b border-card-border">
          <th className={TH}>Actual \ Predicted</th>
          {labels.map((l) => <th key={l} className={TH}>{l}</th>)}
        </tr></thead>
        <tbody>
          {labels.map((a) => (
            <tr key={a} className="border-b border-card-border last:border-0">
              <td className={`${TD} font-mono text-xs uppercase`}>{a}</td>
              {labels.map((b) => (
                <td key={b} className={`${TD} ${a === b ? "text-accent" : ""}`}>{v.confusion_matrix.matrix[a][b]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="font-mono text-[11px] text-foreground/40">
        Walk-forward evaluation (train on earlier matches, predict later ones).{" "}
        {hasDraw ? "Three-class (Test)." : "Two-class (no draw outcome)."} Computed on DEMO DATA; not a claim about real-world accuracy.
      </p>
    </div>
  );
}

export function Ledger({ rows, hasDraw }: { rows: FormatData["ledger"]; hasDraw: boolean }) {
  return (
    <div className="space-y-3">
      <Table>
        <thead><tr className="border-b border-card-border">
          <th className={TH}>Match</th><th className={TH}>Date</th><th className={TH}>Opponent</th><th className={TH}>India</th>
          {hasDraw && <th className={TH}>Draw</th>}<th className={TH}>Result</th><th className={TH}>Correct</th><th className={TH}>Hash</th>
        </tr></thead>
        <tbody>
          {rows.slice(-10).reverse().map((r) => (
            <tr key={r.match_id} className="border-b border-card-border last:border-0">
              <td className={`${TD} font-mono text-xs`}>{r.match_id}</td><td className={TD}>{r.date}</td><td className={TD}>{r.opponent}</td>
              <td className={TD}>{pct(r.india_probability)}</td>
              {hasDraw && <td className={TD}>{pct(r.draw_probability ?? 0)}</td>}
              <td className={TD}>{r.actual_result}</td>
              <td className={`${TD} ${r.model_correct ? "text-accent" : "text-saffron"}`}>{r.model_correct ? "yes" : "no"}</td>
              <td className={`${TD} font-mono text-[10px]`} title={r.hash}>{r.hash.slice(0, 10)}…</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="font-mono text-[11px] text-foreground/40">
        DEMO DATA: these rows were generated in one batch for demonstration, so they are NOT proof of pre-match
        prediction (verified_pre_match = false). Hashes are chained (each includes the previous), so editing a row breaks the chain.
      </p>
    </div>
  );
}
