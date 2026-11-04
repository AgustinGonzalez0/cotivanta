// Real PostgreSQL engine in WASM, isolated in memory. Never connects to Supabase.
const { PGlite } = require("@electric-sql/pglite");
const { readdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const { read, root } = require("./helpers.cjs");
let db, requestId;
const admin = { sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", app_metadata: { cotivanta_admin: true }, aal: "aal2", is_anonymous: false };
const request = { name: "Prueba Sintética", email: "audit@example.invalid", client_type: "individual", service: "website", description: "Consulta sintética de integración SQL.", budget: "unsure", timeline: "flexible", organization: null, language: "es", privacy_version: "2026-10-30.1-draft" };
const key = "11111111-1111-4111-8111-111111111111";
async function asRole(role, claims, fn) {
  await db.exec(`begin; set local role ${role};`);
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  try { return await fn(); } finally { await db.exec("rollback"); }
}
before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
  `);
  for (const file of readdirSync(resolve(root, "supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) await db.exec(read("supabase/migrations/" + file));
  const result = await db.query("select public.submit_project_request($1, $2, $3::jsonb) as receipt", [key, "a".repeat(64), JSON.stringify(request)]);
  requestId = result.rows[0].receipt.request_id;
});
after(async () => { await db?.close(); });

test("all migrations apply in sequence and record real consent and a durable notification", async () => {
  const row = (await db.query("select * from public.project_requests where id=$1", [requestId])).rows[0];
  assert.equal(row.privacy_version, request.privacy_version); assert.ok(row.consent_at);
  assert.equal((await db.query("select count(*)::int as n from public.project_request_notifications where request_id=$1", [requestId])).rows[0].n, 1);
});
test("anon cannot read private inquiries", async () => {
  await asRole("anon", {}, async () => assert.rejects(db.query("select * from public.project_requests"), { code: "42501" }));
});
test("authenticated non-admin cannot see inquiries, even with aal2", async () => {
  await asRole("authenticated", { ...admin, app_metadata: {} }, async () => {
    assert.equal((await db.query("select * from public.project_requests")).rows.length, 0);
    assert.equal((await db.query("update public.site_settings set client_count=99 returning id")).rows.length, 0);
  });
});
test("administrator password session (aal1) cannot read or modify private data", async () => {
  await asRole("authenticated", { ...admin, aal: "aal1" }, async () => {
    assert.equal((await db.query("select * from public.project_requests")).rows.length, 0);
    assert.equal((await db.query("update public.site_settings set client_count=99 returning id")).rows.length, 0);
  });
});
test("anonymous auth sessions cannot act as an administrator", async () => {
  await asRole("authenticated", { ...admin, is_anonymous: true }, async () => assert.equal((await db.query("select * from public.project_requests")).rows.length, 0));
});
test("MFA administrator reads inquiries, changes status and produces audit event", async () => {
  await asRole("authenticated", admin, async () => {
    assert.equal((await db.query("select id from public.project_requests")).rows.length, 1);
    await db.query("update public.project_requests set status='contacted' where id=$1", [requestId]);
    const audit = (await db.query("select * from public.admin_audit_events where entity='project_requests'")).rows[0];
    assert.equal(audit.actor, admin.sub); assert.deepEqual(audit.changes.after, { status: "contacted" });
    assert.ok(!JSON.stringify(audit).includes(request.description));
  });
});
test("MFA administrator still cannot modify visitor content", async () => {
  await asRole("authenticated", admin, async () => assert.rejects(db.query("update public.project_requests set email='changed@example.invalid'"), { code: "42501" }));
});
test("MFA administrator cannot delete inquiries directly", async () => {
  await asRole("authenticated", admin, async () => assert.rejects(db.query("delete from public.project_requests"), { code: "42501" }));
});
test("MFA settings update is audited and revision prevents stale overwrites", async () => {
  await asRole("authenticated", admin, async () => {
    const updated = await db.query("update public.site_settings set client_count=3, team_count=2, metrics_verified=true where id=1 and revision=1 returning revision");
    assert.equal(updated.rows[0].revision, 2);
    assert.equal((await db.query("update public.site_settings set client_count=4 where id=1 and revision=1 returning id")).rows.length, 0);
    assert.equal((await db.query("select * from public.admin_audit_events where entity='site_settings'")).rows.length, 1);
  });
});
test("public can read figures but not write them", async () => {
  await asRole("anon", {}, async () => {
    assert.equal((await db.query("select metrics_verified from public.site_settings")).rows.length, 0);
    await assert.rejects(db.query("update public.site_settings set client_count=9"), { code: "42501" });
  });
  await db.query("update public.site_settings set metrics_verified=true where id=1");
  try {
    await asRole("anon", {}, async () => assert.equal((await db.query("select metrics_verified from public.site_settings")).rows[0].metrics_verified, true));
  } finally { await db.query("update public.site_settings set metrics_verified=false where id=1"); }
});
for (const role of ["anon", "authenticated"]) test(`${role} cannot call privileged intake or queue functions`, async () => {
  for (const sql of ["select public.check_project_request_rate_limit(repeat('a',64))", "select public.claim_project_notifications()", `select public.submit_project_request('${key}',repeat('a',64),'{}')`]) {
    await asRole(role, admin, async () => assert.rejects(db.query(sql), { code: "42501" }));
  }
});
test("database idempotency returns same UUID and refuses a different fingerprint", async () => {
  const duplicate = (await db.query("select public.submit_project_request($1,$2,$3::jsonb) as value", [key, "a".repeat(64), JSON.stringify(request)])).rows[0].value;
  assert.equal(duplicate.request_id, requestId);
  const conflict = (await db.query("select public.submit_project_request($1,$2,$3::jsonb) as value", [key, "b".repeat(64), JSON.stringify(request)])).rows[0].value;
  assert.equal(conflict.code, "idempotency_conflict");
  assert.equal((await db.query("select count(*)::int as n from public.project_requests")).rows[0].n, 1);
});
test("SQL rejects malformed/null policy requests without partial inquiry or outbox", async () => {
  for (const invalid of [{ ...request, privacy_version: null }, { ...request, name: null }, {}]) {
    await assert.rejects(db.query("select public.submit_project_request($1,$2,$3::jsonb)", ["22222222-2222-4222-8222-222222222222", "e".repeat(64), JSON.stringify(invalid)]));
  }
  assert.equal((await db.query("select count(*)::int as n from public.project_requests")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.project_request_notifications")).rows[0].n, 1);
});
test("database rate limit is durable and expired buckets are cleaned", async () => {
  await asRole("service_role", {}, async () => {
    for (let i = 0; i < 5; i++) assert.equal((await db.query("select public.check_project_request_rate_limit(repeat('b',64)) as result")).rows[0].result.allowed, true);
    assert.equal((await db.query("select public.check_project_request_rate_limit(repeat('b',64)) as result")).rows[0].result.allowed, false);
  });
  await db.query("insert into public.project_request_rate_limits values(repeat('c',64),1,now()-interval '1 minute')");
  await db.query("select public.check_project_request_rate_limit(repeat('d',64))");
  assert.equal((await db.query("select count(*)::int as n from public.project_request_rate_limits where key=repeat('c',64)")).rows[0].n, 0);
});
test("notification leases avoid double claiming; failures can retry without losing inquiry", async () => {
  const first = await db.query("select * from public.claim_project_notifications()"); assert.equal(first.rows.length, 1);
  assert.equal((await db.query("select * from public.claim_project_notifications()")).rows.length, 0);
  await db.query("select public.finish_project_notification($1,false)", [requestId]);
  assert.equal((await db.query("select * from public.claim_project_notifications()")).rows.length, 0);
  await db.query("update public.project_request_notifications set next_attempt_at=now()-interval '1 minute'");
  assert.equal((await db.query("select * from public.claim_project_notifications()")).rows.length, 1);
  await db.query("select public.finish_project_notification($1,true)", [requestId]);
  assert.equal((await db.query("select * from public.claim_project_notifications()")).rows.length, 0);
  assert.equal((await db.query("select count(*)::int as n from public.project_requests")).rows[0].n, 1);
});
