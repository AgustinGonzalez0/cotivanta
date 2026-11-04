const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const { runInNewContext } = require("node:vm");

const root = resolve(__dirname, "..");
const site = resolve(root, "site");
const read = (file) => readFileSync(resolve(site, file), "utf8");

test("legal pages, home and admin have valid local links and anchors", () => {
  for (const file of ["index.html", "privacy.html", "policies.html", "admin.html"]) {
    const html = read(file);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `duplicate ID in ${file}`);
    for (const [, link] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:)/.test(link)) continue;
      const [url, anchor] = link.split("#");
      const target = resolve(dirname(resolve(site, file)), url.split("?")[0] || file);
      assert.ok(existsSync(target), `${file}: missing ${link}`);
      if (anchor) {
        assert.ok(readFileSync(target, "utf8").includes(`id="${anchor}"`), `${file}: missing anchor ${link}`);
      }
    }
  }
});

test("main's landing sections and admin entry remain present", () => {
  const html = read("index.html");
  for (const id of ["creation-engine", "proof", "services", "lab", "process", "audience", "faq", "request"]) {
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.match(html, /href="admin.html"/);
  assert.match(html, /href="policies.html"/);
  assert.match(html, /href="assets\/premium.css(?:\?v=[^"]+)?"/);
});

test("form privacy details are collapsed after the fields and submit button", () => {
  const html = read("index.html");
  const disclosure = html.match(/<details\b([^>]*class="legal-disclosure"[^>]*)>([\s\S]*?)<\/details>/);
  assert.ok(disclosure);
  assert.doesNotMatch(disclosure[1], /\bopen\b/);
  assert.match(disclosure[2], /<summary data-i18n="privacyDetailsTitle">/);
  assert.match(disclosure[2], /data-i18n="privacySummary"/);
  assert.match(disclosure[2], /data-i18n="privacyPending"/);
  assert.match(disclosure[2], /LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA/);
  assert.ok(html.indexOf(disclosure[0]) > html.indexOf('id="submit-button"'));
  const consent = html.match(/<label class="consent-label"[\s\S]*?<\/label\s*>/)[0];
  assert.match(consent, /href="privacy.html"/);
  assert.ok(html.indexOf(consent) < html.indexOf(disclosure[0]));
  const formStart = html.match(/<form\s+id="project-form"[^>]*>/)[0];
  assert.doesNotMatch(formStart, /aria-describedby="privacy-summary"/);
});

test("legal pages retain draft warnings and noindex", () => {
  for (const file of ["privacy.html", "policies.html"]) {
    assert.match(read(file), /name="robots" content="noindex, follow"/);
    assert.match(read(file), /borrador/i);
    assert.match(read(file), /domicilio legal/i);
  }
});
