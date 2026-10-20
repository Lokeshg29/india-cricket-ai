import { notFound } from "next/navigation";
import FormatPage from "@/components/cricket/FormatPage";
import { formatData } from "@/lib/cricket";
import { SPORTS, formatSlug } from "@/lib/sports";
import { getFixtureFeed } from "@/lib/server-fixtures";

// Config-driven format routes: every active entry in sports_config.json
// except "/" becomes /test, /odi, /t20i, rendered from
// dashboard/data/cricket/<slug>.json. Adding a format = one config entry
// + one data file.
export function generateStaticParams() {
  return SPORTS.filter((s) => s.is_active && s.path !== "/").map((s) => ({ sport: formatSlug(s) }));
}

export const dynamicParams = false;
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const { sport: slug } = await params;
  const data = formatData(slug);
  if (!data) notFound();
  const fixtureFeed = await getFixtureFeed();
  const fixtures = fixtureFeed.fixtures.filter((fixture) => fixture.format.toLowerCase() === slug);
  return <FormatPage data={{ ...data, upcoming: fixtures }} fixtureStatus={fixtureFeed.status} fixtureSource={fixtureFeed.source} fixtureReason={fixtureFeed.reason} />;
}
