# Cotivanta — Estudio de desarrollo digital (web bilingüe)

**Modelo de negocio:** estudio de soluciones digitales para particulares, emprendedores, profesionales y empresas. El visitante solicita presupuesto para un servicio; el dueño del estudio analiza cada propuesta antes de asumir un compromiso.

## Archivos

- `site/index.html`: landing (ES/EN), catálogo de 6 categorías, proceso, FAQ y formulario de consultas.
- `site/assets/styles.css` y `studio.css`: estilos responsive.
- `site/assets/app.js`: traducción, interacción de servicios, validación del formulario.
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

| Variable | Contenido |
|---|---|
| `TURNSTILE_SECRET_KEY` | Clave privada Turnstile |
| `ALLOWED_ORIGINS` | Orígenes exactos permitidos, separados por coma (p.ej. `https://cotivanta.pages.dev,https://cotivanta.com`) |
| `ALLOWED_TURNSTILE_HOSTNAMES` | Hostnames de Turnstile permitidos separados por coma (sin `https://`) |
| `SUPABASE_URL` | Supabase project URL, normalmente predefinida |
| `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` | Clave privada, normalmente predefinida |

**Por qué `verify_jwt=false`:** el formulario es público, y la función aplica otras protecciones: Turnstile verificado en backend, validación de payload, honeypot, allowlist de origen, credenciales privadas y RLS. Para un sistema con alto tráfico, agregar limitación de solicitudes por IP y monitoreo en la capa edge.

6. Editá `site/config.js` con **valores públicos únicamente**:

```js
window.COTIVANTA_CONFIG = {
  apiUrl: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/project-request",
  turnstileSiteKey: "PUBLIC_TURNSTILE_SITE_KEY"
};
```

7. Confirmá que una solicitud real entra en `public.project_requests`, y que se rechazan correos inválidos, desafíos Turnstile faltantes, y orígenes no autorizados. Una persona puede pedir **varios proyectos** con el mismo correo.

## 3. Publicar

Para Cloudflare Pages, publicá **solo `site/`** como web estática (Direct Upload o integración Git). No publiques `supabase/` en la carpeta pública. Configurá dominio, Turnstile y orígenes de producción.

**Antes de hacerla pública:** actualizar el aviso de privacidad con tu identidad y canal de contacto real, definir cómo vas a responder a solicitudes, comprobar el nombre/dominio y realizar una prueba completa de envío en producción. No afirmar que hay un equipo o clientes existentes si no es verdad.

## Estado

- ✅ Landing bilingüe con catálogo de servicios y formulario responsive.
- ✅ Backend y SQL incluidos en el repositorio.
- ✅ Protección con RLS, validación backend y desafío Turnstile (requiere configuración).
- ⬜ No publicada en Internet.
- ⬜ No conectada todavía a un Supabase real; no se han hecho envíos reales.
- ⬜ Aviso de privacidad pendiente de completar y revisar legalmente.
