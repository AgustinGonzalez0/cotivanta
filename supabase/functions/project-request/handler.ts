// Public intake. Never log payloads, tokens, IPs or provider error bodies.
export const PRIVACY_VERSION = "2026-10-30.1-draft";
type Env = { get(name: string): string | undefined };
type Payload = Record<string, unknown>;
const services = new Set(["website", "app", "automation", "custom-software", "integrations", "other"]);
const clients = new Set(["individual", "entrepreneur", "professional", "business"]);
const budgets = new Set(["unsure", "under-500", "500-1500", "1500-5000", "over-5000"]);
const timelines = new Set(["flexible", "within-month", "1-3-months", "later"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const list = (value: string | undefined) => (value ?? "").split(",").map(s => s.trim()).filter(Boolean);
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value), b => b.toString(16).padStart(2, "0")).join("");

async function readPayload(req: Request): Promise<Payload> {
  // Limit actual bytes while streaming, not after allocating an unlimited string.
  const reader = req.body?.getReader();
  if (!reader) throw new Error("body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 5000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) {
        void reader.cancel().catch(() => {});
        throw new Error("size");
      }
      chunks.push(value);
    }
    if (timedOut) throw new Error("body_timeout");
    const all = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all));
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("body");
    return value;
  } finally {
    clearTimeout(deadline);
    reader.releaseLock();
  }
}

export function createHandler(env: Env, fetcher: typeof fetch = fetch, now = () => Date.now()) {
  // This bounded, local burst limiter is only a first layer. SQL enforces the durable limit.
  const bursts = new Map<string, { count: number; reset: number }>();
  function burst(key: string) {
    const time = now();
    for (const [ip, entry] of bursts) if (entry.reset <= time) bursts.delete(ip);
    const entry = bursts.get(key);
    if (entry) return ++entry.count <= 30;
    if (bursts.size >= 10000) return false; // fail closed under resource pressure
    bursts.set(key, { count: 1, reset: time + 600000 });
    return true;
  }
  async function call(url: string, options: RequestInit) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(8000) });
    const body = response.status === 204 ? null : await response.json();
    return { response, body };
  }
  return async (req: Request) => {
    const origin = req.headers.get("origin") ?? "";
    const allowed = list(env.get("ALLOWED_ORIGINS")).includes(origin) && origin !== "";
    const cors: Record<string, string> = allowed ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "600",
    } : {};
    const respond = (status: number, code: string, extra: object = {}, headers = {}) => new Response(JSON.stringify({ code, ...extra }), {
      status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin", ...cors, ...headers },
    });
    if (!allowed) return respond(403, "origin_denied");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, Vary: "Origin", "Cache-Control": "no-store" } });
    if (req.method !== "POST") return respond(405, "method_denied", {}, { Allow: "POST, OPTIONS" });
    if (env.get("PROJECT_REQUESTS_ENABLED") !== "true") return respond(503, "intake_disabled");
    if ((req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") return respond(415, "json_required");
    const length = req.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > 16384)) return respond(413, "body_too_large");

    const secret = env.get("TURNSTILE_SECRET_KEY");
    const url = env.get("SUPABASE_URL");
    let key = env.get("SUPABASE_SECRET_KEY") || env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key) { try { key = JSON.parse(env.get("SUPABASE_SECRET_KEYS") ?? "")?.default; } catch { /* fail closed below */ } }
    const salt = env.get("RATE_LIMIT_SALT") ?? "";
    const header = env.get("TRUSTED_IP_HEADER");
    const hostnames = list(env.get("ALLOWED_TURNSTILE_HOSTNAMES")).map(s => s.toLowerCase());
    if (!secret || !url || typeof key !== "string" || !key || salt.length < 32 || !hostnames.length || !["x-forwarded-for", "cf-connecting-ip"].includes(header ?? "")) return respond(503, "server_not_ready");
    // Configure only a header that the trusted gateway overwrites. Never trust a caller-supplied fallback.
    const ip = (req.headers.get(header!) ?? "").split(",")[0].trim();
    if (!ip || ip.length > 64 || !/^[0-9a-f:.]+$/i.test(ip)) return respond(503, "client_address_unavailable");
    if (!burst(ip)) return respond(429, "rate_limited", {}, { "Retry-After": "600" });
    let data: Payload;
    try { data = await readPayload(req); }
    catch (error) { return respond(error instanceof Error && error.message === "size" ? 413 : 400, "invalid_body"); }
    // Do not claim to have stored a honeypot submission.
    if (str(data.faxNumber)) return respond(400, "invalid_form");
    const name = str(data.name), email = str(data.email).toLowerCase(), clientType = str(data.clientType), service = str(data.service);
    const description = str(data.description), budget = str(data.budget), timeline = str(data.timeline), organization = str(data.organization), language = str(data.language);
    const token = str(data.turnstileToken), submissionKey = str(data.submissionKey);
    if ([name, email, description, organization].some(value => value.includes("\u0000")) || /[\u0000-\u001f\u007f]/.test(name)) return respond(400, "invalid_form");
    if (name.length < 2 || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !clients.has(clientType) || !services.has(service) || description.length < 20 || description.length > 2500 || !budgets.has(budget) || !timelines.has(timeline) || organization.length > 150 || !["es", "en"].includes(language) || data.consent !== true || token.length < 1 || token.length > 2048 || !uuid.test(submissionKey)) return respond(400, "invalid_form");
    if (data.privacyVersion !== PRIVACY_VERSION) return respond(409, "policy_changed");
    const headers = { apikey: key, "Content-Type": "application/json", ...(!key.startsWith("sb_secret_") ? { Authorization: `Bearer ${key}` } : {}) };
    const rpc = (name: string, body: object) => call(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
    try {
      const signingKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const ipHash = hex(await crypto.subtle.sign("HMAC", signingKey, new TextEncoder().encode(ip)));
      const limit = await rpc("check_project_request_rate_limit", { p_key: ipHash });
      if (!limit.response.ok || typeof limit.body?.allowed !== "boolean") return respond(503, "server_not_ready");
      if (!limit.body.allowed) return respond(429, "rate_limited", {}, { "Retry-After": String(Math.min(600, Math.max(1, Number(limit.body.retry_after) || 600))) });
      const verification = await call("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, response: token }) });
      if (!verification.response.ok) return respond(502, "captcha_unavailable");
      if (verification.body?.success !== true || !hostnames.includes(str(verification.body.hostname).toLowerCase()) || verification.body.action !== "project_request") return respond(403, "captcha_rejected");
      const request = { name, email, client_type: clientType, service, description, budget, timeline, organization: organization || null, language, privacy_version: PRIVACY_VERSION };
      const fingerprint = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(request))));
      // Insert, deduplication and notification outbox are committed in one DB transaction.
      const saved = await rpc("submit_project_request", { p_submission_key: submissionKey, p_fingerprint: fingerprint, p_request: request });
      if (saved.body?.code === "idempotency_conflict") return respond(409, "idempotency_conflict");
      if (!saved.response.ok || saved.body?.ok !== true || !uuid.test(saved.body.request_id ?? "")) return respond(503, "storage_unavailable");
      return respond(200, "received", { ok: true, requestId: saved.body.request_id });
    } catch {
      // A timeout after a commit is ambiguous: client retries with the same submission key.
      return respond(503, "service_unavailable");
    }
  };
}
