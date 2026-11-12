// Public intake for BOTH public forms (client requests and professional applications).
// Never log payloads, tokens, IPs or provider error bodies.
export const PRIVACY_VERSION = "2026-11-12.1-draft";
type Env = { get(name: string): string | undefined };
type Payload = Record<string, unknown>;

// Service catalog. KEEP IN SYNC with site/assets/catalog.js (tests/agency.test.cjs fails if they drift).
// To add a specialty or a whole category: add it here AND in catalog.js, then redeploy this function.
// The database only checks the slug format, so no migration is needed.
export const CATALOG: Record<string, string[]> = {
  tech: ["website", "landing-page", "online-store", "mobile-app", "management-system", "custom-crm", "automation", "whatsapp-bot", "api-integration", "maintenance"],
  design: ["logo-design", "brand-identity", "branding", "social-media-design", "advertising-design", "presentations", "ui-ux-design", "illustration"],
  audiovisual: ["video-editing", "reels-tiktok-editing", "youtube-editing", "subtitles", "animation", "motion-graphics", "photography", "photo-editing", "audiovisual-production"],
  marketing: ["social-media-management", "community-management", "content-creation", "seo", "ad-campaigns", "copywriting", "email-marketing", "digital-marketing-strategy"],
  business: ["virtual-assistance", "data-management", "excel-spreadsheets", "admin-automation", "data-entry", "market-research", "process-organization"],
  other: [],
};
export const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "MXN", "COP"];
export const PROFESSIONAL_LANGUAGES = ["es", "en", "pt", "fr", "it", "de", "other"];
const OTHER_SERVICE = "other";
// Values sent by the previous (technology-only) form. Kept valid so a cached page never gets a hard failure.
const LEGACY_SERVICES = new Set(["website", "app", "automation", "custom-software", "integrations", "other"]);
const clients = new Set(["individual", "entrepreneur", "professional", "business"]);
const budgets = new Set(["unsure", "amount", "under-500", "500-1500", "1500-5000", "over-5000"]);
const timelines = new Set(["flexible", "within-month", "1-3-months", "later"]);
const specialties = new Set(Object.values(CATALOG).flat());
const currencies = new Set(CURRENCIES);
const languages = new Set(PROFESSIONAL_LANGUAGES);
const availabilities = new Set(["full-time", "part-time", "project-based", "limited"]);
const rateModels = new Set(["per-project", "hourly", "per-deliverable", "monthly", "to-discuss"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const control = /[\u0000-\u001f\u007f]/;
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const list = (value: string | undefined) => (value ?? "").split(",").map(s => s.trim()).filter(Boolean);
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value), b => b.toString(16).padStart(2, "0")).join("");

/** Phone / WhatsApp: digits with the usual separators. Returns "" when empty, null when invalid. */
function phone(value: unknown): string | null {
  const text = str(value);
  if (!text) return "";
  const digits = text.replace(/\D/g, "").length;
  return /^\+?[0-9\s().-]{6,30}$/.test(text) && digits >= 7 && digits <= 15 ? text : null;
}
/** Money amount: null = not provided, undefined = invalid. */
function money(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  const text = typeof value === "string" ? value.trim() : value;
  const n = typeof text === "number" ? text : typeof text === "string" && /^\d{1,12}([.,]\d{1,2})?$/.test(text) ? Number(text.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 1_000_000_000 ? Math.round(n * 100) / 100 : undefined;
}
/** Whole number in range: null = not provided, undefined = invalid. */
function whole(value: unknown, min: number, max: number): number | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "string" && /^\d{1,3}$/.test(value.trim()) ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}
/** Public web address: https only, real-looking host (no IPs, no localhost, no credentials). */
function httpsUrl(value: unknown): string | null {
  const text = str(value);
  if (text.length < 12 || text.length > 300 || /[\s\u0000-\u001f\u007f]/.test(text)) return null;
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,63}$/.test(url.hostname) ? text : null;
}
const strings = (value: unknown, max: number): string[] | null => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) return null;
  return value.every(item => typeof item === "string") ? [...new Set(value.map(item => item.trim()))] : null;
};
const isCalendarDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;

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

type Parsed = { record: Record<string, unknown> } | null;

/** Client request. Accepts the previous payload shape (no category, USD ranges) as well as the agency one. */
function parseProjectRequest(data: Payload, today: string): Parsed {
  const name = str(data.name), email = str(data.email).toLowerCase(), clientType = str(data.clientType), service = str(data.service);
  const description = str(data.description), budget = str(data.budget), timeline = str(data.timeline), organization = str(data.organization), language = str(data.language);
  let category = str(data.category);
  if ([name, email, description, organization].some(value => value.includes("\u0000")) || /[\u0000-\u001f\u007f]/.test(name)) return null;
  if (name.length < 2 || name.length > 100 || email.length > 254 || !emailPattern.test(email) || description.length < 20 || description.length > 2500 || organization.length > 150) return null;
  if (control.test(organization) || (clientType && !clients.has(clientType)) || !budgets.has(budget) || !timelines.has(timeline) || !["es", "en"].includes(language)) return null;
  if (data.consent !== true) return null;
  if (category) {
    // New shape: the service must belong to the category, or be the open "something custom" option.
    if (!Object.hasOwn(CATALOG, category) || !(service === OTHER_SERVICE || CATALOG[category].includes(service))) return null;
  } else {
    if (!LEGACY_SERVICES.has(service)) return null;
    category = service === OTHER_SERVICE ? "other" : "tech";
  }
  const whatsapp = phone(data.whatsapp);
  if (whatsapp === null) return null;
  let amount: number | null = null, currency: string | null = null;
  if (budget === "amount") {
    const parsed = money(data.budgetAmount);
    currency = str(data.budgetCurrency).toUpperCase();
    if (!parsed || !currencies.has(currency)) return null;
    amount = parsed;
  }
  const desired = str(data.desiredDate);
  if (desired) {
    // Day-level window; one day of slack so a visitor in a timezone ahead of UTC is not rejected.
    const earliest = new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
    const latest = new Date(Date.parse(today + "T00:00:00Z") + 5 * 366 * 86400000).toISOString().slice(0, 10);
    if (!isCalendarDate(desired) || desired < earliest || desired > latest) return null;
  }
  return { record: { name, email, client_type: clientType || null, category, service, description, budget, timeline, organization: organization || null, language,
    whatsapp: whatsapp || null, budget_amount: amount, budget_currency: currency, desired_date: desired || null, privacy_version: PRIVACY_VERSION } };
}

/** Professional application. Never asks for ID numbers, passwords or bank details. */
function parseApplication(data: Payload): Parsed {
  const fullName = str(data.fullName), email = str(data.email).toLowerCase(), country = str(data.country), city = str(data.city);
  const otherSpecialty = str(data.otherSpecialty), experience = str(data.experience), language = str(data.language);
  const availability = str(data.availability), rateModel = str(data.rateModel), currency = str(data.rateCurrency).toUpperCase();
  if (fullName.length < 2 || fullName.length > 100 || control.test(fullName) || email.length > 254 || !emailPattern.test(email)) return null;
  if (country.length < 2 || country.length > 80 || control.test(country) || city.length > 80 || control.test(city)) return null;
  if (otherSpecialty.length > 100 || control.test(otherSpecialty)) return null;
  // Free text may contain line breaks, but never NUL or other control characters.
  if (experience.length < 30 || experience.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(experience)) return null;
  if (!["es", "en"].includes(language) || data.consent !== true) return null;
  if (!availabilities.has(availability) || !rateModels.has(rateModel) || !currencies.has(currency)) return null;
  const chosen = strings(data.specialties, 12), spoken = strings(data.languages, 8), extra = strings(data.otherLinks, 5);
  if (!chosen || !spoken || !extra || chosen.some(item => !specialties.has(item)) || spoken.length < 1 || spoken.some(item => !languages.has(item))) return null;
  if (chosen.length === 0 && !otherSpecialty) return null;
  const whatsapp = phone(data.whatsapp);
  const years = whole(data.yearsExperience, 0, 60), rate = money(data.rateAmount);
  if (whatsapp === null || years === undefined || rate === undefined) return null;
  const portfolio = httpsUrl(data.portfolioUrl);
  const linkedinText = str(data.linkedinUrl), linkedin = linkedinText ? httpsUrl(linkedinText) : "";
  if (!portfolio || linkedin === null) return null;
  if (linkedin) { const host = new URL(linkedin).hostname; if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null; }
  const links = extra.filter(Boolean).map(httpsUrl);
  if (links.some(link => link === null)) return null;
  return { record: { full_name: fullName, email, country, city: city || null, whatsapp: whatsapp || null, specialties: chosen, other_specialty: otherSpecialty || null,
    experience_summary: experience, years_experience: years, portfolio_url: portfolio, linkedin_url: linkedin || null, other_links: links, languages: spoken,
    availability, rate_model: rateModel, rate_amount: rate, rate_currency: currency, language, privacy_version: PRIVACY_VERSION } };
}

const FORMS = {
  project: { flag: "PROJECT_REQUESTS_ENABLED", action: "project_request", rpc: "submit_project_request", param: "p_request", receipt: "request_id", reply: "requestId", rateNamespace: "" },
  professional: { flag: "PROFESSIONAL_APPLICATIONS_ENABLED", action: "professional_application", rpc: "submit_professional_application", param: "p_application", receipt: "application_id", reply: "applicationId", rateNamespace: "professional:" },
} as const;

export function createHandler(env: Env, fetcher: typeof fetch = fetch, now = () => Date.now(), background: (task: Promise<unknown>) => void = () => {}) {
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
    // Fail closed per form: each public form has its own switch, checked again once the form type is known.
    if (env.get(FORMS.project.flag) !== "true" && env.get(FORMS.professional.flag) !== "true") return respond(503, "intake_disabled");
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
    // No "form" field = the previous client form, which keeps working unchanged.
    const form = str(data.form) === "professional-application" ? FORMS.professional : FORMS.project;
    if (env.get(form.flag) !== "true") return respond(503, "intake_disabled");
    const token = str(data.turnstileToken), submissionKey = str(data.submissionKey);
    if (token.length < 1 || token.length > 2048 || !uuid.test(submissionKey)) return respond(400, "invalid_form");
    const parsed = form === FORMS.professional ? parseApplication(data) : parseProjectRequest(data, new Date(now()).toISOString().slice(0, 10));
    if (!parsed) return respond(400, "invalid_form");
    if (data.privacyVersion !== PRIVACY_VERSION) return respond(409, "policy_changed");
    const headers = { apikey: key, "Content-Type": "application/json", ...(!key.startsWith("sb_secret_") ? { Authorization: `Bearer ${key}` } : {}) };
    const rpc = (name: string, body: object) => call(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
    try {
      const signingKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      // Each form has its own bucket (same durable table and function), so one cannot starve the other.
      const ipHash = hex(await crypto.subtle.sign("HMAC", signingKey, new TextEncoder().encode(form.rateNamespace + ip)));
      const limit = await rpc("check_project_request_rate_limit", { p_key: ipHash });
      if (!limit.response.ok || typeof limit.body?.allowed !== "boolean") return respond(503, "server_not_ready");
      if (!limit.body.allowed) return respond(429, "rate_limited", {}, { "Retry-After": String(Math.min(600, Math.max(1, Number(limit.body.retry_after) || 600))) });
      const verification = await call("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, response: token }) });
      if (!verification.response.ok) return respond(502, "captcha_unavailable");
      if (verification.body?.success !== true || !hostnames.includes(str(verification.body.hostname).toLowerCase()) || verification.body.action !== form.action) return respond(403, "captcha_rejected");
      const fingerprint = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(parsed.record))));
      // Insert, deduplication and notification outbox are committed in one DB transaction.
      const saved = await rpc(form.rpc, { p_submission_key: submissionKey, p_fingerprint: fingerprint, [form.param]: parsed.record });
      if (saved.body?.code === "idempotency_conflict") return respond(409, "idempotency_conflict");
      const id = saved.body?.[form.receipt];
      if (!saved.response.ok || saved.body?.ok !== true || !uuid.test(id ?? "")) return respond(503, "storage_unavailable");
      // Immediate delivery attempt. The saved row and its outbox entry are already durable, so failure here is
      // harmless: the scheduled notify-requests worker retries it (that is the reliable path, this is the fast one).
      const jobSecret = env.get("NOTIFICATION_JOB_SECRET") ?? "";
      if (jobSecret.length >= 32) {
        background(fetcher(`${url}/functions/v1/notify-requests`, { method: "POST", headers: { Authorization: `Bearer ${jobSecret}`, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(8000) })
          .then(response => response.body?.cancel()).catch(() => {}));
      }
      return respond(200, "received", { ok: true, [form.reply]: id });
    } catch {
      // A timeout after a commit is ambiguous: client retries with the same submission key.
      return respond(503, "service_unavailable");
    }
  };
}
