// Dependency-free Chrome DevTools harness. Every external HTTP request is intercepted.
const { spawn } = require("node:child_process");
const { existsSync, mkdtempSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { once } = require("node:events");
async function launch() {
  const executable = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(value => value && existsSync(value));
  if (!executable) throw new Error("Chrome/Edge is required. Set CHROME_PATH; browser tests must not silently skip.");
  const temporary = process.platform === "win32" ? path.join(os.homedir(), "AppData/Local/Temp/opencode") : os.tmpdir();
  const profile = mkdtempSync(path.join(temporary, "cotivanta-security-e2e-"));
  const child = spawn(executable, ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"]);
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Browser startup timed out")), 15000);
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    let log = "";
    child.stderr.on("data", data => { log += data; const match = log.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
  }).catch(error => { child.kill(); throw error; });
  const socket = new WebSocket(endpoint); await once(socket, "open");
  let id = 0;
  const pending = new Map(), events = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) { const entry = pending.get(message.id); if (entry) { clearTimeout(entry.timer); pending.delete(message.id); message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result); } }
    for (const callback of events.get(message.method) || []) callback(message.params, message.sessionId);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const next = ++id;
      const timer = setTimeout(() => { pending.delete(next); reject(new Error(`CDP timeout: ${method}`)); }, 12000);
      pending.set(next, { resolve, reject, timer }); socket.send(JSON.stringify({ id: next, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  function on(name, callback) { if (!events.has(name)) events.set(name, []); events.get(name).push(callback); }
  async function page(base, route = "/", options = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    await send("Target.activateTarget", { targetId });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const requests = [], errors = [], receipts = new Map();
    let settings = { client_count: 4, team_count: 2, metrics_verified: options.verified === true, revision: 1 };
    const evaluate = async expression => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId);
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
    await send("Emulation.setDeviceMetricsOverride", { width: options.mobile ? 390 : 1440, height: options.mobile ? 844 : 1100, deviceScaleFactor: 1, mobile: options.mobile === true }, sessionId);
    on("Runtime.exceptionThrown", (event, session) => { if (session === sessionId) errors.push(event.exceptionDetails); });
    await send("Fetch.enable", { patterns: [{ urlPattern: "https://*" }, { urlPattern: "*config.js*" }, { urlPattern: "*assets/app.js*" }, { urlPattern: "*assets/admin.js*" }] }, sessionId);
    on("Fetch.requestPaused", async (event, session) => {
      if (session !== sessionId) return;
      const { request, requestId } = event;
      const fulfill = (body, status = 200, type = "application/json") => send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "Content-Type", value: type }, { name: "Access-Control-Allow-Origin", value: base }, { name: "Access-Control-Allow-Headers", value: "content-type,apikey,authorization,prefer" }, { name: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,OPTIONS" }], body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)).toString("base64") }, sessionId);
      try {
        if (request.method === "OPTIONS") return await fulfill("", 204);
        if (request.url.includes("config.js")) return await fulfill(`window.COTIVANTA_CONFIG=${JSON.stringify({ projectRequestsEnabled: options.enabled === true, professionalApplicationsEnabled: options.enabled === true, apiUrl: "https://eucejksxzyerpuingidd.supabase.co/functions/v1/project-request", supabaseUrl: "https://eucejksxzyerpuingidd.supabase.co", supabasePublishableKey: "synthetic-public", turnstileSiteKey: "synthetic", metricsVerified: false })}`, 200, "application/javascript");
        if (request.url.includes("assets/app.js") && options.noApp || request.url.includes("assets/admin.js") && options.noAdmin) return await send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }, sessionId);
        if (!request.url.startsWith("https://")) return await send("Fetch.continueRequest", { requestId }, sessionId);
        requests.push(request);
        if (request.url.includes("challenges.cloudflare.com/turnstile/v0/api.js")) return await fulfill("window.__widgets={};window.turnstile={render:(selector,options)=>{const id=Object.keys(window.__widgets).length+1;window.__widgets[id]=options;if(options.action==='project_request')window.__captcha=options.callback;else window.__captchaPro=options.callback;options.callback('synthetic');return id},reset:(id)=>window.__widgets[id].callback('fresh-synthetic')};", 200, "application/javascript");
        if (request.url.includes("functions/v1/project-request")) {
          const body = JSON.parse(request.postData);
          if (!receipts.has(body.submissionKey)) receipts.set(body.submissionKey, body.form === "professional-application" ? "22222222-2222-4222-8222-222222222222" : "11111111-1111-4111-8111-111111111111");
          if (options.dropFirst && requests.filter(item => item.url.includes("functions/v1/project-request")).length === 1) return await send("Fetch.failRequest", { requestId, errorReason: "ConnectionClosed" }, sessionId);
          return await fulfill(body.form === "professional-application" ? { ok: true, applicationId: receipts.get(body.submissionKey) } : { ok: true, requestId: receipts.get(body.submissionKey) });
        }
        if (request.url.includes("auth/v1/token")) return await fulfill({ access_token: "aal1-synthetic", expires_in: 300, user: { app_metadata: { cotivanta_admin: true }, factors: [{ id: "synthetic-factor", factor_type: "totp", status: "verified" }] } });
        if (request.url.includes("/challenge")) return await fulfill({ id: "synthetic-challenge" });
        if (request.url.includes("/verify")) return await fulfill({ access_token: "aal2-synthetic", expires_in: 300 });
        if (request.url.includes("auth/v1/logout")) return await fulfill("", 204);
        if (request.url.includes("site_settings")) {
          if (request.method === "PATCH") { settings = { ...settings, ...JSON.parse(request.postData), revision: settings.revision + 1 }; }
          return await fulfill([settings]);
        }
        if (request.url.includes("project_requests")) return await fulfill([{ id: "11111111-1111-4111-8111-111111111111", created_at: "2026-11-04T12:00:00Z", name: '<img src=x onerror="window.__xss=true">', email: "audit@example.invalid", service: "website", description: "<script>window.__xss=true</script>", budget: "unsure", timeline: "flexible", language: "es", status: "new" }]);
        await fulfill({ code: "external_request_blocked" }, 503);
      } catch (error) { errors.push(error.message); }
    });
    const loaded = new Promise(resolve => on("Page.loadEventFired", (event, session) => { if (session === sessionId) resolve(); }));
    await send("Page.navigate", { url: base + route }, sessionId); await loaded;
    const wait = expression => evaluate(`new Promise((resolve,reject)=>{const check=()=>{if(${expression}){observer?.disconnect();clearTimeout(timer);resolve(true)}};let observer;const timer=setTimeout(()=>{observer?.disconnect();reject(new Error('DOM wait timeout'))},6000);observer=new MutationObserver(check);observer.observe(document,{subtree:true,attributes:true,childList:true,characterData:true});check()})`);
    return { evaluate, wait, requests, errors, receipts, close: () => send("Target.closeTarget", { targetId }), key: async key => { const code = key === "Enter" ? 13 : 32; await send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, text: key === "Enter" ? "\r" : " " }, sessionId); await send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code }, sessionId); } };
  }
  return { page, close: async () => { const exited = once(child, "exit"); await send("Browser.close"); socket.close(); await exited; } };
}
module.exports = { launch };
