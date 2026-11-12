const test = require("node:test");
const assert = require("node:assert/strict");
const { elements, read, submit, vm, node, webcrypto } = require("./helpers.cjs");
function setup({ status = 200, lang = "es", enabled = true, reply, send, config = {} } = {}) {
  const el = elements(["year", "language", "client-count", "team-count", "project-form", "request-fields", "intake-status", "request-reference", "form-message", "submit-button", "form-success", "reset-form", "name", "email", "client-type", "service", "description", "budget", "timeline", "organization", "consent", "fax_number"]);
  Object.assign(el.name, { value: "Prueba Sintética" }); el.email.value = "audit@example.invalid";
  el.description.value = "Consulta sintética de prueba del formulario.";
  el["client-type"].value = "individual"; el.service.value = "website"; el.budget.value = "unsure"; el.timeline.value = "flexible"; el.language.value = lang; el.consent.checked = true;
  const version = read("site/index.html").match(/data-privacy-version="([^"]+)"/)[1]; el["project-form"].dataset.privacyVersion = version;
  el["project-form"].checkValidity = () => el.consent.checked && Object.values(el).every(item => !item.validityMessage);
  el["form-success"].hidden = true;
  const requests = []; let script, captcha;
  const context = {
    navigator: { language: lang }, document: { getElementById: id => el[id], querySelectorAll: () => [], documentElement: {}, addEventListener() {}, createElement() { script = node(); return script; }, head: { append() {} } },
    window: { crypto: webcrypto, COTIVANTA_CONFIG: { projectRequestsEnabled: enabled, apiUrl: "https://example.invalid", turnstileSiteKey: "synthetic", ...config }, CotivantaHTTP: { json: async (url, options) => {
      requests.push(JSON.parse(options.body)); if (send) return send(url, options);
      return { response: { status, ok: status < 400 }, body: reply || { ok: true, requestId: "11111111-1111-4111-8111-111111111111", code: status === 409 ? "policy_changed" : "received" } };
    } }, turnstile: { render(selector, options) { captcha = options.callback; captcha("synthetic"); return 1; }, reset() {} } },
  };
  vm.runInNewContext(read("site/assets/app.js"), context);
  script?.onload();
  return { el, requests, version, script, captcha: () => captcha("fresh-captcha"), submit: () => submit(el["project-form"]) };
}
test("disabled intake leaves controls and button disabled and never loads captcha", async () => {
  const api = setup({ enabled: false }); await api.submit();
  assert.equal(api.el["request-fields"].disabled, true); assert.equal(api.el["submit-button"].disabled, true);
  assert.equal(api.el["intake-status"].hidden, false); assert.equal(api.script, undefined); assert.equal(api.requests.length, 0);
});
test("requested public fallback restores 27 clients and 5 teams independently of intake", () => {
  const context = { window: {} };
  vm.runInNewContext(read("site/config.js"), context);
  const config = context.window.COTIVANTA_CONFIG;
  const api = setup({ enabled: false, config: { metricsVerified: config.metricsVerified, clientCount: config.clientCount, teamCount: config.teamCount } });
  assert.equal(api.el["client-count"].textContent, "27");
  assert.equal(api.el["team-count"].textContent, "5");
  assert.equal(api.el["request-fields"].disabled, true);
});
test("temporary public intake flag enables the form while preserving receipt validation", async () => {
  const context = { window: {} };
  vm.runInNewContext(read("site/config.js"), context);
  assert.equal(context.window.COTIVANTA_CONFIG.projectRequestsEnabled, true);
  const api = setup({ config: { projectRequestsEnabled: context.window.COTIVANTA_CONFIG.projectRequestsEnabled }, status: 503 });
  assert.equal(api.el["request-fields"].disabled, false);
  assert.equal(api.el["submit-button"].disabled, false);
  assert.ok(api.script);
  await api.submit();
  assert.equal(api.requests.length, 1);
  assert.equal(api.el["form-success"].hidden, true);
  assert.equal(api.el.name.value, "Prueba Sintética");
});
test("frontend sends policy and UUID, only accepts a confirmed receipt", async () => {
  const api = setup(); await api.submit();
  assert.equal(api.requests[0].privacyVersion, api.version); assert.match(api.requests[0].submissionKey, /^[\da-f-]{36}$/);
  assert.equal(api.el["project-form"].hidden, true); assert.equal(api.el["form-success"].focused, true);
  assert.match(api.el["request-reference"].textContent, /11111111/);
});
test("consent must be checked and whitespace-only values fail before fetch", async () => {
  const api = setup(); api.el.consent.checked = false; await api.submit(); assert.equal(api.requests.length, 0);
  api.el.consent.checked = true; api.el.name.value = "  "; await api.submit(); assert.equal(api.requests.length, 0); assert.ok(api.el.name.validityMessage);
});
test("failed replies retain input and same key for retries with a fresh captcha", async () => {
  const api = setup({ send: async () => { throw new Error("lost reply"); } });
  await api.submit(); api.captcha(); await api.submit(); assert.equal(api.requests[0].submissionKey, api.requests[1].submissionKey);
  assert.equal(api.el["project-form"].hidden, false); assert.equal(api.el.name.value, "Prueba Sintética");
  assert.equal(api.el["request-fields"].disabled, false); assert.match(api.el["form-message"].textContent, /reintentar/);
  api.el.description.value += " Otro alcance."; api.captcha(); await api.submit(); assert.notEqual(api.requests[1].submissionKey, api.requests[2].submissionKey);
});
test("concurrent submit events cannot create concurrent requests", async () => {
  let finish; const api = setup({ send: () => new Promise(resolve => { finish = resolve; }) });
  const first = api.submit(); await api.submit(); assert.equal(api.requests.length, 1);
  finish({ response: { ok: true, status: 200 }, body: { ok: true, requestId: "synthetic-id" } }); await first;
});
for (const lang of ["es", "en"]) test(`stale privacy unchecks consent without losing draft (${lang})`, async () => {
  const api = setup({ status: 409, lang }); await api.submit();
  assert.equal(api.el.consent.checked, false); assert.equal(api.el["form-success"].hidden, true);
  assert.match(api.el["form-message"].textContent, lang === "es" ? /política de privacidad cambió/ : /privacy policy has changed/);
});
for (const status of [400, 403, 429, 503]) test(`HTTP ${status} never reports receipt`, async () => {
  const api = setup({ status }); await api.submit(); assert.equal(api.el["form-success"].hidden, true); assert.equal(api.el["form-message"].hidden, false);
});
test("captcha load failures produce a visible error", () => {
  const api = setup(); api.script.onerror(); assert.equal(api.el["form-message"].hidden, false); assert.match(api.el["form-message"].textContent, /verificación de seguridad/);
});
