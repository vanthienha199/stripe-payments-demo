import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Stripe from "stripe";

const MOCK_PORT = 12111, PORT = 4299, SECRET = "whsec_demo_test_secret";
const DB = path.join(os.tmpdir(), `stripe-demo-${Date.now()}.json`);
const base = `http://localhost:${PORT}`;
const stripe = new Stripe("sk_test_demo");
const results = [];
const check = (name, ok) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + name); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const procs = [];
function start(cmd, args, env) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: "ignore" });
  procs.push(p);
  return p;
}
async function up(url) {
  for (let i = 0; i < 50; i++) { try { await fetch(url); return; } catch { await wait(200); } }
  throw new Error("not up: " + url);
}

async function send(event, secret = SECRET) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(base + "/webhook", { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": header }, body: payload });
}
const evt = (type, object) => ({ id: "evt_" + Math.random().toString(36).slice(2), type, data: { object } });

try {
  start("stripe-mock", ["-http-port", String(MOCK_PORT)]);
  await up(`http://localhost:${MOCK_PORT}/v1/charges`).catch(() => {});
  start("node", ["server.js"], { PORT: String(PORT), STRIPE_SECRET_KEY: "sk_test_demo", STRIPE_MOCK_PORT: String(MOCK_PORT), STRIPE_WEBHOOK_SECRET: SECRET, DB_FILE: DB });
  await up(base + "/api/orders");

  const ids = {};
  for (const plan of ["guide", "pro_month", "pro_year"]) {
    const r = await fetch(base + "/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    const d = await r.json();
    ids[plan] = d.id;
    check(`checkout session created for ${plan}`, r.ok && d.url && d.id);
  }
  const bad = await fetch(base + "/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "nope" }) });
  check("unknown plan rejected", bad.status === 400);

  let orders = (await (await fetch(base + "/api/orders")).json()).orders;
  check("three pending orders stored", orders.length === 3 && orders.every((o) => o.status === "pending"));
  const distinct = new Set(orders.map((o) => o.session_id)).size === 3;

  const forged = await send(evt("checkout.session.completed", { id: ids.guide, mode: "payment", payment_status: "paid" }), "whsec_wrong");
  check("webhook with a bad signature is rejected", forged.status === 400);

  if (distinct) {
    await send(evt("checkout.session.completed", { id: ids.guide, mode: "payment", payment_status: "paid", customer: "cus_guide", customer_details: { email: "maya@example.com" }, amount_total: 2900 }));
    await send(evt("checkout.session.completed", { id: ids.pro_month, mode: "subscription", payment_status: "paid", customer: "cus_pro", subscription: "sub_month", customer_details: { email: "theo@example.com" }, amount_total: 900 }));
    const e = evt("checkout.session.completed", { id: ids.pro_year, mode: "subscription", payment_status: "paid", customer: "cus_year", subscription: "sub_year", customer_details: { email: "ines@example.com" }, amount_total: 9000 });
    await send(e);
    const dup = await (await send(e)).json();
    check("duplicate event is ignored", dup.duplicate === true);
    await send(evt("invoice.paid", { id: "in_1", subscription: "sub_month", billing_reason: "subscription_cycle" }));
    await send(evt("customer.subscription.deleted", { id: "sub_year" }));
    orders = (await (await fetch(base + "/api/orders")).json()).orders;
    const by = Object.fromEntries(orders.map((o) => [o.plan, o]));
    check("one-time order marked paid by webhook", by.guide.status === "paid" && by.guide.email === "maya@example.com");
    check("monthly subscription active after renewal invoice", by.pro_month.status === "active" && by.pro_month.renewals === 1);
    check("yearly subscription canceled by webhook", by.pro_year.status === "canceled");
  } else {
    console.log("stripe-mock returned the same session id for every call, webhook checks skipped");
    check("distinct session ids", false);
  }
} finally {
  procs.forEach((p) => p.kill());
  fs.rmSync(DB, { force: true });
}
const failed = results.filter((x) => !x).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
