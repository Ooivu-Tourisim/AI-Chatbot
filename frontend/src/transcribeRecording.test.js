import test from "node:test";
import assert from "node:assert/strict";
import { transcribeRecording } from "./transcribeRecording.js";

test("connection reset retries the same recording and recovers", async () => {
  const original = globalThis.fetch, bodies = [];
  globalThis.fetch = async (_, request) => {
    bodies.push(request.body);
    if (bodies.length === 1) throw new TypeError("Failed to fetch");
    return { status: 200, ok: true, json: async () => ({ text: "hello", language_code: "ko" }) };
  };
  try {
    const result = await transcribeRecording("", { audio: "same recording" }, { retryDelay: 0 });
    assert.equal(result.language_code, "ko");
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
  } finally { globalThis.fetch = original; }
});

test("proxy errors have a bounded retry instead of a JSON parse failure", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return { status: 500, ok: false }; };
  try {
    await assert.rejects(transcribeRecording("", {}, { retryDelay: 0 }), /connection was interrupted/);
    assert.equal(calls, 3);
  } finally { globalThis.fetch = original; }
});

test("provider errors and cancelled recordings are not retried", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return { status: 503, ok: false, json: async () => ({ detail: "Provider unavailable" }) }; };
  try {
    await assert.rejects(transcribeRecording("", {}, { retryDelay: 0 }), /Provider unavailable/);
    assert.equal(calls, 1);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(transcribeRecording("", {}, { signal: controller.signal }), { name: "AbortError" });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
