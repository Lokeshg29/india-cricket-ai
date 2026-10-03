import Link from "next/link";
import SportTabs from "./SportTabs";
import { NAV_BRAND } from "@/lib/site";

const LINKS = [
  { href: "#matches", label: "Matches" },
  { href: "#predictions", label: "Predictions" },
  { href: "#analytics", label: "Analytics" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-card-border bg-background/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
          <Link
            href="/"
            className="font-display shrink-0 text-sm font-bold tracking-[0.16em] text-foreground transition-colors hover:text-accent sm:text-[15px]"
          >
            {NAV_BRAND}
          </Link>
          <SportTabs />
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.12em] text-foreground/55">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="nav-link transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
          <Link
            href="/admin"
            title="Read-only internal dashboard"
            className="nav-admin rounded border border-foreground/20 px-2.5 py-1 text-foreground/70 transition-colors hover:border-accent-red/60 hover:text-foreground"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
