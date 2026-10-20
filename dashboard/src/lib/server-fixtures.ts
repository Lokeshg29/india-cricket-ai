import type { Upcoming } from "@/lib/cricket";

type FixtureFeed = {
  status: "available" | "unavailable";
  source: string | null;
  reason: string | null;
  fixtures: Upcoming[];
};

const unavailable = (reason: string): FixtureFeed => ({
  status: "unavailable",
  source: null,
  reason,
  fixtures: [],
});

/** Load verified fixtures server-side. No provider credential reaches the browser. */
export async function getFixtureFeed(): Promise<FixtureFeed> {
  const apiBase = process.env.CRICKET_API_URL;
  if (!apiBase) return unavailable("The cricket service containing the verified fixture registry is not configured.");
  try {
    const response = await fetch(new URL("/cricket/fixtures", apiBase), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return unavailable("The fixture service is unavailable.");
    const payload = await response.json() as {
      status?: unknown;
      source?: unknown;
      reason?: unknown;
      fixtures?: unknown;
    };
    if (payload.status !== "available" || !Array.isArray(payload.fixtures) || typeof payload.source !== "string") {
      return unavailable(typeof payload.reason === "string" ? payload.reason : "No verified fixtures are available.");
    }
    const now = Date.now();
    const fixtures = payload.fixtures.filter((item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item),
    ).filter((item) => {
      if (typeof item.match_id !== "string" || !item.match_id
        || typeof item.opponent !== "string" || !item.opponent
        || !["TEST", "ODI", "T20I"].includes(String(item.format))
        || item.status !== "scheduled"
        || item.fixture_source !== "VERIFIED_FIXTURE_REGISTRY"
        || item.data_label !== "VERIFIED FIXTURE"
        || item.verification_status !== "verified"
        || typeof item.source_url !== "string"
        || typeof item.verified_at !== "string"
        || typeof item.start_time !== "string"
        || !/(Z|[+-]\d{2}:\d{2})$/.test(item.start_time)) return false;
      const kickoff = Date.parse(item.start_time);
      const verified = Date.parse(item.verified_at as string);
      try {
        const source = new URL(item.source_url as string);
        if (!(["http:", "https:"].includes(source.protocol))) return false;
      } catch {
        return false;
      }
      return Number.isFinite(kickoff) && kickoff > now
        && Number.isFinite(verified) && verified <= now;
    }).map((item) => ({
      match_id: item.match_id as string,
      opponent: item.opponent as string,
      venue: typeof item.venue === "string" ? item.venue : "Venue unavailable",
      venue_type: "International",
      date: (item.start_time as string).slice(0, 10),
      start_time: item.start_time as string,
      status: "scheduled" as const,
      format: item.format as string,
      probabilities: null,
      confidence: null,
      explanation: [],
      explanation_method: "unavailable",
      data_label: "VERIFIED FIXTURE" as const,
      fixture_source: "VERIFIED_FIXTURE_REGISTRY" as const,
      prediction_status: "unavailable" as const,
      data_source: payload.source as string,
      source_url: item.source_url as string,
      verified_at: item.verified_at as string,
    }));
    return { status: "available", source: payload.source, reason: null, fixtures };
  } catch {
    return unavailable("The fixture service could not be reached.");
  }
}
