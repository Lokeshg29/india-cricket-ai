const utcDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

export function formatUtcDateTime(value: string): string {
  return `${utcDateTimeFormatter.format(new Date(value))} UTC`;
}
