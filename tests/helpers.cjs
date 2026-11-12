const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { stripTypeScriptTypes } = require("node:module");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const root = resolve(__dirname, "..");
const read = file => readFileSync(resolve(root, file), "utf8");
function factory(file, name, overrides = {}) {
  const source = stripTypeScriptTypes(read(file).replace(/^export /gm, ""));
  // URL is a global in the Deno runtime where these files really run; the sandbox must expose it too.
  const context = { Request, Response, TextEncoder, TextDecoder, Uint8Array, AbortSignal, URL, crypto: webcrypto, setTimeout, clearTimeout, ...overrides };
  vm.runInNewContext(source + `\nglobalThis.result = ${name};`, context);
  return context.result;
}
function node() {
  return {
    value: "", checked: false, hidden: false, disabled: false, textContent: "", dataset: {}, style: {}, children: [], attributes: {}, listeners: {}, validityMessage: "",
    addEventListener(type, fn) { this.listeners[type] = fn; },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return this.attributes[key] ?? null; },
    removeAttribute(key) { delete this.attributes[key]; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    querySelector() { return this.button; }, querySelectorAll: () => [],
    setCustomValidity(value) { this.validityMessage = value; },
    checkValidity() { return !this.validityMessage; }, reportValidity() {}, focus() { this.focused = true; }, scrollIntoView() {},
    classList: { toggle() {}, add() {}, remove() {} },
  };
}
function elements(ids) {
  return Object.fromEntries(ids.map(id => { const el = node(); el.button = node(); return [id, el]; }));
}
const submit = element => element.listeners.submit({ preventDefault() {} });
module.exports = { factory, read, root, webcrypto, node, elements, submit, vm };
