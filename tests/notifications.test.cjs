const test = require("node:test");
const assert = require("node:assert/strict");
const { factory } = require("./helpers.cjs");
const make = factory("supabase/functions/notify-requests/worker.ts", "createNotificationHandler");
const requestId = "11111111-1111-4111-8111-111111111111";
const visitor = { created_at: "2026-11-10T12:00:00Z", name: "Ana Prueba", email: "ana@example.invalid", client_type: "individual", service: "website", description: "Necesito una web <script>alert(1)</script> para mi negocio.", budget: "unsure", timeline: "flexible", organization: null, language: "es" };
let lookupRows = [visitor];
function setup({ emailOk = true, jobKey = "synthetic-job-secret-with-at-least-32-characters" } = {}) {
  lookupRows = [visitor]; const calls = [];
  const env = { NOTIFICATION_JOB_SECRET: jobKey, SUPABASE_URL: "https://example.invalid", SUPABASE_SECRET_KEY: "synthetic", RESEND_API_KEY: "synthetic", NOTIFICATION_FROM: "test@example.invalid", NOTIFICATION_TO: "owner@example.invalid", ADMIN_URL: "https://example.invalid/admin.html" };
  const handler = make({ get: name => env[name] }, async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null; calls.push({ url, options, body });
    if (url.includes("/rest/v1/project_requests")) return Response.json(lookupRows);
    if (url.includes("claim_project_notifications")) return Response.json([{ request_id: requestId }]);
    if (url.includes("api.resend.com")) return Response.json({}, { status: emailOk ? 200 : 500 });
    return new Response(null, { status: 204 });
  });
  const send = (auth = `Bearer ${jobKey}`) => handler(new Request("https://example.invalid", { method: "POST", headers: { authorization: auth } }));
  return { send, calls, env };
}
test("notification worker rejects missing or wrong secret before touching providers", async () => {
  const api = setup(); for (const auth of ["", "Bearer wrong"]) assert.equal((await api.send(auth)).status, 401); assert.equal(api.calls.length, 0);
});
test("notification email carries the inquiry as plain text, replies to the visitor and marks delivery", async () => {
  const api = setup(); assert.equal((await api.send()).status, 200);
  const email = api.calls.find(call => call.url.includes("api.resend.com")), finished = api.calls.find(call => call.url.includes("finish_project_notification"));
  assert.match(email.body.text, /Ana Prueba/); assert.match(email.body.text, /ana@example.invalid/); assert.match(email.body.text, /Necesito una web/); assert.match(email.body.text, /11111111/);
  assert.deepEqual(email.body.reply_to, ["ana@example.invalid"]); assert.deepEqual(email.body.to, ["owner@example.invalid"]);
  assert.equal(email.body.subject, "Nueva consulta en Cotivanta"); assert.equal(email.body.html, undefined);
  assert.equal(email.options.headers["Idempotency-Key"], "cotivanta-" + requestId); assert.equal(finished.body.p_sent, true);
});
test("an unusable visitor address is never used as reply-to", async () => {
  const api = setup(); lookupRows = [{ ...visitor, email: "a@b.c>, evil@example.invalid" }]; assert.equal((await api.send()).status, 200);
  assert.equal(api.calls.find(call => call.url.includes("api.resend.com")).body.reply_to, undefined);
});
test("a request that cannot be loaded sends nothing and stays retryable", async () => {
  const api = setup(); lookupRows = []; assert.equal((await api.send()).status, 503);
  assert.equal(api.calls.some(call => call.url.includes("api.resend.com")), false); assert.equal(api.calls.find(call => call.url.includes("finish_project_notification")).body.p_sent, false);
});
test("failed email remains retryable and does not claim delivery", async () => {
  const api = setup({ emailOk: false }); assert.equal((await api.send()).status, 503); assert.equal(api.calls.find(call => call.url.includes("finish_project_notification")).body.p_sent, false);
});
test("missing notification configuration fails closed", async () => {
  const api = setup(); api.env.RESEND_API_KEY = ""; assert.equal((await api.send()).status, 503); assert.equal(api.calls.length, 0);
});
