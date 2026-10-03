const STEPS = [
  { num: "01", title: "Data", body: "Match history is checked for schema, result labels and chronology. The current export is DEMO DATA; the loader is built so a historical source can replace it without changing downstream code." },
  { num: "02", title: "Features", body: "Team strength, recent form, head-to-head, venue and toss, plus format-specific batting and bowling indicators. Features use only earlier matches." },
  { num: "03", title: "Model", body: "Separate models per format. Test is three-way (India / Draw / Opponent); ODI and T20I are two-way. Probabilities are sigmoid-calibrated." },
  { num: "04", title: "Estimates", body: "Each listed fixture can carry a model probability, written to a timestamped prediction record with a format identifier." },
  { num: "05", title: "Explainability", body: "Per-match feature contributions from a logistic-coefficient surrogate. These are score contributions, not SHAP values." },
  { num: "06", title: "Evaluation", body: "Walk-forward accuracy, Brier score, log loss and calibration are stored per format when the evaluation pipeline has been run." },
];

export default function MethodologySection() {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((step) => (
        <article key={step.title} className="glass-card rounded-lg p-4">
          <div className="font-mono mb-2 text-[11px] text-accent">{step.num}</div>
          <h3 className="mb-1.5 text-base font-semibold text-foreground">{step.title}</h3>
          <p className="text-sm leading-relaxed text-foreground/55">{step.body}</p>
        </article>
      ))}
    </div>
  );
}
