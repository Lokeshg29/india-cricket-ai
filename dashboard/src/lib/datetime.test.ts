import assert from "node:assert/strict";
import { test } from "node:test";
import { formatUtcDateTime } from "./datetime.ts";

test("formats a fixture date with a stable locale and UTC timezone", () => {
  assert.equal(formatUtcDateTime("2026-11-04T02:00:00Z"), "11/4/2026, 2:00:00 AM UTC");
});
