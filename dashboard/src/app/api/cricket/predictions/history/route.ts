const unavailable = (reason: string) => Response.json({
  status: "unavailable",
  data_label: "UNAVAILABLE",
  records: [],
  reason,
}, { status: 503, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const apiBase = process.env.CRICKET_API_URL;
  if (!apiBase) return unavailable("Prediction history service is not configured.");
  try {
    const upstream = await fetch(new URL("/cricket/predictions/history", apiBase), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return unavailable("Prediction history service is unavailable.");
    const payload = await upstream.json();
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return unavailable("Prediction history service could not be reached.");
  }
}
