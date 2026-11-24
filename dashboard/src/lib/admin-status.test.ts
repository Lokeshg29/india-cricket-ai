import assert from "node:assert/strict";
import { test } from "node:test";
import { getAdminDataQuality, statusGeneratedAt } from "./admin-status.ts";

const baseQuality = {
  checks: [
    { name: "player-level data", status: "unavailable" },
    { name: "upcoming fixture feed", status: "unavailable" },
  ],
  data_label: "HISTORICAL DATA",
};

test("reports the fixture feed as passing only when verified fixtures are returned", () => {
  const quality = getAdminDataQuality(baseQuality, {
    status: "available",
    fixtures: [{ match_id: "verified-1", fixture_source: "VERIFIED_FIXTURE_REGISTRY" }],
  });

  assert.equal(quality.checks.find((check) => check.name === "upcoming fixture feed")?.status, "pass");
  assert.equal(quality.checks.find((check) => check.name === "player-level data")?.status, "unavailable");
});

test("keeps the fixture feed unavailable when the backend or verified fixture list is unavailable", () => {
  for (const feed of [
    { status: "unavailable" as const, fixtures: [{ match_id: "ignored" }] },
    { status: "available" as const, fixtures: [] },
  ]) {
    const quality = getAdminDataQuality(baseQuality, feed);
    assert.equal(quality.checks.find((check) => check.name === "upcoming fixture feed")?.status, "unavailable");
  }
});

test("uses the current generated timestamp in ISO UTC form", () => {
  assert.equal(statusGeneratedAt(new Date("2026-10-21T12:34:56.000Z")), "2026-10-21T12:34:56.000Z");
});
