"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeSports } from "@/lib/sports";

export default function SportTabs({ size = "sm" }: { size?: "sm" | "lg" }) {
  const pathname = usePathname();
  const pad = size === "lg" ? "px-3.5 py-1.5 text-[11px]" : "px-2.5 py-1 text-[10px]";

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="navigation" aria-label="Format">
      {activeSports().map((sport) => {
        const isCurrent = pathname === sport.path;
        return (
          <Link
            key={sport.id}
            href={sport.path}
            title={sport.name}
            className={`font-mono rounded border uppercase tracking-[0.12em] transition-colors ${pad} ${
              isCurrent
                ? "border-accent-red/70 bg-accent/15 text-foreground shadow-[inset_0_-2px_0_var(--accent-red)]"
                : "border-foreground/15 text-foreground/55 hover:border-accent/50 hover:text-foreground"
            }`}
          >
            {sport.short}
          </Link>
        );
      })}
    </div>
  );
}
