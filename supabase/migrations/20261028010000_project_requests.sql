-- Deploy only in a new dedicated Cotivanta project.
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
