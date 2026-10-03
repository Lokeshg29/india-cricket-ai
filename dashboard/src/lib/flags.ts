// Team name -> flag-icons code. `null` => no flag (text fallback).
const COUNTRY_CODES: Record<string, string> = {
  India: "in", Australia: "au", England: "gb-eng", "South Africa": "za",
  "New Zealand": "nz", Pakistan: "pk", "Sri Lanka": "lk", Bangladesh: "bd",
  Afghanistan: "af", Zimbabwe: "zw", Ireland: "ie",
};

export function countryCodeFor(team: string): string | null {
  return COUNTRY_CODES[team] ?? null;
}
