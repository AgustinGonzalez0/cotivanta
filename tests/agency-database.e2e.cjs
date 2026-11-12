// Modelo de agencia: campos nuevos de consultas y postulaciones profesionales.
// PostgreSQL real en WASM, aislado en memoria. Nunca se conecta a Supabase.
const { PGlite } = require("@electric-sql/pglite");
const { readdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const { read, root } = require("./helpers.cjs");
let db, legacyId, applicationId;
const admin = { sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", app_metadata: { cotivanta_admin: true }, aal: "aal2", is_anonymous: false };
const request = { name: "Prueba Sintética", email: "audit@example.invalid", client_type: "individual", service: "website", description: "Consulta sintética de integración SQL.", budget: "unsure", timeline: "flexible", organization: null, language: "es", privacy_version: "2026-11-12.1-draft" };
const application = { full_name: "Profesional Sintético", email: "pro@example.invalid", country: "Argentina", city: "Rosario", whatsapp: "+54 9 341 000 0000", specialties: ["video-editing", "motion-graphics"], other_specialty: null, experience_summary: "Editor de video con experiencia sintética en piezas de prueba.", years_experience: 4, portfolio_url: "https://portfolio.example.invalid/work", linkedin_url: "https://www.linkedin.com/in/synthetic", other_links: ["https://vimeo.com/synthetic"], languages: ["es", "en"], availability: "part-time", rate_model: "per-project", rate_amount: 150000.5, rate_currency: "ARS", language: "es", privacy_version: "2026-11-12.1-draft" };
const appKey = "33333333-3333-4333-8333-333333333333";
const submitApplication = (payload, keyValue = appKey, fingerprint = "c".repeat(64)) => db.query("select public.submit_professional_application($1,$2,$3::jsonb) as value", [keyValue, fingerprint, JSON.stringify(payload)]);
const submitRequest = (payload, keyValue, fingerprint = "f".repeat(64)) => db.query("select public.submit_project_request($1,$2,$3::jsonb) as value", [keyValue, fingerprint, JSON.stringify(payload)]);
const count = async table => (await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
async function asRole(role, claims, fn) {
  await db.exec(`begin; set local role ${role};`);
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  try { return await fn(); } finally { await db.exec("rollback"); }
}
// Cada denegación corre en su propia transacción: tras un error, PostgreSQL aborta el resto de la transacción.
const denied = (role, claims, sql, params = [], code = "42501") => asRole(role, claims, () => assert.rejects(db.query(sql, params), { code }));
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
  const files = readdirSync(resolve(root, "supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
  // Una solicitud con el formato ANTERIOR, creada antes de la migración de agencia, debe seguir siendo válida.
  for (const file of files.filter(f => f < "20261112")) await db.exec(read("supabase/migrations/" + file));
  legacyId = (await submitRequest({ ...request, privacy_version: "2026-10-30.1-draft" }, "11111111-1111-4111-8111-111111111111", "a".repeat(64))).rows[0].value.request_id;
  for (const file of files.filter(f => f >= "20261112")) await db.exec(read("supabase/migrations/" + file));
});
after(async () => { await db?.close(); });

test("the agency migration is re-runnable (idempotent) and keeps the pre-existing inquiry intact", async () => {
  await db.exec(read("supabase/migrations/20261112010000_agency_services.sql"));
  const legacy = (await db.query("select * from public.project_requests where id=$1", [legacyId])).rows[0];
  assert.equal(legacy.service, "website"); assert.equal(legacy.client_type, "individual"); assert.equal(legacy.budget, "unsure");
  assert.equal(legacy.category, null); assert.equal(legacy.budget_amount, null); assert.equal(legacy.whatsapp, null);
  assert.equal(await count("project_requests"), 1);
});
test("an old-shape request still goes through the replaced function (backward compatible)", async () => {
  const receipt = (await submitRequest(request, "22222222-2222-4222-8222-222222222222")).rows[0].value;
  assert.equal(receipt.ok, true);
  assert.equal((await db.query("select count(*)::int as n from public.project_request_notifications where request_id=$1", [receipt.request_id])).rows[0].n, 1);
});
test("project requests store the new agency fields", async () => {
  const agency = { ...request, category: "audiovisual", service: "video-editing", client_type: null, budget: "amount", budget_amount: 100000, budget_currency: "ARS", whatsapp: "+54 9 11 5555 5555", desired_date: "2027-01-15" };
  const receipt = (await submitRequest(agency, "44444444-4444-4444-8444-444444444444", "d".repeat(64))).rows[0].value;
  const row = (await db.query("select * from public.project_requests where id=$1", [receipt.request_id])).rows[0];
  assert.equal(row.category, "audiovisual"); assert.equal(row.client_type, null); assert.equal(Number(row.budget_amount), 100000); assert.equal(row.budget_currency, "ARS");
  assert.equal(row.whatsapp, "+54 9 11 5555 5555"); assert.equal(row.desired_date.toISOString().slice(0, 10), "2027-01-15");
});
test("new specialties need no schema change: any well-formed service slug is storable, malformed ones are not", async () => {
  assert.equal((await submitRequest({ ...request, category: "future-category", service: "drone-photography" }, "88888888-8888-4888-8888-888888888888", "9".repeat(64))).rows[0].value.ok, true);
});
test("project request constraints reject malformed agency values without partial data", async () => {
  const before = await count("project_requests"), outbox = await count("project_request_notifications");
  const bad = [{ service: "Has Spaces" }, { budget: "amount" }, { budget: "amount", budget_amount: 5, budget_currency: "ars" }, { budget: "amount", budget_amount: -1, budget_currency: "ARS" }, { whatsapp: "123" }, { category: "UPPER" }, { desired_date: "not-a-date" }, { client_type: "alien" }];
  for (const [index, override] of bad.entries()) {
    await assert.rejects(submitRequest({ ...request, ...override }, `55555555-5555-4555-8555-55555555550${index}`, "e".repeat(64)), undefined, JSON.stringify(override));
  }
  assert.equal(await count("project_requests"), before); assert.equal(await count("project_request_notifications"), outbox);
});
test("professional application is stored as pending with timestamptz fields, consent record and a durable notification", async () => {
  const receipt = (await submitApplication(application)).rows[0].value; applicationId = receipt.application_id; assert.equal(receipt.ok, true);
  const row = (await db.query("select * from public.professional_applications where id=$1", [applicationId])).rows[0];
  assert.equal(row.status, "pending"); assert.ok(row.created_at instanceof Date && row.consent_at instanceof Date);
  assert.deepEqual(row.specialties, ["video-editing", "motion-graphics"]); assert.deepEqual(row.languages, ["es", "en"]); assert.equal(Number(row.rate_amount), 150000.5);
  assert.equal(row.privacy_version, application.privacy_version); assert.equal(row.rate_currency, "ARS");
  assert.equal((await db.query("select count(*)::int as n from public.professional_application_notifications where application_id=$1 and sent_at is null", [applicationId])).rows[0].n, 1);
  const types = (await db.query("select distinct data_type from information_schema.columns where table_name='professional_applications' and column_name in ('created_at','consent_at')")).rows;
  assert.deepEqual(types.map(row => row.data_type), ["timestamp with time zone"]);
  assert.equal((await db.query("select data_type from information_schema.columns where table_name='professional_applications' and column_name='id'")).rows[0].data_type, "uuid");
});
test("application submission is idempotent and refuses a changed payload under the same key", async () => {
  assert.equal((await submitApplication(application)).rows[0].value.application_id, applicationId);
  assert.equal((await submitApplication(application, appKey, "e".repeat(64))).rows[0].value.code, "idempotency_conflict");
  assert.equal(await count("professional_applications"), 1);
});
test("SQL rejects malformed applications without a partial row or outbox entry", async () => {
  const cases = [{ full_name: " " }, { country: "" }, { experience_summary: "corto" }, { portfolio_url: "http://insecure.example.invalid" }, { portfolio_url: "javascript:alert(1)" }, { linkedin_url: "ftp://x.example.invalid/a" }, { availability: "always" }, { rate_model: "free" }, { rate_currency: "ars" }, { languages: [] }, { languages: ["EN"] }, { specialties: ["Bad Slug"] }, { specialties: new Array(13).fill("a-b") }, { specialties: [], other_specialty: null }, { other_links: new Array(6).fill("https://a.example.invalid") }, { other_links: ["https://has space.example.invalid"] }, { specialties: [1] }, { years_experience: 99 }, { rate_amount: -5 }, { privacy_version: null }];
  for (const [index, override] of cases.entries()) {
    await assert.rejects(submitApplication({ ...application, ...override }, `66666666-6666-4666-8666-6666666666${String(index).padStart(2, "0")}`, "a".repeat(64)), undefined, JSON.stringify(override));
  }
  assert.equal(await count("professional_applications"), 1); assert.equal(await count("professional_application_notifications"), 1);
});
test("a professional who only types a free-text specialty is accepted", async () => {
  assert.equal((await submitApplication({ ...application, specialties: [], other_specialty: "Locución profesional" }, "77777777-7777-4777-8777-777777777777")).rows[0].value.ok, true);
});
test("anon cannot read, insert, change or delete applications or touch their queue", async () => {
  for (const sql of ["select * from public.professional_applications", "insert into public.professional_applications(full_name) values ('x')", "update public.professional_applications set status='approved'", "delete from public.professional_applications", "select * from public.professional_application_notifications"]) await denied("anon", {}, sql);
});
test("authenticated non-admins, password-only (aal1) and anonymous-auth sessions see and change nothing", async () => {
  for (const claims of [{ ...admin, app_metadata: {} }, { ...admin, aal: "aal1" }, { ...admin, is_anonymous: true }]) {
    await asRole("authenticated", claims, async () => {
      assert.equal((await db.query("select * from public.professional_applications")).rows.length, 0);
      assert.equal((await db.query("update public.professional_applications set status='approved' returning id")).rows.length, 0);
    });
    await denied("authenticated", claims, "select * from public.professional_application_notifications");
  }
});
test("MFA administrator reads applications and changes only the status, with an audit event that carries no personal data", async () => {
  await asRole("authenticated", admin, async () => {
    assert.equal((await db.query("select id from public.professional_applications")).rows.length, 2);
    await db.query("update public.professional_applications set status='reviewing' where id=$1", [applicationId]);
    const audit = (await db.query("select * from public.admin_audit_events where entity='professional_applications'")).rows[0];
    assert.equal(audit.actor, admin.sub); assert.deepEqual(audit.changes.after, { status: "reviewing" });
    assert.ok(!JSON.stringify(audit).includes(application.email));
  });
  await denied("authenticated", admin, "update public.professional_applications set status='bogus'", [], "23514");
  await denied("authenticated", admin, "update public.professional_applications set email='x@example.invalid'");
  await denied("authenticated", admin, "delete from public.professional_applications");
});
for (const role of ["anon", "authenticated"]) test(`${role} cannot call the application intake or queue functions`, async () => {
  for (const sql of [`select public.submit_professional_application('${appKey}',repeat('a',64),'{}')`, "select public.claim_professional_notifications()", `select public.finish_professional_notification('${appKey}', true)`]) {
    await asRole(role, admin, async () => assert.rejects(db.query(sql), { code: "42501" }));
  }
});
test("service_role can run the application intake and queue functions", async () => {
  await asRole("service_role", {}, async () => {
    assert.equal((await db.query("select public.claim_professional_notifications() as value")).rows.length, 2);
  });
});
test("deleting an application removes its queue entry (no orphaned notifications)", async () => {
  const id = (await submitApplication(application, "99999999-9999-4999-8999-999999999999", "b".repeat(64))).rows[0].value.application_id;
  const before = await count("professional_application_notifications");
  await db.query("delete from public.professional_applications where id=$1", [id]);
  assert.equal(await count("professional_application_notifications"), before - 1);
});
test("application notification leases avoid double claiming and retry after a failure", async () => {
  await db.query("update public.professional_application_notifications set locked_until=null, attempts=0, sent_at=null, next_attempt_at=now()");
  const claimed = await db.query("select * from public.claim_professional_notifications()"); assert.equal(claimed.rows.length, 2);
  assert.equal((await db.query("select * from public.claim_professional_notifications()")).rows.length, 0);
  for (const row of claimed.rows) await db.query("select public.finish_professional_notification($1,false)", [row.application_id]);
  assert.equal((await db.query("select * from public.claim_professional_notifications()")).rows.length, 0);
  await db.query("update public.professional_application_notifications set next_attempt_at=now()-interval '1 minute'");
  assert.equal((await db.query("select * from public.claim_professional_notifications()")).rows.length, 2);
  for (const row of claimed.rows) await db.query("select public.finish_professional_notification($1,true)", [row.application_id]);
  assert.equal((await db.query("select * from public.claim_professional_notifications()")).rows.length, 0);
  assert.equal(await count("professional_applications"), 2);
});
