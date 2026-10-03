import IndiaNightMap from "./IndiaNightMap";
import DataBadge from "./cricket/DataBadge";
import { TAGLINE } from "@/lib/site";
import type { DataLabel } from "@/lib/cricket";

export default function Hero({
  formatLabel,
  dataLabel,
  tagline,
}: {
  formatLabel?: string;
  dataLabel: DataLabel;
  tagline?: string;
}) {
  return (
    <section className="hero-shell relative isolate overflow-hidden border-b border-card-border px-4 sm:px-6">
      <div className="hero-grid absolute inset-0" aria-hidden="true" />
      <div className="hero-wash absolute inset-0" aria-hidden="true" />
      <IndiaNightMap compact className="hero-map right-0 left-auto w-[56%] sm:w-[50%]" />

      <div className="relative z-10 mx-auto grid min-h-[390px] max-w-6xl items-center py-12 sm:min-h-[430px] sm:py-16 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="hero-copy max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-foreground/55">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-red" aria-hidden="true" />
              India · International Cricket
            </span>
            <DataBadge label={dataLabel} />
          </div>
          <h1 className="editorial-heading mt-6 text-[clamp(3rem,7.3vw,6.1rem)] leading-[0.88] tracking-[-0.055em] text-foreground">
            <span className="block">India’s game,</span>
            <span className="mt-1 block italic text-accent-red">in detail.</span>
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-foreground/65 sm:text-base">
            {tagline ?? TAGLINE}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#matches" className="hero-button-primary">Explore matches <span aria-hidden="true">↗</span></a>
            <a href="#analytics" className="hero-button-secondary">Team analytics</a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-foreground/10 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/45">
            <span>{formatLabel ?? "Test · ODI · T20I"}</span>
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
            <span>Data-led match analysis</span>
          </div>
        </div>
        <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </section>
  );
}
