import testData from "../../../../../data/cricket/test.json";
import odiData from "../../../../../data/cricket/odi.json";
import t20iData from "../../../../../data/cricket/t20i.json";
import type { DataLabel, Upcoming } from "@/lib/cricket";

type FormatExport = { upcoming: Upcoming[] };
const schedules: Record<string, FormatExport> = {
  test: testData as unknown as FormatExport,
  odi: odiData as unknown as FormatExport,
  t20i: t20iData as unknown as FormatExport,
};

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
  const fixtures = schedules[format]?.upcoming ?? [];
  const fixture = fixtures.find((match) => match.match_id === matchId);
  if (!fixture
    || fixture.fixture_source !== "OFFICIAL_FIXTURE_FEED"
    || !["LIVE DATA", "HISTORICAL DATA"].includes(fixture.data_label)) {
    return unavailable("Prediction requires a verified upcoming fixture from a configured source.", 404);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fixture.date) || fixture.date <= new Date().toISOString().slice(0, 10)) {
    return unavailable("Prediction requires a future fixture date.", 400);
  }

  const apiBase = process.env.CRICKET_API_URL;
  if (!apiBase) return unavailable("Cricket prediction service is not configured.", 503);

  try {
    const endpoint = new URL("/cricket/predict", apiBase);
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, opponent: fixture.opponent, as_of: fixture.date }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
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
