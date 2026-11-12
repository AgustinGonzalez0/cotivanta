(() => {
  "use strict";
  // Parte «agencia» de la página: tarjetas de categorías y selectores del formulario de clientes,
  // generados a partir de assets/catalog.js. El envío del formulario vive en app.js.
  const catalog = window.COTIVANTA_CATALOG;
  if (!catalog) return;
  const get = (id) => document.getElementById(id);
  // Mismo criterio de idioma inicial que app.js; después se sigue el atributo lang del documento.
  let lang = (navigator.language || "").toLowerCase().startsWith("en") ? "en" : "es";
  const text = (key) => (window.COTIVANTA_COPY?.[lang]?.[key]) ?? "";
  const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  const serviceLabel = (service) => (lang === "en" ? service[2] : service[1]);
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  function node(tag, className, content, attributes = {}) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
  }
  function option(value, label) {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = label;
    return element;
  }
  // Conserva el primer <option> (el marcador «Elegí…», traducido por app.js) y reemplaza el resto.
  function keepPlaceholder(select) {
    [...select.options].forEach((item, index) => { if (index > 0 || item.value !== "") item.remove(); });
  }

  /* ---------- Tarjetas de categorías ---------- */
  function renderCategories() {
    const grid = get("category-grid");
    if (!grid) return;
    const cards = catalog.categories.map((category, index) => {
      const card = node("article", "service-card" + (category.open ? " service-card-alt" : ""));
      card.dataset.category = category.id;
      card.append(
        node("span", "service-emoji", category.icon, { "aria-hidden": "true" }),
        node("span", "service-number", String(index + 1).padStart(2, "0") + " /", { "aria-hidden": "true" }),
        node("h3", "", category[lang].name),
        node("p", "", category[lang].description),
      );
      if (category.services.length) {
        const list = node("ul", "service-chips", undefined, { "aria-label": fill(text("serviceChipsLabel"), { name: category[lang].name }) });
        for (const service of category.services) {
          const item = node("li");
          const chip = node("button", "service-chip", serviceLabel(service), { type: "button" });
          chip.dataset.category = category.id;
          chip.dataset.service = service[0];
          item.append(chip);
          list.append(item);
        }
        card.append(list);
      }
      const action = node("button", "service-choose", category.open ? text("serviceOtherLink") : text("serviceRequest"), { type: "button" });
      action.dataset.category = category.id;
      card.append(action);
      return card;
    });
    grid.replaceChildren(...cards);
  }

  /* ---------- Formulario de clientes: categoría → servicio ---------- */
  function renderServices() {
    const categorySelect = get("category"), serviceSelect = get("service");
    if (!categorySelect || !serviceSelect) return;
    const category = catalog.categories.find((item) => item.id === categorySelect.value);
    const previous = serviceSelect.value;
    keepPlaceholder(serviceSelect);
    if (category) {
      for (const service of category.services) serviceSelect.append(option(service[0], serviceLabel(service)));
      serviceSelect.append(option(catalog.otherService, text("serviceCustom")));
      const valid = previous !== "" && [...serviceSelect.options].some((item) => item.value === previous);
      // La categoría abierta («Otros servicios») solo tiene la opción personalizada: ya queda elegida.
      serviceSelect.value = valid ? previous : category.services.length === 0 ? catalog.otherService : "";
    } else {
      serviceSelect.value = "";
    }
  }
  function renderRequestSelects() {
    const categorySelect = get("category");
    if (categorySelect) {
      const previous = categorySelect.value;
      keepPlaceholder(categorySelect);
      for (const category of catalog.categories) categorySelect.append(option(category.id, category[lang].name));
      categorySelect.value = catalog.categories.some((item) => item.id === previous) ? previous : "";
    }
    renderServices();
    const currency = get("budget-currency");
    if (currency) {
      const previous = currency.value;
      currency.replaceChildren(...catalog.currencies.map((item) => option(item[0], lang === "en" ? item[2] : item[1])));
      currency.value = previous || (lang === "en" ? "USD" : "ARS");
    }
  }
  function syncBudget() {
    const row = get("budget-amount-row"), mode = get("budget");
    if (!row || !mode) return;
    const amount = mode.value === "amount";
    row.hidden = !amount;
    get("budget-amount").required = amount;
    get("budget-currency").required = amount;
    if (!amount) get("budget-amount").setCustomValidity("");
  }
  function limitDeadline() {
    const deadline = get("deadline");
    if (!deadline) return;
    const now = new Date();
    deadline.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  /* ---------- Desde una tarjeta hacia el formulario ---------- */
  function goToRequest(categoryId, serviceId) {
    const request = get("request"), categorySelect = get("category"), serviceSelect = get("service");
    if (categorySelect && !categorySelect.disabled) {
      categorySelect.value = categoryId;
      renderServices();
      if (serviceId && [...serviceSelect.options].some((item) => item.value === serviceId)) serviceSelect.value = serviceId;
    }
    request?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    // Con el servicio ya elegido, lo siguiente es describir el pedido; si no, elegirlo.
    const next = serviceSelect?.value ? get("description") : serviceSelect;
    next?.focus({ preventScroll: true });
  }
  get("category-grid")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (button) goToRequest(button.dataset.category, button.dataset.service || "");
  });
  get("category")?.addEventListener("change", renderServices);
  get("budget")?.addEventListener("change", syncBudget);
  get("project-form")?.addEventListener("reset", () => setTimeout(() => { renderRequestSelects(); syncBudget(); }, 0));

  function renderAll() {
    renderCategories();
    renderRequestSelects();
  }
  renderAll();
  syncBudget();
  limitDeadline();
  new MutationObserver(() => {
    const next = document.documentElement.lang === "en" ? "en" : "es";
    if (next === lang) return;
    lang = next;
    renderAll();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})();
