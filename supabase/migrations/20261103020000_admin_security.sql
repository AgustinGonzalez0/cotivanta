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

create function public.is_cotivanta_admin()
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

create table public.admin_audit_events (
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
create policy "MFA administrators can read audit events" on public.admin_audit_events for select to authenticated using (public.is_cotivanta_admin());

create function public.audit_cotivanta_changes()
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
create trigger audit_settings before update on public.site_settings for each row execute function public.audit_cotivanta_changes();
create trigger audit_request_status before update of status on public.project_requests for each row execute function public.audit_cotivanta_changes();
commit;
