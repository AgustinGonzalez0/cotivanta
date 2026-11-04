const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { root } = require("./helpers.cjs");
const { build } = require("../scripts/build.cjs");
function fixture(t) {
  const temp = process.platform === "win32" ? path.join(os.homedir(), "AppData/Local/Temp/opencode") : os.tmpdir();
  const directory = fs.mkdtempSync(path.join(temp, "cotivanta-build-test-"));
  const source = path.join(directory, "source"), output = path.join(directory, "dist/site");
  fs.cpSync(path.join(root, "site"), source, { recursive: true });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { source, output };
}
test("build hashes public assets and does not publish backend or tests", t => {
  const { source, output } = fixture(t); build(source, output);
  const html = fs.readFileSync(path.join(output, "index.html"), "utf8");
  assert.match(html, /assets\/app.js\?v=[a-f0-9]{16}/); assert.match(html, /config.js\?v=[a-f0-9]{16}/);
  assert.equal(fs.existsSync(path.join(output, "supabase")), false); assert.equal(fs.existsSync(path.join(output, "tests")), false);
});
for (const [name, text] of [["config.local.js", "local"], [".env", "secret"], ["leaked.js", "const key='sb_secret_synthetic';"], ["key.pem", "private"]]) test(`build refuses ${name}`, t => {
  const { source, output } = fixture(t); fs.writeFileSync(path.join(source, name), text); assert.throws(() => build(source, output), /Refusing|credential/);
});
test("build refuses a legacy service-role JWT", t => {
  const { source, output } = fixture(t);
  const jwt = Buffer.from('{"alg":"HS256"}').toString("base64url") + "." + Buffer.from('{"role":"service_role"}').toString("base64url") + ".synthetic";
  fs.writeFileSync(path.join(source, "leaked.js"), `const key='${jwt}'`); assert.throws(() => build(source, output), /Private service JWT/);
});
test("build preserves unfamiliar output rather than deleting user work", t => {
  const { source, output } = fixture(t); build(source, output); fs.writeFileSync(path.join(output, "user-note.txt"), "keep");
  assert.throws(() => build(source, output), /Preserving unknown/); assert.equal(fs.readFileSync(path.join(output, "user-note.txt"), "utf8"), "keep");
});
test("build removes only stale files it owns and refreshes content versions", t => {
  const { source, output } = fixture(t); fs.writeFileSync(path.join(source, "temporary.txt"), "owned"); build(source, output);
  const previous = fs.readFileSync(path.join(output, "index.html"), "utf8");
  fs.unlinkSync(path.join(source, "temporary.txt")); fs.appendFileSync(path.join(source, "assets/app.js"), "\n// build version test\n"); build(source, output);
  assert.equal(fs.existsSync(path.join(output, "temporary.txt")), false); assert.notEqual(fs.readFileSync(path.join(output, "index.html"), "utf8"), previous);
});
