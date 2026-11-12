// Catálogo de servicios de Cotivanta: alimenta las tarjetas de categorías, los selectores del formulario de
// clientes y la lista de especialidades del formulario de profesionales.
//
// Para sumar una especialidad: agregá una fila [slug, "Español", "English"] a su categoría.
// Para sumar una categoría: agregá un objeto a `categories`. No hace falta tocar HTML ni CSS.
// IMPORTANTE: el backend (supabase/functions/project-request/handler.ts → CATALOG) valida los mismos slugs.
// Repetí el cambio allí y volvé a desplegar la función; tests/agency.test.cjs falla si difieren.
// Los slugs usan minúsculas, números y guiones. Una vez publicados, no los renombres (quedan guardados en los datos).
window.COTIVANTA_CATALOG = Object.freeze({
  otherService: "other",
  categories: [
    {
      id: "tech", icon: "⌘",
      es: { name: "Tecnología y desarrollo", description: "Sitios web, tiendas online, aplicaciones, sistemas a medida y automatizaciones." },
      en: { name: "Technology & development", description: "Websites, online stores, apps, custom systems and automations." },
      services: [
        ["website", "Desarrollo de páginas web", "Website development"],
        ["landing-page", "Landing pages", "Landing pages"],
        ["online-store", "Tiendas online", "Online stores"],
        ["mobile-app", "Aplicaciones móviles", "Mobile apps"],
        ["management-system", "Sistemas de gestión", "Management systems"],
        ["custom-crm", "CRM personalizados", "Custom CRMs"],
        ["automation", "Automatizaciones", "Automations"],
        ["whatsapp-bot", "Bots de WhatsApp", "WhatsApp bots"],
        ["api-integration", "Integraciones con APIs", "API integrations"],
        ["maintenance", "Mantenimiento y optimización de sistemas", "System maintenance and optimization"],
      ],
    },
    {
      id: "design", icon: "✦",
      es: { name: "Diseño y creatividad", description: "Logotipos, identidad de marca, piezas gráficas, interfaces y presentaciones." },
      en: { name: "Design & creative", description: "Logos, brand identity, graphic pieces, interfaces and presentations." },
      services: [
        ["logo-design", "Diseño de logotipos", "Logo design"],
        ["brand-identity", "Identidad de marca", "Brand identity"],
        ["branding", "Branding", "Branding"],
        ["social-media-design", "Diseño de publicaciones para redes sociales", "Social media post design"],
        ["advertising-design", "Diseño publicitario", "Advertising design"],
        ["presentations", "Presentaciones profesionales", "Professional presentations"],
        ["ui-ux-design", "Diseño de interfaces UI/UX", "UI/UX interface design"],
        ["illustration", "Ilustraciones", "Illustrations"],
      ],
    },
    {
      id: "audiovisual", icon: "◐",
      es: { name: "Producción audiovisual", description: "Edición de video, animación, motion graphics, fotografía y contenido audiovisual." },
      en: { name: "Audiovisual production", description: "Video editing, animation, motion graphics, photography and audiovisual content." },
      services: [
        ["video-editing", "Edición de videos", "Video editing"],
        ["reels-tiktok-editing", "Edición de reels y TikToks", "Reels and TikTok editing"],
        ["youtube-editing", "Edición de videos para YouTube", "YouTube video editing"],
        ["subtitles", "Subtítulos", "Subtitles"],
        ["animation", "Animaciones", "Animation"],
        ["motion-graphics", "Motion graphics", "Motion graphics"],
        ["photography", "Fotografía", "Photography"],
        ["photo-editing", "Edición y retoque fotográfico", "Photo editing and retouching"],
        ["audiovisual-production", "Producción de contenido audiovisual", "Audiovisual content production"],
      ],
    },
    {
      id: "marketing", icon: "↗",
      es: { name: "Marketing y comunicación", description: "Redes sociales, contenido, SEO, campañas publicitarias y estrategias digitales." },
      en: { name: "Marketing & communication", description: "Social media, content, SEO, advertising campaigns and digital strategy." },
      services: [
        ["social-media-management", "Gestión de redes sociales", "Social media management"],
        ["community-management", "Community management", "Community management"],
        ["content-creation", "Creación de contenido", "Content creation"],
        ["seo", "SEO", "SEO"],
        ["ad-campaigns", "Campañas publicitarias", "Advertising campaigns"],
        ["copywriting", "Redacción publicitaria", "Copywriting"],
        ["email-marketing", "Email marketing", "Email marketing"],
        ["digital-marketing-strategy", "Estrategias de marketing digital", "Digital marketing strategy"],
      ],
    },
    {
      id: "business", icon: "▤",
      es: { name: "Administración y negocios", description: "Asistencia virtual, gestión de datos, planillas, procesos e investigación de mercado." },
      en: { name: "Administration & business", description: "Virtual assistance, data management, spreadsheets, processes and market research." },
      services: [
        ["virtual-assistance", "Asistencia virtual", "Virtual assistance"],
        ["data-management", "Gestión de datos", "Data management"],
        ["excel-spreadsheets", "Planillas de Excel", "Excel spreadsheets"],
        ["admin-automation", "Automatización administrativa", "Administrative automation"],
        ["data-entry", "Carga y organización de información", "Data entry and organization"],
        ["market-research", "Investigación de mercado", "Market research"],
        ["process-organization", "Organización de procesos empresariales", "Business process organization"],
      ],
    },
    {
      id: "other", icon: "✳", open: true,
      es: { name: "Otros servicios", description: "¿Necesitás algo que no está en la lista? Contanos qué buscás y evaluamos cómo resolverlo." },
      en: { name: "Other services", description: "Need something that is not listed? Tell us what you are after and we will assess how to solve it." },
      services: [],
    },
  ],
  // Opciones compartidas por ambos formularios.
  currencies: [
    ["ARS", "ARS · Peso argentino", "ARS · Argentine peso"],
    ["USD", "USD · Dólar estadounidense", "USD · US dollar"],
    ["EUR", "EUR · Euro", "EUR · Euro"],
    ["BRL", "BRL · Real brasileño", "BRL · Brazilian real"],
    ["UYU", "UYU · Peso uruguayo", "UYU · Uruguayan peso"],
    ["CLP", "CLP · Peso chileno", "CLP · Chilean peso"],
    ["MXN", "MXN · Peso mexicano", "MXN · Mexican peso"],
    ["COP", "COP · Peso colombiano", "COP · Colombian peso"],
  ],
  languages: [
    ["es", "Español", "Spanish"], ["en", "Inglés", "English"], ["pt", "Portugués", "Portuguese"], ["fr", "Francés", "French"],
    ["it", "Italiano", "Italian"], ["de", "Alemán", "German"], ["other", "Otro", "Other"],
  ],
});
