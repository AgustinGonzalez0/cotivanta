# Cotivanta — Estudio de desarrollo digital (web bilingüe)

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

1. Revisar y ejecutar `supabase/setup/site_settings.sql` en el proyecto correcto. El archivo crea una tabla nueva para contenido público; no modifica `project_requests`. No ejecutar dos veces.
2. Crear manualmente en Supabase Dashboard → Authentication → Users una cuenta confirmada para `cotivanta@gmail.com`, sin compartir la contraseña por chat. Verificar que sea la única cuenta con ese correo. Un administrador del proyecto debe asignarle `app_metadata.cotivanta_admin = true` mediante el mecanismo administrativo de Supabase; los usuarios normales no pueden concederse este permiso. Después de asignarlo, iniciar una sesión nueva para que el token incluya el permiso.
3. Iniciar sesión en `admin.html`, guardar una cifra de prueba autorizada, verificarla en la web pública y restaurar el valor deseado. Probar también que un usuario sin ese atributo no pueda actualizar la tabla.

El panel usa la clave publicable; no almacena claves privadas ni persiste la sesión al recargar la página. La tabla solo permite lectura pública y escritura a cuentas autorizadas por RLS. Hasta completar esas pruebas, los valores en `site/config.js` siguen siendo el respaldo. Nunca pongas secretos en archivos del sitio. La comprobación local del panel se ejecuta con `node --test tests/admin.test.cjs`.

- `site/privacy.html`: aviso **BORRADOR**. Requiere revisión e identificación del responsable.
- `site/config.js`: configuración PÚBLICA para API y Turnstile.
- `supabase/migrations/20261028010000_project_requests.sql`: esquema privado de solicitudes, con RLS y sin acceso público.
- `supabase/functions/project-request/index.ts`: endpoint de ingreso con validación y verificación server-side Turnstile.

## 1. Probar la web localmente

```bash
cd site
python -m http.server 8000
```

Abrí `http://localhost:8000`. Los botones de las tarjetas de servicios preseleccionan la categoría y llevan al formulario. Cambiá ES / EN. Sin backend configurado, el formulario muestra **un mensaje de configuración pendiente**: jamás simula haber recibido la solicitud.

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

Para Cloudflare Pages, publicá **solo `site/`** como web estática (Direct Upload o integración Git). No publiques `supabase/` en la carpeta pública. Configurá dominio, Turnstile y orígenes de producción.

**Antes de hacerla pública:** actualizar el aviso de privacidad con tu identidad y canal de contacto real, definir cómo vas a responder a solicitudes, comprobar el nombre/dominio y realizar una prueba completa de envío en producción. No afirmar que hay un equipo o clientes existentes si no es verdad.

## Estado

- ✅ Landing bilingüe con catálogo de servicios y formulario responsive.
- ✅ Backend y SQL incluidos en el repositorio.
- ✅ Protección con RLS, validación backend, allowlist CORS/hostname, honeypot y rate limit best-effort.
- ✅ Edge Function `project-request` publicada en Supabase con `verify_jwt=false` para el formulario público.
- ✅ Landing conectada a la URL pública de la Edge Function.
- ⬜ Turnstile y secretos de producción pendientes: todavía no se deben aceptar solicitudes reales.
- ⬜ No se ha realizado un envío real ni una prueba end-to-end con un token Turnstile válido.
- ⬜ Aviso de privacidad pendiente de completar y revisar legalmente.
