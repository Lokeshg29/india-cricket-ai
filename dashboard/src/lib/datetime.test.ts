import assert from "node:assert/strict";
import { test } from "node:test";
import { formatIstDateTime } from "./datetime.ts";

test("converts a UTC fixture instant to Indian Standard Time", () => {
  assert.equal(formatIstDateTime("2026-11-04T02:00:00Z"), "4 Nov 2026, 7:30 AM IST");
});

test("converts the date as well as the time when UTC crosses midnight in India", () => {
  assert.equal(formatIstDateTime("2026-11-03T20:30:00Z"), "4 Nov 2026, 2:00 AM IST");
});

test("formats Test, ODI and T20I schedule timestamps with the same IST rules", () => {
  const scheduleExamples = [
    { format: "ODI", timestamp: "2026-11-04T02:00:00Z", expected: "4 Nov 2026, 7:30 AM IST" },
    { format: "TEST", timestamp: "2026-11-18T22:00:00Z", expected: "19 Nov 2026, 3:30 AM IST" },
    { format: "T20I", timestamp: "2026-11-20T18:00:00Z", expected: "20 Nov 2026, 11:30 PM IST" },
  ];

  for (const example of scheduleExamples) {
    assert.equal(formatIstDateTime(example.timestamp), example.expected, `${example.format} display`);
  }
});

test("returns an explicit unavailable label for missing, invalid or timezone-free values", () => {
  assert.equal(formatIstDateTime(undefined), "Time unavailable");
  assert.equal(formatIstDateTime(""), "Time unavailable");
  assert.equal(formatIstDateTime("not-a-date"), "Time unavailable");
  assert.equal(formatIstDateTime("2026-11-04T02:00:00"), "Time unavailable");
});
