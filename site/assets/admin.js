(() => {
  "use strict";
  const config = window.COTIVANTA_CONFIG || {}, http = window.CotivantaHTTP;
  const get = id => document.getElementById(id);
  const login = get("login-form"), mfa = get("mfa-form"), settings = get("settings-form");
  const statuses = { new: "Nueva", contacted: "Contactada", qualified: "Calificada", quoted: "Presupuestada", won: "Aceptada", lost: "No concretada", declined: "Rechazada" };
  let token = "", factor = "", generation = 0, revision = 0, page = 0, expiry;
  let loginBusy = false, mfaBusy = false, saveBusy = false, inboxBusy = false;
  const message = text => { get("admin-message").textContent = text; };
  const headers = () => ({ apikey: config.supabasePublishableKey, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  function clearSession() {
    generation++;
    token = ""; factor = ""; revision = 0; page = 0;
    clearTimeout(expiry);
    get("admin-password").value = "";
    get("mfa-code").value = "";
    get("mfa-qr").removeAttribute("src");
    get("mfa-enrollment").hidden = true;
    get("request-list").replaceChildren();
    get("inbox-message").textContent = "";
    get("client-count-input").value = "";
    get("team-count-input").value = "";
    settings.hidden = true; mfa.hidden = true; get("inbox").hidden = true; get("logout").hidden = true; login.hidden = false;
  }
  async function logout() {
    const previous = token;
    clearSession(); // Clear sensitive content even when the provider is unreachable.
    message("Sesión local cerrada. Los tokens de acceso emitidos vencen según su plazo del proveedor.");
    if (previous && http) {
      try {
        const { response } = await http.json(`${config.supabaseUrl}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${previous}` } });
        if (!response.ok) throw new Error("logout");
      } catch { message("Sesión local cerrada. No se pudo confirmar la revocación remota; si sospechás un acceso indebido, revocá las sesiones desde Supabase."); }
    }
  }
  function expires(session) {
    clearTimeout(expiry);
    const seconds = Math.max(1, Math.min(Number(session.expires_in) || 900, 3600));
    expiry = setTimeout(() => { clearSession(); message("La sesión venció. Volvé a iniciar sesión con segundo factor."); }, seconds * 1000);
  }
  async function api(path, options = {}) {
    const current = generation;
    const result = await http.json(`${config.supabaseUrl}${path}`, { ...options, headers: { ...headers(), ...options.headers } });
    if (current !== generation) throw new Error("stale-session");
    if (result.response.status === 401 || result.response.status === 403) {
      clearSession();
      message("La sesión venció o no tiene permisos con segundo factor. Volvé a ingresar.");
      throw new Error("unauthorized");
    }
    if (!result.response.ok) throw new Error("request");
    return result.body;
  }
  async function readSettings() {
    const rows = await api("/rest/v1/site_settings?id=eq.1&select=client_count,team_count,metrics_verified,revision");
    const row = rows?.[0];
    if (!Number.isSafeInteger(row?.client_count) || !Number.isSafeInteger(row?.team_count) || !Number.isSafeInteger(row?.revision) || typeof row?.metrics_verified !== "boolean") throw new Error("migration-required");
    revision = row.revision;
    get("client-count-input").value = String(row.client_count);
    get("team-count-input").value = String(row.team_count);
    get("metrics-verified").checked = row.metrics_verified;
  }
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  };
  async function loadInbox() {
    if (inboxBusy || !token) return;
    inboxBusy = true;
    const current = generation;
    get("inbox-message").textContent = "Cargando consultas…";
    try {
      const rows = await api(`/rest/v1/project_requests?select=id,created_at,name,email,service,description,budget,timeline,organization,language,status&order=created_at.desc,id.desc&limit=50&offset=${page * 50}`);
      if (!Array.isArray(rows)) throw new Error("rows");
      get("request-list").replaceChildren();
      for (const row of rows) {
        // Every visitor-controlled value is text, never HTML or executable attributes.
        const card = element("article", undefined, "inquiry-card");
        card.append(element("h3", row.name), element("p", row.email), element("small", `${row.created_at} · ${row.id}`));
        card.append(element("p", `${row.service} · ${row.budget} · ${row.timeline} · ${row.language}`));
        if (row.organization) card.append(element("p", row.organization));
        const details = element("details");
        details.append(element("summary", "Ver descripción"), element("p", row.description, "inquiry-description"));
        const label = element("label", "Estado de la consulta");
        const select = element("select");
        for (const [value, text] of Object.entries(statuses)) { const option = element("option", text); option.value = value; select.append(option); }
        select.value = row.status;
        select.addEventListener("change", async () => {
          select.disabled = true;
          const desired = select.value;
          try {
            const updated = await api(`/rest/v1/project_requests?id=eq.${encodeURIComponent(row.id)}&status=eq.${encodeURIComponent(row.status)}&select=id,status`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: desired }) });
            if (updated?.length !== 1 || updated[0].status !== desired) throw new Error("conflict");
            row.status = desired;
            get("inbox-message").textContent = "Estado actualizado y registrado en auditoría.";
          } catch { select.value = row.status; if (current === generation) get("inbox-message").textContent = "No se guardó el estado. Actualizá la lista o volvé a ingresar."; }
          finally { select.disabled = false; }
        });
        label.append(select); card.append(details, label); get("request-list").append(card);
      }
      get("previous-page").disabled = page === 0;
      get("next-page").disabled = rows.length < 50;
      get("inbox-message").textContent = rows.length ? `Página ${page + 1}: ${rows.length} consultas.` : "No hay consultas en esta página.";
    } catch { if (current === generation) get("inbox-message").textContent = "No se pudieron cargar las consultas. Verificá conexión, permisos y migraciones."; }
    finally { inboxBusy = false; }
  }
  login.addEventListener("submit", async event => {
    event.preventDefault();
    if (loginBusy || !http || !config.supabaseUrl || !config.supabasePublishableKey) return;
    loginBusy = true;
    const button = login.querySelector("button[type=submit]"); button.disabled = true;
    const current = ++generation;
    message("Verificando credenciales…");
    try {
      const { response, body: session } = await http.json(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: headers(), body: JSON.stringify({ email: get("admin-email").value.trim(), password: get("admin-password").value }) });
      if (current !== generation) return;
      if (!response.ok || !session?.access_token) throw new Error("login");
      token = session.access_token;
      if (session.user?.app_metadata?.cotivanta_admin !== true) throw new Error("forbidden");
      get("admin-password").value = ""; expires(session);
      const verified = session.user.factors?.find(item => item.factor_type === "totp" && item.status === "verified");
      if (verified) factor = verified.id;
      else {
        const enrollment = await api("/auth/v1/factors", { method: "POST", body: JSON.stringify({ factor_type: "totp", friendly_name: `Cotivanta ${Date.now()}` }) });
        if (!enrollment.id || typeof enrollment.totp?.qr_code !== "string" || enrollment.totp.qr_code.length > 50000) throw new Error("mfa-enrollment");
        factor = enrollment.id;
        get("mfa-qr").src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.totp.qr_code)}`;
        get("mfa-enrollment").hidden = false;
      }
      login.hidden = true; mfa.hidden = false; get("mfa-code").focus();
      message("Ingresá el código del autenticador. Todavía no se habilitó el acceso a datos privados.");
    } catch { if (current === generation) { await logout(); message("No se pudo ingresar. Revisá la cuenta autorizada, el segundo factor y la configuración del panel."); } }
    finally { loginBusy = false; button.disabled = false; }
  });
  mfa.addEventListener("submit", async event => {
    event.preventDefault();
    const code = get("mfa-code").value.trim();
    if (mfaBusy || !token || !factor || !/^\d{6}$/.test(code)) { message("Ingresá los seis dígitos del autenticador."); return; }
    mfaBusy = true; const button = mfa.querySelector("button[type=submit]"); button.disabled = true;
    const current = generation;
    try {
      const challenge = await api(`/auth/v1/factors/${encodeURIComponent(factor)}/challenge`, { method: "POST", body: "{}" });
      const session = await api(`/auth/v1/factors/${encodeURIComponent(factor)}/verify`, { method: "POST", body: JSON.stringify({ challenge_id: challenge.id, code }) });
      if (!session.access_token) throw new Error("mfa");
      token = session.access_token; expires(session);
      // The RLS policies, not this UI, require the verified aal2 token.
      await readSettings();
      mfa.hidden = true; get("mfa-qr").removeAttribute("src"); get("mfa-enrollment").hidden = true;
      settings.hidden = false; get("inbox").hidden = false; get("logout").hidden = false;
      message(""); get("client-count-input").focus(); await loadInbox();
    } catch { if (current === generation) message("No se verificó el acceso. Revisá el código; si sigue fallando, verificá las migraciones y los permisos MFA."); }
    finally { get("mfa-code").value = ""; mfaBusy = false; button.disabled = false; }
  });
  settings.addEventListener("submit", async event => {
    event.preventDefault();
    if (saveBusy || !token) return;
    const count = Number(get("client-count-input").value), teams = Number(get("team-count-input").value);
    if (!settings.checkValidity() || ![count, teams].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 10000000)) { message("Ingresá números enteros entre 0 y 10.000.000."); return; }
    saveBusy = true; const button = settings.querySelector("button[type=submit]"); button.disabled = true;
    const current = generation;
    try {
      const verified = get("metrics-verified").checked;
      const rows = await api(`/rest/v1/site_settings?id=eq.1&revision=eq.${revision}&select=client_count,team_count,metrics_verified,revision`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ client_count: count, team_count: teams, metrics_verified: verified }) });
      if (rows?.length !== 1 || rows[0].client_count !== count || rows[0].team_count !== teams || rows[0].metrics_verified !== verified || !Number.isSafeInteger(rows[0].revision)) throw new Error("conflict");
      revision = rows[0].revision;
      message(verified ? "Cifras verificadas guardadas y auditadas." : "Guardado como no verificado: las cifras no se publicarán.");
    } catch { if (current === generation) message("No se guardó el cambio. Puede haber otra edición; recargá los datos o volvé a ingresar."); }
    finally { saveBusy = false; button.disabled = false; }
  });
  get("logout").addEventListener("click", logout);
  get("cancel-session").addEventListener("click", logout);
  get("refresh-inbox").addEventListener("click", () => { page = 0; void loadInbox(); });
  get("previous-page").addEventListener("click", () => { if (page > 0 && !inboxBusy) { page--; void loadInbox(); } });
  get("next-page").addEventListener("click", () => { if (!inboxBusy) { page++; void loadInbox(); } });
  get("admin-login-fields").disabled = !(http && config.supabaseUrl && config.supabasePublishableKey);
  if (!http || !config.supabaseUrl || !config.supabasePublishableKey) message("El panel no está configurado o faltan scripts seguros.");
})();
