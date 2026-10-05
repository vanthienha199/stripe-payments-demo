import fs from "node:fs";
import Stripe from "stripe";

const BASE = process.env.BASE_URL || "http://localhost:4242";
const SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const DB = process.env.DB_FILE || "data/orders.json";
if (!SECRET) { console.error("Set STRIPE_WEBHOOK_SECRET to the same value the server uses"); process.exit(1); }
const stripe = new Stripe("sk_test_seed");
const AMOUNTS = { guide: 2900, pro_month: 900, pro_year: 9000 };
const PEOPLE = [
  ["pro_year", "priya.raman@example.com", 0.85], ["guide", "marcus.oyelaran@kestrel.example", 1], ["pro_month", "hannah.vu@northfork.example", 1],
  ["pro_month", "diego.santos@trailcrew.example", 1], ["guide", "ellie.kowalczyk@example.org", 0.85], ["pro_year", "tom.brennan@ridgeline.example", 1],
  ["pro_month", "aisha.karimi@fieldlab.example", 1], ["guide", "jonah.whitfield@example.net", 1], ["pro_month", "sofia.marchetti@example.com", 1],
  ["pro_year", "kenji.mori@kestrel.example", 0.85], ["guide", "olivia.grant@northfork.example", 1], ["pro_month", "sam.delacroix@trailcrew.example", 1],
  ["pro_month", "ruth.adebayo@example.org", 1], ["guide", "wes.lindqvist@ridgeline.example", 1],
];
const send = async (type, object, id) => {
  const payload = JSON.stringify({ id: id || "evt_" + Math.random().toString(36).slice(2), type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  await fetch(BASE + "/webhook", { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": header }, body: payload });
};
const ids = [];
const rid = (n) => Array.from({ length: n }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[Math.floor(Math.random() * 57)]).join("");
for (const [i, [plan, email, mult]] of PEOPLE.entries()) {
  const d = await (await fetch(BASE + "/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, code: mult < 1 ? "FIELD15" : "" }) })).json();
  ids.push(d.id);
  if (i === PEOPLE.length - 1) continue;
  const sub = plan === "guide" ? null : "sub_" + rid(14);
  await send("checkout.session.completed", { id: d.id, mode: plan === "guide" ? "payment" : "subscription", payment_status: "paid", customer: "cus_" + rid(14), subscription: sub, customer_details: { email }, amount_total: AMOUNTS[plan] - Math.round((AMOUNTS[plan] * (1 - mult))) });
  if (i === 2 || i === 6) await send("invoice.paid", { id: "in_" + rid(14), subscription: sub, billing_reason: "subscription_cycle" });
  if (i === 3) await send("customer.subscription.deleted", { id: sub });
}
const db = JSON.parse(fs.readFileSync(DB, "utf8"));
const now = Date.now();
db.orders.forEach((o) => {
  const k = ids.indexOf(o.session_id);
  if (k < 0) return;
  const age = (ids.length - k) * 1.43 * 86400000 + ((k * 7919) % 36000) * 1000;
  o.created = now - age;
  o.updated = o.status === "pending" ? o.created : Math.min(now, o.created + ((k * 104729) % 5400) * 1000 + 60000);
});
fs.writeFileSync(DB, JSON.stringify(db, null, 2));
console.log("seeded", ids.length, "orders");
