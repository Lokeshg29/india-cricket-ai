export default function StatsStrip({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-px border border-card-border bg-card-border sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-background px-4 py-4">
          <div className="font-mono text-xl font-semibold text-foreground sm:text-2xl">{s.value}</div>
          <div className="mt-1 text-[11px] tracking-wide text-foreground/50">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
