(() => {
  "use strict";
  const config = window.COTIVANTA_CONFIG || {};
  const login = document.getElementById("login-form");
  const settings = document.getElementById("settings-form");
  const message = document.getElementById("admin-message");
  const input = document.getElementById("client-count-input");
  const teamInput = document.getElementById("team-count-input");
  const password = document.getElementById("admin-password");
  let accessToken = "";

  const headers = () => ({
    apikey: config.supabasePublishableKey,
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  });
  const setMessage = (text) => {
    message.textContent = text;
  };
  const clearSession = () => {
    accessToken = "";
    password.value = "";
    settings.hidden = true;
    login.hidden = false;
  };
  const readCount = async () => {
    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/site_settings?id=eq.1&select=client_count,team_count`,
      { headers: headers() },
    );
    if (!response.ok) throw new Error("read");
    const rows = await response.json();
    if (
      !Array.isArray(rows) ||
      !Number.isSafeInteger(rows[0]?.client_count) ||
      !Number.isSafeInteger(rows[0]?.team_count)
    )
      throw new Error("missing");
    return rows[0];
  };
  login.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      setMessage("El panel todavía no está configurado.");
      return;
    }
    const submit = login.querySelector("button[type=submit]");
    submit.disabled = true;
    setMessage("Ingresando…");
    try {
      const response = await fetch(
        `${config.supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            email: document.getElementById("admin-email").value.trim(),
            password: password.value,
          }),
        },
      );
      if (!response.ok) throw new Error("login");
      const session = await response.json();
      if (
        !session.access_token ||
        session.user?.app_metadata?.cotivanta_admin !== true
      )
        throw new Error("forbidden");
      accessToken = session.access_token;
      password.value = "";
      const values = await readCount();
      input.value = String(values.client_count);
      teamInput.value = String(values.team_count);
      login.hidden = true;
      settings.hidden = false;
      setMessage("");
      input.focus();
    } catch {
      clearSession();
      setMessage(
        "No se pudo ingresar. Revisá tus datos o consultá si la cuenta está autorizada y el panel está configurado.",
      );
    } finally {
      submit.disabled = false;
    }
  });
  settings.addEventListener("submit", async (event) => {
    event.preventDefault();
    const count = Number(input.value);
    const teams = Number(teamInput.value);
    if (
      !input.checkValidity() ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > 10000000 ||
      !teamInput.checkValidity() ||
      !Number.isSafeInteger(teams) ||
      teams < 0 ||
      teams > 10000000
    ) {
      setMessage("Ingresá un número entero entre 0 y 10.000.000.");
      return;
    }
    const submit = settings.querySelector("button[type=submit]");
    submit.disabled = true;
    setMessage("Guardando…");
    try {
      const response = await fetch(
        `${config.supabaseUrl}/rest/v1/site_settings?id=eq.1&select=client_count,team_count`,
        {
          method: "PATCH",
          headers: { ...headers(), Prefer: "return=representation" },
          body: JSON.stringify({ client_count: count, team_count: teams }),
        },
      );
      if (response.status === 401) {
        clearSession();
        throw new Error("expired");
      }
      if (!response.ok) throw new Error("save");
      const rows = await response.json();
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        rows[0].client_count !== count ||
        rows[0].team_count !== teams
      )
        throw new Error("not saved");
      setMessage(
        "Guardado. La página pública mostrará el nuevo número al actualizarse.",
      );
    } catch {
      setMessage(
        "No se guardó el cambio. Revisá la conexión o volvé a iniciar sesión.",
      );
    } finally {
      submit.disabled = false;
    }
  });
  document.getElementById("logout").addEventListener("click", () => {
    clearSession();
    setMessage("Sesión cerrada en este navegador.");
  });
})();
