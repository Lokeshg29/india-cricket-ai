import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import Section from "@/components/Section";
import SectionHeading from "@/components/SectionHeading";
import StatsStrip from "@/components/StatsStrip";
import ResultCards from "@/components/ResultCards";
import MethodologySection from "@/components/MethodologySection";
import TechStack from "@/components/TechStack";
import PredictionCards from "@/components/cricket/PredictionCards";
import StoredPredictionHistory from "@/components/cricket/StoredPredictionHistory";
import ModelPerformance from "@/components/cricket/ModelPerformance";
import DataBadge from "@/components/cricket/DataBadge";
import { Ledger, Validation } from "@/components/cricket/Panels";
import { CalibrationChart, FormChart } from "@/components/cricket/Charts";
import { aggregateDataLabel, allFormats, historicalEvaluation } from "@/lib/cricket";
import { getFixtureFeed } from "@/lib/server-fixtures";

export const dynamic = "force-dynamic";

export default async function Home() {
  const formats = allFormats();
  const fixtureFeed = await getFixtureFeed();
  const upcoming = fixtureFeed.fixtures.sort((a, b) => (a.start_time ?? a.date).localeCompare(b.start_time ?? b.date));
  const results = formats.flatMap((f) =>
    f.results.map((r) => ({ ...r, fmt: f.format })),
  ).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const ledger = formats
    .flatMap((f) => historicalEvaluation.formats[f.slug]?.ledger ?? [])
    .sort((a, b) => b.date.localeCompare(a.date));
  const dataLabel = aggregateDataLabel(formats);

  const stats = [
    { label: "Upcoming matches", value: String(upcoming.length) },
    { label: "Recent results", value: String(results.length) },
    { label: "Formats", value: "Test · ODI · T20I" },
    { label: "Public data status", value: dataLabel },
  ];

  return (
    <main className="relative">
      <Nav />
      <Hero dataLabel={dataLabel} minimal />

      <Section>
        <StatsStrip stats={stats} />
      </Section>

      <Section id="matches">
        <SectionHeading
          eyebrow="Schedule"
          title="Upcoming Matches"
          subtitle={fixtureFeed.status === "available"
            ? `Verified schedule source: ${fixtureFeed.source}. Model probabilities are estimates, not guarantees.`
            : fixtureFeed.reason ?? "No verified upcoming international fixture feed is configured."}
        />
        <PredictionCards matches={upcoming} />
        <div className="mt-10">
          <SectionHeading eyebrow="Results" title="Recent Matches" subtitle="Completed matches from the available export." />
          <ResultCards results={results} />
        </div>
      </Section>

      <Section id="predictions">
        <SectionHeading
          eyebrow="Predictions"
          title="Prediction History"
          subtitle="Timestamped model estimates are stored separately from match results. Actual outcomes appear only after a provider verifies a completed match."
        />
        <StoredPredictionHistory />
        <div className="mt-8">
          <SectionHeading eyebrow="Evaluation" title="Historical Backtest Ledger" subtitle="Chronological holdout predictions from Cricsheet. These are not archived pre-match calls." />
          <Ledger rows={ledger} hasDraw />
        </div>
      </Section>

      <Section id="analytics">
        <SectionHeading
          eyebrow="Analytics"
          title="Team Performance & Format Insights"
          subtitle="India form uses resolved Cricsheet international results. Player-level scorecards and upcoming fixtures are unavailable in the current data sources."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {formats.map((f) => (
            <article key={f.slug} className="glass-card rounded-lg p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold uppercase">{f.format}</h3>
                <DataBadge label={f.data_sources.form.status} />
              </div>
              <p className="mb-3 text-xs text-foreground/50">
                {f.has_draw ? "Outcomes: India / Draw / Opponent · Cricsheet" : "Outcomes: India / Opponent · Cricsheet"}
              </p>
              <FormChart form={f.form.slice(-12)} />
            </article>
          ))}
        </div>
        <div className="mt-12">
          <SectionHeading eyebrow="Model Performance" title="Model Performance" subtitle="Metrics from the stored evaluation export. Missing values are shown as Evaluation pending." />
          <ModelPerformance formats={formats} />
        </div>
        <div className="mt-12">
          <SectionHeading eyebrow="Model Details" title="Model Evaluation" subtitle="Evaluation summaries and calibration are available when recorded for a format." />
          {formats.map((f) => (
            <div key={f.slug} className="mb-8 space-y-4">
              <h3 className="text-sm font-semibold text-foreground/75">{f.format}</h3>
              <Validation v={historicalEvaluation.formats[f.slug]?.validation} hasDraw={f.has_draw} />
              {historicalEvaluation.formats[f.slug]?.validation?.calibration.length ? (
                <CalibrationChart calibration={historicalEvaluation.formats[f.slug].validation!.calibration} />
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-12">
          <SectionHeading eyebrow="Model Details" title="How the Model Works" subtitle="Project methods and implementation details for readers who want more depth." />
          <MethodologySection />
          <div className="mt-8">
            <SectionHeading eyebrow="Implementation" title="Technology" />
            <TechStack />
          </div>
        </div>
      </Section>
      <Footer />
    </main>
  );
}
