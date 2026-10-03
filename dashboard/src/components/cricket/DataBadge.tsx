import type { DataLabel } from "@/lib/cricket";

// Always-visible provenance tag. DEMO DATA is saffron so it can't be missed.
export default function DataBadge({ label }: { label: DataLabel }) {
  const demo = label === "DEMO DATA";
  return (
    <span
      className="font-mono inline-block rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em]"
      style={{
        borderColor: demo ? "var(--saffron)" : "var(--accent)",
        color: demo ? "var(--saffron)" : "var(--accent)",
      }}
    >
      {label}
    </span>
  );
}
