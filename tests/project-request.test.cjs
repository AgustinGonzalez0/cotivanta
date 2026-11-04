const test = require("node:test");
const assert = require("node:assert/strict");
const { factory, read, webcrypto } = require("./helpers.cjs");
const make = factory("supabase/functions/project-request/handler.ts", "createHandler");
const version = read("supabase/functions/project-request/handler.ts").match(/PRIVACY_VERSION = "([^"]+)"/)[1];
const valid = () => ({ name: "Prueba Sintética", email: "audit@example.invalid", clientType: "individual", service: "website", description: "Consulta sintética para auditoría local.", budget: "unsure", timeline: "flexible", organization: "", language: "es", consent: true, privacyVersion: version, turnstileToken: "synthetic-token", submissionKey: webcrypto.randomUUID(), faxNumber: "" });
function setup(options = {}) {
  let now = Date.now(), dropped = false;
  const rows = [], calls = [], stored = new Map(), buckets = new Map();
  const env = { PROJECT_REQUESTS_ENABLED: "true", ALLOWED_ORIGINS: "http://localhost:8080", ALLOWED_TURNSTILE_HOSTNAMES: "localhost", TURNSTILE_SECRET_KEY: "synthetic", SUPABASE_URL: "https://example.invalid", SUPABASE_SECRET_KEY: "synthetic", RATE_LIMIT_SALT: "synthetic-test-salt-at-least-32-characters", TRUSTED_IP_HEADER: "x-forwarded-for", ...options.env };
  const handler = (options.make || make)({ get: key => env[key] }, async (url, request) => {
    const body = JSON.parse(request.body); calls.push({ url, request, body });
    assert.ok(request.signal, "all provider calls have a timeout signal");
    if (options.networkError) throw new Error("provider failed with private data that must never leak");
    if (url.endsWith("check_project_request_rate_limit")) {
      if (options.limitDown) return Response.json({}, { status: 500 });
      const entry = buckets.get(body.p_key);
      const bucket = entry && entry.until > now ? entry : { count: 0, until: now + 600000 };
      buckets.set(body.p_key, bucket); bucket.count++;
      return Response.json({ allowed: bucket.count <= 5, retry_after: 600 });
    }
    if (url.includes("siteverify")) return Response.json({ success: options.captchaValid !== false, hostname: options.hostname || "localhost", action: options.action || "project_request" }, { status: options.captchaStatus || 200 });
    assert.ok(url.endsWith("submit_project_request"));
    if (options.databaseDown) return Response.json({}, { status: 500 });
    const previous = stored.get(body.p_submission_key);
    if (previous) return Response.json(previous.fingerprint === body.p_fingerprint ? { ok: true, request_id: previous.id } : { code: "idempotency_conflict" });
    const id = webcrypto.randomUUID(); stored.set(body.p_submission_key, { id, fingerprint: body.p_fingerprint }); rows.push(body.p_request);
    if (options.dropReply && !dropped) { dropped = true; throw new Error("response lost after commit"); }
    return Response.json({ ok: true, request_id: id });
  }, () => now);
  const send = (payload = valid(), options = {}) => handler(new Request("https://example.invalid/intake", { method: options.method || "POST", headers: { origin: "http://localhost:8080", "content-type": "application/json", "x-forwarded-for": "192.0.2.1", ...options.headers }, ...(!["GET", "OPTIONS"].includes(options.method) ? { body: options.raw ?? JSON.stringify(payload) } : {}) }));
  return { send, handler, rows, calls, env, advance: milliseconds => { now += milliseconds; } };
}
test("policy version matches frontend and published policy, consent unchecked", () => {
  assert.equal(read("site/index.html").match(/data-privacy-version="([^"]+)"/)[1], version);
  assert.equal(read("site/privacy.html").match(/name="privacy-version"\s+content="([^"]+)"/)[1], version);
  const input = read("site/index.html").match(/<input\s+id="consent"[^>]*>/)[0];
  assert.match(input, /\brequired\b/); assert.doesNotMatch(input, /\bchecked\b/);
});
for (const flag of [undefined, "false", "TRUE", "1"]) test(`intake fails closed with flag ${flag}`, async () => {
  const api = setup({ env: { PROJECT_REQUESTS_ENABLED: flag } });
  assert.equal((await api.send()).status, 503); assert.equal(api.calls.length, 0);
});
test("rejects unknown origins without CORS and handles preflight only for allowed origins", async () => {
  const api = setup(); const denied = await api.send(valid(), { headers: { origin: "https://evil.invalid" } });
  assert.equal(denied.status, 403); assert.equal(denied.headers.get("access-control-allow-origin"), null);
  assert.equal((await api.send(valid(), { method: "OPTIONS" })).status, 204);
  assert.equal((await api.send(valid(), { method: "GET" })).status, 405); assert.equal(api.calls.length, 0);
});
test("requires a trusted IP header and sufficient salt, never guesses an address", async () => {
  assert.equal((await setup({ env: { RATE_LIMIT_SALT: "short" } }).send()).status, 503);
  assert.equal((await setup({ env: { TRUSTED_IP_HEADER: undefined } }).send()).status, 503);
  assert.equal((await setup().send(valid(), { headers: { "x-forwarded-for": "" } })).status, 503);
});
for (const raw of ["{", "[]", "null", "true", '"text"']) test(`invalid JSON shape: ${raw}`, async () => {
  const api = setup(); assert.equal((await api.send(valid(), { raw })).status, 400); assert.equal(api.calls.length, 0);
});
test("rejects large bytes while streaming and checks Content-Length early", async () => {
  const api = setup(); assert.equal((await api.send(valid(), { raw: JSON.stringify({ value: "ñ".repeat(9000) }) })).status, 413);
  assert.equal((await api.send(valid(), { headers: { "content-length": "9999999" } })).status, 413); assert.equal(api.calls.length, 0);
});
test("body deadline rejects a valid JSON prefix whose stream never finishes", async () => {
  const shortDeadline = factory("supabase/functions/project-request/handler.ts", "createHandler", { setTimeout: fn => setTimeout(fn, 10) });
  const api = setup({ make: shortDeadline });
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(valid()))); } });
  const response = await api.handler(new Request("https://example.invalid", { method: "POST", headers: { origin: "http://localhost:8080", "content-type": "application/json", "x-forwarded-for": "192.0.2.1" }, body, duplex: "half" }));
  assert.equal(response.status, 400); assert.equal(api.calls.length, 0);
});
test("only application/json is accepted, not substring matches", async () => {
  assert.equal((await setup().send(valid(), { headers: { "content-type": "text/application/jsonp" } })).status, 415);
});
for (const overrides of [{ consent: false }, { name: "  " }, { name: "Name\nInjected" }, { description: " ".repeat(20) }, { description: "Null character attack\u0000invalid input" }, { submissionKey: "not-a-uuid" }, { faxNumber: "bot" }, { service: "unknown" }, { email: "bad" }]) test(`rejects invalid values: ${JSON.stringify(overrides)}`, async () => {
  const api = setup(); assert.equal((await api.send({ ...valid(), ...overrides })).status, 400); assert.equal(api.calls.length, 0);
});
test("rejects stale or missing privacy before any provider calls", async () => {
  for (const privacyVersion of [undefined, "old"]) { const api = setup(); assert.equal((await api.send({ ...valid(), privacyVersion })).status, 409); assert.equal(api.calls.length, 0); }
});
for (const options of [{ captchaValid: false }, { hostname: "evil.invalid" }, { action: "other_form" }]) test(`requires captcha success, hostname and action: ${JSON.stringify(options)}`, async () => {
  const api = setup(options); assert.equal((await api.send()).status, 403); assert.equal(api.rows.length, 0);
});
test("durable rate limit is before captcha, never sends raw IP to storage", async () => {
  const api = setup(); for (let i = 0; i < 5; i++) assert.equal((await api.send()).status, 200);
  const response = await api.send(); assert.equal(response.status, 429); assert.equal(response.headers.get("retry-after"), "600");
  assert.equal(api.calls.filter(call => call.url.includes("siteverify")).length, 5);
  assert.match(api.calls[0].body.p_key, /^[a-f0-9]{64}$/); assert.ok(!JSON.stringify(api.calls).includes("192.0.2.1"));
});
test("rate-limit backend failure fails closed", async () => {
  const api = setup({ limitDown: true }); assert.equal((await api.send()).status, 503); assert.equal(api.rows.length, 0);
});
test("duplicate key returns same receipt; changed payload conflicts", async () => {
  const api = setup(), payload = valid(); const first = await (await api.send(payload)).json();
  const second = await (await api.send({ ...payload, turnstileToken: "fresh" })).json();
  assert.equal(first.requestId, second.requestId); assert.equal(api.rows.length, 1);
  assert.equal((await api.send({ ...payload, description: "A different valid project description." })).status, 409);
});
test("lost response after commit can be safely retried", async () => {
  const api = setup({ dropReply: true }), payload = valid(); assert.equal((await api.send(payload)).status, 503);
  const response = await api.send({ ...payload, turnstileToken: "fresh" }); assert.equal(response.status, 200); assert.equal(api.rows.length, 1);
});
test("distinct projects from one email are allowed", async () => {
  const api = setup(); await api.send(); await api.send(); assert.equal(api.rows.length, 2);
});
test("secret map works without putting sb_secret keys into Bearer headers", async () => {
  const api = setup({ env: { SUPABASE_SECRET_KEY: undefined, SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_synthetic" }) } });
  assert.equal((await api.send()).status, 200); assert.equal(api.calls[0].request.headers.Authorization, undefined);
});
test("malformed secret-map values fail closed instead of crashing", async () => {
  const api = setup({ env: { SUPABASE_SECRET_KEY: undefined, SUPABASE_SECRET_KEYS: JSON.stringify({ default: { invalid: true } }) } });
  assert.equal((await api.send()).status, 503); assert.equal(api.calls.length, 0);
});
test("database/network failures never return success or private error bodies", async () => {
  for (const options of [{ databaseDown: true }, { networkError: true }]) { const api = setup(options); const response = await api.send(); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private data|synthetic/); }
});
test("local burst limiter rejects request floods and expires buckets", async () => {
  const api = setup(); for (let i = 0; i < 30; i++) await api.send(valid(), { raw: "{" });
  assert.equal((await api.send()).status, 429); api.advance(600001); assert.equal((await api.send()).status, 200);
});
