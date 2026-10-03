import Nav from "../Nav";
import Hero from "../Hero";
import Footer from "../Footer";
import SectionHeading from "../SectionHeading";
import StatsStrip from "../StatsStrip";
import ResultsTicker from "../ResultsTicker";
import MethodologySection from "../MethodologySection";
import TechStack from "../TechStack";
import PredictionCards from "./PredictionCards";
import DataBadge from "./DataBadge";
import { CalibrationChart, FormChart, TrendChart } from "./Charts";
import { H2H, Ledger, Players, Validation, Venues } from "./Panels";
import { pct, type FormatData } from "@/lib/cricket";

const Section = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <section id={id} className="relative z-10 mx-auto max-w-6xl px-6 py-12">{children}</section>
);

export default function FormatPage({ data }: { data: FormatData }) {
  const stats = [
    { label: "Matches tracked", value: String(data.summary.matches_tracked) },
    { label: "Predictions generated", value: String(data.summary.predictions_generated) },
    { label: "Walk-forward accuracy (demo)", value: pct(data.summary.accuracy, 0) },
    { label: "Outcomes modelled", value: data.has_draw ? "Win / Draw / Loss" : "Win / Loss" },
  ];
  const ticker = data.results.map((r) => ({ ...r, fmt: data.format }));
  return (
    <main className="relative">
      <Nav />
      <Hero formatLabel={data.format} dataLabel={data.data_label} />
      <Section><StatsStrip stats={stats} /></Section>

      <Section id="predictions">
        <SectionHeading eyebrow={`India ${data.format} Prediction Board`} title="Upcoming Matches"
          subtitle="Model probability for each fixture. Fixtures here are DEMO placeholders, not the official schedule." />
        <PredictionCards matches={data.upcoming} />
      </Section>

      <Section id="results">
        <SectionHeading eyebrow="Just Finished" title="Recent Results" subtitle="DEMO DATA: synthetic history used to exercise the pipeline." />
        <ResultsTicker results={ticker} />
      </Section>

      <Section>
        <SectionHeading eyebrow="Team Form" title="India Recent Form" subtitle="Rolling result score (win = 1, draw = 0.5, loss = 0)." />
        <FormChart form={data.form} />
      </Section>

      <Section>
        <SectionHeading eyebrow="Player Form" title="Player Analytics" subtitle="Placeholder players with seeded numbers. No real player statistics are shown yet." />
        <Players rows={data.players} slug={data.slug} />
      </Section>

      <Section>
        <SectionHeading eyebrow="Head To Head" title="India vs The World" />
        <H2H rows={data.h2h} />
      </Section>

      <Section>
        <SectionHeading eyebrow="Venue Analytics" title="Home, Away, Neutral" />
        <Venues rows={data.venues} />
      </Section>

      <Section>
        <SectionHeading eyebrow="Prediction Trend" title="How Probabilities Move"
          subtitle="India win probability for each upcoming fixture as the model is refit on more history (demo)." />
        <TrendChart trend={data.trend} />
      </Section>

      <Section id="validation">
        <SectionHeading eyebrow="Model Validation" title="Model vs Actual Results" />
        <Validation v={data.validation} hasDraw={data.has_draw} />
        <div className="mt-5"><CalibrationChart calibration={data.validation.calibration} /></div>
      </Section>

      <Section id="proof">
        <SectionHeading eyebrow="Prediction Ledger" title="Verified Prediction History"
          subtitle="A hash-chained record per prediction: timestamp, model version, probabilities, outcome." />
        <Ledger rows={data.ledger} hasDraw={data.has_draw} />
      </Section>

      <Section>
        <SectionHeading eyebrow="Under the Hood" title="How It Works" />
        <MethodologySection />
      </Section>

      <Section id="stack">
        <SectionHeading eyebrow="Behind The Scenes" title="What Powers This Site" />
        <TechStack />
        <div className="mt-6"><DataBadge label={data.data_label} /></div>
      </Section>
      <Footer />
    </main>
  );
}
