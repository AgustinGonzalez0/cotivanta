-- Review and apply AFTER the two 2026-10 migrations, before deploying the new functions.
-- No existing requests are deleted or assigned invented consent/submission keys.
begin;

alter table public.project_requests
  add column if not exists submission_key uuid,
  add column if not exists submission_fingerprint text;
create unique index if not exists project_requests_submission_key_idx
  on public.project_requests(submission_key) where submission_key is not null;

create table public.project_request_rate_limits (
  key text primary key check (length(key) = 64),
  count integer not null,
  expires_at timestamptz not null
);
create index on public.project_request_rate_limits(expires_at);
alter table public.project_request_rate_limits enable row level security;
revoke all on public.project_request_rate_limits from public, anon, authenticated;

create table public.project_request_notifications (
  request_id uuid primary key references public.project_requests(id) on delete cascade,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  sent_at timestamptz
);
create index on public.project_request_notifications(next_attempt_at) where sent_at is null;
alter table public.project_request_notifications enable row level security;
revoke all on public.project_request_notifications from public, anon, authenticated;

create function public.check_project_request_rate_limit(p_key text)
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

create function public.submit_project_request(p_submission_key uuid, p_fingerprint text, p_request jsonb)
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

create function public.claim_project_notifications()
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

create function public.finish_project_notification(p_request_id uuid, p_sent boolean)
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
commit;
