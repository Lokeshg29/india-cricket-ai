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
import ModelPerformance from "@/components/cricket/ModelPerformance";
import DataBadge from "@/components/cricket/DataBadge";
import { Ledger, Validation } from "@/components/cricket/Panels";
import { CalibrationChart, FormChart } from "@/components/cricket/Charts";
import { aggregateDataLabel, allFormats } from "@/lib/cricket";

export default function Home() {
  const formats = allFormats();
  const upcoming = formats.flatMap((f) => f.upcoming).sort((a, b) => a.date.localeCompare(b.date));
  const results = formats.flatMap((f) =>
    f.results.map((r) => ({ ...r, fmt: f.format })),
  ).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const ledger = formats
    .flatMap((f) => f.ledger.map((row) => ({ ...row, format: f.format })))
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
      <Hero dataLabel={dataLabel} />

      <Section>
        <StatsStrip stats={stats} />
      </Section>

      <Section id="matches">
        <SectionHeading
          eyebrow="Schedule"
          title="Upcoming Matches"
          subtitle="Fixtures and any available estimates come from the labelled data export. Demo entries are not an official schedule."
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
          subtitle="Stored estimates and outcomes. DEMO DATA rows were generated after matches and are not verified pre-match predictions."
        />
        <Ledger rows={ledger} hasDraw />
      </Section>

      <Section id="analytics">
        <SectionHeading
          eyebrow="Analytics"
          title="Team Performance & Format Insights"
          subtitle="Explore India’s form by format. Use TEST, ODI or T20I above for player, venue and head-to-head detail."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {formats.map((f) => (
            <article key={f.slug} className="glass-card rounded-lg p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold uppercase">{f.format}</h3>
                <DataBadge label={f.data_label} />
              </div>
              <p className="mb-3 text-xs text-foreground/50">
                {f.has_draw ? "Outcomes: India / Draw / Opponent" : "Outcomes: India / Opponent"}
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
              <Validation v={f.validation} hasDraw={f.has_draw} />
              {f.validation?.calibration?.length ? (
                <CalibrationChart calibration={f.validation.calibration} />
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
