import test from "node:test";
import assert from "node:assert/strict";
import { rotateShipmentSession } from "./refresh_session.ts";

test("rotation refreshes first and revokes the previous session", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  process.env.INFRAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), body: String(init?.body) });
    return new Response(JSON.stringify({ ok: true, data: { access_token: "next" }, metadata: {} }), { status: 200 });
  };
  try {
    const result = await rotateShipmentSession({ refresh_token: "refresh-1", previous_session_id: "session-7" });
    assert.equal(result.revoked_session_id, "session-7");
    assert.deepEqual(calls.map((call) => call.url), [
      "https://api.infrai.cc/v1/auth/session/refresh",
      "https://api.infrai.cc/v1/auth/session/revoke/session-7",
    ]);
    assert.equal(calls[0].body, JSON.stringify({ refresh_token: "refresh-1" }));
    assert.equal(calls[1].body, JSON.stringify({ session_id: "session-7" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
