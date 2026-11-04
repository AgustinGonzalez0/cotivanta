-- LEGACY bootstrap only. Prefer the complete migrations in supabase/migrations.
-- Never run after the security migrations. MFA and audit/inbox migration are required.
-- Apply only after review in the Cotivanta project. This is separate from
-- project_requests and does not grant access to inquiry data.
begin;

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  client_count integer not null check (client_count between 0 and 10000000),
  team_count integer not null check (team_count between 0 and 10000000),
  metrics_verified boolean not null default false,
  revision integer not null default 1
);

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant update (client_count, team_count, metrics_verified) on table public.site_settings to authenticated;

create policy "Public can read published site settings"
  on public.site_settings for select to anon, authenticated
  using (metrics_verified);

create policy "Only designated administrators can update site settings"
  on public.site_settings for update to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'cotivanta_admin') = 'true'
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'cotivanta_admin') = 'true'
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
  );

insert into public.site_settings (id, client_count, team_count) values (1, 0, 0);

commit;
