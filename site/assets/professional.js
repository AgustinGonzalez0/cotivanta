(() => {
  "use strict";
  // Formulario «Trabajá con Cotivanta»: postulación de profesionales independientes.
  // Misma protección que el formulario de clientes: Turnstile, honeypot, clave de envío única y validación previa.
  // La validación definitiva ocurre en el servidor (supabase/functions/project-request/handler.ts).
  const form = document.getElementById("pro-form");
  const catalog = window.COTIVANTA_CATALOG;
  if (!form || !catalog) return;
  const get = (id) => document.getElementById(id);
  const cfg = window.COTIVANTA_CONFIG || {};
  const http = window.CotivantaHTTP;
  let lang = (navigator.language || "").toLowerCase().startsWith("en") ? "en" : "es";
  const text = (key) => (window.COTIVANTA_COPY?.[lang]?.[key]) ?? "";
  const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

  const fields = get("pro-fields"), message = get("pro-message"), submit = get("pro-submit"), success = get("pro-success");
  const enabled = cfg.professionalApplicationsEnabled === true && !!cfg.apiUrl && !!cfg.turnstileSiteKey && !!http && typeof window.crypto?.randomUUID === "function";

  const selectedSpecialties = new Set();
  const selectedLanguages = new Set();
  const openGroups = new Set();
  let messageKey = "", captchaToken = "", widgetId, captchaLoading = false, inFlight = false, submissionKey = "", signature = "";

  function node(tag, className, content, attributes = {}) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
  }
  function checkbox(name, value, label, checked) {
    const wrapper = node("label", "check");
    const input = node("input", "", undefined, { type: "checkbox", name, value });
    input.checked = checked;
    wrapper.append(input, node("span", "", label));
    return wrapper;
  }

  /* ---------- Especialidades, idiomas y moneda (desde el catálogo) ---------- */
  function renderSpecialties() {
    const container = get("pro-specialties");
    if (!container) return;
    const groups = catalog.categories.filter((category) => category.services.length > 0).map((category) => {
      const details = node("details", "spec-group");
      details.dataset.category = category.id;
      details.open = openGroups.has(category.id);
      const summary = node("summary", "");
      summary.append(node("span", "spec-name", category[lang].name), node("small", "spec-count"));
      const grid = node("div", "check-grid");
      for (const [slug, es, en] of category.services) grid.append(checkbox("specialties", slug, lang === "en" ? en : es, selectedSpecialties.has(slug)));
      details.append(summary, grid);
      return details;
    });
    container.replaceChildren(...groups);
    updateSpecialtyCounts();
  }
  function updateSpecialtyCounts() {
    for (const details of document.querySelectorAll("#pro-specialties .spec-group")) {
      const category = catalog.categories.find((item) => item.id === details.dataset.category);
      const count = category.services.filter((service) => selectedSpecialties.has(service[0])).length;
      details.querySelector(".spec-count").textContent = count ? fill(text("proSpecCount"), { n: count }) : "";
    }
  }
  function renderLanguages() {
    const container = get("pro-languages");
    if (!container) return;
    container.replaceChildren(...catalog.languages.map(([code, es, en]) => checkbox("languages", code, lang === "en" ? en : es, selectedLanguages.has(code))));
  }
  function renderCurrency() {
    const select = get("pro-currency");
    if (!select) return;
    const previous = select.value;
    [...select.options].forEach((item, index) => { if (index > 0) item.remove(); });
    for (const [code, es, en] of catalog.currencies) {
      const item = document.createElement("option");
      item.value = code;
      item.textContent = lang === "en" ? en : es;
      select.append(item);
    }
    select.value = previous;
  }
  function renderAll() {
    renderSpecialties();
    renderLanguages();
    renderCurrency();
    if (messageKey) message.textContent = text(messageKey);
  }

  /* ---------- Validación en el navegador (el servidor repite todo) ---------- */
  const phoneIsValid = (value) => value === "" || (/^\+?[0-9\s().-]{6,30}$/.test(value) && value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 15);
  const normalizeUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    // Quien escribe «behance.net/usuario» sin esquema no debería recibir un error por eso.
    return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : "https://" + trimmed.replace(/^\/+/, "");
  };
  function httpsHost(value) {
    if (value.length < 12 || value.length > 300 || /\s/.test(value)) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,63}$/.test(url.hostname) ? url.hostname : null;
    } catch { return null; }
  }
  const isLinkedin = (host) => host === "linkedin.com" || host.endsWith(".linkedin.com");
  const splitLinks = (value) => [...new Set(value.split(/[\s,]+/).filter(Boolean).map(normalizeUrl))];

  function check(id, invalidMessage) {
    const input = get(id);
    input.setCustomValidity(invalidMessage ? text(invalidMessage) : "");
  }
  function validateAll() {
    for (const id of ["pro-name", "pro-country", "pro-city", "pro-email", "pro-other-specialty", "pro-experience", "pro-whatsapp", "pro-years", "pro-rate-amount"]) {
      const input = get(id);
      input.value = input.value.trim();
    }
    for (const id of ["pro-portfolio", "pro-linkedin"]) get(id).value = normalizeUrl(get(id).value);
    get("pro-links").value = splitLinks(get("pro-links").value).join("\n");
    for (const [id, minimum, message] of [["pro-name", 2, "proErrText"], ["pro-country", 2, "proErrText"], ["pro-experience", 30, "proErrExperience"]]) check(id, get(id).value.length < minimum ? message : "");
    const portfolioHost = httpsHost(get("pro-portfolio").value);
    check("pro-portfolio", portfolioHost ? "" : "proErrUrl");
    const linkedin = get("pro-linkedin").value, linkedinHost = linkedin ? httpsHost(linkedin) : "";
    check("pro-linkedin", linkedin && (!linkedinHost || !isLinkedin(linkedinHost)) ? "proErrLinkedin" : "");
    const links = splitLinks(get("pro-links").value);
    check("pro-links", links.length > 5 || links.some((link) => !httpsHost(link)) ? "proErrLinks" : "");
    check("pro-whatsapp", phoneIsValid(get("pro-whatsapp").value) ? "" : "proErrPhone");
    const years = get("pro-years").value;
    check("pro-years", years !== "" && !(/^\d{1,2}$/.test(years) && Number(years) <= 60) ? "proErrYears" : "");
    const rate = get("pro-rate-amount").value;
    check("pro-rate-amount", rate !== "" && !(Number(rate) > 0) ? "proErrAmount" : "");
    // Las especialidades viven en grupos plegables: se abre el primero para que el aviso sea visible y enfocable.
    const firstSpecialty = document.querySelector('#pro-specialties input[type="checkbox"]');
    const missingSpecialty = selectedSpecialties.size === 0 && !get("pro-other-specialty").value;
    if (firstSpecialty) {
      if (missingSpecialty) firstSpecialty.closest("details").open = true;
      firstSpecialty.setCustomValidity(missingSpecialty ? text("proErrSpecialty") : "");
    }
    const firstLanguage = document.querySelector('#pro-languages input[type="checkbox"]');
    if (firstLanguage) firstLanguage.setCustomValidity(selectedLanguages.size === 0 ? text("proErrLanguage") : "");
  }

  /* ---------- Turnstile (se carga al primer uso para no pedir nada a Cloudflare a quien no postula) ---------- */
  const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    return new Promise((resolve, reject) => {
      let script = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (!script) {
        script = document.createElement("script");
        script.src = TURNSTILE_SRC;
        script.async = true;
        document.head.append(script);
      }
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.turnstile) { clearInterval(timer); resolve(window.turnstile); }
        else if (Date.now() - started > 15000) { clearInterval(timer); reject(new Error("captcha")); }
      }, 150);
      script.addEventListener("error", () => { clearInterval(timer); reject(new Error("captcha")); });
    });
  }
  async function ensureCaptcha() {
    if (!enabled || widgetId !== undefined || captchaLoading) return;
    captchaLoading = true;
    try {
      const turnstile = await loadTurnstile();
      widgetId = turnstile.render("#pro-turnstile", {
        sitekey: cfg.turnstileSiteKey,
        action: "professional_application",
        theme: "light",
        callback: (token) => { captchaToken = token; },
        "expired-callback": () => { captchaToken = ""; },
        "error-callback": () => { captchaToken = ""; showMessage("proCaptchaUnavailable"); },
      });
    } catch { showMessage("proCaptchaUnavailable"); }
    finally { captchaLoading = false; }
  }

  function showMessage(key) {
    messageKey = key;
    message.textContent = text(key);
    message.hidden = false;
  }
  function hideMessage() {
    messageKey = "";
    message.hidden = true;
  }

  /* ---------- Envío ---------- */
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (inFlight) return;
    if (!enabled) { showMessage("proUnavailable"); return; }
    hideMessage();
    validateAll();
    if (!form.checkValidity()) {
      form.reportValidity();
      showMessage("proInvalid");
      return;
    }
    if (!captchaToken) {
      await ensureCaptcha();
      if (!messageKey) showMessage("proCaptcha");
      return;
    }
    const rate = get("pro-rate-amount").value, years = get("pro-years").value;
    const payload = {
      form: "professional-application",
      fullName: get("pro-name").value,
      email: get("pro-email").value,
      country: get("pro-country").value,
      city: get("pro-city").value,
      whatsapp: get("pro-whatsapp").value,
      specialties: [...selectedSpecialties],
      otherSpecialty: get("pro-other-specialty").value,
      experience: get("pro-experience").value,
      yearsExperience: years === "" ? undefined : Number(years),
      portfolioUrl: get("pro-portfolio").value,
      linkedinUrl: get("pro-linkedin").value,
      otherLinks: splitLinks(get("pro-links").value),
      languages: [...selectedLanguages],
      availability: get("pro-availability").value,
      rateModel: get("pro-rate-model").value,
      rateAmount: rate === "" ? undefined : Number(rate),
      rateCurrency: get("pro-currency").value,
      language: lang,
      consent: get("pro-consent").checked,
      privacyVersion: form.dataset.privacyVersion,
      faxNumber: get("pro-fax").value,
    };
    // Un reintento del MISMO contenido reutiliza la clave: el servidor no crea una segunda postulación.
    const currentSignature = JSON.stringify(payload);
    if (!submissionKey || signature !== currentSignature) {
      submissionKey = window.crypto.randomUUID();
      signature = currentSignature;
    }
    payload.submissionKey = submissionKey;
    payload.turnstileToken = captchaToken;
    inFlight = true;
    fields.disabled = true;
    form.setAttribute("aria-busy", "true");
    submit.disabled = true;
    submit.querySelector("[data-i18n]").textContent = text("proSending");
    try {
      const { response, body: result } = await http.json(cfg.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 409 && result?.code === "policy_changed") { get("pro-consent").checked = false; showMessage("proPolicyChanged"); return; }
      if (response.status === 429) { showMessage("proRateLimited"); return; }
      if (response.status === 403) { showMessage("proCaptchaUnavailable"); return; }
      if (response.status === 400) { showMessage("proInvalid"); return; }
      if (response.status === 409) { submissionKey = ""; showMessage("proFailure"); return; }
      if (!response.ok || result?.ok !== true || typeof result.applicationId !== "string") throw new Error("Unconfirmed receipt");
      form.hidden = true;
      success.hidden = false;
      get("pro-reference").textContent = text("proReference") + result.applicationId;
      success.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      success.focus({ preventScroll: true });
    } catch {
      showMessage("proUncertain");
    } finally {
      inFlight = false;
      fields.disabled = false;
      form.setAttribute("aria-busy", "false");
      submit.disabled = false;
      submit.querySelector("[data-i18n]").textContent = text("proSubmit");
      captchaToken = "";
      if (window.turnstile && widgetId !== undefined) window.turnstile.reset(widgetId);
    }
  });

  /* ---------- Eventos ---------- */
  form.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches('input[name="specialties"]')) {
      target.checked ? selectedSpecialties.add(target.value) : selectedSpecialties.delete(target.value);
      updateSpecialtyCounts();
    } else if (target.matches('input[name="languages"]')) {
      target.checked ? selectedLanguages.add(target.value) : selectedLanguages.delete(target.value);
    }
  });
  form.addEventListener("input", (event) => {
    event.target.setCustomValidity?.("");
    // Las condiciones de grupo se reevalúan al enviar; mientras tanto, no dejan el aviso pegado.
    if (event.target.matches('input[name="specialties"], #pro-other-specialty')) document.querySelector('#pro-specialties input[type="checkbox"]')?.setCustomValidity("");
    if (event.target.matches('input[name="languages"]')) document.querySelector('#pro-languages input[type="checkbox"]')?.setCustomValidity("");
  });
  // Recordar qué grupos están abiertos para no plegarlos al cambiar de idioma.
  form.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!details.matches?.(".spec-group")) return;
    details.open ? openGroups.add(details.dataset.category) : openGroups.delete(details.dataset.category);
  }, true);
  form.addEventListener("focusin", ensureCaptcha);
  get("pro-reset")?.addEventListener("click", () => {
    form.reset();
    selectedSpecialties.clear();
    selectedLanguages.clear();
    submissionKey = "";
    signature = "";
    hideMessage();
    renderAll();
    form.hidden = false;
    success.hidden = true;
    if (window.turnstile && widgetId !== undefined) window.turnstile.reset(widgetId);
    captchaToken = "";
  });

  renderAll();
  // Habilitar solo cuando el controlador de envío ya está registrado: sin JavaScript el formulario queda bloqueado.
  fields.disabled = !enabled;
  submit.disabled = !enabled;
  get("pro-intake-status").hidden = enabled;
  new MutationObserver(() => {
    const next = document.documentElement.lang === "en" ? "en" : "es";
    if (next === lang) return;
    lang = next;
    renderAll();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})();
