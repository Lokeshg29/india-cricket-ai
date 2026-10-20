import type { DataLabel, Upcoming } from "@/lib/cricket";
import { getFixtureFeed } from "@/lib/server-fixtures";

const unavailable = (reason: string, status: number) =>
  Response.json({ status: "unavailable", reason, data_label: "MODEL PREDICTION" satisfies DataLabel }, { status });

export async function POST(request: Request) {
  let body: { format?: unknown; match_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return unavailable("Invalid prediction request.", 400);
  }

  const format = typeof body.format === "string" ? body.format.toLowerCase() : "";
  const matchId = typeof body.match_id === "string" ? body.match_id : "";
  if (!["test", "odi", "t20i"].includes(format) || !matchId) {
    return unavailable("Invalid prediction request.", 400);
  }
  const feed = await getFixtureFeed();
  const fixtures: Upcoming[] = feed.fixtures;
  const fixture = fixtures.find((match) => match.match_id === matchId);
  if (!fixture
    || fixture.format.toLowerCase() !== format
    || fixture.fixture_source !== "VERIFIED_FIXTURE_REGISTRY"
    || fixture.data_label !== "VERIFIED FIXTURE") {
    return unavailable("Prediction requires a verified upcoming fixture from a configured source.", 404);
  }
  if (!fixture.start_time || !/(Z|[+-]\d{2}:\d{2})$/.test(fixture.start_time)
    || !Number.isFinite(Date.parse(fixture.start_time)) || Date.parse(fixture.start_time) <= Date.now()) {
    return unavailable("Prediction requires a future fixture date.", 400);
  }

  const apiBase = process.env.CRICKET_API_URL;
  if (!apiBase) return unavailable("Cricket prediction service is not configured.", 503);

  try {
    const endpoint = new URL(`/cricket/fixtures/${encodeURIComponent(matchId)}/predict`, apiBase);
    const upstream = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      // First-time model explanations can take longer than fixture/history reads.
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) return unavailable("Cricket prediction service is unavailable.", 503);

    const result = await upstream.json() as {
      status?: unknown;
      model_version?: unknown;
      probabilities?: Record<string, unknown>;
      data_label?: unknown;
    };
    const labels = format === "test" ? ["india", "draw", "opponent"] : ["india", "opponent"];
    const values = labels.map((label) => result.probabilities?.[label]);
    const sum = values.reduce<number>((total, value) => total + (typeof value === "number" ? value : Number.NaN), 0);
    if (result.status !== "available"
      || result.data_label !== "MODEL PREDICTION"
      || typeof result.model_version !== "string"
      || values.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
      || Math.abs(sum - 1) > 1e-6) {
      return unavailable("A usable trained model is not available for this fixture.", 503);
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return unavailable("Cricket prediction service could not be reached.", 503);
  }
}
