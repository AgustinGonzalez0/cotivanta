-- Apply before deploying the updated project-request function.
-- Historical submissions remain NULL: do not invent an accepted policy version.
alter table public.project_requests
  add column if not exists privacy_version text
  check (privacy_version is null or char_length(privacy_version) between 1 and 80);

comment on column public.project_requests.privacy_version is
  'Policy version validated server-side for new inquiries; NULL for legacy rows.';
