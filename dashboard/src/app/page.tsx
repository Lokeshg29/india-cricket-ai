import Link from "next/link";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import SectionHeading from "@/components/SectionHeading";
import StatsStrip from "@/components/StatsStrip";
import ResultsTicker from "@/components/ResultsTicker";
import MethodologySection from "@/components/MethodologySection";
import TechStack from "@/components/TechStack";
import PredictionCards from "@/components/cricket/PredictionCards";
import DataBadge from "@/components/cricket/DataBadge";
import { allFormats, pct } from "@/lib/cricket";

const Section = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <section id={id} className="relative z-10 mx-auto max-w-6xl px-6 py-12">{children}</section>
);

export default function Home() {
  const formats = allFormats();
  const stats = [
    { label: "Matches tracked", value: String(formats.reduce((a, f) => a + f.summary.matches_tracked, 0)) },
    { label: "Predictions generated", value: String(formats.reduce((a, f) => a + f.summary.predictions_generated, 0)) },
    { label: "Mean walk-forward accuracy (demo)", value: pct(formats.reduce((a, f) => a + f.summary.accuracy, 0) / formats.length, 0) },
    { label: "Formats supported", value: "Test · ODI · T20I" },
  ];
  const ticker = formats.flatMap((f) => f.results.slice(0, 6).map((r) => ({ ...r, fmt: f.format })));

  return (
    <main className="relative">
      <Nav />
      <Hero dataLabel="DEMO DATA" />
      <Section><StatsStrip stats={stats} /></Section>

      <Section id="predictions">
        <SectionHeading eyebrow="India Prediction Board" title="Pick A Format"
          subtitle="Test, ODI and T20I are modelled separately. Test has a draw outcome; ODI and T20I do not." />
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {formats.map((f) => (
            <Link key={f.slug} href={`/${f.slug}`} className="glass-card rounded-2xl p-5 transition-colors hover:border-accent/60">
              <div className="font-display text-3xl font-extrabold uppercase text-foreground">{f.format}</div>
              <div className="font-mono mt-2 text-[11px] text-foreground/50">
                {f.has_draw ? "India / Draw / Opponent" : "India / Opponent"} &middot; {f.upcoming.length} fixtures
              </div>
              <div className="mt-3 flex items-center justify-between">
                <DataBadge label={f.data_label} />
                <span className="font-mono text-xs text-accent">Open &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
        <PredictionCards matches={formats.map((f) => f.upcoming[0])} />
      </Section>

      <Section id="results">
        <SectionHeading eyebrow="Just Finished" title="Recent Results" subtitle="DEMO DATA across all three formats." />
        <ResultsTicker results={ticker} />
      </Section>

      <Section id="validation">
        <SectionHeading eyebrow="Model Validation" title="Per-Format Scorecard"
          subtitle="Walk-forward metrics on demo data. Real numbers appear once a real dataset is loaded." />
        <div className="grid gap-4 sm:grid-cols-3">
          {formats.map((f) => (
            <div key={f.slug} className="glass-card rounded-2xl p-5">
              <div className="font-display text-xl font-bold uppercase text-foreground">{f.format}</div>
              <dl className="font-mono mt-3 space-y-1 text-sm text-foreground/70">
                <div className="flex justify-between"><dt>Accuracy</dt><dd className="text-foreground">{pct(f.validation.accuracy)}</dd></div>
                <div className="flex justify-between"><dt>Brier</dt><dd className="text-foreground">{f.validation.brier.toFixed(3)}</dd></div>
                <div className="flex justify-between"><dt>Log loss</dt><dd className="text-foreground">{f.validation.log_loss.toFixed(3)}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <Section><SectionHeading eyebrow="Under the Hood" title="How It Works" /><MethodologySection /></Section>
      <Section id="stack"><SectionHeading eyebrow="Behind The Scenes" title="What Powers This Site" /><TechStack /></Section>
      <Footer />
    </main>
  );
}
