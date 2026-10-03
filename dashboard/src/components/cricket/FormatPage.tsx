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
import { type FormatData } from "@/lib/cricket";

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
          subtitle="India, opponent, format, date and venue from the labelled export. Demo entries are not an official schedule."
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
          subtitle="Stored estimates and outcomes. Demo rows are not verified pre-match predictions."
        />
        <Ledger rows={data.ledger} hasDraw={data.has_draw} />
      </Section>

      <Section id="analytics">
        <SectionHeading
          eyebrow="Analytics"
          title="Team Performance & Format Insights"
          subtitle="Rolling form, players, head-to-head and venues from the same export. Player names in demo data are placeholders."
        />
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground/75">India form</h3>
            <FormChart form={data.form} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground/75">Player performance</h3>
            <Players rows={data.players} slug={data.slug} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground/75">Head-to-head</h3>
            <H2H rows={data.h2h} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground/75">Venue insights</h3>
            <Venues rows={data.venues} />
          </div>
        </div>
        <div className="mt-12">
          <SectionHeading eyebrow="Model Performance" title="Model Performance" subtitle="Metrics stored for this format. Missing values show as Evaluation pending." />
          <ModelPerformance formats={[data]} />
        </div>
        <div className="mt-12">
          <SectionHeading eyebrow="Model Details" title="Model Evaluation" />
          <Validation v={data.validation} hasDraw={data.has_draw} />
          {data.validation?.calibration?.length ? (
            <div className="mt-4"><CalibrationChart calibration={data.validation.calibration} /></div>
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
