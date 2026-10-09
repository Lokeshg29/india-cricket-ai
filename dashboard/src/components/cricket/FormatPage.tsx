import Nav from "../Nav";
import Hero from "../Hero";
import Footer from "../Footer";
import Section from "../Section";
import SectionHeading from "../SectionHeading";
import StatsStrip from "../StatsStrip";
import ResultCards from "../ResultCards";
import MethodologySection from "../MethodologySection";
import TechStack from "../TechStack";
import PredictionCards from "./PredictionCards";
import ModelPerformance from "./ModelPerformance";
import DataBadge from "./DataBadge";
import { CalibrationChart, FormChart, TrendChart } from "./Charts";
import { H2H, Ledger, Players, Validation, Venues } from "./Panels";
import { historicalEvaluation, type FormatData } from "@/lib/cricket";

export default function FormatPage({ data }: { data: FormatData }) {
  const stats = [
    { label: "Upcoming matches", value: String(data.upcoming.length) },
    { label: "Recent results", value: String(data.results.length) },
    { label: "Format", value: data.format },
    { label: "Data status", value: data.data_label },
  ];
  const ticker = data.results.map((r) => ({ ...r, fmt: data.format }));

  return (
    <main className="relative">
      <Nav />
      <Hero
        formatLabel={data.format}
        dataLabel={data.data_label}
        tagline={`${data.format} view. Upcoming matches, results, estimates and evaluation for India in this format only.`}
      />

      <Section>
        <StatsStrip stats={stats} />
      </Section>

      <Section id="matches">
        <SectionHeading
          eyebrow="Schedule"
          title="Upcoming Matches"
          subtitle="No verified upcoming international fixture feed is configured. Predictions remain unavailable until a genuine fixture source is connected."
        />
        <PredictionCards matches={[...data.upcoming].sort((a, b) => a.date.localeCompare(b.date))} />
        <div className="mt-10">
          <SectionHeading eyebrow="Results" title="Recent Matches" />
          <ResultCards results={[...ticker].sort((a, b) => b.date.localeCompare(a.date))} />
        </div>
      </Section>

      <Section id="predictions">
        <SectionHeading
          eyebrow="Predictions"
          title="Prediction History"
          subtitle="Chronological historical backtest predictions. Source records contain dates, not archived pre-match prediction timestamps."
        />
        <Ledger rows={historicalEvaluation.formats[data.slug]?.ledger ?? []} hasDraw={data.has_draw} />
      </Section>

      <Section id="analytics">
        <SectionHeading
          eyebrow="Analytics"
          title="Team Performance & Format Insights"
          subtitle="Results, form, head-to-head and venue aggregates use resolved Cricsheet international matches. Player-level scorecards are unavailable in this dataset."
        />
        <div className="space-y-8">
          <div>
            <div className="mb-3 flex items-center gap-2"><h3 className="text-sm font-semibold text-foreground/75">India form</h3><DataBadge label={data.data_sources.form.status} /><span className="font-mono text-[10px] text-foreground/40">Cricsheet</span></div>
            <FormChart form={data.form} />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2"><h3 className="text-sm font-semibold text-foreground/75">Player performance</h3><DataBadge label={data.data_sources.players.status} /></div>
            <Players rows={data.players} slug={data.slug} />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2"><h3 className="text-sm font-semibold text-foreground/75">Head-to-head</h3><DataBadge label={data.data_sources.head_to_head.status} /><span className="font-mono text-[10px] text-foreground/40">resolved matches · Cricsheet</span></div>
            <H2H rows={data.h2h} />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2"><h3 className="text-sm font-semibold text-foreground/75">Venue insights</h3><DataBadge label={data.data_sources.venues.status} /><span className="font-mono text-[10px] text-foreground/40">stadium only · Cricsheet</span></div>
            <Venues rows={data.venues} />
          </div>
        </div>
        <div className="mt-12">
          <SectionHeading eyebrow="Model Performance" title="Model Performance" subtitle="Metrics stored for this format. Missing values show as Evaluation pending." />
          <ModelPerformance formats={[data]} />
        </div>
        <div className="mt-12">
          <SectionHeading eyebrow="Model Details" title="Model Evaluation" />
          <Validation v={historicalEvaluation.formats[data.slug]?.validation} hasDraw={data.has_draw} />
          {historicalEvaluation.formats[data.slug]?.validation?.calibration.length ? (
            <div className="mt-4"><CalibrationChart calibration={historicalEvaluation.formats[data.slug].validation!.calibration} /></div>
          ) : null}
        </div>
        {data.trend?.length ? (
          <div className="mt-12">
            <SectionHeading eyebrow="Model Details" title="Prediction Trend" />
            <TrendChart trend={data.trend} />
          </div>
        ) : null}
        <div className="mt-12">
          <SectionHeading eyebrow="Model Details" title="How the Model Works" />
          <MethodologySection />
          <div className="mt-6 flex items-center gap-3">
            <DataBadge label={data.data_label} />
            <span className="text-xs text-foreground/45">This format export is labelled as shown.</span>
          </div>
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
