"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SportTabs from "./SportTabs";
import ThemeToggle from "./ThemeToggle";
import AuthNavControls from "./auth/AuthNavControls";
import { NAV_BRAND } from "@/lib/site";

const LINKS = [
  { href: "#matches", label: "Matches" },
  { href: "#predictions", label: "Predictions" },
  { href: "#analytics", label: "Analytics" },
];

export default function Nav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const hasHero = pathname === "/" || ["/test", "/odi", "/t20i"].includes(pathname);

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 12);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <header className={`site-nav ${hasHero ? "site-nav--hero" : "site-nav--standalone"} ${scrolled ? "is-scrolled" : ""}`}>
      <div className="mx-auto flex min-h-[76px] max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
          <Link
            href="/"
            className="font-display shrink-0 text-sm font-bold tracking-[0.16em] text-foreground transition-colors hover:text-accent sm:text-[15px]"
          >
            {NAV_BRAND}
          </Link>
          {!compact && <SportTabs />}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.12em] text-secondary">
            {compact ? (
              <Link href="/" className="nav-link transition-colors hover:text-foreground">Dashboard</Link>
            ) : (
              <>
                {LINKS.map((l) => (
                  <a key={l.href} href={l.href} className="nav-link transition-colors hover:text-foreground">
                    {l.label}
                  </a>
                ))}
                <Link
                  href="/admin"
                  title="Read-only internal dashboard"
                  className="nav-admin rounded border border-card-border px-2.5 py-1 text-foreground/80 transition-colors hover:border-accent-red/60 hover:text-foreground"
                >
                  Admin
                </Link>
              </>
            )}
          </nav>
          <AuthNavControls />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
