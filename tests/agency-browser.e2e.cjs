// Recorridos de la agencia en un navegador real: categorías, formulario de clientes ampliado,
// postulación de profesionales, idioma, teclado y móvil. Toda petición externa está interceptada.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch } = require("./browser-driver.cjs");
const { createSiteServer } = require("../scripts/serve.cjs");
let browser, server, base;
before(async () => {
  server = await createSiteServer(); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`; browser = await launch();
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

const posts = page => page.requests.filter(request => request.url.includes("functions/v1/project-request")).map(request => JSON.parse(request.postData));
const clientPosts = page => posts(page).filter(body => body.form !== "professional-application");
const proPosts = page => posts(page).filter(body => body.form === "professional-application");
// Helpers que se ejecutan dentro de la página.
const helpers = `const set=(id,value)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}; const tick=(selector)=>{const e=document.querySelector(selector);e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))};`;
// Cada evaluación corre en su propio ámbito para poder redeclarar los ayudantes.
const inPage = code => `(()=>{${helpers} ${code}})()`;
const clientFill = `${helpers} set('category','tech'); set('service','website'); set('name','Prueba Sintética'); set('email','audit@example.invalid'); set('description','Consulta sintética para pruebas locales.'); document.getElementById('consent').checked=true;`;
const proFill = `${helpers} set('pro-name','Profesional Sintético'); set('pro-email','pro@example.invalid'); set('pro-country','Argentina'); tick('#pro-specialties input[value=video-editing]'); tick('#pro-languages input[value=es]'); set('pro-experience','Editor de video con experiencia sintética en piezas de prueba.'); set('pro-portfolio','portfolio.example.invalid/trabajo'); set('pro-availability','part-time'); set('pro-rate-model','per-project'); set('pro-currency','ARS'); document.getElementById('pro-consent').checked=true;`;
const ready = async (page, fieldsId) => { await page.wait(`!document.getElementById('${fieldsId}').disabled`); };
const openPro = async (options = {}) => {
  const page = await browser.page(base, "/", { enabled: true, ...options });
  await ready(page, "pro-fields");
  await page.evaluate("document.getElementById('pro-name').focus()");
  await page.wait("typeof window.__captchaPro==='function'");
  return page;
};

/* ---------- Portada y categorías ---------- */
test("hero offers both journeys, nothing links to the admin panel and the engine demo follows the chosen category", async () => {
  const page = await browser.page(base);
  assert.equal(await page.evaluate("document.querySelector('.hero-actions a[href=\"#request\"]').textContent.trim().startsWith('Quiero contratar un servicio')"), true);
  assert.equal(await page.evaluate("document.querySelector('.hero-actions a[href=\"#work\"]').textContent.trim().startsWith('Quiero trabajar con Cotivanta')"), true);
  assert.equal(await page.evaluate("document.querySelectorAll('a[href*=\"admin\"]').length"), 0);
  await page.evaluate("document.querySelector('[data-engine=design]').click()");
  assert.equal(await page.evaluate("document.querySelector('.output-name').textContent"), "DISEÑO");
  assert.equal(await page.evaluate("document.querySelector('[data-engine=design]').getAttribute('aria-pressed')"), "true");
  assert.equal(page.errors.length, 0); assert.equal(page.requests.some(request => request.url.includes("cloudflare")), false); await page.close();
});
test("every catalog category is rendered as a card with its services, and the open category is last", async () => {
  const page = await browser.page(base);
  assert.equal(await page.evaluate("document.querySelectorAll('#category-grid .service-card').length"), 6);
  assert.equal(await page.evaluate("document.querySelectorAll('#category-grid .service-chip').length"), await page.evaluate("COTIVANTA_CATALOG.categories.reduce((total,c)=>total+c.services.length,0)"));
  assert.equal(await page.evaluate("document.querySelector('#category-grid .service-card:last-child').classList.contains('service-card-alt')"), true);
  assert.equal(await page.evaluate("document.querySelector('.category-fallback')"), null, "the no-JS fallback is replaced");
  assert.equal(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"), true); assert.equal(page.errors.length, 0); await page.close();
});
test("a service chip preselects category and service and moves focus to the description; the open card selects 'custom'", async () => {
  const page = await browser.page(base, "/", { enabled: true }); await ready(page, "request-fields");
  await page.evaluate("document.querySelector('#category-grid .service-chip[data-service=video-editing]').click()");
  assert.deepEqual(await page.evaluate("[document.getElementById('category').value,document.getElementById('service').value,document.activeElement.id]"), ["audiovisual", "video-editing", "description"]);
  await page.evaluate("document.querySelector('#category-grid .service-card[data-category=marketing] .service-choose').click()");
  assert.deepEqual(await page.evaluate("[document.getElementById('category').value,document.getElementById('service').value,document.activeElement.id]"), ["marketing", "", "service"]);
  await page.evaluate("document.querySelector('#category-grid .service-card-alt .service-choose').click()");
  assert.deepEqual(await page.evaluate("[document.getElementById('category').value,document.getElementById('service').value,document.activeElement.id]"), ["other", "other", "description"]);
  assert.equal(page.errors.length, 0); await page.close();
});

/* ---------- Formulario de clientes ---------- */
test("service options follow the category, always end with the custom option, and the budget fields appear only when needed", async () => {
  const page = await browser.page(base, "/", { enabled: true }); await ready(page, "request-fields");
  await page.evaluate(inPage(`set('category','audiovisual')`));
  const options = await page.evaluate("[...document.querySelectorAll('#service option')].map(o=>o.value)");
  assert.ok(options.includes("video-editing") && options.includes("photography") && !options.includes("website")); assert.equal(options.at(-1), "other");
  await page.evaluate(inPage(`set('category','business')`));
  assert.equal(await page.evaluate("[...document.querySelectorAll('#service option')].some(o=>o.value==='video-editing')"), false);
  assert.equal(await page.evaluate("document.getElementById('budget-amount-row').checkVisibility()"), false);
  assert.equal(await page.evaluate("document.getElementById('budget').value"), "unsure");
  await page.evaluate(inPage(`set('budget','amount')`));
  assert.equal(await page.evaluate("document.getElementById('budget-amount-row').checkVisibility()"), true);
  assert.equal(await page.evaluate("document.getElementById('budget-amount').required && document.getElementById('budget-currency').required"), true);
  assert.deepEqual(await page.evaluate("[...document.querySelectorAll('#budget-currency option')].map(o=>o.value)"), ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "MXN", "COP"]);
  await page.evaluate(inPage(`set('budget','unsure')`));
  assert.equal(await page.evaluate("document.getElementById('budget-amount-row').checkVisibility() || document.getElementById('budget-amount').required"), false);
  assert.equal(page.errors.length, 0); await page.close();
});
test("language switch re-renders cards and selects without losing the visitor's choices", async () => {
  const page = await browser.page(base, "/", { enabled: true }); await ready(page, "request-fields");
  await page.evaluate(inPage(`set('category','audiovisual'); set('service','photography'); set('name','Prueba Sintética')`));
  await page.evaluate("document.querySelector('[data-lang=en]').click()");
  assert.equal(await page.evaluate("document.querySelector('#category option[value=audiovisual]').textContent"), "Audiovisual production");
  assert.equal(await page.evaluate("document.querySelector('#service option[value=photography]').textContent"), "Photography");
  assert.deepEqual(await page.evaluate("[document.getElementById('category').value,document.getElementById('service').value,document.getElementById('name').value]"), ["audiovisual", "photography", "Prueba Sintética"]);
  assert.equal(await page.evaluate("document.querySelector('#category-grid .service-card h3').textContent"), "Technology & development");
  assert.equal(await page.evaluate("document.querySelector('#category-grid .service-card-alt .service-choose').textContent"), "Tell us what you need ↗");
  assert.equal(await page.evaluate("document.querySelector('#budget option[value=unsure]').textContent"), "Not sure yet");
  await page.evaluate("document.querySelector('[data-lang=es]').click()");
  assert.equal(await page.evaluate("document.querySelector('#category option[value=audiovisual]').textContent"), "Producción audiovisual");
  assert.equal(await page.evaluate("document.getElementById('service').value"), "photography"); assert.equal(page.errors.length, 0); await page.close();
});
test("client request with an approximate budget sends category, amount, currency, date and WhatsApp", async () => {
  const page = await browser.page(base, "/", { enabled: true }); await ready(page, "request-fields");
  await page.wait("typeof window.__captcha==='function'");
  await page.evaluate(`(()=>{${clientFill} set('budget','amount'); set('budget-amount','100000'); set('budget-currency','ARS'); set('whatsapp','+54 9 11 5555 5555'); set('deadline','2099-01-01'); document.getElementById('project-form').requestSubmit()})()`);
  await page.wait("!document.getElementById('form-success').hidden");
  const body = clientPosts(page)[0];
  assert.deepEqual([body.form, body.category, body.service, body.budget, body.budgetAmount, body.budgetCurrency, body.whatsapp, body.desiredDate], ["project-request", "tech", "website", "amount", 100000, "ARS", "+54 9 11 5555 5555", "2099-01-01"]);
  assert.match(await page.evaluate("document.getElementById('request-reference').textContent"), /11111111/);
  assert.equal(proPosts(page).length, 0); assert.equal(page.errors.length, 0); await page.close();
});
test("'I don't know the budget yet' sends no amount or currency", async () => {
  const page = await browser.page(base, "/", { enabled: true }); await ready(page, "request-fields"); await page.wait("typeof window.__captcha==='function'");
  await page.evaluate(`(()=>{${clientFill} document.getElementById('project-form').requestSubmit()})()`); await page.wait("!document.getElementById('form-success').hidden");
  const body = clientPosts(page)[0]; assert.equal(body.budget, "unsure"); assert.equal(body.budgetAmount, undefined); assert.equal(body.budgetCurrency, undefined);
  assert.equal(body.whatsapp, ""); assert.equal(body.desiredDate, ""); await page.close();
});
test("client form blocks an amount-less budget, an invalid WhatsApp, a past deadline and a missing category", async () => {
  const page = await browser.page(base, "/", { enabled: true }); await ready(page, "request-fields"); await page.wait("typeof window.__captcha==='function'");
  const attempt = async extra => { await page.evaluate(`(()=>{${clientFill} ${extra}; document.getElementById('project-form').requestSubmit()})()`); };
  await attempt("set('budget','amount')"); assert.equal(await page.evaluate("document.getElementById('budget-amount').validationMessage.length>0"), true);
  await attempt("set('whatsapp','not a phone')"); assert.equal(await page.evaluate("document.getElementById('whatsapp').validationMessage.length>0"), true);
  await attempt("set('whatsapp',''); set('deadline','2001-01-01')"); assert.equal(await page.evaluate("document.getElementById('deadline').validationMessage.length>0"), true);
  await attempt("set('deadline',''); set('category','')"); assert.equal(await page.evaluate("document.getElementById('category').validity.valueMissing"), true);
  assert.equal(clientPosts(page).length, 0); await page.close();
});

/* ---------- Postulación de profesionales ---------- */
test("professional form is visibly disabled by default, offers specialties by category and loads no captcha", async () => {
  const page = await browser.page(base);
  assert.equal(await page.evaluate("document.getElementById('pro-fields').disabled && document.getElementById('pro-submit').disabled"), true);
  assert.equal(await page.evaluate("document.getElementById('pro-intake-status').checkVisibility()"), true);
  assert.equal(await page.evaluate("document.querySelectorAll('#pro-specialties .spec-group').length"), 5);
  assert.equal(await page.evaluate("document.querySelectorAll('#pro-specialties input[type=checkbox]').length"), await page.evaluate("COTIVANTA_CATALOG.categories.reduce((total,c)=>total+c.services.length,0)"));
  assert.equal(await page.evaluate("document.querySelectorAll('#pro-languages input').length"), 7);
  assert.equal(page.requests.some(request => request.url.includes("cloudflare")), false); assert.equal(page.errors.length, 0); await page.close();
});
test("a professional can apply: URL is normalized, receipt shown with focus, nothing sent to the client endpoint path", async () => {
  const page = await openPro();
  await page.evaluate(`(()=>{${proFill} document.getElementById('pro-form').requestSubmit()})()`);
  await page.wait("!document.getElementById('pro-success').hidden");
  assert.equal(await page.evaluate("document.activeElement.id"), "pro-success");
  assert.match(await page.evaluate("document.getElementById('pro-reference').textContent"), /22222222/);
  const [body] = proPosts(page); assert.equal(proPosts(page).length, 1); assert.equal(clientPosts(page).length, 0);
  assert.deepEqual([body.fullName, body.country, body.specialties, body.languages, body.portfolioUrl, body.availability, body.rateModel, body.rateCurrency, body.consent, body.language], ["Profesional Sintético", "Argentina", ["video-editing"], ["es"], "https://portfolio.example.invalid/trabajo", "part-time", "per-project", "ARS", true, "es"]);
  assert.match(body.submissionKey, /^[0-9a-f-]{36}$/); assert.equal(body.turnstileToken, "synthetic"); assert.equal(body.faxNumber, "");
  assert.equal(body.yearsExperience, undefined); assert.equal(body.rateAmount, undefined);
  assert.equal(await page.evaluate("document.getElementById('pro-form').hidden"), true); assert.equal(page.errors.length, 0); await page.close();
});
test("invalid professional forms never reach the network and explain the problem", async () => {
  const page = await openPro();
  const attempt = async extra => { await page.evaluate(`(()=>{${proFill} ${extra}; document.getElementById('pro-form').requestSubmit()})()`); };
  const bad = id => page.evaluate(`document.getElementById('${id}').validationMessage.length>0`);
  await attempt("document.querySelector('#pro-specialties input[value=video-editing]').checked=false; document.querySelector('#pro-specialties input[value=video-editing]').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await page.evaluate("document.querySelector('#pro-specialties input').validationMessage.length>0"), true);
  assert.equal(await page.evaluate("document.querySelector('#pro-specialties details').open"), true, "the group with the error opens so it is visible");
  assert.equal(await page.evaluate("document.getElementById('pro-message').hidden"), false);
  await attempt("set('pro-other-specialty','Locución'); "); // una especialidad escrita a mano alcanza
  await page.wait("!document.getElementById('pro-success').hidden"); assert.equal(proPosts(page).length, 1); await page.close();
  const second = await openPro();
  const run = async extra => { await second.evaluate(`(()=>{${proFill} ${extra}; document.getElementById('pro-form').requestSubmit()})()`); };
  const invalid = id => second.evaluate(`document.getElementById('${id}').validationMessage.length>0`);
  await run("set('pro-portfolio','http://insecure.example.invalid/x')"); assert.equal(await invalid("pro-portfolio"), true);
  await run("set('pro-portfolio','not a url at all')"); assert.equal(await invalid("pro-portfolio"), true);
  await run("set('pro-linkedin','https://evil.example.invalid/in/x')"); assert.equal(await invalid("pro-linkedin"), true);
  await run("set('pro-linkedin',''); set('pro-links','https://a.example.invalid\\nhttps://b.example.invalid\\nhttps://c.example.invalid\\nhttps://d.example.invalid\\nhttps://e.example.invalid\\nhttps://f.example.invalid')"); assert.equal(await invalid("pro-links"), true);
  await run("set('pro-links',''); set('pro-whatsapp','abc')"); assert.equal(await invalid("pro-whatsapp"), true);
  await run("set('pro-whatsapp',''); set('pro-years','99')"); assert.equal(await invalid("pro-years"), true);
  await run("set('pro-years',''); set('pro-rate-amount','-3')"); assert.equal(await invalid("pro-rate-amount"), true);
  await run("set('pro-rate-amount',''); set('pro-experience','corta')"); assert.equal(await invalid("pro-experience"), true);
  await run("set('pro-experience','Editor de video con experiencia sintética en piezas de prueba.'); document.getElementById('pro-consent').checked=false"); assert.equal(await invalid("pro-consent"), true);
  await run("document.getElementById('pro-consent').checked=true; document.querySelector('#pro-languages input[value=es]').checked=false; document.querySelector('#pro-languages input[value=es]').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await second.evaluate("document.querySelector('#pro-languages input').validationMessage.length>0"), true);
  assert.equal(proPosts(second).length, 0, "no invalid submission reached the network"); assert.equal(second.errors.length, 0); await second.close();
});
test("optional professional fields are sent when provided: years, rate, LinkedIn and extra links", async () => {
  const page = await openPro();
  await page.evaluate(`(()=>{${proFill} set('pro-years','7'); set('pro-rate-amount','25.5'); set('pro-linkedin','www.linkedin.com/in/synthetic'); set('pro-links','https://vimeo.com/synthetic, github.com/synthetic'); set('pro-city','Rosario'); set('pro-whatsapp','+54 341 555 0000'); document.getElementById('pro-form').requestSubmit()})()`);
  await page.wait("!document.getElementById('pro-success').hidden");
  const [body] = proPosts(page);
  assert.deepEqual([body.yearsExperience, body.rateAmount, body.linkedinUrl, body.otherLinks, body.city, body.whatsapp], [7, 25.5, "https://www.linkedin.com/in/synthetic", ["https://vimeo.com/synthetic", "https://github.com/synthetic"], "Rosario", "+54 341 555 0000"]);
  await page.close();
});
test("a lost reply keeps the draft and retries with the same key (no duplicate application)", async () => {
  const page = await openPro({ dropFirst: true });
  await page.evaluate(`(()=>{${proFill} document.getElementById('pro-form').requestSubmit()})()`);
  await page.wait("document.getElementById('pro-form').getAttribute('aria-busy')==='false' && !document.getElementById('pro-message').hidden");
  assert.equal(await page.evaluate("document.getElementById('pro-name').value"), "Profesional Sintético"); assert.equal(await page.evaluate("document.getElementById('pro-fields').disabled"), false);
  assert.match(await page.evaluate("document.getElementById('pro-message').textContent"), /reintentar/);
  await page.evaluate("document.getElementById('pro-form').requestSubmit()"); await page.wait("!document.getElementById('pro-success').hidden");
  const sent = proPosts(page); assert.equal(sent.length, 2); assert.equal(sent[0].submissionKey, sent[1].submissionKey); assert.equal(page.receipts.size, 1); await page.close();
});
test("double submit while a request is in flight sends only one application", async () => {
  const page = await openPro();
  await page.evaluate(`(()=>{${proFill} const f=document.getElementById('pro-form'); f.requestSubmit(); f.requestSubmit(); f.requestSubmit()})()`);
  await page.wait("!document.getElementById('pro-success').hidden"); assert.equal(proPosts(page).length, 1); await page.close();
});
test("the professional form is bilingual and keeps choices across a language switch; reset starts a clean application", async () => {
  const page = await openPro();
  await page.evaluate(inPage(`tick('#pro-specialties input[value=seo]'); tick('#pro-languages input[value=en]'); set('pro-name','Ana')`));
  await page.evaluate("document.querySelector('[data-lang=en]').click()");
  assert.equal(await page.evaluate("document.querySelector('#pro-specialties .spec-name').textContent"), "Technology & development");
  assert.equal(await page.evaluate("document.querySelector('label[for=pro-name]').textContent"), "Full name *");
  assert.equal(await page.evaluate("document.querySelector('#pro-languages input[value=en]').parentElement.textContent"), "English");
  assert.equal(await page.evaluate("document.querySelector('#pro-languages input[value=en]').checked && document.querySelector('#pro-specialties input[value=seo]').checked"), true);
  assert.match(await page.evaluate("document.querySelector('#pro-specialties details[data-category=marketing] .spec-count').textContent"), /1 selected/);
  assert.equal(await page.evaluate("document.getElementById('pro-name').value"), "Ana");
  assert.equal(await page.evaluate("document.querySelector('#pro-fields option[value=part-time]').textContent"), "Part time");
  await page.evaluate("document.querySelector('[data-lang=es]').click()");
  assert.match(await page.evaluate("document.querySelector('#pro-specialties details[data-category=marketing] .spec-count').textContent"), /1 elegidas/);
  await page.evaluate(`(()=>{${proFill} document.getElementById('pro-form').requestSubmit()})()`); await page.wait("!document.getElementById('pro-success').hidden");
  await page.evaluate("document.getElementById('pro-reset').click()");
  assert.equal(await page.evaluate("document.getElementById('pro-form').hidden"), false);
  assert.equal(await page.evaluate("document.getElementById('pro-name').value + document.querySelectorAll('#pro-specialties input:checked').length"), "0");
  assert.equal(page.errors.length, 0); await page.close();
});
test("specialty groups open and close with the keyboard and show how many are chosen", async () => {
  const page = await browser.page(base, "/", { enabled: true }); await ready(page, "pro-fields");
  await page.evaluate("document.querySelector('#pro-specialties .spec-group summary').focus()");
  assert.equal(await page.evaluate("document.querySelector('#pro-specialties .spec-group').open"), false);
  await page.key("Enter"); assert.equal(await page.evaluate("document.querySelector('#pro-specialties .spec-group').open"), true);
  await page.evaluate("document.querySelector('#pro-specialties .spec-group input').click()");
  assert.match(await page.evaluate("document.querySelector('#pro-specialties .spec-count').textContent"), /1/);
  assert.equal(page.errors.length, 0); await page.close();
});
test("the two forms keep independent captcha widgets with their own action", async () => {
  const page = await openPro();
  assert.deepEqual(await page.evaluate("Object.values(window.__widgets).map(w=>w.action).sort()"), ["professional_application", "project_request"]);
  await page.close();
});

/* ---------- Móvil y accesibilidad ---------- */
for (const language of ["es", "en"]) test(`mobile layout (${language}): no horizontal overflow, 16px fields, tappable controls and everything reachable`, async () => {
  const page = await browser.page(base, "/", { mobile: true, enabled: true }); await ready(page, "pro-fields");
  if (language === "en") await page.evaluate("document.querySelector('[data-lang=en]').click()");
  await page.evaluate("document.querySelectorAll('#pro-specialties details').forEach(d=>d.open=true); document.getElementById('budget').value='amount'; document.getElementById('budget').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
  assert.equal(await page.evaluate("[...document.querySelectorAll('.form-card input:not([type=checkbox]):not(.hp-field input), .form-card select, .form-card textarea')].filter(e=>e.checkVisibility()).every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)"), true, "iOS does not zoom into fields");
  assert.equal(await page.evaluate("[...document.querySelectorAll('.form-card .btn-submit, .service-chip, .service-choose, .spec-group summary')].filter(e=>e.checkVisibility()).every(e=>e.getBoundingClientRect().height>=32)"), true);
  // (el círculo decorativo de .form-card:before sobresale a propósito y se recorta con overflow:hidden; aquí se miran los elementos reales)
  assert.equal(await page.evaluate("[...document.querySelectorAll('.form-card *')].filter(e=>e.checkVisibility()).every(e=>e.getBoundingClientRect().right<=e.closest('.form-card').getBoundingClientRect().right+1)"), true, "no form content sticks out of its card");
  assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.hero h1')).fontSize.replace('px','')*1<=58"), true);
  assert.equal(await page.evaluate("document.querySelector('#menu-toggle').checkVisibility()"), true);
  await page.evaluate("document.getElementById('menu-toggle').click()");
  assert.equal(await page.evaluate("[...document.querySelectorAll('#nav-links a')].map(a=>a.getAttribute('href')).join()"), "#services,#process,#work,#faq");
  assert.equal(page.errors.length, 0); await page.close();
});
test("desktop layout has no horizontal overflow with every section rendered", async () => {
  const page = await browser.page(base, "/", { enabled: true }); await ready(page, "pro-fields");
  assert.equal(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
  assert.equal(await page.evaluate("[...document.querySelectorAll('main section')].map(s=>s.id).filter(Boolean).join()"), "proof,services,process,work,apply,faq,request");
  assert.equal(page.errors.length, 0); await page.close();
});
test("every in-page navigation target exists and the document language follows the switch", async () => {
  const page = await browser.page(base);
  assert.equal(await page.evaluate("[...document.querySelectorAll('a[href^=\"#\"]')].every(a=>a.hash==='#top'||document.getElementById(a.hash.slice(1)))"), true);
  await page.evaluate("document.querySelector('[data-lang=en]').click()");
  assert.equal(await page.evaluate("document.documentElement.lang"), "en"); assert.match(await page.evaluate("document.title"), /Professional services agency/);
  assert.equal(await page.evaluate("document.querySelector('.hero h1').textContent.trim()"), "We connect your ideas with the right talent to make them real.");
  assert.equal(await page.evaluate("document.querySelector('.footer-nav').getAttribute('aria-label')"), "Footer links");
  await page.close();
});
