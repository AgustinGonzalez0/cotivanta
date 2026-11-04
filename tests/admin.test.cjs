const test = require("node:test");
const assert = require("node:assert/strict");
const { elements, read, submit, vm, node } = require("./helpers.cjs");
const settingsRow = { client_count: 2, team_count: 1, metrics_verified: true, revision: 1 };
function setup(responses) {
  const el = elements(["login-form", "mfa-form", "settings-form", "admin-message", "admin-login-fields", "client-count-input", "team-count-input", "metrics-verified", "admin-password", "admin-email", "mfa-code", "mfa-qr", "mfa-enrollment", "request-list", "inbox", "inbox-message", "logout", "cancel-session", "refresh-inbox", "previous-page", "next-page"]);
  for (const id of ["settings-form", "mfa-form", "inbox", "logout"]) el[id].hidden = true;
  el["admin-email"].value = "audit@example.invalid"; el["admin-password"].value = "synthetic-password";
  const requests = [], timers = [];
  vm.runInNewContext(read("site/assets/admin.js"), {
    window: { COTIVANTA_CONFIG: { supabaseUrl: "https://example.invalid", supabasePublishableKey: "synthetic-public" }, CotivantaHTTP: { json: async (url, options) => {
      requests.push({ url, options }); const response = responses.shift(); if (!response) throw new Error("unexpected request");
      return { response: { status: response.status || 200, ok: (response.status || 200) < 400 }, body: response.body };
    } } },
    document: { getElementById: id => el[id], createElement: () => node() },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
  });
  return { el, requests, timers };
}
const login = (admin = true) => ({ body: { access_token: "aal1-synthetic", expires_in: 300, user: { app_metadata: { cotivanta_admin: admin }, factors: [{ id: "factor-test", factor_type: "totp", status: "verified" }] } } });
const mfaResponses = () => [{ body: { id: "challenge-test" } }, { body: { access_token: "aal2-synthetic", expires_in: 300 } }, { body: [settingsRow] }, { body: [] }];
async function signIn(api) { await submit(api.el["login-form"]); api.el["mfa-code"].value = "123456"; await submit(api.el["mfa-form"]); }
test("users without administrator role never see private settings or inbox", async () => {
  const api = setup([login(false), { status: 204, body: null }]); await submit(api.el["login-form"]);
  assert.equal(api.el["settings-form"].hidden, true); assert.equal(api.el.inbox.hidden, true); assert.equal(api.requests.length, 2);
  assert.match(api.requests[1].url, /logout\?scope=local/);
});
test("password alone does not grant access: MFA challenge and verified session required", async () => {
  const api = setup([login(), ...mfaResponses()]); await submit(api.el["login-form"]);
  assert.equal(api.el["settings-form"].hidden, true); assert.equal(api.el["mfa-form"].hidden, false);
  assert.equal(api.requests.length, 1); api.el["mfa-code"].value = "123456"; await submit(api.el["mfa-form"]);
  assert.equal(api.el["settings-form"].hidden, false); assert.equal(api.el.inbox.hidden, false);
  assert.ok(api.requests.find(r => r.url.includes("site_settings")).options.headers.Authorization.includes("aal2"));
});
test("invalid MFA code is not sent", async () => {
  const api = setup([login()]); await submit(api.el["login-form"]); api.el["mfa-code"].value = "123"; await submit(api.el["mfa-form"]); assert.equal(api.requests.length, 1);
});
test("RLS denial after MFA clears all private content", async () => {
  const api = setup([login(), ...mfaResponses().slice(0, 2), { status: 403, body: {} }]); await signIn(api);
  assert.equal(api.el["settings-form"].hidden, true); assert.equal(api.el.inbox.hidden, true); assert.equal(api.el["request-list"].children.length, 0);
});
test("settings save uses optimistic revision and verifies returned values", async () => {
  const api = setup([login(), ...mfaResponses(), { body: [{ ...settingsRow, client_count: 3, revision: 2 }] }]); await signIn(api);
  api.el["client-count-input"].value = "3"; await submit(api.el["settings-form"]);
  assert.match(api.requests.at(-1).url, /revision=eq.1/); assert.match(api.el["admin-message"].textContent, /guardadas/);
});
test("empty updates never claim success", async () => {
  const api = setup([login(), ...mfaResponses(), { body: [] }]); await signIn(api); await submit(api.el["settings-form"]); assert.match(api.el["admin-message"].textContent, /No se guardó/);
});
test("logout revokes provider session and removes private data even when revocation fails", async () => {
  const api = setup([login(), ...mfaResponses(), { status: 500, body: {} }]); await signIn(api);
  api.el["request-list"].append(node()); await api.el.logout.listeners.click();
  assert.equal(api.el["request-list"].children.length, 0); assert.equal(api.el["client-count-input"].value, "");
  assert.match(api.requests.at(-1).url, /logout\?scope=local/); assert.match(api.el["admin-message"].textContent, /revocación remota/);
});
test("private inbox values are rendered as text, not executable markup", async () => {
  const responses = mfaResponses(); responses[3] = { body: [{ id: "synthetic-id", name: '<img src=x onerror="alert(1)">', email: "audit@example.invalid", description: "<script>bad()</script>", status: "new" }] };
  const api = setup([login(), ...responses]); await signIn(api);
  const card = api.el["request-list"].children[0]; assert.equal(card.children[0].textContent, '<img src=x onerror="alert(1)">'); assert.equal(card.children[0].children.length, 0);
});
test("MFA enrollment QR is an image, never injected into HTML", async () => {
  const session = login(); session.body.user.factors = [];
  const api = setup([session, { body: { id: "new-factor", totp: { qr_code: "<svg></svg>" } } }]); await submit(api.el["login-form"]);
  assert.match(api.el["mfa-qr"].src, /^data:image\/svg\+xml/); assert.equal(api.el["mfa-enrollment"].hidden, false); assert.equal(api.el.inbox.hidden, true);
});
