const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

const site = resolve(__dirname, "../site");
const html = readFileSync(resolve(site, "index.html"), "utf8");

for (const className of ["engine-core-mark", "pilot-mark"]) {
  test(`${className} uses the new modular logo instead of a letter or arrow`, () => {
    const markup = html.match(new RegExp(`<(?:span|div) class="${className}">([\\s\\S]*?)<\\/(?:span|div)>`))[1];
    assert.match(markup, /<img\s+src="assets\/logo-symbol.svg\?v=pieces-20261103"[^>]*alt=""/);
    assert.equal(markup.replace(/<img\b[^>]*>/, "").trim(), "");
    assert.ok(existsSync(resolve(site, "assets/logo-symbol.svg")));
  });
}

test("both logo variants retain the exact supplied geometry and colors", () => {
  const paths = [
    "M30 28V26C30 12.745 40.745 2 54 2H62V28H30Z",
    "M26 20V56H8C4.686 56 2 53.314 2 50V44C2 40.817 3.264 37.764 5.515 35.515L26 20Z",
    "M2 60H22C28.627 60 34 65.373 34 72V88L6 66C3.5 64 2 62 2 60Z",
    "M46 68H82C82 82.359 70.359 94 56 94H40V74C40 70.686 42.686 68 46 68Z",
    "M68 2H70C84.359 2 96 13.641 96 28H74C70.686 28 68 25.314 68 22V2Z",
  ];
  for (const [file, color] of [["logo-symbol.svg", "#0A1721"], ["logo-symbol-light.svg", "#F7F8F2"]]) {
    const svg = readFileSync(resolve(site, "assets", file), "utf8");
    assert.deepEqual([...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]), paths);
    assert.ok(svg.includes(`<g fill="${color}">`));
    assert.match(svg, /fill="#C9FF95"/);
  }
});
