-- Apply only after review in the Cotivanta project. This is separate from
-- project_requests and does not grant access to inquiry data.
begin;

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  client_count integer not null check (client_count between 0 and 10000000),
  team_count integer not null check (team_count between 0 and 10000000)
);

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant update (client_count, team_count) on table public.site_settings to authenticated;

create policy "Public can read published site settings"
  on public.site_settings for select to anon, authenticated
  using (true);

create policy "Only designated administrators can update site settings"
  on public.site_settings for update to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'cotivanta_admin') = 'true'
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'cotivanta_admin') = 'true'
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
  );

insert into public.site_settings (id, client_count, team_count) values (1, 200, 5);

commit;
