import { notFound } from "next/navigation";
import FormatPage from "@/components/cricket/FormatPage";
import { formatData } from "@/lib/cricket";
import { SPORTS, formatSlug } from "@/lib/sports";

// Config-driven format routes: every active entry in sports_config.json
// except "/" becomes /test, /odi, /t20i, rendered from
// dashboard/data/cricket/<slug>.json. Adding a format = one config entry
// + one data file.
export function generateStaticParams() {
  return SPORTS.filter((s) => s.is_active && s.path !== "/").map((s) => ({ sport: formatSlug(s) }));
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const { sport: slug } = await params;
  const data = formatData(slug);
  if (!data) notFound();
  return <FormatPage data={data} />;
}
