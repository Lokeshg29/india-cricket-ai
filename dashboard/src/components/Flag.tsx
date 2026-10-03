import { countryCodeFor } from "@/lib/flags";

export default function Flag({ team, className = "" }: { team: string; className?: string }) {
  const code = countryCodeFor(team);
  if (!code) {
    return (
      <span className={`font-mono text-[10px] text-foreground/50 ${className}`} title={team}>
        {team.slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return (
    <span
      className={`fi fi-${code} inline-block rounded-[3px] shadow-sm ${className}`}
      title={team}
    />
  );
}
