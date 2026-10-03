export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 max-w-3xl">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{eyebrow}</span>
      <h2 className="font-display mt-1.5 text-[clamp(18px,3vw,26px)] font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-foreground/55">{subtitle}</p>
      )}
    </div>
  );
}
