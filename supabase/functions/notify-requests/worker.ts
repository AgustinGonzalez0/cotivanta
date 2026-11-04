type Env = { get(name: string): string | undefined };
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
    try {
      const claimed = await rpc("claim_project_notifications", {});
      if (!claimed.ok) return reply(503, { code: "queue_unavailable" });
      const rows = await claimed.json();
      if (!Array.isArray(rows) || rows.length > 5) return reply(503, { code: "queue_unavailable" });
      const results = await Promise.all(rows.map(async (row: { request_id: string }) => {
        if (!/^[0-9a-f-]{36}$/i.test(row.request_id)) return false;
        let sent = false;
        try {
          const email = await fetcher("https://api.resend.com/emails", {
            method: "POST", signal: AbortSignal.timeout(8000),
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `cotivanta-${row.request_id}` },
            body: JSON.stringify({ from, to: [to], subject: "Nueva consulta en Cotivanta", text: `Hay una nueva consulta. Referencia: ${row.request_id}\nRevisala en el panel privado: ${adminUrl}\nNo respondas a esta notificación automática.` }),
          });
          sent = email.ok;
          await email.body?.cancel();
        } catch { /* Release for retry; never discard a saved inquiry. */ }
        const finished = await rpc("finish_project_notification", { p_request_id: row.request_id, p_sent: sent });
        await finished.body?.cancel();
        return sent && finished.ok;
      }));
      return reply(results.every(Boolean) ? 200 : 503, { processed: rows.length, accepted: results.filter(Boolean).length });
    } catch { return reply(503, { code: "worker_unavailable" }); }
  };
}
