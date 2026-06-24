// Phase 0 RLS + privilege-escalation verification (repeatable, runs against the
// live Supabase project via the API). Proves:
//   1. Tenant isolation: gym A's user cannot see gym B's rows (and vice versa).
//   2. Escalation guard: a staff user cannot change their own role/gym_id.
//   3. Owner guard: a gym_owner cannot promote themselves to super_admin.
//   4. Legit self-edit: a user CAN change their own non-protected fields.
//
// Usage (PowerShell/bash with env loaded from .env.local):
//   U=<url> ANON=<anon-key> SR=<service-role-key> node scripts/verify-isolation.mjs
//
// Exits non-zero if any assertion fails. Cleans up all test data it creates.

const U = process.env.U, ANON = process.env.ANON, SR = process.env.SR;
if (!U || !ANON || !SR) { console.error("Missing U / ANON / SR env vars"); process.exit(2); }

const jH = (tok) => ({ apikey: ANON, "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) });
const srH = () => ({ apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" });

async function signup(email, password) {
  const r = await fetch(`${U}/auth/v1/signup`, { method: "POST", headers: jH(), body: JSON.stringify({ email, password }) });
  const j = await r.json();
  return { userId: j?.user?.id ?? j?.id, access: j?.access_token, refresh: j?.refresh_token };
}
async function refresh(refresh_token) {
  const r = await fetch(`${U}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: jH(), body: JSON.stringify({ refresh_token }) });
  const j = await r.json();
  return { access: j?.access_token, refresh: j?.refresh_token };
}
async function rpcCreateGym(access, userId, email, name, slug) {
  const r = await fetch(`${U}/rest/v1/rpc/create_gym_with_owner`, { method: "POST", headers: jH(access),
    body: JSON.stringify({ p_user_id: userId, p_email: email, p_full_name: name, p_gym_name: name, p_slug: slug }) });
  if (!r.ok) throw new Error(`create gym failed: ${await r.text()}`);
  return r.json();
}
async function seedStaff(userId, gymId, email) {
  const r = await fetch(`${U}/rest/v1/profiles`, { method: "POST", headers: srH(),
    body: JSON.stringify({ id: userId, gym_id: gymId, role: "staff", email, full_name: "Staff Probe" }) });
  if (!r.ok) throw new Error(`seed staff failed: ${await r.text()}`);
}
const get = async (access, path) => { const r = await fetch(`${U}/rest/v1/${path}`, { headers: jH(access) }); return { status: r.status, body: await r.json() }; };
const patch = async (access, path, body) => { const r = await fetch(`${U}/rest/v1/${path}`, { method: "PATCH", headers: { ...jH(access), Prefer: "return=representation" }, body: JSON.stringify(body) }); return { status: r.status, text: await r.text() }; };
const del = (path) => fetch(`${U}/rest/v1/${path}`, { method: "DELETE", headers: srH() });
const delUser = (id) => fetch(`${U}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: srH() });

const results = [];
const assert = (name, cond, detail = "") => { results.push({ name, pass: !!cond, detail }); };

const ts = Date.now();
let A = {}, B = {}, C = {};
try {
  // --- Setup: gym A owner, gym B owner, staff C in gym A ---
  A = await signup(`gymflow.a.${ts}@gmail.com`, "Str0ngPass!42");
  const gymA = await rpcCreateGym(A.access, A.userId, `gymflow.a.${ts}@gmail.com`, "Gym A", `gym-a-${ts}`);
  ({ access: A.access, refresh: A.refresh } = await refresh(A.refresh)); // token now carries claims
  A.gymId = gymA;

  B = await signup(`gymflow.b.${ts}@gmail.com`, "Str0ngPass!42");
  const gymB = await rpcCreateGym(B.access, B.userId, `gymflow.b.${ts}@gmail.com`, "Gym B", `gym-b-${ts}`);
  ({ access: B.access, refresh: B.refresh } = await refresh(B.refresh));
  B.gymId = gymB;

  C = await signup(`gymflow.c.${ts}@gmail.com`, "Str0ngPass!42");
  await seedStaff(C.userId, gymA, `gymflow.c.${ts}@gmail.com`); // staff in gym A
  ({ access: C.access, refresh: C.refresh } = await refresh(C.refresh)); // claims: role=staff, gym=A

  // --- 1. Isolation: gym A owner sees only gym A ---
  const aGyms = await get(A.access, "gyms?select=id,slug");
  assert("A sees exactly 1 gym", aGyms.body.length === 1, JSON.stringify(aGyms.body));
  assert("A's visible gym is gym A", aGyms.body[0]?.id === gymA);
  assert("A cannot see gym B id", !aGyms.body.some((g) => g.id === gymB));

  const aSubs = await get(A.access, "subscriptions?select=gym_id");
  assert("A sees only own subscription", aSubs.body.length === 1 && aSubs.body[0].gym_id === gymA, JSON.stringify(aSubs.body));

  // --- 2. Isolation reverse: gym B owner sees only gym B ---
  const bGyms = await get(B.access, "gyms?select=id");
  assert("B sees exactly 1 gym (gym B)", bGyms.body.length === 1 && bGyms.body[0]?.id === gymB, JSON.stringify(bGyms.body));

  // --- 3. Escalation guard: staff cannot self-promote to super_admin ---
  const esc = await patch(C.access, `profiles?id=eq.${C.userId}`, { role: "super_admin" });
  assert("staff role escalation REJECTED", esc.status >= 400, `status ${esc.status}: ${esc.text}`);

  // --- 4. Escalation guard: staff cannot move self to gym B ---
  const move = await patch(C.access, `profiles?id=eq.${C.userId}`, { gym_id: gymB });
  assert("staff gym-move REJECTED", move.status >= 400, `status ${move.status}: ${move.text}`);

  // --- 5. Owner guard: gym_owner cannot self-promote to super_admin ---
  const ownEsc = await patch(A.access, `profiles?id=eq.${A.userId}`, { role: "super_admin" });
  assert("owner self-promote to super_admin REJECTED", ownEsc.status >= 400, `status ${ownEsc.status}: ${ownEsc.text}`);

  // --- 6. Legit self-edit: staff CAN change own full_name ---
  const edit = await patch(C.access, `profiles?id=eq.${C.userId}`, { full_name: "Renamed Staff" });
  assert("staff legit full_name edit ALLOWED", edit.status >= 200 && edit.status < 300, `status ${edit.status}: ${edit.text}`);

  // --- 7. Confirm staff role unchanged after attacks ---
  const staffRow = await fetch(`${U}/rest/v1/profiles?id=eq.${C.userId}&select=role,gym_id`, { headers: srH() }).then((r) => r.json());
  assert("staff role still 'staff' after attacks", staffRow[0]?.role === "staff", JSON.stringify(staffRow));
  assert("staff gym still gym A after attacks", staffRow[0]?.gym_id === gymA, JSON.stringify(staffRow));
} finally {
  // cleanup
  for (const id of [A.userId, B.userId, C.userId]) if (id) await delUser(id);
  for (const g of [A.gymId, B.gymId]) if (g) await del(`gyms?id=eq.${g}`);
}

let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "  -> " + r.detail}`); }
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exitCode = failed ? 1 : 0;
