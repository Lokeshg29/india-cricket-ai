import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { GET } from "./route.ts";

const originalFetch = globalThis.fetch;
const originalApiUrl = process.env.CRICKET_API_URL;

before(() => {
  process.env.CRICKET_API_URL = "http://127.0.0.1:8000";
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiUrl === undefined) delete process.env.CRICKET_API_URL;
  else process.env.CRICKET_API_URL = originalApiUrl;
});

test("history route forwards available records from FastAPI", async () => {
  const payload = { status: "available", records: [{ provider_fixture_id: "fixture-1" }], reason: null };
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "http://127.0.0.1:8000/cricket/predictions/history");
    assert.equal(init?.cache, "no-store");
    return Response.json(payload);
  };

  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), payload);
});

test("history route returns a safe unavailable response when FastAPI cannot be reached", async () => {
  globalThis.fetch = async () => {
    throw new Error("connection refused");
  };

  const response = await GET();
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.status, "unavailable");
  assert.deepEqual(payload.records, []);
  assert.equal(payload.reason, "Prediction history service could not be reached.");
});
