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
const fill = `for (const [id,value] of Object.entries({name:'Prueba Sintética',email:'audit@example.invalid',description:'Consulta sintética para pruebas locales.', 'client-type':'individual',service:'website'})) document.getElementById(id).value=value; document.getElementById('consent').checked=true;`;
const sent = page => page.requests.filter(request => request.url.includes("functions/v1/project-request"));
test("failed app script cannot submit visitor data into URL", async () => {
  const page = await browser.page(base, "/", { noApp: true });
  const state = await page.evaluate(`(()=>{${fill} const f=document.getElementById('project-form'); f.requestSubmit(); return {method:f.method,disabled:document.getElementById('request-fields').disabled,query:location.search,success:!document.getElementById('form-success').hidden}})()`);
  assert.equal(state.method, "post"); assert.equal(state.disabled, true); assert.equal(state.query, ""); assert.equal(state.success, false); assert.equal(sent(page).length, 0);
  await page.close();
});
test("intake is visibly disabled by default and loads no captcha", async () => {
  const page = await browser.page(base);
  assert.equal(await page.evaluate("document.getElementById('request-fields').disabled"), true);
  assert.equal(await page.evaluate("document.getElementById('intake-status').checkVisibility()"), true);
  assert.equal(page.requests.some(request => request.url.includes("cloudflare")), false);
  assert.equal(await page.evaluate("document.getElementById('client-count').textContent"), "—");
  assert.equal(page.errors.length, 0); await page.close();
});
test("real browser rejects whitespace and missing consent before any POST", async () => {
  const page = await browser.page(base, "/", { enabled: true });
  await page.wait("!document.getElementById('request-fields').disabled");
  await page.evaluate(`(()=>{${fill} document.getElementById('name').value='  ';document.getElementById('project-form').requestSubmit()})()`);
  assert.equal(sent(page).length, 0); assert.ok(await page.evaluate("document.getElementById('name').validationMessage.length>0"));
  await page.evaluate(`(()=>{${fill} document.getElementById('consent').checked=false;document.getElementById('project-form').requestSubmit()})()`);
  assert.equal(sent(page).length, 0); await page.close();
});
test("successful receipt has reference, moves focus and preserves privacy link in a new tab", async () => {
  const page = await browser.page(base, "/", { enabled: true });
  await page.wait("typeof window.__captcha==='function'");
  assert.equal(await page.evaluate("document.querySelector('.consent-label a').target"), "_blank");
  await page.evaluate(`(()=>{${fill} document.getElementById('project-form').requestSubmit()})()`);
  await page.wait("!document.getElementById('form-success').hidden");
  assert.equal(await page.evaluate("document.activeElement.id"), "form-success");
  assert.match(await page.evaluate("document.getElementById('request-reference').textContent"), /11111111/);
  assert.equal(sent(page).length, 1); assert.equal(page.errors.length, 0); await page.close();
});
test("lost reply preserves draft and reuses the same submission key", async () => {
  const page = await browser.page(base, "/", { enabled: true, dropFirst: true });
  await page.wait("typeof window.__captcha==='function'");
  await page.evaluate(`(()=>{${fill} document.getElementById('project-form').requestSubmit()})()`);
  await page.wait("document.getElementById('project-form').getAttribute('aria-busy')==='false' && !document.getElementById('form-message').hidden");
  assert.equal(await page.evaluate("document.getElementById('name').value"), "Prueba Sintética");
  await page.evaluate("document.getElementById('project-form').requestSubmit()"); await page.wait("!document.getElementById('form-success').hidden");
  const posts = sent(page).map(request => JSON.parse(request.postData)); assert.equal(posts.length, 2); assert.equal(posts[0].submissionKey, posts[1].submissionKey); assert.equal(page.receipts.size, 1);
  await page.close();
});
test("English labels and native privacy disclosure work with keyboard", async () => {
  const page = await browser.page(base);
  await page.evaluate("document.querySelector('[data-lang=en]').click()");
  assert.equal(await page.evaluate("document.getElementById('name').placeholder"), "Your name");
  assert.equal(await page.evaluate("document.getElementById('organization').placeholder"), "Your brand");
  assert.equal(await page.evaluate("document.getElementById('menu-toggle').getAttribute('aria-label')"), "Open menu");
  assert.equal(await page.evaluate("document.querySelector('#budget option[value=under-500]').textContent"), "Under US$500");
  await page.evaluate("document.querySelector('.legal-disclosure summary').focus()"); await page.key("Enter");
  assert.equal(await page.evaluate("document.querySelector('.legal-disclosure').open"), true); await page.close();
});
for (const route of ["/privacy.html", "/policies.html"]) {
  for (const mobile of [false, true]) {
    test(`${route} switches the full legal page with ES/EN (${mobile ? "mobile" : "desktop"})`, async () => {
      const page = await browser.page(base, route, { mobile });
      try {
        assert.equal(await page.evaluate("document.documentElement.lang === (navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es')"), true);
        await page.evaluate("document.querySelector('[data-lang=es]').click()");
        const spanish = await page.evaluate(`({
          blocks: [...document.querySelectorAll('[data-i18n]')].map(el => el.innerHTML),
          ids: [...document.querySelectorAll('[id]')].map(el => el.id).sort(),
          title: document.title,
          description: document.querySelector('meta[name=description]').content
        })`);
        await page.evaluate("document.querySelector('[data-lang=en]').focus()");
        await page.key("Enter");
        assert.equal(await page.evaluate("document.documentElement.lang"), "en");
        assert.match(await page.evaluate("document.title"), /\(draft\)/);
        assert.equal(await page.evaluate("document.querySelector('[data-lang=en]').getAttribute('aria-pressed')"), "true");
        assert.equal(await page.evaluate("document.querySelector('[data-lang=es]').classList.contains('is-active')"), false);
        assert.equal(await page.evaluate("document.querySelector('.lang-switch').getAttribute('aria-label')"), "Language");
        assert.equal(await page.evaluate("document.querySelector('.footer-nav').getAttribute('aria-label')"), "Footer links");
        const english = await page.evaluate("[...document.querySelectorAll('[data-i18n]')].map(el => el.innerHTML)");
        assert.equal(english.length, spanish.blocks.length);
        english.forEach((block, index) => assert.notEqual(block, spanish.blocks[index], `untranslated block ${index}`));
        assert.deepEqual(await page.evaluate("[...document.querySelectorAll('[id]')].map(el => el.id).sort()"), spanish.ids);
        assert.equal(await page.evaluate("[...document.querySelectorAll('[aria-labelledby]')].every(el => el.getAttribute('aria-labelledby').split(' ').every(id => document.getElementById(id)))"), true);
        assert.equal(await page.evaluate("[...document.querySelectorAll('a[href^=\"#\"]')].every(el => document.getElementById(el.hash.slice(1)))"), true);
        assert.equal(await page.evaluate("document.querySelector('meta[name=robots]').content"), "noindex, follow");
        assert.equal(await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
        assert.equal(await page.evaluate("[...document.querySelectorAll('.lang-btn')].every(el => el.checkVisibility())"), true);
        await page.evaluate("document.querySelector('[data-lang=es]').focus()");
        await page.key("Enter");
        assert.equal(await page.evaluate("document.documentElement.lang"), "es");
        assert.equal(await page.evaluate("document.querySelector('[data-lang=es]').getAttribute('aria-pressed')"), "true");
        assert.deepEqual(await page.evaluate("[...document.querySelectorAll('[data-i18n]')].map(el => el.innerHTML)"), spanish.blocks);
        assert.equal(await page.evaluate("document.title"), spanish.title);
        assert.equal(await page.evaluate("document.querySelector('meta[name=description]').content"), spanish.description);
        assert.equal(await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
        assert.equal(await page.evaluate("localStorage.length + sessionStorage.length"), 0);
        assert.equal(await page.evaluate("document.cookie"), "");
        assert.equal(page.requests.length, 0);
        assert.equal(page.errors.length, 0);
      } finally {
        await page.close();
      }
    });
  }
}
test("admin requires MFA and renders hostile inquiry content as plain text", async () => {
  const page = await browser.page(base, "/admin.html");
  await page.evaluate("document.getElementById('admin-email').value='audit@example.invalid';document.getElementById('admin-password').value='synthetic';document.getElementById('login-form').requestSubmit()");
  await page.wait("!document.getElementById('mfa-form').hidden");
  assert.equal(page.requests.some(request => request.url.includes("project_requests")), false);
  assert.equal(await page.evaluate("document.getElementById('settings-form').hidden"), true);
  await page.evaluate("document.getElementById('mfa-code').value='123456';document.getElementById('mfa-form').requestSubmit()");
  await page.wait("document.querySelectorAll('.inquiry-card').length===1");
  assert.equal(await page.evaluate("document.querySelector('.inquiry-card h3').textContent"), '<img src=x onerror="window.__xss=true">');
  assert.equal(await page.evaluate("document.querySelectorAll('.inquiry-card img,.inquiry-card script').length"), 0);
  assert.equal(await page.evaluate("window.__xss===true"), false);
  await page.evaluate("document.getElementById('logout').click()"); await page.wait("document.getElementById('settings-form').hidden");
  assert.equal(await page.evaluate("document.getElementById('request-list').childElementCount"), 0); assert.equal(page.errors.length, 0); await page.close();
});
test("admin scripts failing leaves credential controls disabled", async () => {
  const page = await browser.page(base, "/admin.html", { noAdmin: true });
  assert.equal(await page.evaluate("document.getElementById('admin-login-fields').disabled"), true); assert.equal(page.requests.length, 0); await page.close();
});
test("mobile layout has no horizontal overflow and disclosure starts closed", async () => {
  const page = await browser.page(base, "/", { mobile: true });
  assert.equal(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
  assert.equal(await page.evaluate("document.querySelector('.legal-disclosure').open"), false); assert.equal(page.errors.length, 0); await page.close();
});
test("server sends CSP and refuses POSTs and private paths", async () => {
  const response = await fetch(base); assert.match(response.headers.get("content-security-policy"), /form-action 'none'/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await fetch(base + "/", { method: "POST", body: "synthetic" })).status, 405);
  assert.equal((await fetch(base + "/.git/config")).status, 404); assert.equal((await fetch(base + "/_headers")).status, 404);
});
