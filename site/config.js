// Public-only settings. NEVER put service_role, Turnstile secret, or any other private key here.
window.COTIVANTA_CONFIG = {
  // Habilitado temporalmente a pedido del responsable; no activa el backend remoto.
  // Supabase requiere PROJECT_REQUESTS_ENABLED=true y sus controles configurados.
  projectRequestsEnabled: true,
  apiUrl:
    "https://eucejksxzyerpuingidd.supabase.co/functions/v1/project-request",
  turnstileSiteKey: "0x4AAAAAAFtd62eKjmqTaV2D",
  // Número de clientes atendidos. Actualizalo cuando corresponda.
  // Respaldo público restaurado a pedido del responsable. Supabase verificado tiene prioridad.
  metricsVerified: true,
  clientCount: 200,
  teamCount: 5,
  // URL y clave publicable de Supabase; ninguna es una credencial privada.
  supabaseUrl: "https://eucejksxzyerpuingidd.supabase.co",
  supabasePublishableKey: "sb_publishable_-_5RxAqUrux3f80xzWOuaw_mizcr0qC",
};
