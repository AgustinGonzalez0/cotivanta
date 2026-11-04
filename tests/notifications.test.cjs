const test = require("node:test");
const assert = require("node:assert/strict");
const { factory } = require("./helpers.cjs");
const make = factory("supabase/functions/notify-requests/worker.ts", "createNotificationHandler");
const requestId = "11111111-1111-4111-8111-111111111111";
function setup({ emailOk = true, jobKey = "synthetic-job-secret-with-at-least-32-characters" } = {}) {
  const calls = [];
  const env = { NOTIFICATION_JOB_SECRET: jobKey, SUPABASE_URL: "https://example.invalid", SUPABASE_SECRET_KEY: "synthetic", RESEND_API_KEY: "synthetic", NOTIFICATION_FROM: "test@example.invalid", NOTIFICATION_TO: "owner@example.invalid", ADMIN_URL: "https://example.invalid/admin.html" };
  const handler = make({ get: name => env[name] }, async (url, options) => {
    const body = JSON.parse(options.body); calls.push({ url, options, body });
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
test("notification email contains reference only, has idempotency header and marks delivery", async () => {
  const api = setup(); assert.equal((await api.send()).status, 200);
  const email = api.calls[1]; assert.match(email.body.text, /11111111/); assert.equal(email.options.headers["Idempotency-Key"], "cotivanta-" + requestId);
  assert.equal(email.body.html, undefined); assert.equal(api.calls[2].body.p_sent, true);
});
test("failed email remains retryable and does not claim delivery", async () => {
  const api = setup({ emailOk: false }); assert.equal((await api.send()).status, 503); assert.equal(api.calls[2].body.p_sent, false);
});
test("missing notification configuration fails closed", async () => {
  const api = setup(); api.env.RESEND_API_KEY = ""; assert.equal((await api.send()).status, 503); assert.equal(api.calls.length, 0);
});
