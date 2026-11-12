// Portada de la agencia: estructura, textos bilingües, accesibilidad estática y seguridad del HTML.
const test = require("node:test");
const assert = require("node:assert/strict");
const { read, vm } = require("./helpers.cjs");
const html = read("site/index.html");
const plain = value => JSON.parse(JSON.stringify(value));

function dictionaries() {
  const source = read("site/assets/app.js");
  const start = source.indexOf("const translations = {"), end = source.indexOf("// Textos de la versión «agencia»");
  assert.ok(start > 0 && end > start, "app.js translations block not found");
  const context = { window: {}, out: null };
  vm.runInNewContext(read("site/assets/agency-copy.js"), context);
  vm.runInNewContext(`${source.slice(start, end)}\nObject.assign(translations.es, window.COTIVANTA_COPY.es); Object.assign(translations.en, window.COTIVANTA_COPY.en); out = translations;`, context);
  return plain(context.out);
}
const attr = name => [...html.matchAll(new RegExp(`\\b${name}="([^"]+)"`, "g"))].map(match => match[1]);

test("the page follows the requested structure, in order", () => {
  const order = ['class="site-header"', 'class="hero section-dark"', 'id="services"', 'id="process"', 'id="work"', 'id="apply"', 'id="faq"', 'id="request"', "<footer"].map(marker => html.indexOf(marker));
  assert.ok(order.every(index => index > 0), `missing section: ${order}`);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
});
test("hero exposes both journeys with clear calls to action", () => {
  const hero = html.slice(html.indexOf('class="hero section-dark"'), html.indexOf('id="proof"'));
  assert.match(hero, /href="#request"[^>]*>\s*<span data-i18n="heroCta">Quiero contratar un servicio/);
  assert.match(hero, /href="#work"[^>]*>\s*<span data-i18n="heroWork">Quiero trabajar con Cotivanta/);
});
test("the home page links neither to the admin panel nor to anything private", () => {
  assert.doesNotMatch(html, /admin.html|href="[^"]*admin/i);
  assert.doesNotMatch(html, /service_role|sb_secret|SECRET/);
});
test("static category fallback lists exactly the catalog categories (no-JS and search engines)", () => {
  const context = { window: {} }; vm.runInNewContext(read("site/assets/catalog.js"), context);
  const fallback = [...html.match(/<ul class="category-fallback">([\s\S]*?)<\/ul>/)[1].matchAll(/<li>([^<]+)<\/li>/g)].map(match => match[1]);
  assert.deepEqual(fallback, plain(context.window.COTIVANTA_CATALOG.categories.map(category => category.es.name)));
});
test("every translated key used by the page exists in Spanish and English, and English really is translated", () => {
  const { es, en } = dictionaries();
  const keys = new Set([...attr("data-i18n"), ...attr("data-i18n-aria"), ...attr("data-placeholder")]);
  const sameInBoth = new Set(["engineIdea", "engineVideo", "engineMarketing", "pill3", "pill4", "engineVideoName", "engineMarketingName"]);
  for (const key of keys) {
    assert.equal(typeof es[key], "string", `missing ES key: ${key}`);
    assert.equal(typeof en[key], "string", `missing EN key: ${key}`);
    if (!sameInBoth.has(key)) assert.notEqual(en[key], es[key], `EN not translated: ${key}`);
  }
});
test("new agency copy is complete in both languages with the same keys", () => {
  const context = { window: {} }; vm.runInNewContext(read("site/assets/agency-copy.js"), context);
  const copy = plain(context.window.COTIVANTA_COPY);
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort());
  for (const key of Object.keys(copy.es)) assert.ok(copy.es[key].trim() && copy.en[key].trim(), `empty copy: ${key}`);
});
test("the FAQ answers the required questions honestly and promises nothing", () => {
  const { es } = dictionaries();
  for (const index of [1, 2, 3, 4, 5, 6, 7, 8]) assert.ok(es[`faq${index}Q`] && es[`faq${index}A`]);
  assert.match(es.faq8A, /^No\./); assert.match(es.faq8A, /no implica una contratación/);
  assert.match(es.faq3A, /no publicamos precios fijos/);
  assert.match(es.faq4A, /profesionales independientes/);
  const everything = Object.values(es).join(" ");
  assert.doesNotMatch(everything, /garantizamos|100\s?%|resultados asegurados|en 24 horas|en 48 horas|testimonio de/i, "no guarantees or invented proof");
});
test("no invented testimonials, ratings or case studies on the page", () => {
  assert.doesNotMatch(html, /testimonial|★|⭐|casos? de éxito|calificaci/i);
});
test("the page is CSP-safe: no inline styles, inline scripts or event-handler attributes", () => {
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i);
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attributes)) assert.equal(body.trim(), "");
    else { assert.match(attributes, /application\/ld\+json/); JSON.parse(body); }
  }
});
test("every script and stylesheet the page loads exists and agency scripts load in a safe order", () => {
  const scripts = [...html.matchAll(/<script defer src="([^"?]+)/g)].map(match => match[1]);
  assert.deepEqual(scripts, ["assets/catalog.js", "assets/agency-copy.js", "config.js", "assets/http.js", "assets/agency.js", "assets/app.js", "assets/professional.js"]);
  assert.match(html, /href="assets\/agency\.css/);
});
test("form labels, descriptions and group names point to existing elements", () => {
  const ids = new Set(attr("id"));
  for (const target of attr("for")) assert.ok(ids.has(target), `label for missing id ${target}`);
  for (const list of [...attr("aria-labelledby"), ...attr("aria-describedby")]) for (const target of list.split(/\s+/)) assert.ok(ids.has(target), `aria reference to missing id ${target}`);
  assert.equal(ids.size, attr("id").length, "duplicate ids");
});
test("client form has the requested fields and the 'budget unknown' option", () => {
  for (const id of ["category", "service", "description", "budget", "budget-currency", "budget-amount", "timeline", "deadline", "name", "email", "whatsapp", "consent", "fax_number"]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /<option value="unsure"[^>]*>Todavía no lo sé/);
  for (const required of ["category", "service", "description", "name", "email", "consent"]) assert.match(html.match(new RegExp(`<(?:input|select|textarea)[^>]*id="${required}"[^>]*>`))[0], /\brequired\b/, required);
  for (const optional of ["whatsapp", "deadline", "organization", "client-type"]) assert.doesNotMatch(html.match(new RegExp(`<(?:input|select|textarea)[^>]*id="${optional}"[^>]*>`))[0], /\brequired\b/, optional);
});
test("professional form asks for the requested data and nothing sensitive", () => {
  const form = html.match(/<form\s+id="pro-form"[\s\S]*?<\/form>/)[0];
  for (const id of ["pro-name", "pro-email", "pro-country", "pro-city", "pro-whatsapp", "pro-specialties", "pro-other-specialty", "pro-experience", "pro-years", "pro-portfolio", "pro-linkedin", "pro-links", "pro-languages", "pro-availability", "pro-rate-model", "pro-rate-amount", "pro-currency", "pro-consent", "pro-fax", "pro-turnstile"]) assert.match(form, new RegExp(`id="${id}"`), id);
  for (const required of ["pro-name", "pro-email", "pro-country", "pro-experience", "pro-portfolio", "pro-availability", "pro-rate-model", "pro-currency", "pro-consent"]) assert.match(form.match(new RegExp(`<(?:input|select|textarea)[^>]*id="${required}"[^>]*>`))[0], /\brequired\b/, required);
  for (const optional of ["pro-city", "pro-whatsapp", "pro-years", "pro-linkedin", "pro-links", "pro-rate-amount", "pro-other-specialty"]) assert.doesNotMatch(form.match(new RegExp(`<(?:input|select|textarea)[^>]*id="${optional}"[^>]*>`))[0], /\brequired\b/, optional);
  assert.doesNotMatch(form, /type="password"|name="(?:dni|cuit|cuil|cbu|card|iban|password|passport|ssn)/i);
  assert.match(form, /<fieldset id="pro-fields" disabled>/, "fail-closed without JavaScript");
  assert.match(form.match(/<button[^>]*id="pro-submit"[^>]*>/)[0], /\bdisabled\b/);
  assert.match(form, /action="index\.html#apply"/); assert.match(form, /method="post"/);
  const input = form.match(/<input\s+id="pro-consent"[^>]*>/)[0]; assert.match(input, /\brequired\b/); assert.doesNotMatch(input, /\bchecked\b/);
});
test("both forms carry the same privacy version as the policy page and the intake function", () => {
  const version = read("supabase/functions/project-request/handler.ts").match(/PRIVACY_VERSION = "([^"]+)"/)[1];
  assert.deepEqual([...html.matchAll(/data-privacy-version="([^"]+)"/g)].map(match => match[1]), [version, version]);
  assert.equal(read("site/privacy.html").match(/name="privacy-version"\s+content="([^"]+)"/)[1], version);
  assert.ok(read("site/privacy/2026-10-30.1-draft.txt").includes("ARCHIVO HISTÓRICO"), "previous policy text is archived");
  assert.match(read("site/privacy.html"), new RegExp(`privacy/2026-10-30.1-draft.txt`));
});
test("the professional section states plainly that applying guarantees nothing", () => {
  const { es, en } = dictionaries();
  for (const text of [es.proFootnote, es.proSuccessDesc, es.applyDesc]) assert.match(text, /oportunidad compatible/);
  assert.match(es.proFootnote, /no implica una contratación ni garantiza/); assert.match(en.proFootnote, /does not mean you are hired or guarantee/);
  assert.match(es.workPoint3, /no garantiza/);
});
test("public config exposes only public values and the professional switch", () => {
  const context = { window: {} }; vm.runInNewContext(read("site/config.js"), context);
  const config = plain(context.window.COTIVANTA_CONFIG);
  assert.equal(typeof config.professionalApplicationsEnabled, "boolean");
  assert.match(config.apiUrl, /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/project-request$/);
  assert.match(read("site/_headers"), new RegExp(config.apiUrl.match(/^https:\/\/[^/]+/)[0].replace(/\./g, "\\.")), "CSP connect-src allows the API host");
  assert.doesNotMatch(read("site/config.js"), /sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}.|re_[A-Za-z0-9]{20,}/);
});
