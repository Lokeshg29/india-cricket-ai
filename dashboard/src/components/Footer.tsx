import { DISCLAIMER, OWNER_CREDIT, PRODUCT_NAME } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="relative z-10 mx-auto max-w-6xl border-t border-card-border px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4 text-xs text-foreground/45">
        <div className="space-y-1">
          <div className="font-mono uppercase tracking-[0.12em] text-foreground/60">{PRODUCT_NAME}</div>
          <div>{OWNER_CREDIT}</div>
        </div>
        <p className="max-w-md leading-relaxed">
          {DISCLAIMER} Not affiliated with the BCCI or ICC. Demo figures are labelled and are not current fixtures.
        </p>
      </div>
    </footer>
  );
}
