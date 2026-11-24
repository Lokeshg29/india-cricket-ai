import type { DataLabel } from "@/lib/cricket";

type FixtureFeedStatus = {
  status: "available" | "unavailable";
  fixtures: unknown[];
};

type DataQuality = {
  checks: { name: string; status: string }[];
  data_label: DataLabel;
};

export function getAdminDataQuality(dataQuality: DataQuality, fixtureFeed: FixtureFeedStatus) {
  const hasVerifiedFixtures = fixtureFeed.status === "available" && fixtureFeed.fixtures.length > 0;
  return {
    ...dataQuality,
    checks: dataQuality.checks.map((check) => check.name === "upcoming fixture feed"
      ? { ...check, status: hasVerifiedFixtures ? "pass" : "unavailable" }
      : check),
  };
}

export function statusGeneratedAt(now: Date = new Date()): string {
  return now.toISOString();
}

