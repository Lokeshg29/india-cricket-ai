import Link from "next/link";
import SportTabs from "./SportTabs";

export default function Nav() {
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5"
      style={{ background: "linear-gradient(180deg, rgba(9,9,9,0.9), rgba(9,9,9,0))" }}
    >
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="hidden font-mono text-[10px] italic tracking-wide text-secondary lg:block">
          AN AI CRICKET PROJECT BY LOKESH GOUD
        </div>
        <SportTabs />
      </div>
      <div className="flex items-center gap-4 sm:gap-7">
        <div className="hidden gap-7 text-xs uppercase tracking-[0.12em] text-foreground/55 md:flex">
          <a href="#predictions" className="hover:text-foreground transition-colors">Predictions</a>
          <a href="#results" className="hover:text-foreground transition-colors">Results</a>
          <a href="#validation" className="hover:text-foreground transition-colors">Validation</a>
          <a href="#proof" className="hover:text-foreground transition-colors">Proof</a>
          <a href="#stack" className="hover:text-foreground transition-colors">Stack</a>
        </div>
        <Link
          href="/admin"
          title="Read-only internal admin dashboard"
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-foreground/70 transition-colors hover:border-foreground/50 hover:text-foreground"
        >
          Admin
        </Link>
      </div>
    </div>
  );
}
