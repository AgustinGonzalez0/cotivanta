const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(
  path.join(__dirname, "../site/assets/admin.js"),
  "utf8",
);
function setup(responses) {
  const elements = {};
  for (const id of [
    "login-form",
    "settings-form",
    "admin-message",
    "client-count-input",
    "team-count-input",
    "admin-password",
    "admin-email",
    "logout",
  ]) {
    elements[id] = {
      value: "",
      textContent: "",
      hidden: false,
      disabled: false,
      listeners: {},
      addEventListener(type, fn) {
        this.listeners[type] = fn;
      },
      querySelector() {
        return this.button;
      },
      checkValidity() {
        return true;
      },
      focus() {},
    };
    elements[id].button = { disabled: false };
  }
  elements["admin-email"].value = "admin@example.test";
  elements["admin-password"].value = "test-password";
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected request");
    return response;
  };
  vm.runInNewContext(script, {
    window: {
      COTIVANTA_CONFIG: {
        supabaseUrl: "https://example.test",
        supabasePublishableKey: "public",
      },
    },
    document: { getElementById: (id) => elements[id] },
    fetch,
    Number,
    JSON,
    String,
    Error,
  });
  return { elements, requests };
}
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const submit = (element) => element.listeners.submit({ preventDefault() {} });

test("rejects signed-in users without the administrator claim", async () => {
  const { elements, requests } = setup([
    response({ access_token: "token", user: { app_metadata: {} } }),
  ]);
  await submit(elements["login-form"]);
  assert.equal(elements["settings-form"].hidden, true);
  assert.equal(requests.length, 1);
});

test("saves both counts only after the server confirms the updated row", async () => {
  const { elements, requests } = setup([
    response({
      access_token: "token",
      user: { app_metadata: { cotivanta_admin: true } },
    }),
    response([{ client_count: 200, team_count: 5 }]),
    response([{ client_count: 201, team_count: 6 }]),
  ]);
  await submit(elements["login-form"]);
  assert.equal(elements["settings-form"].hidden, false);
  elements["client-count-input"].value = "201";
  elements["team-count-input"].value = "6";
  await submit(elements["settings-form"]);
  assert.match(elements["admin-message"].textContent, /Guardado/);
  assert.deepEqual(JSON.parse(requests[2].options.body), {
    client_count: 201,
    team_count: 6,
  });
});

test("does not report success when RLS updates no rows", async () => {
  const { elements } = setup([
    response({
      access_token: "token",
      user: { app_metadata: { cotivanta_admin: true } },
    }),
    response([{ client_count: 200, team_count: 5 }]),
    response([]),
  ]);
  await submit(elements["login-form"]);
  await submit(elements["settings-form"]);
  assert.match(elements["admin-message"].textContent, /No se guardó/);
});
