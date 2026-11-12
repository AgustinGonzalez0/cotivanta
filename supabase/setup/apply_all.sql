-- Cotivanta: base de datos completa en un solo script, seguro de ejecutar más de una vez.
-- Pegalo entero en Supabase > SQL Editor > New query > Run.
-- Qué hace: agrega columnas, tablas, funciones, políticas y auditoría que necesita el formulario nuevo,
-- el panel de administración y la cola de avisos por correo.
-- Qué NO hace: no borra ni modifica solicitudes existentes, ni crea avisos para las viejas.
-- Qué NO puede hacer SQL: desplegar las Edge Functions ni cargar sus secretos (ver schedule_notifications.sql y la guía).
begin;

-- 1) project_requests (si ya existe, se respeta)
-- No public table access: all INSERT calls go through the protected Edge Function.
create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  client_type text not null check(client_type in ('individual','entrepreneur','professional','business')),
  service text not null check(service in ('website','app','automation','custom-software','integrations','other')),
  description text not null,
  budget text not null check(budget in ('unsure','under-500','500-1500','1500-5000','over-5000')),
  timeline text not null check(timeline in ('flexible','within-month','1-3-months','later')),
  organization text,
  language text not null check(language in ('es','en')),
  consent_at timestamptz not null,
  source text not null default 'landing',
  status text not null default 'new' check(status in ('new','contacted','qualified','quoted','won','lost','declined'))
);
create index if not exists project_requests_created_at_idx on public.project_requests(created_at desc);
create index if not exists project_requests_status_idx on public.project_requests(status);
create index if not exists project_requests_email_idx on public.project_requests(email);
alter table public.project_requests enable row level security;
revoke all on table public.project_requests from anon, authenticated;
-- Intentionally no anon or authenticated policies. Only server-side secret key can insert or read.


-- 2) versión de privacidad
alter table public.project_requests
  add column if not exists privacy_version text
  check (privacy_version is null or char_length(privacy_version) between 1 and 80);

comment on column public.project_requests.privacy_version is
  'Policy version validated server-side for new inquiries; NULL for legacy rows.';


-- 3) seguridad del formulario: antispam, idempotencia y cola de avisos
-- Review and apply AFTER the two 2026-10 migrations, before deploying the new functions.
-- No existing requests are deleted or assigned invented consent/submission keys.
begin;

alter table public.project_requests
  add column if not exists submission_key uuid,
  add column if not exists submission_fingerprint text;
create unique index if not exists project_requests_submission_key_idx
  on public.project_requests(submission_key) where submission_key is not null;

create table if not exists public.project_request_rate_limits (
  key text primary key check (length(key) = 64),
  count integer not null,
  expires_at timestamptz not null
);
create index if not exists project_request_rate_limits_expires_at_idx on public.project_request_rate_limits(expires_at);
alter table public.project_request_rate_limits enable row level security;
revoke all on public.project_request_rate_limits from public, anon, authenticated;

create table if not exists public.project_request_notifications (
  request_id uuid primary key references public.project_requests(id) on delete cascade,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  sent_at timestamptz
);
create index if not exists project_request_notifications_next_attempt_idx on public.project_request_notifications(next_attempt_at) where sent_at is null;
alter table public.project_request_notifications enable row level security;
revoke all on public.project_request_notifications from public, anon, authenticated;

create or replace function public.check_project_request_rate_limit(p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare bucket public.project_request_rate_limits;
begin
  if p_key !~ '^[0-9a-f]{64}$' then raise exception 'Invalid rate key'; end if;
  delete from public.project_request_rate_limits where expires_at <= now();
  insert into public.project_request_rate_limits as limits(key, count, expires_at)
    values (p_key, 1, now() + interval '10 minutes')
    on conflict (key) do update set count = limits.count + 1
    returning * into bucket;
  return jsonb_build_object('allowed', bucket.count <= 5,
    'retry_after', greatest(1, ceil(extract(epoch from (bucket.expires_at - now())))));
end;
$$;

create or replace function public.submit_project_request(p_submission_key uuid, p_fingerprint text, p_request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.project_requests; new_id uuid;
begin
  if p_submission_key is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Invalid submission'; end if;
  -- Serialize only competing submissions with the same key, across all Edge instances.
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
    or length(coalesce(p_request->>'privacy_version', '')) not between 1 and 80 then
    raise exception 'Invalid form values';
  end if;
  insert into public.project_requests(name, email, client_type, service, description, budget,
    timeline, organization, language, consent_at, privacy_version, source, submission_key, submission_fingerprint)
    values (p_request->>'name', p_request->>'email', p_request->>'client_type', p_request->>'service',
      p_request->>'description', p_request->>'budget', p_request->>'timeline', p_request->>'organization',
      p_request->>'language', now(), p_request->>'privacy_version', 'landing', p_submission_key, p_fingerprint)
    returning id into new_id;
  insert into public.project_request_notifications(request_id) values (new_id);
  return jsonb_build_object('ok', true, 'request_id', new_id);
end;
$$;

create or replace function public.claim_project_notifications()
returns table(request_id uuid) language sql security definer set search_path = '' as $$
  update public.project_request_notifications as notifications
    set locked_until = now() + interval '2 minutes', attempts = attempts + 1
    where notifications.request_id in (
      select pending.request_id from public.project_request_notifications as pending
      where pending.sent_at is null and pending.next_attempt_at <= now()
        and (pending.locked_until is null or pending.locked_until < now())
      order by pending.next_attempt_at limit 5 for update skip locked
    ) returning notifications.request_id;
$$;

create or replace function public.finish_project_notification(p_request_id uuid, p_sent boolean)
returns void language sql security definer set search_path = '' as $$
  update public.project_request_notifications set
    sent_at = case when p_sent then now() else null end,
    next_attempt_at = now() + interval '15 minutes', locked_until = null
  where request_id = p_request_id and sent_at is null;
$$;

revoke all on function public.check_project_request_rate_limit(text) from public, anon, authenticated;
revoke all on function public.submit_project_request(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_project_notifications() from public, anon, authenticated;
revoke all on function public.finish_project_notification(uuid, boolean) from public, anon, authenticated;
grant execute on function public.check_project_request_rate_limit(text) to service_role;
grant execute on function public.submit_project_request(uuid, text, jsonb) to service_role;
grant execute on function public.claim_project_notifications() to service_role;
grant execute on function public.finish_project_notification(uuid, boolean) to service_role;


-- 4) panel de administración (MFA), políticas y auditoría
-- Review before applying. Administrators MUST use a verified MFA session (aal2).
begin;
create table if not exists public.site_settings (
  id smallint primary key default 1 check(id = 1),
  client_count integer not null check(client_count between 0 and 10000000),
  team_count integer not null check(team_count between 0 and 10000000)
);
alter table public.site_settings add column if not exists metrics_verified boolean not null default false;
alter table public.site_settings add column if not exists revision integer not null default 1;
insert into public.site_settings(id, client_count, team_count) values (1, 0, 0) on conflict (id) do nothing;

create or replace function public.is_cotivanta_admin()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt()->'app_metadata'->>'cotivanta_admin') = 'true'
    and (auth.jwt()->>'aal') = 'aal2'
    and coalesce(auth.jwt()->>'is_anonymous', 'false') = 'false', false);
$$;
revoke all on function public.is_cotivanta_admin() from public, anon;
grant execute on function public.is_cotivanta_admin() to authenticated;

alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update(client_count, team_count, metrics_verified) on public.site_settings to authenticated;
drop policy if exists "Public can read published site settings" on public.site_settings;
drop policy if exists "Only designated administrators can update site settings" on public.site_settings;
drop policy if exists "Authenticated settings visibility" on public.site_settings;
drop policy if exists "MFA administrators can read inquiries" on public.project_requests;
drop policy if exists "MFA administrators can update inquiry status" on public.project_requests;
create policy "Public can read published site settings" on public.site_settings for select to anon using (metrics_verified);
create policy "Authenticated settings visibility" on public.site_settings for select to authenticated
  using (metrics_verified or public.is_cotivanta_admin());
create policy "Only designated administrators can update site settings" on public.site_settings for update to authenticated
  using (public.is_cotivanta_admin()) with check (public.is_cotivanta_admin());

grant select on public.project_requests to authenticated;
grant update(status) on public.project_requests to authenticated;
create policy "MFA administrators can read inquiries" on public.project_requests for select to authenticated using (public.is_cotivanta_admin());
create policy "MFA administrators can update inquiry status" on public.project_requests for update to authenticated
  using (public.is_cotivanta_admin()) with check (public.is_cotivanta_admin());

create table if not exists public.admin_audit_events (
  id bigint generated always as identity primary key,
  happened_at timestamptz not null default now(),
  actor uuid,
  entity text not null,
  record_id text not null,
  changes jsonb not null
);
alter table public.admin_audit_events enable row level security;
revoke all on public.admin_audit_events from public, anon, authenticated;
grant select on public.admin_audit_events to authenticated;
drop policy if exists "MFA administrators can read audit events" on public.admin_audit_events;
create policy "MFA administrators can read audit events" on public.admin_audit_events for select to authenticated using (public.is_cotivanta_admin());

create or replace function public.audit_cotivanta_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare before_values jsonb; after_values jsonb;
begin
  if tg_table_name = 'site_settings' then
    before_values = jsonb_build_object('clients', old.client_count, 'teams', old.team_count, 'verified', old.metrics_verified);
    after_values = jsonb_build_object('clients', new.client_count, 'teams', new.team_count, 'verified', new.metrics_verified);
    new.revision = old.revision + 1;
  else
    before_values = jsonb_build_object('status', old.status);
    after_values = jsonb_build_object('status', new.status);
  end if;
  if before_values is distinct from after_values then
    insert into public.admin_audit_events(actor, entity, record_id, changes)
      values (auth.uid(), tg_table_name, new.id::text, jsonb_build_object('before', before_values, 'after', after_values));
  end if;
  return new;
end;
$$;
revoke all on function public.audit_cotivanta_changes() from public, anon, authenticated;
drop trigger if exists audit_settings on public.site_settings;
create trigger audit_settings before update on public.site_settings for each row execute function public.audit_cotivanta_changes();
drop trigger if exists audit_request_status on public.project_requests;
create trigger audit_request_status before update of status on public.project_requests for each row execute function public.audit_cotivanta_changes();

commit;

-- Verificación: debe devolver las 7 tablas/funciones esperadas.
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name in ('project_requests','project_request_rate_limits','project_request_notifications','site_settings','admin_audit_events')) as tablas_esperadas_5,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('submit_project_request','check_project_request_rate_limit','claim_project_notifications','finish_project_notification','is_cotivanta_admin')) as funciones_esperadas_5;
