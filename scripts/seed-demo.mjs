// Demo-data seeder for load/UX testing. Inserts ~100 members (with varied
// membership statuses), their subscriptions + payments, some Personal Trainer
// subscriptions, and a batch of pending join requests — all tagged DEMO_SEED so
// they can be removed cleanly before going live.
//
// Runs against the live Supabase project with the service-role key (bypasses RLS).
// Usage:
//   node --env-file=.env.local scripts/seed-demo.mjs            # seed
//   node --env-file=.env.local scripts/seed-demo.mjs --clean    # remove demo data
//
// Optional env: COUNT (members, default 100), REQUESTS (pending, default 18),
//               GYM_ID (target gym; otherwise auto-detected), OWNER_EMAIL.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !SR) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)");
  process.exit(2);
}

const COUNT = Number(process.env.COUNT ?? 100);
const REQUESTS = Number(process.env.REQUESTS ?? 18);
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "anshu.novelty@gmail.com";
const CLEAN = process.argv.includes("--clean");
const MARK = "DEMO_SEED";

const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${U}/rest/v1/${path}`, {
    method,
    headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const isoDate = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

const FIRST = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Krishna","Ishaan","Rohan","Ananya","Diya","Aadhya","Saanvi","Pari","Anika","Navya","Riya","Myra","Kiara","Kabir","Dev","Aryan","Rahul","Priya","Neha","Pooja","Sneha","Karan","Manish","Raj","Simran","Tanvi","Yash","Zara"];
const LAST = ["Sharma","Verma","Gupta","Patel","Singh","Kumar","Reddy","Nair","Iyer","Das","Mehta","Shah","Joshi","Rao","Bose","Khan","Chopra","Malhotra","Bhat","Pillai"];
const METHODS = ["cash", "upi", "card", "bank_transfer"];

async function pickGym() {
  if (process.env.GYM_ID) return { id: process.env.GYM_ID, name: "(from GYM_ID)" };
  const byOwner = await rest(`profiles?select=gym_id&email=eq.${encodeURIComponent(OWNER_EMAIL)}&role=eq.gym_owner&limit=1`);
  if (byOwner?.[0]?.gym_id) {
    const g = await rest(`gyms?select=id,name&id=eq.${byOwner[0].gym_id}&limit=1`);
    if (g?.[0]) return g[0];
  }
  const gyms = await rest(`gyms?select=id,name&order=created_at.asc`);
  if (!gyms?.length) throw new Error("No gyms found to seed into.");
  if (gyms.length > 1) console.warn(`! ${gyms.length} gyms found; using the first: ${gyms[0].name}. Set GYM_ID to target another.`);
  return gyms[0];
}

async function ensurePlans(gymId) {
  let membership = await rest(`membership_plans?select=id,name,price,duration_days&gym_id=eq.${gymId}&kind=eq.membership&is_active=eq.true&order=price`);
  let trainer = await rest(`membership_plans?select=id,name,price,duration_days&gym_id=eq.${gymId}&kind=eq.personal_trainer&is_active=eq.true&order=price`);

  if (membership.length < 2) {
    const created = await rest(`membership_plans`, {
      method: "POST", prefer: "return=representation",
      body: [
        { gym_id: gymId, kind: "membership", name: "Monthly", price: 1000, duration_days: 30 },
        { gym_id: gymId, kind: "membership", name: "Quarterly", price: 2700, duration_days: 90 },
        { gym_id: gymId, kind: "membership", name: "Half-yearly", price: 5000, duration_days: 180 },
        { gym_id: gymId, kind: "membership", name: "Annual", price: 9000, duration_days: 365 },
      ],
    });
    membership = membership.concat(created);
  }
  if (trainer.length < 1) {
    const created = await rest(`membership_plans`, {
      method: "POST", prefer: "return=representation",
      body: [
        { gym_id: gymId, kind: "personal_trainer", name: "PT Monthly", price: 3000, duration_days: 30 },
        { gym_id: gymId, kind: "personal_trainer", name: "PT Quarterly", price: 8000, duration_days: 90 },
      ],
    });
    trainer = trainer.concat(created);
  }
  return { membership, trainer };
}

// Choose start/end dates so the member lands in a target status bucket.
function subDates(durationDays, bucket) {
  if (bucket === "expired") {
    const end = daysFromNow(-randInt(1, 60));
    const start = new Date(end); start.setDate(start.getDate() - durationDays);
    return { start: isoDate(start), end: isoDate(end) };
  }
  if (bucket === "expiring") {
    const end = daysFromNow(randInt(0, 7));
    const start = new Date(end); start.setDate(start.getDate() - durationDays);
    return { start: isoDate(start), end: isoDate(end) };
  }
  const end = daysFromNow(randInt(8, durationDays));
  const start = new Date(end); start.setDate(start.getDate() - durationDays);
  return { start: isoDate(start), end: isoDate(end) };
}

async function clean(gymId) {
  console.log("Cleaning demo data…");
  await rest(`payments?gym_id=eq.${gymId}&note=eq.${MARK}`, { method: "DELETE" });
  await rest(`join_requests?gym_id=eq.${gymId}&notes=eq.${MARK}`, { method: "DELETE" });
  // Deleting members cascades their member_subscriptions (FK on delete cascade).
  await rest(`members?gym_id=eq.${gymId}&notes=eq.${MARK}`, { method: "DELETE" });
  console.log("Done. Demo members, subscriptions, payments and requests removed.");
}

async function chunked(rows, size, fn) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) {
    const r = await fn(rows.slice(i, i + size));
    if (Array.isArray(r)) out.push(...r); // return=minimal yields null; nothing to collect
  }
  return out;
}

async function seed() {
  const gym = await pickGym();
  console.log(`Target gym: ${gym.name} (${gym.id})`);

  if (CLEAN) return clean(gym.id);

  const { membership, trainer } = await ensurePlans(gym.id);
  console.log(`Plans: ${membership.length} membership, ${trainer.length} personal-trainer`);

  // 1. Members
  const memberRows = Array.from({ length: COUNT }, (_, i) => {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    return {
      gym_id: gym.id,
      full_name: name,
      email: `demo+${i + 1}@seed.local`,
      phone: `9${randInt(100000000, 999999999)}`,
      gender: pick(["male", "female", "other"]),
      date_of_birth: isoDate(new Date(randInt(1975, 2006), randInt(0, 11), randInt(1, 28))),
      height_cm: randInt(150, 190),
      weight_kg: randInt(50, 100),
      joined_at: isoDate(daysFromNow(-randInt(0, 365))),
      notes: MARK,
    };
  });
  const members = await chunked(memberRows, 50, (b) =>
    rest(`members`, { method: "POST", prefer: "return=representation", body: b }),
  );
  console.log(`Inserted ${members.length} members`);

  // 2. Membership subscriptions (status mix) + payments
  const subRows = members.map((m) => {
    const plan = pick(membership);
    const r = Math.random();
    const bucket = r < 0.15 ? "expired" : r < 0.3 ? "expiring" : "active";
    const { start, end } = subDates(plan.duration_days, bucket);
    return { gym_id: gym.id, member_id: m.id, plan_id: plan.id, plan_name: plan.name, start_date: start, end_date: end, status: "active", kind: "membership", _price: plan.price };
  });
  const toSubInsert = (s) => ({
    gym_id: s.gym_id, member_id: s.member_id, plan_id: s.plan_id, plan_name: s.plan_name,
    start_date: s.start_date, end_date: s.end_date, status: s.status, kind: s.kind,
  });
  const subs = await chunked(
    subRows.map(toSubInsert), 50,
    (b) => rest(`member_subscriptions`, { method: "POST", prefer: "return=representation", body: b }),
  );
  const payRows = subs.map((s, i) => ({
    gym_id: gym.id, member_id: s.member_id, member_name: members[i].full_name,
    subscription_id: s.id, amount: subRows[i]._price, method: pick(METHODS),
    note: MARK, invoice_number: `DEMO-${Date.now()}-${i}`, paid_at: `${s.start_date}T10:00:00Z`,
  }));
  await chunked(payRows, 50, (b) => rest(`payments`, { method: "POST", prefer: "return=minimal", body: b }));
  console.log(`Inserted ${subs.length} membership subscriptions + payments`);

  // 3. Personal-trainer subscriptions + payments for ~25% of members
  if (trainer.length) {
    const ptMembers = members.filter(() => Math.random() < 0.25);
    const ptSubRows = ptMembers.map((m) => {
      const plan = pick(trainer);
      const { start, end } = subDates(plan.duration_days, Math.random() < 0.2 ? "expiring" : "active");
      return { gym_id: gym.id, member_id: m.id, plan_id: plan.id, plan_name: plan.name, start_date: start, end_date: end, status: "active", kind: "personal_trainer", _price: plan.price, _name: m.full_name };
    });
    const ptSubs = await chunked(
      ptSubRows.map(toSubInsert), 50,
      (b) => rest(`member_subscriptions`, { method: "POST", prefer: "return=representation", body: b }),
    );
    const ptPays = ptSubs.map((s, i) => ({
      gym_id: gym.id, member_id: s.member_id, member_name: ptSubRows[i]._name, subscription_id: s.id,
      amount: ptSubRows[i]._price, method: pick(METHODS), note: MARK,
      invoice_number: `DEMO-PT-${Date.now()}-${i}`, paid_at: `${s.start_date}T11:00:00Z`,
    }));
    await chunked(ptPays, 50, (b) => rest(`payments`, { method: "POST", prefer: "return=minimal", body: b }));
    console.log(`Inserted ${ptSubs.length} personal-trainer subscriptions + payments`);
  }

  // 4. Pending join requests
  const reqRows = Array.from({ length: REQUESTS }, (_, i) => {
    const plan = pick(membership);
    const withPt = trainer.length && Math.random() < 0.4 ? pick(trainer) : null;
    return {
      gym_id: gym.id, full_name: `${pick(FIRST)} ${pick(LAST)}`,
      email: `demoreq+${i + 1}@seed.local`, phone: `9${randInt(100000000, 999999999)}`,
      gender: pick(["male", "female", "other"]),
      plan_id: plan.id, plan_name: plan.name, plan_price: plan.price,
      pt_plan_id: withPt?.id ?? null, pt_plan_name: withPt?.name ?? null, pt_plan_price: withPt?.price ?? null,
      payment_method: pick(["cash", "upi"]), status: "pending", notes: MARK,
    };
  });
  await rest(`join_requests`, { method: "POST", prefer: "return=minimal", body: reqRows });
  console.log(`Inserted ${reqRows.length} pending join requests`);

  console.log("\n✅ Seed complete. Remove later with: node --env-file=.env.local scripts/seed-demo.mjs --clean");
}

seed().catch((e) => { console.error("\n✗ Seed failed:", e.message); process.exit(1); });
