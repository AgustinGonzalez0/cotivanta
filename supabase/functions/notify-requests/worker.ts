type Env = { get(name: string): string | undefined };
type Row = Record<string, unknown>;

// Visitor data is untrusted: plain text only, no HTML, and no visitor value is used in the subject.
const clean = (value: unknown): string => (Array.isArray(value) ? value.map(clean).join(", ") : String(value ?? ""))
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 2600);
const dash = (value: unknown) => clean(value) || "-";

// One delivery pipeline (claim -> load -> Resend -> finish) shared by every notification queue.
// To notify about a new kind of record: add a source here, plus its queue table and RPCs in a migration.
type Source = {
  claim: string; finish: string; idField: string; finishParam: string; table: string; columns: string;
  idempotencyPrefix: string; subject: string; text: (row: Row, id: string, adminUrl: string) => string;
};
const sources: Source[] = [
  {
    claim: "claim_project_notifications", finish: "finish_project_notification", idField: "request_id", finishParam: "p_request_id",
    table: "project_requests", idempotencyPrefix: "cotivanta-", subject: "Nueva consulta en Cotivanta",
    columns: "created_at,name,email,client_type,category,service,description,budget,budget_amount,budget_currency,timeline,desired_date,organization,whatsapp,language",
    text: (request, id, adminUrl) => [
      "Nueva consulta recibida en Cotivanta.", "",
      `Nombre: ${clean(request.name)}`, `Correo: ${clean(request.email)}`, `WhatsApp: ${dash(request.whatsapp)}`,
      `Tipo de cliente: ${dash(request.client_type)}`, `Categoría: ${dash(request.category)}`, `Servicio: ${clean(request.service)}`,
      `Presupuesto: ${request.budget === "amount" ? `${clean(request.budget_amount)} ${clean(request.budget_currency)}` : clean(request.budget)}`,
      `Plazo: ${clean(request.timeline)}`, `Fecha deseada: ${dash(request.desired_date)}`,
      `Empresa o marca: ${dash(request.organization)}`, `Idioma: ${clean(request.language)}`,
      `Recibida: ${clean(request.created_at)}`, "", "Descripción:", clean(request.description), "",
      `Referencia: ${id}`, `Panel privado: ${adminUrl}`,
      "Podés responder a este correo: la respuesta va a la persona que escribió.",
    ].join("\n"),
  },
  {
    claim: "claim_professional_notifications", finish: "finish_professional_notification", idField: "application_id", finishParam: "p_application_id",
    table: "professional_applications", idempotencyPrefix: "cotivanta-application-", subject: "Nueva postulación profesional en Cotivanta",
    columns: "created_at,full_name,email,country,city,whatsapp,specialties,other_specialty,experience_summary,years_experience,portfolio_url,linkedin_url,other_links,languages,availability,rate_model,rate_amount,rate_currency,language,status",
    text: (application, id) => [
      "Nueva postulación profesional recibida en Cotivanta.", "",
      `Nombre: ${clean(application.full_name)}`, `Correo: ${clean(application.email)}`, `WhatsApp: ${dash(application.whatsapp)}`,
      `País: ${clean(application.country)}`, `Ciudad: ${dash(application.city)}`,
      `Especialidades: ${dash(application.specialties)}`, `Otra especialidad: ${dash(application.other_specialty)}`,
      `Años de experiencia: ${dash(application.years_experience)}`, `Idiomas: ${dash(application.languages)}`,
      `Disponibilidad: ${clean(application.availability)}`,
      `Cobro: ${clean(application.rate_model)} · ${dash(application.rate_amount)} ${clean(application.rate_currency)}`,
      `Portfolio: ${clean(application.portfolio_url)}`, `LinkedIn: ${dash(application.linkedin_url)}`, `Otros enlaces: ${dash(application.other_links)}`,
      `Idioma de contacto: ${clean(application.language)}`, `Estado: ${clean(application.status)}`, `Recibida: ${clean(application.created_at)}`, "",
      "Experiencia y habilidades:", clean(application.experience_summary), "",
      `Referencia: ${id}`,
      "Gestión: tabla professional_applications en Supabase (aún no hay vista en el panel).",
      "Podés responder a este correo: la respuesta va a la persona que se postuló.",
    ].join("\n"),
  },
];

export function createNotificationHandler(env: Env, fetcher: typeof fetch = fetch) {
  return async (req: Request) => {
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
    if (req.method !== "POST") return reply(405, { code: "method_denied" });
    const jobKey = env.get("NOTIFICATION_JOB_SECRET") ?? "";
    const supplied = req.headers.get("authorization") ?? "";
    if (jobKey.length < 32 || supplied.length > 512) return reply(401, { code: "unauthorized" });
    const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    const expected = await digest(`Bearer ${jobKey}`), actual = await digest(supplied);
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ actual[i];
    if (difference !== 0) return reply(401, { code: "unauthorized" });
    const url = env.get("SUPABASE_URL"), apiKey = env.get("RESEND_API_KEY"), from = env.get("NOTIFICATION_FROM"), to = env.get("NOTIFICATION_TO"), adminUrl = env.get("ADMIN_URL");
    let key = env.get("SUPABASE_SECRET_KEY") || env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key) { try { key = JSON.parse(env.get("SUPABASE_SECRET_KEYS") ?? "")?.default; } catch { /* checked below */ } }
    if (!url || typeof key !== "string" || !key || !apiKey || !from || !to || !adminUrl || !/^https:\/\/[^\s]+$/.test(adminUrl)) return reply(503, { code: "worker_not_ready" });
    const headers = { apikey: key, "Content-Type": "application/json", ...(!key.startsWith("sb_secret_") ? { Authorization: `Bearer ${key}` } : {}) };
    const rpc = (name: string, body: object) => fetcher(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });

    async function deliver(source: Source, id: string): Promise<boolean> {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
      let sent = false;
      try {
        const lookup = await fetcher(`${url}/rest/v1/${source.table}?id=eq.${id}&select=${source.columns}&limit=1`, { headers, signal: AbortSignal.timeout(8000) });
        const found = lookup.ok ? await lookup.json() : null;
        const record = Array.isArray(found) ? found[0] : null;
        if (!record) throw new Error("record_unavailable");
        const replyTo = /^[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+$/.test(String(record.email)) ? [String(record.email)] : undefined;
        const email = await fetcher("https://api.resend.com/emails", {
          method: "POST", signal: AbortSignal.timeout(8000),
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `${source.idempotencyPrefix}${id}` },
          body: JSON.stringify({ from, to: [to], ...(replyTo ? { reply_to: replyTo } : {}), subject: source.subject, text: source.text(record, id, adminUrl!) }),
        });
        sent = email.ok;
        await email.body?.cancel();
      } catch { /* Release for retry; never discard a saved record. */ }
      const finished = await rpc(source.finish, { [source.finishParam]: id, p_sent: sent });
      await finished.body?.cancel();
      return sent && finished.ok;
    }

    // Queues are independent: a problem in one (e.g. a migration not applied yet) never blocks the other.
    let processed = 0, accepted = 0, failed = false, queueError = false;
    for (const source of sources) {
      try {
        const claimed = await rpc(source.claim, {});
        if (!claimed.ok) { failed = queueError = true; await claimed.body?.cancel(); continue; }
        const rows = await claimed.json();
        if (!Array.isArray(rows) || rows.length > 5) { failed = queueError = true; continue; }
        const results = await Promise.all(rows.map((row: Row) => deliver(source, String(row[source.idField] ?? ""))));
        processed += rows.length; accepted += results.filter(Boolean).length;
        if (!results.every(Boolean)) failed = true;
      } catch { failed = queueError = true; }
    }
    return reply(failed ? 503 : 200, { processed, accepted, ...(queueError ? { code: "queue_unavailable" } : {}) });
  };
}
