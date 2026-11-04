const test = require("node:test");
const assert = require("node:assert/strict");
const { read, vm } = require("./helpers.cjs");
function setup(fetch) {
  const context = { window: {}, fetch, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(read("site/assets/http.js"), context);
  return context.window.CotivantaHTTP.json;
}
test("HTTP helper sets privacy-safe options and parses JSON", async () => {
  const json = setup(async (url, options) => {
    assert.equal(options.credentials, "omit"); assert.equal(options.referrerPolicy, "no-referrer"); assert.equal(options.cache, "no-store");
    return Response.json({ ok: true });
  });
  assert.equal((await json("https://example.invalid")).body.ok, true);
});
test("HTTP deadline aborts a hanging network request", async () => {
  const json = setup((url, options) => new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")))));
  await assert.rejects(json("https://example.invalid", {}, 10), { name: "AbortError" });
});
test("HTTP deadline also covers response-body reads", async () => {
  const json = setup(async (url, options) => ({ status: 200, json: () => new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")))) }));
  await assert.rejects(json("https://example.invalid", {}, 10), { name: "AbortError" });
});
