// Modelo de agencia: intake unificado (clientes + profesionales), notificaciones y consistencia del catálogo.
const test = require("node:test");
const assert = require("node:assert/strict");
const { factory, read, webcrypto, vm } = require("./helpers.cjs");
const make = factory("supabase/functions/project-request/handler.ts", "createHandler");
const CATALOG = factory("supabase/functions/project-request/handler.ts", "CATALOG");
const CURRENCIES = factory("supabase/functions/project-request/handler.ts", "CURRENCIES");
const PRO_LANGUAGES = factory("supabase/functions/project-request/handler.ts", "PROFESSIONAL_LANGUAGES");
const version = read("supabase/functions/project-request/handler.ts").match(/PRIVACY_VERSION = "([^"]+)"/)[1];
const makeWorker = factory("supabase/functions/notify-requests/worker.ts", "createNotificationHandler");
const plain = value => JSON.parse(JSON.stringify(value));
const today = new Date().toISOString().slice(0, 10);
const inDays = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const client = (extra = {}) => ({ name: "Prueba Sintética", email: "audit@example.invalid", clientType: "", category: "audiovisual", service: "video-editing", description: "Necesito editar un video institucional de prueba.", budget: "amount", budgetAmount: 100000, budgetCurrency: "ARS", timeline: "within-month", desiredDate: inDays(30), organization: "", whatsapp: "+54 9 11 5555 5555", language: "es", consent: true, privacyVersion: version, turnstileToken: "synthetic-token", submissionKey: webcrypto.randomUUID(), faxNumber: "", ...extra });
const pro = (extra = {}) => ({ form: "professional-application", fullName: "Profesional Sintético", email: "pro@example.invalid", country: "Argentina", city: "Rosario", whatsapp: "+54 341 555 0000", specialties: ["video-editing", "motion-graphics"], otherSpecialty: "", experience: "Editor de video con experiencia sintética en piezas de prueba.", yearsExperience: 4, portfolioUrl: "https://portfolio.example.invalid/work", linkedinUrl: "https://www.linkedin.com/in/synthetic", otherLinks: ["https://vimeo.com/synthetic"], languages: ["es", "en"], availability: "part-time", rateModel: "per-project", rateAmount: 150000, rateCurrency: "ARS", language: "es", consent: true, privacyVersion: version, turnstileToken: "pro-token", submissionKey: webcrypto.randomUUID(), faxNumber: "", ...extra });

function setup(options = {}) {
  const calls = [], stored = new Map(), buckets = new Map(), background = [];
  const env = { PROJECT_REQUESTS_ENABLED: "true", PROFESSIONAL_APPLICATIONS_ENABLED: "true", ALLOWED_ORIGINS: "http://localhost:8080", ALLOWED_TURNSTILE_HOSTNAMES: "localhost", TURNSTILE_SECRET_KEY: "synthetic", SUPABASE_URL: "https://example.invalid", SUPABASE_SECRET_KEY: "synthetic", RATE_LIMIT_SALT: "synthetic-test-salt-at-least-32-characters", TRUSTED_IP_HEADER: "x-forwarded-for", ...options.env };
  const handler = make({ get: key => env[key] }, async (url, request) => {
    const body = JSON.parse(request.body); calls.push({ url, request, body });
    assert.ok(request.signal, "all provider calls have a timeout signal");
    if (url.endsWith("check_project_request_rate_limit")) {
      const bucket = buckets.get(body.p_key) ?? { count: 0 }; buckets.set(body.p_key, bucket); bucket.count++;
      return Response.json({ allowed: bucket.count <= 5, retry_after: 600 });
    }
    if (url.includes("siteverify")) return Response.json({ success: true, hostname: "localhost", action: options.captchaAction ?? (body.response === "pro-token" ? "professional_application" : "project_request") });
    if (url.endsWith("/functions/v1/notify-requests")) { if (options.notifyFails) throw new Error("worker unreachable"); return Response.json({ processed: 1 }); }
    assert.match(url, /submit_(project_request|professional_application)$/);
    const record = body.p_request ?? body.p_application, id = stored.get(body.p_submission_key)?.id ?? webcrypto.randomUUID();
    if (stored.has(body.p_submission_key)) return Response.json(stored.get(body.p_submission_key).fingerprint === body.p_fingerprint ? { ok: true, [url.endsWith("professional_application") ? "application_id" : "request_id"]: id } : { code: "idempotency_conflict" });
    stored.set(body.p_submission_key, { id, fingerprint: body.p_fingerprint, record });
    return Response.json({ ok: true, [url.endsWith("professional_application") ? "application_id" : "request_id"]: id });
  }, () => Date.now(), task => background.push(task));
  const send = (payload, headers = {}) => handler(new Request("https://example.invalid/intake", { method: "POST", headers: { origin: "http://localhost:8080", "content-type": "application/json", "x-forwarded-for": "192.0.2.1", ...headers }, body: JSON.stringify(payload) }));
  const saves = () => calls.filter(call => /submit_/.test(call.url));
  return { send, calls, stored, saves, env, background, handler };
}

// ---------- catálogo ----------
test("the site catalog and the backend allow-list describe exactly the same categories and services", () => {
  const context = { window: {} }; vm.runInNewContext(read("site/assets/catalog.js"), context);
  const site = context.window.COTIVANTA_CATALOG;
  assert.deepEqual(plain(Object.fromEntries(site.categories.map(category => [category.id, category.services.map(service => service[0])]))), plain(CATALOG));
  assert.deepEqual(plain(site.currencies.map(currency => currency[0])), plain(CURRENCIES));
  assert.deepEqual(plain(site.languages.map(language => language[0])), plain(PRO_LANGUAGES));
  assert.equal(site.otherService, "other");
});
test("every catalog entry is bilingual and slugs are unique, well-formed and short", () => {
  const context = { window: {} }; vm.runInNewContext(read("site/assets/catalog.js"), context);
  const slugs = [];
  for (const category of context.window.COTIVANTA_CATALOG.categories) {
    for (const lang of ["es", "en"]) { assert.ok(category[lang].name.length > 2); assert.ok(category[lang].description.length > 10); }
    assert.match(category.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const [slug, es, en] of category.services) { assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/); assert.ok(slug.length <= 60 && es && en); slugs.push(slug); }
  }
  assert.equal(new Set(slugs).size, slugs.length);
});

// ---------- formulario de clientes ----------
test("agency client request is validated and forwarded with every new field", async () => {
  const api = setup(); const response = await api.send(client());
  assert.equal(response.status, 200); assert.match((await response.json()).requestId, /^[0-9a-f-]{36}$/);
  const record = api.saves()[0].body.p_request;
  assert.deepEqual({ category: record.category, service: record.service, budget: record.budget, budget_amount: record.budget_amount, budget_currency: record.budget_currency, whatsapp: record.whatsapp, client_type: record.client_type, desired_date: record.desired_date }, { category: "audiovisual", service: "video-editing", budget: "amount", budget_amount: 100000, budget_currency: "ARS", whatsapp: "+54 9 11 5555 5555", client_type: null, desired_date: inDays(30) });
  assert.equal(record.privacy_version, version);
});
test("'I don't know the budget yet' and a custom service need no amount, currency or date", async () => {
  const api = setup(); const response = await api.send(client({ budget: "unsure", budgetAmount: "", budgetCurrency: "", service: "other", category: "marketing", desiredDate: "", whatsapp: "" }));
  assert.equal(response.status, 200); const record = api.saves()[0].body.p_request;
  assert.deepEqual([record.budget, record.budget_amount, record.budget_currency, record.desired_date, record.whatsapp], ["unsure", null, null, null, null]);
});
test("a stray amount is ignored unless the budget mode is 'amount'", async () => {
  const api = setup(); await api.send(client({ budget: "unsure", budgetAmount: 5, budgetCurrency: "USD" }));
  assert.equal(api.saves()[0].body.p_request.budget_amount, null);
});
test("the previous technology-only payload (no category, USD ranges) still works", async () => {
  const api = setup(); const legacy = client({ category: undefined, service: "custom-software", clientType: "business", budget: "500-1500", budgetAmount: undefined, budgetCurrency: undefined, desiredDate: undefined, whatsapp: undefined });
  assert.equal((await api.send(legacy)).status, 200); const record = api.saves()[0].body.p_request;
  assert.deepEqual([record.category, record.service, record.client_type, record.budget], ["tech", "custom-software", "business", "500-1500"]);
});
for (const [label, override] of [["service from another category", { service: "logo-design" }], ["unknown category", { category: "plumbing" }], ["inherited object key as category", { category: "constructor", service: "other" }], ["unknown service", { service: "unknown" }], ["custom service in the open category is the only one", { category: "other", service: "seo" }], ["amount mode without amount", { budgetAmount: "" }], ["negative amount", { budgetAmount: -5 }], ["absurd amount", { budgetAmount: 1e12 }], ["unlisted currency", { budgetCurrency: "XYZ" }], ["amount mode without currency", { budgetCurrency: "" }], ["invalid whatsapp", { whatsapp: "call me maybe" }], ["too-short whatsapp", { whatsapp: "12345" }], ["impossible date", { desiredDate: "2027-02-30" }], ["past date", { desiredDate: "2020-01-01" }], ["far-future date", { desiredDate: "2099-01-01" }], ["malformed date", { desiredDate: "tomorrow" }], ["unknown client type", { clientType: "alien" }], ["bad budget", { budget: "free" }], ["control characters in organization", { organization: "Acme\nInc" }]]) {
  test(`rejects client request: ${label}`, async () => {
    const api = setup(); assert.equal((await api.send(client(override))).status, 400); assert.equal(api.calls.length, 0);
  });
}
test("a request dated 'today' is accepted (timezone slack) and the one from two days ago is not", async () => {
  assert.equal((await setup().send(client({ desiredDate: today }))).status, 200);
  assert.equal((await setup().send(client({ desiredDate: inDays(-3) }))).status, 400);
});

// ---------- formulario de profesionales ----------
test("professional application is stored through its own function with pending-ready data", async () => {
  const api = setup(); const response = await api.send(pro()); const body = await response.json();
  assert.equal(response.status, 200); assert.match(body.applicationId, /^[0-9a-f-]{36}$/); assert.equal(body.requestId, undefined);
  const save = api.saves()[0]; assert.match(save.url, /submit_professional_application$/);
  const record = save.body.p_application;
  assert.deepEqual([record.full_name, record.country, record.city, record.specialties, record.languages, record.rate_currency, record.rate_amount, record.years_experience], ["Profesional Sintético", "Argentina", "Rosario", ["video-editing", "motion-graphics"], ["es", "en"], "ARS", 150000, 4]);
  assert.equal(record.privacy_version, version);
});
test("optional professional fields can be left empty; one free-text specialty is enough", async () => {
  const api = setup(); const response = await api.send(pro({ city: "", whatsapp: "", yearsExperience: "", linkedinUrl: "", otherLinks: [], rateAmount: "", specialties: [], otherSpecialty: "Locución" }));
  assert.equal(response.status, 200); const record = api.saves()[0].body.p_application;
  assert.deepEqual([record.city, record.whatsapp, record.years_experience, record.linkedin_url, record.other_links, record.rate_amount, record.other_specialty], [null, null, null, null, [], null, "Locución"]);
});
test("professional specialties and links are de-duplicated", async () => {
  const api = setup(); await api.send(pro({ specialties: ["seo", "seo", "copywriting"], otherLinks: ["https://a.example.invalid/x", "https://a.example.invalid/x"] }));
  const record = api.saves()[0].body.p_application; assert.deepEqual(record.specialties, ["seo", "copywriting"]); assert.equal(record.other_links.length, 1);
});
const longText = "x".repeat(2001);
for (const [label, override] of [["short name", { fullName: "A" }], ["control chars in name", { fullName: "Ana\u0007" }], ["bad email", { email: "nope" }], ["missing country", { country: "" }], ["no specialty at all", { specialties: [], otherSpecialty: "" }], ["unknown specialty", { specialties: ["hacking"] }], ["too many specialties", { specialties: ["seo", "copywriting", "photography", "animation", "subtitles", "branding", "logo-design", "illustration", "website", "landing-page", "online-store", "mobile-app", "automation"] }], ["specialty not an array", { specialties: "seo" }], ["specialty array of objects", { specialties: [{ a: 1 }] }], ["short experience", { experience: "poca" }], ["long experience", { experience: longText }], ["NUL in experience", { experience: "Experiencia válida con carácter nulo\u0000 incluido en el texto." }], ["years out of range", { yearsExperience: 70 }], ["years fractional", { yearsExperience: 2.5 }], ["no portfolio", { portfolioUrl: "" }], ["http portfolio", { portfolioUrl: "http://portfolio.example.invalid/work" }], ["javascript portfolio", { portfolioUrl: "javascript:alert(1)//https://x.example.invalid" }], ["ip portfolio", { portfolioUrl: "https://192.168.0.10/work" }], ["localhost portfolio", { portfolioUrl: "https://localhost/work" }], ["credentials in url", { portfolioUrl: "https://user:pass@portfolio.example.invalid/work" }], ["url with spaces", { portfolioUrl: "https://portfolio.example.invalid/my work" }], ["huge url", { portfolioUrl: "https://example.invalid/" + "a".repeat(400) }], ["linkedin on another site", { linkedinUrl: "https://evil.example.invalid/in/x" }], ["linkedin lookalike", { linkedinUrl: "https://notlinkedin.com/in/x" }], ["too many links", { otherLinks: new Array(6).fill(0).map((_, i) => `https://site${i}.example.invalid/x`) }], ["bad extra link", { otherLinks: ["https://ok.example.invalid/x", "ftp://bad.example.invalid"] }], ["no languages", { languages: [] }], ["unknown language", { languages: ["klingon"] }], ["bad availability", { availability: "always" }], ["bad rate model", { rateModel: "free" }], ["bad currency", { rateCurrency: "XYZ" }], ["negative rate", { rateAmount: -1 }], ["no consent", { consent: false }], ["bad ui language", { language: "fr" }], ["bad whatsapp", { whatsapp: "abc" }]]) {
  test(`rejects professional application: ${label}`, async () => {
    const api = setup(); assert.equal((await api.send(pro(override))).status, 400); assert.equal(api.calls.length, 0);
  });
}
test("a professional form with a stale privacy version asks for re-acceptance before any provider call", async () => {
  const api = setup(); assert.equal((await api.send(pro({ privacyVersion: "old" }))).status, 409); assert.equal(api.calls.length, 0);
});

// ---------- anti-spam y aislamiento entre formularios ----------
test("the honeypot rejects bots on the professional form without storing anything", async () => {
  const api = setup(); assert.equal((await api.send(pro({ faxNumber: "bot" }))).status, 400); assert.equal(api.calls.length, 0);
});
test("each form has its own switch: disabling professional applications leaves client requests working, and vice versa", async () => {
  const closed = setup({ env: { PROFESSIONAL_APPLICATIONS_ENABLED: "false" } });
  assert.equal((await closed.send(pro())).status, 503); assert.equal(closed.calls.length, 0); assert.equal((await closed.send(client())).status, 200);
  const other = setup({ env: { PROJECT_REQUESTS_ENABLED: undefined } });
  assert.equal((await other.send(client())).status, 503); assert.equal(other.calls.length, 0); assert.equal((await other.send(pro())).status, 200);
  assert.equal((await setup({ env: { PROJECT_REQUESTS_ENABLED: "TRUE", PROFESSIONAL_APPLICATIONS_ENABLED: "1" } }).send(pro())).status, 503);
});
test("a captcha solved for the client form cannot be replayed on the professional form (and the reverse)", async () => {
  const api = setup({ captchaAction: "project_request" }); assert.equal((await api.send(pro())).status, 403); assert.equal(api.saves().length, 0);
  const reverse = setup({ captchaAction: "professional_application" }); assert.equal((await reverse.send(client())).status, 403); assert.equal(reverse.saves().length, 0);
  const matching = setup(); assert.equal((await matching.send(pro())).status, 200); assert.equal((await matching.send(client())).status, 200);
});
test("the durable rate limit uses separate buckets per form and never the raw address", async () => {
  const api = setup(); for (let i = 0; i < 5; i++) assert.equal((await api.send(client())).status, 200);
  assert.equal((await api.send(client())).status, 429);
  assert.equal((await api.send(pro())).status, 200, "client submissions must not exhaust the professional bucket");
  const keys = api.calls.filter(call => call.url.endsWith("check_project_request_rate_limit")).map(call => call.body.p_key);
  assert.equal(keys.length, 7); assert.notEqual(keys[0], keys[6]); keys.forEach(value => assert.match(value, /^[a-f0-9]{64}$/)); assert.ok(!JSON.stringify(api.calls).includes("192.0.2.1"));
});
test("professional duplicate submissions return the same receipt and a changed payload conflicts", async () => {
  const api = setup(), payload = pro(); const first = await (await api.send(payload)).json();
  const second = await (await api.send({ ...payload })).json();
  assert.equal(first.applicationId, second.applicationId); assert.equal(api.stored.size, 1);
  assert.equal((await api.send({ ...payload, experience: "Otra descripción distinta de la experiencia profesional." })).status, 409);
});
test("applications reuse the origin allow-list: unknown origins are refused", async () => {
  const api = setup(); assert.equal((await api.send(pro(), { origin: "https://evil.invalid" })).status, 403); assert.equal(api.calls.length, 0);
});
test("responses never expose the service key, secrets or visitor data in error bodies", async () => {
  const api = setup({ env: { SUPABASE_SECRET_KEY: "sb_secret_synthetic_value_123" } });
  const text = await (await api.send(pro({ turnstileToken: "" }))).text(); assert.doesNotMatch(text, /sb_secret|synthetic|Profesional/);
});

// ---------- intento inmediato de aviso + reintentos ----------
test("a saved submission triggers an immediate, authenticated attempt of the notification worker", async () => {
  const secret = "synthetic-job-secret-with-at-least-32-characters"; const api = setup({ env: { NOTIFICATION_JOB_SECRET: secret } });
  assert.equal((await api.send(pro())).status, 200); await Promise.all(api.background);
  assert.equal(api.background.length, 1);
  const kick = api.calls.find(call => call.url === "https://example.invalid/functions/v1/notify-requests");
  assert.ok(kick); assert.equal(kick.request.headers.Authorization, `Bearer ${secret}`); assert.equal(kick.request.method, "POST");
  assert.equal((await api.send(client())).status, 200); assert.equal(api.background.length, 2);
});
test("the immediate attempt is skipped when no job secret is configured, and rejected submissions never trigger it", async () => {
  const none = setup(); await none.send(pro()); assert.equal(none.background.length, 0);
  const secret = "synthetic-job-secret-with-at-least-32-characters"; const bad = setup({ env: { NOTIFICATION_JOB_SECRET: secret } });
  await bad.send(pro({ consent: false })); await bad.send(client({ faxNumber: "bot" })); assert.equal(bad.background.length, 0);
});
test("a failing immediate attempt never fails the submission (the scheduled worker is the safety net)", async () => {
  const api = setup({ notifyFails: true, env: { NOTIFICATION_JOB_SECRET: "synthetic-job-secret-with-at-least-32-characters" } });
  const response = await api.send(pro()); assert.equal(response.status, 200); await assert.doesNotReject(Promise.all(api.background));
});

// ---------- worker: dos colas, un solo canal de correo ----------
const requestId = "11111111-1111-4111-8111-111111111111", applicationId = "22222222-2222-4222-8222-222222222222";
const applicant = { created_at: "2026-11-12T12:00:00Z", full_name: "Ana Profesional", email: "ana.pro@example.invalid", country: "Chile", city: null, whatsapp: null, specialties: ["video-editing", "seo"], other_specialty: null, experience_summary: "Editora <script>alert(1)</script> con experiencia de prueba suficiente.", years_experience: 6, portfolio_url: "https://portfolio.example.invalid", linkedin_url: null, other_links: ["https://vimeo.com/x"], languages: ["es", "en"], availability: "part-time", rate_model: "hourly", rate_amount: 25, rate_currency: "USD", language: "es", status: "pending" };
const inquiry = { created_at: "2026-11-12T12:00:00Z", name: "Beto Cliente", email: "beto@example.invalid", client_type: null, category: "audiovisual", service: "video-editing", description: "Necesito editar un video institucional.", budget: "amount", budget_amount: "100000.00", budget_currency: "ARS", timeline: "flexible", desired_date: "2026-12-20", organization: null, whatsapp: "+54 9 11 5555 5555", language: "es" };
function worker({ requests = [requestId], applications = [applicationId], emailOk = true, applicationClaimStatus = 200 } = {}) {
  const calls = []; const env = { NOTIFICATION_JOB_SECRET: "synthetic-job-secret-with-at-least-32-characters", SUPABASE_URL: "https://example.invalid", SUPABASE_SECRET_KEY: "synthetic", RESEND_API_KEY: "synthetic", NOTIFICATION_FROM: "from@example.invalid", NOTIFICATION_TO: "owner@example.invalid", ADMIN_URL: "https://example.invalid/admin.html" };
  const handler = makeWorker({ get: name => env[name] }, async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null; calls.push({ url, options, body });
    if (url.includes("/rest/v1/project_requests")) return Response.json([inquiry]);
    if (url.includes("/rest/v1/professional_applications")) return Response.json([applicant]);
    if (url.includes("claim_project_notifications")) return Response.json(requests.map(id => ({ request_id: id })));
    if (url.includes("claim_professional_notifications")) return applicationClaimStatus === 200 ? Response.json(applications.map(id => ({ application_id: id }))) : Response.json({ message: "function does not exist" }, { status: applicationClaimStatus });
    if (url.includes("api.resend.com")) return Response.json({}, { status: emailOk ? 200 : 500 });
    return new Response(null, { status: 204 });
  });
  return { calls, env, run: () => handler(new Request("https://example.invalid", { method: "POST", headers: { authorization: `Bearer ${env.NOTIFICATION_JOB_SECRET}` } })) };
}
test("the one worker delivers both queues through the same Resend channel, plain text, with per-kind idempotency keys", async () => {
  const api = worker(); const response = await api.run(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { processed: 2, accepted: 2 });
  const emails = api.calls.filter(call => call.url.includes("api.resend.com"));
  assert.equal(emails.length, 2);
  const [inquiryMail, applicationMail] = emails;
  assert.equal(inquiryMail.body.subject, "Nueva consulta en Cotivanta"); assert.equal(applicationMail.body.subject, "Nueva postulación profesional en Cotivanta");
  assert.equal(inquiryMail.options.headers["Idempotency-Key"], "cotivanta-" + requestId); assert.equal(applicationMail.options.headers["Idempotency-Key"], "cotivanta-application-" + applicationId);
  for (const mail of emails) { assert.deepEqual(mail.body.to, ["owner@example.invalid"]); assert.equal(mail.body.html, undefined); }
  assert.deepEqual(applicationMail.body.reply_to, ["ana.pro@example.invalid"]);
  for (const expected of [/Ana Profesional/, /Chile/, /video-editing, seo/, /hourly · 25 USD/, /portfolio\.example\.invalid/, /<script>alert\(1\)<\/script>/, new RegExp(applicationId), /professional_applications/]) assert.match(applicationMail.body.text, expected);
  for (const expected of [/Beto Cliente/, /Categoría: audiovisual/, /100000\.00 ARS/, /Fecha deseada: 2026-12-20/, /\+54 9 11 5555 5555/]) assert.match(inquiryMail.body.text, expected);
  assert.doesNotMatch(applicationMail.body.subject + inquiryMail.body.subject, /Ana|Beto|Chile/, "no visitor value in subjects");
  const finishes = api.calls.filter(call => /finish_(project|professional)_notification/.test(call.url));
  assert.deepEqual(finishes.map(call => call.body), [{ p_request_id: requestId, p_sent: true }, { p_application_id: applicationId, p_sent: true }]);
});
test("a failed email keeps the application retryable and the response signals it", async () => {
  const api = worker({ requests: [], emailOk: false }); const response = await api.run(); assert.equal(response.status, 503);
  assert.deepEqual(api.calls.find(call => call.url.includes("finish_professional_notification")).body, { p_application_id: applicationId, p_sent: false });
});
test("a broken application queue (migration not applied yet) never blocks client notifications", async () => {
  const api = worker({ applicationClaimStatus: 404 }); const response = await api.run();
  assert.equal(response.status, 503); assert.equal((await response.json()).code, "queue_unavailable");
  assert.ok(api.calls.some(call => call.url.includes("api.resend.com") && call.body.subject === "Nueva consulta en Cotivanta"), "the inquiry was still emailed");
  assert.equal(api.calls.find(call => call.url.includes("finish_project_notification")).body.p_sent, true);
});
test("an application whose record cannot be loaded sends nothing and is released for retry", async () => {
  const calls = []; const env = { NOTIFICATION_JOB_SECRET: "synthetic-job-secret-with-at-least-32-characters", SUPABASE_URL: "https://example.invalid", SUPABASE_SECRET_KEY: "synthetic", RESEND_API_KEY: "synthetic", NOTIFICATION_FROM: "a@example.invalid", NOTIFICATION_TO: "b@example.invalid", ADMIN_URL: "https://example.invalid/admin.html" };
  const handler = makeWorker({ get: name => env[name] }, async (url, options) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    if (url.includes("/rest/v1/professional_applications")) return Response.json([]);
    if (url.includes("claim_professional_notifications")) return Response.json([{ application_id: applicationId }]);
    if (url.includes("claim_project_notifications")) return Response.json([]);
    return new Response(null, { status: 204 });
  });
  const response = await handler(new Request("https://example.invalid", { method: "POST", headers: { authorization: `Bearer ${env.NOTIFICATION_JOB_SECRET}` } }));
  assert.equal(response.status, 503); assert.equal(calls.some(call => call.url.includes("resend")), false); assert.equal(calls.find(call => call.url.includes("finish_professional")).body.p_sent, false);
});
