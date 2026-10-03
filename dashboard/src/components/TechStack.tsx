const GROUPS: { label: string; items: string[] }[] = [
  { label: "Data & modelling", items: ["Python", "pandas", "NumPy", "scikit-learn", "Elo-style ratings", "Sigmoid calibration"] },
  { label: "Optional / planned", items: ["XGBoost backend", "SHAP", "Cricsheet historical load"] },
  { label: "Dashboard", items: ["Next.js", "TypeScript", "Tailwind CSS", "Recharts"] },
  { label: "Evaluation", items: ["pytest", "Walk-forward backtesting", "Prediction ledger"] },
];

export default function TechStack() {
  return (
    <div className="space-y-5">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="font-mono mb-2 text-[11px] uppercase tracking-[0.14em] text-foreground/40">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <span key={item} className="font-mono rounded border border-card-border px-3 py-1.5 text-xs text-foreground/80">
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
