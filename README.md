# Cotivanta — Agencia de servicios profesionales (web bilingüe)

**Modelo (noviembre 2026):** Cotivanta vende y gestiona servicios de cinco áreas (tecnología, diseño, audiovisual, marketing y negocios, más una categoría abierta) y los ejecuta con **profesionales independientes** a los que paga un importe acordado de antemano. No es un marketplace: el cliente solo trata con Cotivanta. La web tiene dos recorridos: «Quiero contratar un servicio» (formulario de presupuesto) y «Quiero trabajar con Cotivanta» (postulación de profesionales, sin cuentas ni perfiles públicos). Despliegue y pruebas: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

- `site/assets/catalog.js`: catálogo único de categorías, servicios, monedas e idiomas (alimenta tarjetas, selectores y especialidades).
- `site/assets/agency-copy.js`: textos ES/EN de la portada de agencia (tienen prioridad sobre las claves históricas de `app.js`).
- `site/assets/agency.js` / `professional.js` / `agency.css`: tarjetas y formulario de clientes ampliado / postulación de profesionales / estilos.
- `supabase/migrations/20261112010000_agency_services.sql`: columnas nuevas de consultas, `professional_applications`, su cola de avisos y RLS.
- La única función pública sigue siendo `project-request` (atiende ambos formularios); `notify-requests` envía los avisos de las dos colas. Secretos nuevos: `PROFESSIONAL_APPLICATIONS_ENABLED` y `NOTIFICATION_JOB_SECRET` también en `project-request`.
- La portada **no enlaza** al panel administrativo (`admin.html` sigue existiendo y se abre escribiendo su dirección).

> **Estado actual:** formulario habilitado temporalmente en la configuración pública a pedido del responsable. No se activó ni verificó la recepción en Supabase; siguen pendientes la revisión legal y el despliegue coordinado. Ver [despliegue](docs/DEPLOYMENT.md) y [seguridad](docs/SECURITY.md); estas guías sustituyen las instrucciones históricas de activación de abajo.

## Desarrollo y verificación

Requiere Node.js 24 o posterior. Ejecutá `npm ci --ignore-scripts` y `npm run check` (tipos, lógica, PostgreSQL aislado, Chrome/Edge y build). `npm start` sirve la web con cabeceras de seguridad. Publicá **solo `dist/site/`**, generado por el build con versiones de recursos basadas en su contenido. Nunca publiques la raíz, `supabase/`, `tests/` ni secretos.

Las funciones nuevas requieren las cuatro migraciones en orden. El panel incluye segundo factor, bandeja de consultas y cambios auditados. Los avisos internos usan cola transaccional y worker privado que requiere proveedor y programación externa. Editar archivos locales no aplica estos cambios a Supabase.

**Modelo de negocio:** estudio de soluciones digitales para particulares, emprendedores, profesionales y empresas. El visitante solicita presupuesto para un servicio; el dueño del estudio analiza cada propuesta antes de asumir un compromiso.

## Archivos

- `site/index.html`: landing (ES/EN), catálogo de 6 categorías, proceso, FAQ y formulario de consultas.
- `site/assets/styles.css` y `studio.css`: estilos responsive.
- `site/assets/experience.css` y `premium.css`: dirección visual e interacciones del rediseño; el formulario conserva los estilos compartidos.
- `site/assets/app.js`: traducción, interacción de servicios, validación del formulario.
- El Creation Engine y Cotivanta Lab son demostraciones conceptuales con estado local; no representan proyectos de clientes ni envían datos.

### Organización y formato

Los estilos se cargan en este orden: `styles.css` (base y componentes compartidos), `studio.css` (estudio y animaciones), `experience.css` (ajustes visuales) y `premium.css` (rediseño y demostraciones). Al editar, comprobá las reglas posteriores para evitar duplicar o contradecir estilos. La sección de clientes está en `site/index.html` y sus traducciones en `site/assets/app.js`.

El proyecto incluye `.editorconfig` y `.prettierrc.json` para mantener una indentación y un formato coherentes. Podés activar «Format on Save» en tu editor con la extensión Prettier.

Para actualizar la cantidad de clientes y equipos, `site/admin.html` incluye un panel con inicio de sesión de Supabase. La página pública consulta `public.site_settings`; si no está disponible, utiliza `clientCount` y `teamCount` de `site/config.js` como respaldo. El panel y la tabla **todavía requieren configuración y pruebas antes de publicarse**:

1. Aplicar las migraciones de `supabase/migrations/` en orden en staging, después de revisión. `supabase/setup/site_settings.sql` es histórico: no sustituye las migraciones de seguridad ni debe ejecutarse después.
2. Crear manualmente en Supabase Dashboard → Authentication → Users una cuenta confirmada para `cotivanta@gmail.com`, sin compartir la contraseña por chat. Verificar que sea la única cuenta con ese correo. Un administrador del proyecto debe asignarle `app_metadata.cotivanta_admin = true` mediante el mecanismo administrativo de Supabase; los usuarios normales no pueden concederse este permiso. Después de asignarlo, iniciar una sesión nueva para que el token incluya el permiso.
3. Iniciar sesión en `admin.html`, guardar una cifra de prueba autorizada, verificarla en la web pública y restaurar el valor deseado. Probar también que un usuario sin ese atributo no pueda actualizar la tabla.

El panel usa la clave publicable; no almacena claves privadas ni persiste la sesión al recargar la página. La tabla solo permite lectura pública y escritura a cuentas autorizadas por RLS. Hasta completar esas pruebas, los valores en `site/config.js` siguen siendo el respaldo. Nunca pongas secretos en archivos del sitio. La comprobación local del panel se ejecuta con `node --test tests/admin.test.cjs`.

- `site/privacy.html`: aviso **BORRADOR**. Requiere revisión e identificación del responsable.
- `site/policies.html`: apartados legales trasladados de `dev` (aviso legal, privacidad, cookies, uso, contratación y derechos), con estilos aislados en `site/assets/policies.css`.
- `site/assets/logo-symbol.svg`, `logo-symbol-light.svg` y `favicon.svg`: identidad «Piezas a medida», para fondos claros, oscuros e icono del navegador.
- `site/config.js`: configuración PÚBLICA para API y Turnstile.
- `supabase/migrations/20261028010000_project_requests.sql`: esquema privado de solicitudes, con RLS y sin acceso público.
- `supabase/functions/project-request/index.ts`: endpoint de ingreso con validación y verificación server-side Turnstile.

## 1. Probar la web localmente

```bash
npm start
```

Abrí `http://127.0.0.1:8080`. Los botones preseleccionan servicios; ES/EN cambia textos y etiquetas. El formulario está habilitado temporalmente en la configuración pública y sus controles se activan al inicializar sus scripts. El envío requiere Turnstile y un backend habilitado y configurado. No simula haber recibido solicitudes.

## 2. Conectar el formulario a Supabase

1. Creá un **nuevo proyecto Supabase dedicado a Cotivanta** (no reutilizar proyectos de clientes ni otros productos).
2. Ejecutá la migración `supabase/migrations/20261028010000_project_requests.sql` en el SQL Editor del nuevo proyecto.
3. Creá un widget Cloudflare Turnstile para los dominios definitivos, y para `localhost` si vas a probar localmente.
4. Con la Supabase CLI autenticada y vinculada al proyecto correcto, desplegá `project-request` (asegurate de estar en el directorio raíz del repo):

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy project-request --no-verify-jwt
```

5. En Supabase > Edge Functions > Secrets, configurá las variables privadas:

| Variable                                            | Contenido                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `TURNSTILE_SECRET_KEY`                              | Clave privada Turnstile                                                                                     |
| `ALLOWED_ORIGINS`                                   | Orígenes exactos permitidos, separados por coma (p.ej. `https://cotivanta.pages.dev,https://cotivanta.com`) |
| `ALLOWED_TURNSTILE_HOSTNAMES`                       | Hostnames de Turnstile permitidos separados por coma (sin `https://`)                                       |
| `SUPABASE_URL`                                      | Supabase project URL, normalmente predefinida                                                               |
| `SUPABASE_SECRET_KEYS`                              | Mapa JSON de claves privadas actual (`{"default":"sb_secret_..."}`), normalmente predefinido                |
| `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` | Compatibilidad con configuraciones anteriores                                                               |

**Por qué `verify_jwt=false`:** el formulario es público, y la función aplica otras protecciones: Turnstile verificado en backend, validación de payload, honeypot, allowlist de origen, credenciales privadas y RLS. Además aplica un límite best-effort de 5 solicitudes por IP cada 10 minutos por instancia; para tráfico alto conviene agregar rate limiting distribuido en Cloudflare.

6. Editá `site/config.js` con **valores públicos únicamente**:

```js
window.COTIVANTA_CONFIG = {
  apiUrl:
    "https://eucejksxzyerpuingidd.supabase.co/functions/v1/project-request",
  turnstileSiteKey: "PUBLIC_TURNSTILE_SITE_KEY",
};
```

7. Confirmá que una solicitud real entra en `public.project_requests`, y que se rechazan correos inválidos, desafíos Turnstile faltantes, y orígenes no autorizados. Una persona puede pedir **varios proyectos** con el mismo correo.

## 3. Publicar

Para Cloudflare Pages, ejecutá `npm run build` y publicá **solo `dist/site/`** como web estática. No publiques `supabase/` en la carpeta pública. Configurá dominio, cabeceras, Turnstile y orígenes de producción según `docs/DEPLOYMENT.md`.

**Antes de hacerla pública:** actualizar el aviso de privacidad con tu identidad y canal de contacto real, definir cómo vas a responder a solicitudes, comprobar el nombre/dominio y realizar una prueba completa de envío en producción. No afirmar que hay un equipo o clientes existentes si no es verdad.

## Documentación legal y consentimiento

Los textos de `dev` se incorporaron conservando la portada, las demostraciones y el panel de administración de `main`. Siguen siendo **borradores para Argentina**: faltan domicilio legal, información fiscal aplicable, conservación, revisión de proveedores y transferencias internacionales y procedimientos operativos. Confirmar también la grafía legal de «Agustín Gonzales». No quitar los avisos ni `noindex` hasta completar la revisión.

El resumen legal y los avisos del formulario se conservan en «Información de privacidad», un desplegable cerrado inicialmente al final del formulario. Se abre con clic o teclado, sin JavaScript adicional. El consentimiento obligatorio y el enlace a la política permanecen visibles.

La versión `2026-10-30.1-draft` debe coincidir en `site/index.html` (`data-privacy-version`), `site/privacy.html` (`meta[name="privacy-version"]`) y `supabase/functions/project-request/handler.ts` (`PRIVACY_VERSION`). El borrador histórico de `dev` está en `site/privacy/initial-draft.txt`. Archivar cada texto vigente antes de modificarlo y asignar una versión nueva en los tres lugares. Antes de activar envíos, revisar también los avisos internos por Resend y el acceso MFA del panel.

La función local rechaza versiones ausentes o desactualizadas con HTTP 409 y registra `privacy_version` junto con `consent_at`. El formulario informa el cambio y desmarca el consentimiento para una nueva revisión. **Antes de desplegar la función**, aplicar `supabase/migrations/20261030010000_privacy_version.sql` en el proyecto correcto. Las solicitudes históricas conservan una versión nula; no se inventan consentimientos anteriores. Esta integración no aplica migraciones ni despliega cambios automáticamente.

La configuración pública tiene temporalmente `projectRequestsEnabled: true` a pedido del responsable, y el servidor nuevo exige `PROJECT_REQUESTS_ENABLED=true`. Este cambio local no activa la recepción remota. Los avisos legales por sí solos no son un control de acceso. No usar datos reales hasta completar la revisión y verificar todas las migraciones y funciones desplegadas. No se certifica cumplimiento ni se acreditan trámites ante la AAIP.

Pruebas locales con Node.js 24 o posterior: `node --test tests/*.test.cjs`. Los tests del formulario y de la función usan servicios simulados; no envían datos a Supabase ni sustituyen una prueba end-to-end del despliegue.

## Estado

- ✅ Landing bilingüe, identidad visual y legales conservados.
- ✅ Código local: recepción fail-closed, consentimiento/versionado, deduplicación, rate limit persistente, límites de bytes/tiempo y cola transaccional.
- ✅ Panel local: alta/verificación MFA, bandeja, estados, cifras verificadas y auditoría protegidos por RLS.
- ✅ Pruebas automatizadas de lógica, PostgreSQL aislado y Chrome/Edge; build versionado y CI preparados.
- ⬜ Aplicar y comprobar migraciones/funciones nuevas en staging y producción. Una función antigua publicada no incorpora cambios locales.
- ⬜ Configurar y probar gateway/IP, Turnstile, correo, scheduler, alertas, backups y recuperación.
- ⬜ Completar y versionar la política legal definitiva, incluidos los proveedores realmente utilizados.
- ⬜ Hacer la prueba end-to-end autorizada con servicios reales antes de habilitar la recepción pública.
