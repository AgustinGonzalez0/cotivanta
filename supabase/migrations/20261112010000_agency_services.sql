-- Cotivanta como agencia multidisciplinaria.
-- Revisar y aplicar DESPUÉS de las cuatro migraciones anteriores y ANTES de desplegar las funciones actualizadas.
--
-- No destructiva: no borra ni reescribe filas existentes. Solo
--   1) agrega columnas opcionales a project_requests y AFLOJA (nunca endurece) tres restricciones CHECK
--      para que las categorías/servicios nuevos se puedan agregar sin tocar la base;
--   2) reemplaza submit_project_request (create or replace; conserva idempotencia y permisos);
--   3) crea professional_applications y su cola de avisos, con RLS y sin acceso público.
-- Se puede ejecutar más de una vez (SQL Editor): usa if not exists / create or replace / drop ... if exists.
begin;

-- ---------------------------------------------------------------------------
-- 1) project_requests: campos nuevos opcionales y restricciones más flexibles
-- ---------------------------------------------------------------------------
alter table public.project_requests
  add column if not exists category text,
  add column if not exists whatsapp text,
  add column if not exists budget_amount numeric(14,2),
  add column if not exists budget_currency text,
  add column if not exists desired_date date;

-- Los servicios dejan de ser una lista cerrada en la base: se valida el formato aquí y la lista permitida
-- vive en la Edge Function (un único lugar para sumar especialidades).
alter table public.project_requests drop constraint if exists project_requests_service_check;
alter table public.project_requests drop constraint if exists project_requests_service_format;
alter table public.project_requests add constraint project_requests_service_format
  check (service ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(service) <= 60);

-- "Sos…" pasa a ser opcional en el formulario nuevo; las filas anteriores conservan su valor.
alter table public.project_requests alter column client_type drop not null;
alter table public.project_requests drop constraint if exists project_requests_client_type_check;
alter table public.project_requests add constraint project_requests_client_type_check
  check (client_type is null or client_type in ('individual','entrepreneur','professional','business'));

-- 'amount' = el cliente indicó un monto + moneda. Los rangos históricos en USD siguen siendo válidos.
alter table public.project_requests drop constraint if exists project_requests_budget_check;
alter table public.project_requests add constraint project_requests_budget_check
  check (budget in ('unsure','amount','under-500','500-1500','1500-5000','over-5000'));

alter table public.project_requests drop constraint if exists project_requests_category_format;
alter table public.project_requests add constraint project_requests_category_format
  check (category is null or (category ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(category) <= 40));
alter table public.project_requests drop constraint if exists project_requests_whatsapp_length;
alter table public.project_requests add constraint project_requests_whatsapp_length
  check (whatsapp is null or char_length(whatsapp) between 6 and 30);
alter table public.project_requests drop constraint if exists project_requests_budget_amount_range;
alter table public.project_requests add constraint project_requests_budget_amount_range
  check (budget_amount is null or (budget_amount > 0 and budget_amount <= 1000000000));
alter table public.project_requests drop constraint if exists project_requests_budget_currency_format;
alter table public.project_requests add constraint project_requests_budget_currency_format
  check (budget_currency is null or budget_currency ~ '^[A-Z]{3}$');
alter table public.project_requests drop constraint if exists project_requests_amount_complete;
alter table public.project_requests add constraint project_requests_amount_complete
  check (budget <> 'amount' or (budget_amount is not null and budget_currency is not null));

comment on column public.project_requests.category is 'Categoría de servicio elegida (slug). NULL en solicitudes anteriores al modelo de agencia.';
comment on column public.project_requests.desired_date is 'Fecha límite deseada (día calendario, sin hora). Opcional.';

create or replace function public.submit_project_request(p_submission_key uuid, p_fingerprint text, p_request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.project_requests; new_id uuid; v_amount numeric; v_date date;
begin
  if p_submission_key is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Invalid submission'; end if;
  -- Serializa solo envíos concurrentes con la misma clave, entre todas las instancias de Edge.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_submission_key::text, 0));
  select * into existing from public.project_requests where submission_key = p_submission_key;
  if found then
    if existing.submission_fingerprint is distinct from p_fingerprint then
      return jsonb_build_object('code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'request_id', existing.id);
  end if;
  if jsonb_typeof(p_request) is distinct from 'object' or not (p_request ?& array['name','email','description','privacy_version'])
    or length(coalesce(btrim(p_request->>'name'), '')) not between 2 and 100
    or length(coalesce(p_request->>'email', '')) not between 3 and 254
    or length(coalesce(btrim(p_request->>'description'), '')) not between 20 and 2500
    or length(coalesce(p_request->>'organization', '')) > 150
    or length(coalesce(p_request->>'whatsapp', '')) > 30
    or length(coalesce(p_request->>'category', '')) > 40
    or length(coalesce(p_request->>'privacy_version', '')) not between 1 and 80 then
    raise exception 'Invalid form values';
  end if;
  v_amount := nullif(p_request->>'budget_amount', '')::numeric;
  v_date := nullif(p_request->>'desired_date', '')::date;
  insert into public.project_requests(name, email, client_type, service, description, budget,
    timeline, organization, language, consent_at, privacy_version, source, submission_key, submission_fingerprint,
    category, whatsapp, budget_amount, budget_currency, desired_date)
    values (p_request->>'name', p_request->>'email', p_request->>'client_type', p_request->>'service',
      p_request->>'description', p_request->>'budget', p_request->>'timeline', p_request->>'organization',
      p_request->>'language', now(), p_request->>'privacy_version', 'landing', p_submission_key, p_fingerprint,
      p_request->>'category', p_request->>'whatsapp', v_amount, p_request->>'budget_currency', v_date)
    returning id into new_id;
  insert into public.project_request_notifications(request_id) values (new_id);
  return jsonb_build_object('ok', true, 'request_id', new_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Postulaciones de profesionales
-- ---------------------------------------------------------------------------
create table if not exists public.professional_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  country text not null check (char_length(btrim(country)) between 2 and 80),
  city text check (city is null or char_length(city) between 1 and 80),
  whatsapp text check (whatsapp is null or char_length(whatsapp) between 6 and 30),
  specialties text[] not null default '{}' check (cardinality(specialties) <= 12),
  other_specialty text check (other_specialty is null or char_length(other_specialty) between 1 and 100),
  experience_summary text not null check (char_length(btrim(experience_summary)) between 30 and 2000),
  years_experience smallint check (years_experience is null or years_experience between 0 and 60),
  portfolio_url text not null check (portfolio_url ~ '^https://[^[:space:]]+$' and char_length(portfolio_url) between 12 and 300),
  linkedin_url text check (linkedin_url is null or (linkedin_url ~ '^https://[^[:space:]]+$' and char_length(linkedin_url) between 12 and 300)),
  other_links text[] not null default '{}' check (cardinality(other_links) <= 5),
  languages text[] not null check (cardinality(languages) between 1 and 8),
  availability text not null check (availability in ('full-time','part-time','project-based','limited')),
  rate_model text not null check (rate_model in ('per-project','hourly','per-deliverable','monthly','to-discuss')),
  rate_amount numeric(14,2) check (rate_amount is null or (rate_amount > 0 and rate_amount <= 1000000000)),
  rate_currency text not null check (rate_currency ~ '^[A-Z]{3}$'),
  language text not null check (language in ('es','en')),
  consent_at timestamptz not null,
  privacy_version text not null check (char_length(privacy_version) between 1 and 80),
  source text not null default 'landing',
  status text not null default 'pending' check (status in ('pending','reviewing','approved','declined','archived')),
  submission_key uuid,
  submission_fingerprint text,
  constraint professional_applications_has_specialty check (cardinality(specialties) > 0 or other_specialty is not null)
);
create unique index if not exists professional_applications_submission_key_idx
  on public.professional_applications(submission_key) where submission_key is not null;
create index if not exists professional_applications_created_at_idx on public.professional_applications(created_at desc);
create index if not exists professional_applications_status_idx on public.professional_applications(status);
create index if not exists professional_applications_email_idx on public.professional_applications(email);
comment on table public.professional_applications is
  'Postulaciones de profesionales independientes. Privada: no hay perfil público ni cuentas. Estado inicial pending.';

alter table public.professional_applications enable row level security;
revoke all on public.professional_applications from public, anon, authenticated;
-- Los visitantes no tienen NINGUNA política: no pueden leer, modificar ni borrar. El alta pasa por la Edge Function
-- (clave secreta del servidor). Los administradores con MFA pueden leer y cambiar el estado, nada más.
grant select on public.professional_applications to authenticated;
grant update(status) on public.professional_applications to authenticated;
drop policy if exists "MFA administrators can read applications" on public.professional_applications;
create policy "MFA administrators can read applications" on public.professional_applications
  for select to authenticated using (public.is_cotivanta_admin());
drop policy if exists "MFA administrators can update application status" on public.professional_applications;
create policy "MFA administrators can update application status" on public.professional_applications
  for update to authenticated using (public.is_cotivanta_admin()) with check (public.is_cotivanta_admin());
drop trigger if exists audit_application_status on public.professional_applications;
create trigger audit_application_status before update of status on public.professional_applications
  for each row execute function public.audit_cotivanta_changes();

-- Cola de avisos: mismo patrón que project_request_notifications (el worker notify-requests atiende ambas).
create table if not exists public.professional_application_notifications (
  application_id uuid primary key references public.professional_applications(id) on delete cascade,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  sent_at timestamptz
);
create index if not exists professional_application_notifications_pending_idx
  on public.professional_application_notifications(next_attempt_at) where sent_at is null;
alter table public.professional_application_notifications enable row level security;
revoke all on public.professional_application_notifications from public, anon, authenticated;

create or replace function public.submit_professional_application(p_submission_key uuid, p_fingerprint text, p_application jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.professional_applications; new_id uuid; v_years smallint; v_rate numeric;
begin
  if p_submission_key is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Invalid submission'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_submission_key::text, 0));
  select * into existing from public.professional_applications where submission_key = p_submission_key;
  if found then
    if existing.submission_fingerprint is distinct from p_fingerprint then
      return jsonb_build_object('code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'application_id', existing.id);
  end if;
  if jsonb_typeof(p_application) is distinct from 'object'
    or not (p_application ?& array['full_name','email','country','experience_summary','portfolio_url','availability','rate_model','rate_currency','privacy_version'])
    or jsonb_typeof(coalesce(p_application->'specialties', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_application->'languages', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_application->'other_links', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_application->'specialties', '[]'::jsonb)) > 12
    or jsonb_array_length(coalesce(p_application->'languages', '[]'::jsonb)) not between 1 and 8
    or jsonb_array_length(coalesce(p_application->'other_links', '[]'::jsonb)) > 5 then
    raise exception 'Invalid application';
  end if;
  -- Cada elemento de las listas debe ser un texto con el formato esperado (los CHECK no pueden recorrer arrays).
  if exists (select 1 from jsonb_array_elements(coalesce(p_application->'specialties', '[]'::jsonb)) as item
             where jsonb_typeof(item) <> 'string' or (item #>> '{}') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(item #>> '{}') > 60)
    or exists (select 1 from jsonb_array_elements(coalesce(p_application->'languages', '[]'::jsonb)) as item
             where jsonb_typeof(item) <> 'string' or (item #>> '{}') !~ '^[a-z]{2,5}$')
    or exists (select 1 from jsonb_array_elements(coalesce(p_application->'other_links', '[]'::jsonb)) as item
             where jsonb_typeof(item) <> 'string' or (item #>> '{}') !~ '^https://[^[:space:]]+$' or char_length(item #>> '{}') not between 12 and 300) then
    raise exception 'Invalid application lists';
  end if;
  v_years := nullif(p_application->>'years_experience', '')::smallint;
  v_rate := nullif(p_application->>'rate_amount', '')::numeric;
  insert into public.professional_applications(full_name, email, country, city, whatsapp, specialties, other_specialty,
    experience_summary, years_experience, portfolio_url, linkedin_url, other_links, languages, availability,
    rate_model, rate_amount, rate_currency, language, consent_at, privacy_version, source, submission_key, submission_fingerprint)
  values (p_application->>'full_name', p_application->>'email', p_application->>'country', p_application->>'city',
    p_application->>'whatsapp',
    array(select jsonb_array_elements_text(coalesce(p_application->'specialties', '[]'::jsonb))),
    p_application->>'other_specialty', p_application->>'experience_summary', v_years,
    p_application->>'portfolio_url', p_application->>'linkedin_url',
    array(select jsonb_array_elements_text(coalesce(p_application->'other_links', '[]'::jsonb))),
    array(select jsonb_array_elements_text(p_application->'languages')),
    p_application->>'availability', p_application->>'rate_model', v_rate, p_application->>'rate_currency',
    coalesce(p_application->>'language', 'es'), now(), p_application->>'privacy_version', 'landing',
    p_submission_key, p_fingerprint)
  returning id into new_id;
  insert into public.professional_application_notifications(application_id) values (new_id);
  return jsonb_build_object('ok', true, 'application_id', new_id);
end;
$$;

create or replace function public.claim_professional_notifications()
returns table(application_id uuid) language sql security definer set search_path = '' as $$
  update public.professional_application_notifications as notifications
    set locked_until = now() + interval '2 minutes', attempts = attempts + 1
    where notifications.application_id in (
      select pending.application_id from public.professional_application_notifications as pending
      where pending.sent_at is null and pending.next_attempt_at <= now()
        and (pending.locked_until is null or pending.locked_until < now())
      order by pending.next_attempt_at limit 5 for update skip locked
    ) returning notifications.application_id;
$$;

create or replace function public.finish_professional_notification(p_application_id uuid, p_sent boolean)
returns void language sql security definer set search_path = '' as $$
  update public.professional_application_notifications set
    sent_at = case when p_sent then now() else null end,
    next_attempt_at = now() + interval '15 minutes', locked_until = null
  where application_id = p_application_id and sent_at is null;
$$;

revoke all on function public.submit_professional_application(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_professional_notifications() from public, anon, authenticated;
revoke all on function public.finish_professional_notification(uuid, boolean) from public, anon, authenticated;
grant execute on function public.submit_professional_application(uuid, text, jsonb) to service_role;
grant execute on function public.claim_professional_notifications() to service_role;
grant execute on function public.finish_professional_notification(uuid, boolean) to service_role;
-- submit_project_request conserva sus permisos (create or replace no los modifica); se reafirman por si acaso.
revoke all on function public.submit_project_request(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_project_request(uuid, text, jsonb) to service_role;
commit;
