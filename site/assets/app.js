(() => {
  "use strict";
  const translations = {
    es: {
      skip: "Ir al contenido",
      navServices: "Servicios",
      navProcess: "Cómo trabajamos",
      navAbout: "Para quiénes",
      navFaq: "Preguntas",
      navCta: "Pedir presupuesto",
      heroBadge: "ESTUDIO DIGITAL · PROYECTOS A MEDIDA",
      heroTitle: "Tu idea merece <em>hacerse realidad.</em>",
      heroDesc:
        "Diseñamos y desarrollamos sitios web, aplicaciones y software a medida. No importa si sos una persona, emprendimiento o empresa: contanos qué querés crear.",
      heroCta: "Contanos tu proyecto",
      heroSecondary: "Explorar servicios",
      heroNote:
        "Escuchamos tu necesidad, evaluamos el alcance y te proponemos una solución. Sin compromiso inicial de contratación.",
      visualEyebrow: "TU PROYECTO, NUESTRA PRÓXIMA IDEA",
      visualTitle: "¿Qué podemos crear juntos?",
      visualWeb: "Sitio web",
      visualWebSub: "Rápido y profesional",
      visualApp: "Aplicación",
      visualAppSub: "Web o móvil",
      visualAutomation: "Automatización",
      visualAutomationSub: "Menos trabajo manual",
      visualSoftware: "Software propio",
      visualSoftwareSub: "A tu medida",
      visualFooter: "Y si tu idea es diferente, también queremos escucharla.",
      floatingTop: "Tu idea, sin límites de rubro",
      floatingTopSub: "Proyectos personales y comerciales",
      floatingBottom: "Presupuesto personalizado",
      floatingBottomSub: "Luego de conocer tu proyecto",
      sectorIntro: "TECNOLOGÍA PARA LAS IDEAS QUE MUEVEN EL MUNDO",
      pill1: "Personas",
      pill2: "Emprendedores",
      pill3: "Profesionales",
      pill4: "Pymes",
      pill5: "Empresas",
      servicesEyebrow: "QUÉ HACEMOS",
      servicesTitle: "Un socio tecnológico para <span>cada gran idea.</span>",
      servicesDesc:
        "Desde una web para comenzar a vender hasta un sistema que transforme la forma de trabajar. Elegí una categoría o contanos una necesidad diferente.",
      serviceWebTitle: "Páginas web",
      serviceWebDesc:
        "Landings, páginas institucionales, portfolios y sitios comerciales que representen tu marca.",
      serviceAppTitle: "Apps web y móviles",
      serviceAppDesc:
        "Productos digitales, plataformas y herramientas para tus clientes o tu equipo.",
      serviceAutoTitle: "Automatizaciones",
      serviceAutoDesc:
        "Procesos, tareas y seguimientos que hoy te hacen perder horas de trabajo.",
      serviceSoftTitle: "Software a medida",
      serviceSoftDesc:
        "Sistemas administrativos, portales, paneles y soluciones internas específicas.",
      serviceIntegrationsTitle: "Integraciones",
      serviceIntegrationsDesc:
        "Conectá tus herramientas, APIs, bases de datos y servicios existentes.",
      serviceOtherTitle: "¿Tenés otra idea?",
      serviceOtherDesc:
        "No hace falta que sepas cómo desarrollarla. Describinos lo que imaginás y evaluamos si podemos ayudarte.",
      serviceLink: "Consultar este servicio ↗",
      serviceOtherLink: "Contanos tu idea ↗",
      processEyebrow: "EL PROCESO",
      processTitle:
        "De la primera charla <br/><span>al producto terminado.</span>",
      processDesc:
        "Trabajamos con alcances claros. Antes de empezar, revisamos la viabilidad, las funcionalidades, los plazos y el presupuesto. Cada propuesta depende de la complejidad de tu proyecto.",
      processLink: "Empezar con una consulta",
      step1Title: "Contanos qué necesitás",
      step1Desc: "Completá el formulario con tu idea o problema.",
      step2Title: "Evaluamos la propuesta",
      step2Desc:
        "Revisamos si podemos ayudarte y qué preguntas faltan responder.",
      step3Title: "Definimos alcance y presupuesto",
      step3Desc:
        "Acordamos entregables, etapas, costo y condiciones antes de avanzar.",
      step4Title: "Construimos y entregamos",
      step4Desc:
        "Desarrollamos el proyecto acordado con seguimiento y revisiones.",
      audienceEyebrow: "SIN LIMITARNOS A UN RUBRO",
      audienceTitle:
        "Ideas grandes, pequeñas <span>y completamente nuevas.</span>",
      audienceDesc:
        "Podés venir con una idea recién pensada o con un negocio en funcionamiento. No necesitás conocimientos técnicos para escribirnos.",
      audience1: "Personas",
      audience1Sub: "Proyectos personales",
      audience2: "Emprendedores",
      audience2Sub: "Ideas y nuevos negocios",
      audience3: "Profesionales",
      audience3Sub: "Herramientas para trabajar",
      audience4: "Pymes",
      audience4Sub: "Operaciones y crecimiento",
      audience5: "Equipos",
      audience5Sub: "Software e integraciones",
      ctaEyebrow: "HABLEMOS DE TU IDEA",
      ctaTitle:
        "No necesitás saber programar. <em>Solo saber qué querés mejorar.</em>",
      ctaDesc:
        "Cotivanta está dando sus primeros pasos. Estamos recibiendo consultas para evaluar proyectos y desarrollar propuestas personalizadas. No publicamos clientes ficticios ni prometemos entregas sin revisar el alcance.",
      ctaButton: "Solicitar una propuesta",
      faqEyebrow: "PREGUNTAS FRECUENTES",
      faqTitle: "Resolvemos tus<br/>primeras dudas.",
      faq1Q: "¿Solo trabajan con empresas?",
      faq1A:
        "No. Recibimos consultas de personas, profesionales, emprendimientos y empresas. Evaluamos cada proyecto según su alcance y viabilidad.",
      faq2Q: "¿Cuánto cuesta un proyecto?",
      faq2A:
        "El precio depende de las funcionalidades, integraciones y esfuerzo necesario. Primero conocemos tu idea y luego presentamos una propuesta si podemos realizarla.",
      faq3Q: "¿Puedo pedir algo que no aparece en servicios?",
      faq3A:
        "Sí. Seleccioná «Otro proyecto» y explicá qué necesitás. Te diremos si podemos ayudarte; no todos los proyectos serán aceptados.",
      faq4Q: "¿La consulta tiene costo?",
      faq4A:
        "Enviar la solicitud inicial no tiene costo ni genera un compromiso de contratación. Cualquier trabajo pago requiere una propuesta acordada previamente.",
      formEyebrow: "EMPECEMOS",
      formTitle: "Contanos tu idea. <span>Nosotros vemos cómo crearla.</span>",
      formDesc:
        "Describí lo que necesitás con tus palabras. Revisaremos tu solicitud y, si podemos trabajar en ella, te contactaremos para conversar sobre el alcance.",
      formPoint1: "Consultas de personas y empresas",
      formPoint2: "Presupuesto adaptado a cada proyecto",
      formPoint3: "Sin obligación de contratar",
      formTag: "SOLICITUD DE PROYECTO",
      formCardTitle: "Hablemos de lo que querés construir.",
      formCardDesc: "Los campos con * son obligatorios.",
      labelName: "Nombre completo *",
      labelEmail: "Correo electrónico *",
      labelClient: "Sos... *",
      clientChoose: "Elegí una opción",
      clientIndividual: "Particular",
      clientEntrepreneur: "Emprendedor/a",
      clientProfessional: "Profesional",
      clientBusiness: "Empresa / equipo",
      labelService: "Qué necesitás *",
      serviceChoose: "Elegí un servicio",
      optWebsite: "Página web",
      optApp: "App web o móvil",
      optAuto: "Automatización",
      optSoftware: "Software a medida",
      optIntegration: "Integración de herramientas",
      optOther: "Otro proyecto",
      labelDescription: "Describí tu proyecto *",
      descriptionHint:
        "No hace falta que sea técnico. Unos pocos detalles nos ayudan a entenderlo.",
      descriptionPlaceholder:
        "¿Qué problema querés resolver? ¿Para quién sería? ¿Qué debería poder hacer?",
      labelBudget: "Presupuesto estimado",
      budgetUnsure: "Todavía no lo sé",
      labelTimeline: "¿Para cuándo lo necesitás?",
      timelineFlexible: "Flexible / por definir",
      timelineMonth: "Dentro de 1 mes",
      timelineQuarter: "En 1 a 3 meses",
      timelineLater: "Más adelante",
      labelOrganization: "Empresa o marca (opcional)",
      labelLanguage: "Idioma preferido",
      consentText:
        'Acepto que Cotivanta use estos datos para evaluar y responder mi solicitud, y leí el <a href="privacy.html">Aviso de privacidad</a>.',
      formSubmit: "Enviar solicitud",
      formFootnote:
        "Enviar la consulta no garantiza la aceptación del proyecto.",
      successTitle: "Solicitud recibida.",
      successDesc:
        "Gracias por contarnos tu proyecto. Vamos a revisarlo y te contactaremos si podemos ayudarte.",
      successReset: "Enviar otra solicitud ↗",
      footerTag: "Ideas que se convierten en soluciones digitales.",
      footerServices: "Servicios",
      footerRequest: "Pedir presupuesto",
      footerPrivacy: "Privacidad",
      footerRights: "Todos los derechos reservados.",
      footerStage: "Estudio digital independiente · Recibiendo consultas.",
      invalid: "Revisá los campos obligatorios e ingresá información válida.",
      captcha: "Completá la verificación de seguridad.",
      config:
        "El formulario todavía no está conectado. El responsable de Cotivanta debe configurar el backend antes de recibir solicitudes.",
      failure: "No pudimos enviar la solicitud. Intentá nuevamente más tarde.",
      sending: "Enviando solicitud...",
    },
    en: {
      skip: "Skip to content",
      navServices: "Services",
      navProcess: "Our process",
      navAbout: "Who we help",
      navFaq: "FAQ",
      navCta: "Get a quote",
      heroBadge: "DIGITAL STUDIO · CUSTOM PROJECTS",
      heroTitle: "Your idea deserves <em>to become real.</em>",
      heroDesc:
        "We design and build websites, apps, and custom software. Whether you are an individual, entrepreneur, or company, tell us what you want to create.",
      heroCta: "Tell us about your project",
      heroSecondary: "Explore our services",
      heroNote:
        "We listen, review the scope, and suggest a solution. No commitment to hire us just to ask.",
      visualEyebrow: "YOUR PROJECT, OUR NEXT IDEA",
      visualTitle: "What can we build together?",
      visualWeb: "Website",
      visualWebSub: "Fast and professional",
      visualApp: "Application",
      visualAppSub: "Web or mobile",
      visualAutomation: "Automation",
      visualAutomationSub: "Less manual work",
      visualSoftware: "Custom software",
      visualSoftwareSub: "Built for your needs",
      visualFooter: "And if your idea is different, we want to hear it too.",
      floatingTop: "Your idea, any industry",
      floatingTopSub: "Personal and business projects",
      floatingBottom: "Custom project quote",
      floatingBottomSub: "After we learn about your needs",
      sectorIntro: "TECHNOLOGY FOR PEOPLE WITH IDEAS",
      pill1: "Individuals",
      pill2: "Entrepreneurs",
      pill3: "Professionals",
      pill4: "Small businesses",
      pill5: "Companies",
      servicesEyebrow: "WHAT WE DO",
      servicesTitle:
        "A technology partner for <span>every ambitious idea.</span>",
      servicesDesc:
        "From launching a website to building software that changes how your team works. Choose a service or tell us about something different.",
      serviceWebTitle: "Websites",
      serviceWebDesc:
        "Landing pages, company websites, portfolios, and online experiences that represent your brand.",
      serviceAppTitle: "Web & mobile apps",
      serviceAppDesc:
        "Digital products, platforms, and tools for your customers or your team.",
      serviceAutoTitle: "Automation",
      serviceAutoDesc:
        "Processes, repetitive tasks, and follow-ups that consume too much time.",
      serviceSoftTitle: "Custom software",
      serviceSoftDesc:
        "Internal tools, management systems, portals, and dashboards tailored to you.",
      serviceIntegrationsTitle: "Integrations",
      serviceIntegrationsDesc:
        "Connect your existing tools, APIs, databases, and services.",
      serviceOtherTitle: "Something else in mind?",
      serviceOtherDesc:
        "You do not need to know how to build it. Describe your idea and we will assess whether we can help.",
      serviceLink: "Ask about this service ↗",
      serviceOtherLink: "Tell us your idea ↗",
      processEyebrow: "HOW IT WORKS",
      processTitle:
        "From the first conversation <br/><span>to the finished project.</span>",
      processDesc:
        "We define clear project scopes. Before any work begins, we review feasibility, functionality, timelines, and budget. Every proposal depends on your project’s complexity.",
      processLink: "Start with a conversation",
      step1Title: "Tell us what you need",
      step1Desc: "Share your idea or the problem you want to solve.",
      step2Title: "We assess the project",
      step2Desc: "We check if we can help and what details are still needed.",
      step3Title: "We agree on scope and price",
      step3Desc: "We define deliverables, stages, pricing, and terms up front.",
      step4Title: "We build and deliver",
      step4Desc: "We develop the agreed project with updates and reviews.",
      audienceEyebrow: "NOT LIMITED TO ONE INDUSTRY",
      audienceTitle:
        "Big ideas, small ideas, <span>and brand-new ideas.</span>",
      audienceDesc:
        "Come to us with a brand-new concept or an established business. No technical background required.",
      audience1: "Individuals",
      audience1Sub: "Personal projects",
      audience2: "Entrepreneurs",
      audience2Sub: "Ideas and new ventures",
      audience3: "Professionals",
      audience3Sub: "Tools for daily work",
      audience4: "Small businesses",
      audience4Sub: "Operations and growth",
      audience5: "Teams",
      audience5Sub: "Software and integrations",
      ctaEyebrow: "LET’S TALK ABOUT YOUR IDEA",
      ctaTitle:
        "You don’t need to know how to code. <em>Just what you want to improve.</em>",
      ctaDesc:
        "Cotivanta is just getting started. We are accepting inquiries to assess projects and prepare custom proposals. We do not publish fictional client stories or promise delivery before reviewing scope.",
      ctaButton: "Request a proposal",
      faqEyebrow: "FREQUENT QUESTIONS",
      faqTitle: "A few things you<br/>may be wondering.",
      faq1Q: "Do you only work with businesses?",
      faq1A:
        "No. We welcome inquiries from individuals, professionals, startups, and companies. We assess each project for fit and feasibility.",
      faq2Q: "How much does a project cost?",
      faq2A:
        "Pricing depends on features, integrations, and the work involved. We first learn about your project, then send a proposal if we can take it on.",
      faq3Q: "Can I ask about something not listed?",
      faq3A:
        "Yes. Select “Other project” and tell us what you need. We will let you know if we can help; not every project can be accepted.",
      faq4Q: "Is the initial inquiry free?",
      faq4A:
        "Submitting an inquiry is free and does not commit you to hiring us. Any paid work requires an agreed proposal first.",
      formEyebrow: "LET’S GET STARTED",
      formTitle:
        "Tell us your idea. <span>We’ll explore how to build it.</span>",
      formDesc:
        "Describe what you need in your own words. We will review the request and contact you if the project is a fit.",
      formPoint1: "For individuals and businesses",
      formPoint2: "Quotes tailored to each project",
      formPoint3: "No obligation to hire us",
      formTag: "PROJECT INQUIRY",
      formCardTitle: "Tell us what you want to build.",
      formCardDesc: "Fields marked * are required.",
      labelName: "Full name *",
      labelEmail: "Email address *",
      labelClient: "You are... *",
      clientChoose: "Select an option",
      clientIndividual: "An individual",
      clientEntrepreneur: "An entrepreneur",
      clientProfessional: "A professional",
      clientBusiness: "A business / team",
      labelService: "What do you need? *",
      serviceChoose: "Select a service",
      optWebsite: "Website",
      optApp: "Web or mobile app",
      optAuto: "Automation",
      optSoftware: "Custom software",
      optIntegration: "Tool integration",
      optOther: "Other project",
      labelDescription: "Describe your project *",
      descriptionHint:
        "No technical language required. A few details help us understand your needs.",
      descriptionPlaceholder:
        "What problem should it solve? Who is it for? What should it do?",
      labelBudget: "Estimated budget",
      budgetUnsure: "Not sure yet",
      labelTimeline: "When do you need it?",
      timelineFlexible: "Flexible / to be discussed",
      timelineMonth: "Within a month",
      timelineQuarter: "In 1–3 months",
      timelineLater: "Later on",
      labelOrganization: "Company or brand (optional)",
      labelLanguage: "Preferred language",
      consentText:
        'I agree that Cotivanta may use my information to assess and respond to my request, and I have read the <a href="privacy.html">Privacy Notice</a>.',
      formSubmit: "Send project inquiry",
      formFootnote:
        "Submitting an inquiry does not guarantee project acceptance.",
      successTitle: "Inquiry received.",
      successDesc:
        "Thank you for telling us about your project. We’ll review it and contact you if we can help.",
      successReset: "Submit another request ↗",
      footerTag: "Turning ideas into digital solutions.",
      footerServices: "Services",
      footerRequest: "Get a quote",
      footerPrivacy: "Privacy",
      footerRights: "All rights reserved.",
      footerStage: "Independent digital studio · Accepting inquiries.",
      invalid: "Please review required fields and enter valid information.",
      captcha: "Please complete the security verification.",
      config:
        "The form is not connected yet. Cotivanta must configure its backend before accepting submissions.",
      failure: "We could not send your request. Please try again later.",
      sending: "Sending request...",
    },
  };
  Object.assign(translations.es, {
    proofEyebrow: "SEÑALES DE CALIDAD",
    proofTitle: "Ideas serias. <span>Resultados que se sienten.</span>",
    proofDesc:
      "No mostramos clientes ficticios ni prometemos soluciones genéricas. Escuchamos el contexto, diseñamos con intención y construimos una base sólida para que tu proyecto pueda crecer.",
    proofStat1: "clientes atendidos",
    proofStat1Sub: "proyectos y necesidades diferentes",
    proofStat2: "idiomas disponibles",
    proofStat2Sub: "español e inglés",
    proofStat3: "equipos ayudados",
    proofStat3Sub: "soluciones para trabajar mejor",
    proofClientsEyebrow: "PARA QUIÉN TRABAJAMOS",
    proofClientsIntro:
      "Cada cliente llega con una necesidad distinta. La tecnología se adapta a la idea, no al revés.",
    proofClient1: "Personas con una idea",
    proofClient1Sub:
      "Convertimos una primera intuición en un proyecto claro y posible.",
    proofClient2: "Emprendimientos",
    proofClient2Sub:
      "Creamos una presencia digital que ayude a crecer con confianza.",
    proofClient3: "Profesionales y equipos",
    proofClient3Sub:
      "Diseñamos herramientas que ordenan el trabajo y ahorran tiempo.",
    proofClient4: "Empresas en evolución",
    proofClient4Sub:
      "Integramos sistemas y procesos para acompañar nuevos desafíos.",
    proofNote:
      "La cantidad de clientes y casos publicados se actualizará cuando existan resultados verificables para compartir.",
  });
  Object.assign(translations.en, {
    proofEyebrow: "QUALITY, BY DESIGN",
    proofTitle: "Serious ideas. <span>Results you can feel.</span>",
    proofDesc:
      "We do not show fictional clients or promise generic solutions. We listen to the context, design with intention, and build a solid foundation for your project to grow.",
    proofStat1: "clients served",
    proofStat1Sub: "different projects and needs",
    proofStat2: "available languages",
    proofStat2Sub: "Spanish and English",
    proofStat3: "teams supported",
    proofStat3Sub: "solutions for better work",
    proofClientsEyebrow: "WHO WE WORK WITH",
    proofClientsIntro:
      "Every client arrives with a different need. Technology should adapt to the idea, not the other way around.",
    proofClient1: "People with an idea",
    proofClient1Sub:
      "We turn an early intuition into a clear and achievable project.",
    proofClient2: "Entrepreneurs",
    proofClient2Sub:
      "We build a digital presence that helps new ventures grow with confidence.",
    proofClient3: "Professionals and teams",
    proofClient3Sub: "We design tools that bring order to work and save time.",
    proofClient4: "Growing companies",
    proofClient4Sub:
      "We connect systems and processes to support new challenges.",
    proofNote:
      "The number of clients and published cases will be updated when there are verified results to share.",
  });
  Object.assign(translations.es, {
    heroTitle: "Lo imaginás.<br><em>Lo construimos.</em>",
    heroDesc:
      "Diseñamos y desarrollamos sitios web, aplicaciones, automatizaciones y software a medida para convertir tu idea en una experiencia digital real.",
    demoLabel: "DEMOSTRACIÓN CONCEPTUAL",
    engineIdea: "IDEA",
    engineDesign: "DISEÑO",
    engineBuild: "DESARROLLO",
    engineProduct: "PRODUCTO",
    engineChoose: "EXPLORÁ UNA IDEA",
    engineAutomation: "Automatización",
    engineWebDesc:
      "Una presencia digital diseñada para conectar con las personas.",
    engineAppDesc: "Una aplicación pensada para acompañar cada interacción.",
    engineAutomationDesc:
      "Procesos conectados que hacen espacio para lo importante.",
    engineSoftwareDesc:
      "Herramientas digitales creadas alrededor de tu manera de trabajar.",
    labTitle: "Una idea en movimiento.",
    labDesc:
      "Probá una automatización conceptual: una solicitud recorre distintas etapas hasta estar lista para revisar.",
    labCaption: "EJEMPLO INTERACTIVO · DATOS SIMULADOS",
    labReady: "LISTO PARA PROBAR",
    labStep1: "Solicitud",
    labSub1: "Nuevo mensaje",
    labStep2: "Organizar",
    labSub2: "Preparar datos",
    labStep3: "Revisar",
    labSub3: "Listo para vos",
    labRun: "Ejecutar ejemplo ↗",
    labStatus: "Todo ocurre en tu navegador.",
    labRunning: "Procesando el ejemplo…",
    labDone: "Ejemplo completado. Podés volver a ejecutarlo.",
  });
  Object.assign(translations.en, {
    heroTitle: "Imagine it.<br><em>We build it.</em>",
    heroDesc:
      "We design and develop websites, apps, automations, and custom software that bring your idea into the digital world.",
    demoLabel: "CONCEPT DEMONSTRATION",
    engineIdea: "IDEA",
    engineDesign: "DESIGN",
    engineBuild: "DEVELOPMENT",
    engineProduct: "PRODUCT",
    engineChoose: "EXPLORE AN IDEA",
    engineAutomation: "Automation",
    engineWebDesc: "A digital presence designed to connect with people.",
    engineAppDesc: "An application designed around every interaction.",
    engineAutomationDesc:
      "Connected processes that make room for what matters.",
    engineSoftwareDesc: "Digital tools built around the way you work.",
    labTitle: "An idea in motion.",
    labDesc:
      "Try a conceptual automation: an inquiry moves through a simple workflow until it is ready to review.",
    labCaption: "INTERACTIVE EXAMPLE · SIMULATED DATA",
    labReady: "READY TO TRY",
    labStep1: "Inquiry",
    labSub1: "New message",
    labStep2: "Organize",
    labSub2: "Prepare details",
    labStep3: "Review",
    labSub3: "Ready for you",
    labRun: "Run example ↗",
    labStatus: "Everything runs in your browser.",
    labRunning: "Running the example…",
    labDone: "Example complete. You can run it again.",
  });
  let lang = (navigator.language || "").toLowerCase().startsWith("en")
    ? "en"
    : "es";
  const copy = () => translations[lang];
  const get = (id) => document.getElementById(id);
  function translate(next) {
    lang = next;
    document.documentElement.lang = lang;
    document.title =
      lang === "es"
        ? "Cotivanta — Desarrollo y soluciones digitales a medida"
        : "Cotivanta — Custom digital development & services";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.dataset.i18n;
      if (copy()[k] !== undefined) el.innerHTML = copy()[k];
    });
    document.querySelectorAll("[data-placeholder]").forEach((el) => {
      el.placeholder = copy()[el.dataset.placeholder] || "";
    });
    document.querySelectorAll("[data-lang]").forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    if (get("language") && !get("language").dataset.edited)
      get("language").value = lang;
    get("form-message")?.setAttribute("hidden", "");
  }
  document
    .querySelectorAll("[data-lang]")
    .forEach((btn) =>
      btn.addEventListener("click", () => translate(btn.dataset.lang)),
    );
  get("language")?.addEventListener(
    "change",
    (e) => (e.target.dataset.edited = "true"),
  );
  get("year").textContent = String(new Date().getFullYear());
  const menu = get("menu-toggle"),
    links = get("nav-links");
  menu?.addEventListener("click", () => {
    const expanded = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!expanded));
    links.classList.toggle("is-open", !expanded);
  });
  links?.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("is-open");
      menu.setAttribute("aria-expanded", "false");
    }),
  );
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menu?.getAttribute("aria-expanded") === "true"
    ) {
      links?.classList.remove("is-open");
      menu.setAttribute("aria-expanded", "false");
      menu.focus();
    }
  });
  document.querySelectorAll(".service-choose").forEach((button) =>
    button.addEventListener("click", () => {
      const choice = button.closest("[data-service]")?.dataset.service;
      if (choice) get("service").value = choice;
      get("request").scrollIntoView({ behavior: "smooth", block: "start" });
      get("service").focus({ preventScroll: true });
    }),
  );
  translate(lang);
  const engine = get("creation-engine");
  const engineModes = {
    web: ["WEB EXPERIENCE", "engineWebDesc"],
    app: ["APP EXPERIENCE", "engineAppDesc"],
    automation: ["AUTOMATION FLOW", "engineAutomationDesc"],
    software: ["CUSTOM SOFTWARE", "engineSoftwareDesc"],
  };
  engine?.querySelectorAll("[data-engine]").forEach((button) =>
    button.addEventListener("click", () => {
      const mode = button.dataset.engine;
      if (!engineModes[mode]) return;
      engine.dataset.mode = mode;
      engine
        .querySelectorAll("[data-engine]")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      engine.querySelector(".output-name").textContent = engineModes[mode][0];
      const desc = engine.querySelector(".engine-description");
      desc.dataset.i18n = engineModes[mode][1];
      desc.textContent = copy()[engineModes[mode][1]];
    }),
  );
  const labRun = get("lab-run");
  let labTimers = [];
  labRun?.addEventListener("click", () => {
    labTimers.forEach(clearTimeout);
    labTimers = [];
    const steps = [...document.querySelectorAll(".lab-step")];
    steps.forEach((step) => step.classList.remove("is-active"));
    labRun.disabled = true;
    get("lab-status").textContent = copy().labRunning;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    steps.forEach((step, index) =>
      labTimers.push(
        setTimeout(
          () => {
            step.classList.add("is-active");
            if (index === steps.length - 1) {
              labRun.disabled = false;
              get("lab-status").textContent = copy().labDone;
            }
          },
          reduced ? 0 : index * 650,
        ),
      ),
    );
  });
  const motionTargets = document.querySelectorAll(
    ".service-card,.industry-card,.workflow-step,.faq-accordion details,.form-card,.access-copy,.proof-heading,.proof-stat,.proof-card",
  );
  if ("IntersectionObserver" in window) {
    const motionObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            motionObserver.unobserve(entry.target);
          }
        }),
      { threshold: 0.14, rootMargin: "0px 0px -32px" },
    );
    motionTargets.forEach((el, index) => {
      el.dataset.motion = "";
      el.style.transitionDelay = `${Math.min(index % 5, 4) * 70}ms`;
      motionObserver.observe(el);
    });
  } else {
    motionTargets.forEach((el) => el.classList.add("is-visible"));
  }
  const form = get("project-form");
  if (!form) return;
  const cfg = window.COTIVANTA_CONFIG || {};
  const clientCount = cfg.clientCount;
  if (Number.isSafeInteger(clientCount) && clientCount >= 0) {
    const countElement = get("client-count");
    if (countElement) countElement.textContent = String(clientCount);
  }
  const teamCount = cfg.teamCount;
  if (Number.isSafeInteger(teamCount) && teamCount >= 0) {
    const countElement = get("team-count");
    if (countElement) countElement.textContent = String(teamCount);
  }
  // La configuración local sirve como respaldo si el servicio no está disponible.
  if (cfg.supabaseUrl && cfg.supabasePublishableKey) {
    fetch(
      `${cfg.supabaseUrl}/rest/v1/site_settings?id=eq.1&select=client_count,team_count`,
      {
        headers: { apikey: cfg.supabasePublishableKey },
      },
    )
      .then((response) => {
        if (!response.ok) throw new Error("Settings unavailable");
        return response.json();
      })
      .then((rows) => {
        const count = rows?.[0]?.client_count;
        if (Number.isSafeInteger(count) && count >= 0) {
          const countElement = get("client-count");
          if (countElement) countElement.textContent = String(count);
        }
        const teams = rows?.[0]?.team_count;
        if (Number.isSafeInteger(teams) && teams >= 0) {
          const teamElement = get("team-count");
          if (teamElement) teamElement.textContent = String(teams);
        }
      })
      .catch(() => {});
  }
  let captchaToken = "",
    widgetId;
  const message = get("form-message"),
    submit = get("submit-button"),
    success = get("form-success");
  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }
  function initCaptcha() {
    if (!cfg.turnstileSiteKey || !window.turnstile) return;
    widgetId = window.turnstile.render("#turnstile-container", {
      sitekey: cfg.turnstileSiteKey,
      action: "project_request",
      theme: "light",
      callback: (t) => (captchaToken = t),
      "expired-callback": () => (captchaToken = ""),
      "error-callback": () => (captchaToken = ""),
    });
  }
  if (cfg.turnstileSiteKey) {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = initCaptcha;
    document.head.append(script);
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.hidden = true;
    if (!form.checkValidity()) {
      form.reportValidity();
      showMessage(copy().invalid);
      return;
    }
    if (!cfg.apiUrl || !cfg.turnstileSiteKey) {
      showMessage(copy().config);
      return;
    }
    if (!captchaToken) {
      showMessage(copy().captcha);
      return;
    }
    const payload = {
      name: get("name").value.trim(),
      email: get("email").value.trim(),
      clientType: get("client-type").value,
      service: get("service").value,
      description: get("description").value.trim(),
      budget: get("budget").value,
      timeline: get("timeline").value,
      organization: get("organization").value.trim(),
      language: get("language").value,
      consent: get("consent").checked,
      faxNumber: get("fax_number").value,
      turnstileToken: captchaToken,
    };
    submit.disabled = true;
    submit.querySelector("[data-i18n]").textContent = copy().sending;
    try {
      const response = await fetch(cfg.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const result = await response.json();
      if (result.ok !== true) throw new Error("Unexpected response");
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      console.error("Project inquiry failed:", err);
      showMessage(copy().failure);
    } finally {
      submit.disabled = false;
      submit.querySelector("[data-i18n]").textContent = copy().formSubmit;
      captchaToken = "";
      if (window.turnstile && widgetId !== undefined)
        window.turnstile.reset(widgetId);
    }
  });
  get("reset-form")?.addEventListener("click", () => {
    form.reset();
    form.hidden = false;
    success.hidden = true;
    message.hidden = true;
    get("language").dataset.edited = "";
    get("language").value = lang;
    window.turnstile?.reset?.(widgetId);
  });
})();
