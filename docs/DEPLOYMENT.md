# Despliegue — Cotivanta como agencia multidisciplinaria

Arquitectura sin cambios: sitio estático en Cloudflare Pages + Supabase (Postgres + Edge Functions) + Resend. Nada de esto se aplica solo: editar archivos locales no modifica Supabase.

## Qué cambió respecto de la versión anterior

| Pieza | Cambio |
| --- | --- |
| `supabase/migrations/20261112010000_agency_services.sql` | Columnas nuevas en `project_requests`, restricciones más flexibles, función `submit_project_request` actualizada, tabla `professional_applications` + cola de avisos + funciones. **No destructiva y re-ejecutable.** |
| `functions/project-request` | Atiende los dos formularios (clientes y profesionales) con el mismo endpoint, Turnstile, honeypot y límite de frecuencia. Dispara un envío inmediato del aviso. El formato anterior de la solicitud sigue aceptándose. |
| `functions/notify-requests` | Atiende dos colas (consultas y postulaciones) con el mismo canal Resend. Una cola con problemas no bloquea a la otra. |
| `site/` | Portada de agencia, formulario de clientes ampliado, formulario «Trabajá con Cotivanta», catálogo único `assets/catalog.js`. |

## Orden de despliegue (respetalo)

1. **Base de datos.** Con las cuatro migraciones anteriores ya aplicadas, ejecutá `supabase/migrations/20261112010000_agency_services.sql` en staging primero (SQL Editor o `npx supabase db push`). Luego en producción.
2. **Secretos nuevos** (Supabase → Edge Functions → Secrets). No los pegues en chats ni en archivos del repo:
   - `PROFESSIONAL_APPLICATIONS_ENABLED=true` — interruptor del formulario de profesionales (fail-closed: sin él responde 503).
   - `NOTIFICATION_JOB_SECRET` — ya existe para el cron; ahora **también lo lee `project-request`** para el envío inmediato. Es el mismo valor (≥ 32 caracteres).
   - Siguen igual: `PROJECT_REQUESTS_ENABLED`, `TURNSTILE_SECRET_KEY`, `ALLOWED_ORIGINS`, `ALLOWED_TURNSTILE_HOSTNAMES`, `TRUSTED_IP_HEADER`, `RATE_LIMIT_SALT`, `RESEND_API_KEY`, `NOTIFICATION_FROM`, `NOTIFICATION_TO`, `ADMIN_URL`.
3. **Funciones** (con la CLI vinculada al proyecto correcto):
   ```bash
   npx supabase functions deploy project-request --no-verify-jwt
   npx supabase functions deploy notify-requests --no-verify-jwt
   ```
4. **Cron de avisos:** si todavía no está programado, ejecutá `supabase/setup/schedule_notifications.sql` (instrucciones dentro del archivo). Es el mecanismo de reintento.
5. **Turnstile:** el widget del sitio debe permitir los hostnames de producción. El formulario de profesionales usa la acción `professional_application` y el de clientes `project_request`; ambas se validan en el servidor.
6. **Sitio:** `npm ci --ignore-scripts && npm run build` y publicá **solo `dist/site/`** en Cloudflare Pages. Hacelo **al final**: si el sitio sale antes que las funciones, los formularios responden «servicio no disponible» (sin pérdida de datos).
7. **Prueba de punta a punta** (ver abajo).

## Verificación posterior al despliegue

1. Enviar una solicitud de cliente con categoría, monto y moneda → fila en `project_requests` con `category`, `budget_amount`, `budget_currency`; llega el correo «Nueva consulta en Cotivanta» (segundos si el envío inmediato funcionó; ≤ 1 minuto por el cron si no).
2. Enviar una postulación → fila en `professional_applications` con `status = 'pending'`, correo «Nueva postulación profesional en Cotivanta».
3. Repetir el mismo envío con el mismo contenido (clic doble / reintento) → no se duplica.
4. Con una sesión anónima (clave publicable) probar `select * from professional_applications` → debe fallar o devolver 0 filas; `update`/`delete` → denegados.
5. `select * from cron.job_run_details order by start_time desc limit 5;` y `select * from professional_application_notifications where sent_at is null;` → sin pendientes viejos.

## Gestión manual de postulaciones

No hay panel nuevo (alcance del MVP). Las postulaciones se revisan en Supabase → Table editor → `professional_applications` y en el correo de aviso. Para cambiar el estado: `pending`, `reviewing`, `approved`, `declined`, `archived`. Los administradores con MFA (`is_cotivanta_admin`) ya tienen permiso de lectura y de cambio de estado por RLS, listo para una futura vista en el panel.

## Agregar una especialidad o categoría

1. Agregá la fila en `site/assets/catalog.js` (español e inglés).
2. Repetí el slug en `CATALOG` de `supabase/functions/project-request/handler.ts` y volvé a desplegar la función.
3. `npm test`: `tests/agency.test.cjs` falla si ambos catálogos difieren. No hace falta migración ni cambios de HTML/CSS.

## Pruebas

`npm run check` ejecuta tipos, pruebas unitarias, PostgreSQL aislado (PGlite), navegador real (Chrome/Edge con red interceptada) y build. Ninguna prueba toca Supabase, Resend ni Cloudflare reales: la prueba de punta a punta anterior es manual y obligatoria.
