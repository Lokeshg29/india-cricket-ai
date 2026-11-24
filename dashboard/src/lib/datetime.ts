const istDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Format an ISO timestamp with an explicit timezone as a stable IST display. */
export function formatIstDateTime(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.trim() || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return "Time unavailable";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";

  const parts = Object.fromEntries(istDateTimeFormatter.formatToParts(date).map(({ type, value: part }) => [type, part]));
  const { day, month, year, hour, minute, dayPeriod } = parts;
  if (!day || !month || !year || !hour || !minute || !dayPeriod) return "Time unavailable";
  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod.toUpperCase()} IST`;
}
