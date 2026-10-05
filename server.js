import express from "express";
import Stripe from "stripe";
import { CATALOG, quote } from "./catalog.js";
import { receiptEmail } from "./receipt.js";
import { listOrders, createOrder, updateOrder, findBy, seenEvent, queueEmail, listOutbox } from "./db.js";

const PORT = Number(process.env.PORT || 4242);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const key = process.env.STRIPE_SECRET_KEY;
if (!key || !key.startsWith("sk_test_")) {
  console.error("Set STRIPE_SECRET_KEY to a test mode key (sk_test_...). This demo refuses live keys.");
  process.exit(1);
}
const mock = process.env.STRIPE_MOCK_PORT;
const stripe = new Stripe(key, mock ? { host: "localhost", port: Number(mock), protocol: "http" } : {});
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();

async function priceFor(plan) {
  const item = CATALOG[plan];
  if (!item) throw new Error("Unknown plan");
  if (mock) return { id: "price_" + item.lookup_key };
  const { data } = await stripe.prices.list({ lookup_keys: [item.lookup_key], limit: 1 });
  if (!data.length) throw new Error(`Price ${item.lookup_key} not found. Run npm run setup first.`);
  return data[0];
}

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature check failed: ${err.message}`);
  }
  if (seenEvent(event.id)) return res.json({ received: true, duplicate: true });
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      const paid = obj.payment_status === "paid" || obj.mode === "subscription";
      const before = findBy("session_id", obj.id);
      const updated = updateOrder(obj.id, {
        status: paid ? "paid" : "processing",
        customer: obj.customer,
        email: obj.customer_details?.email || null,
        subscription: obj.subscription || null,
        amount_total: obj.amount_total,
      });
      if (updated && paid && before?.status !== "paid" && updated.email) queueEmail(receiptEmail(updated));
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      updateOrder(obj.id, { status: event.type.endsWith("expired") ? "expired" : "failed" });
      break;
    case "invoice.paid": {
      const o = obj.subscription && findBy("subscription", obj.subscription);
      if (o) updateOrder(o.session_id, { status: "active", renewals: (o.renewals || 0) + (obj.billing_reason === "subscription_cycle" ? 1 : 0), last_invoice: obj.id });
      break;
    }
    case "customer.subscription.deleted": {
      const o = findBy("subscription", obj.id);
      if (o) updateOrder(o.session_id, { status: "canceled" });
      break;
    }
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(express.static("public"));

app.post("/api/checkout", async (req, res) => {
  try {
    const plan = req.body.plan;
    const item = CATALOG[plan];
    if (!item) return res.status(400).json({ error: "Unknown plan" });
    const q = quote(plan, req.body.code);
    if (q.error) return res.status(422).json({ error: q.error });
    const price = await priceFor(plan);
    const session = await stripe.checkout.sessions.create({
      mode: item.mode,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/?canceled=1`,
      ...(q.code ? { discounts: [{ coupon: q.code }] } : { allow_promotion_codes: true }),
      ...(item.mode === "payment" ? { customer_creation: "always" } : {}),
    });
    createOrder({ session_id: session.id, plan, product: item.label, amount: item.amount, amount_total: q.total, coupon: q.code, mode: item.mode });
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/session/:id", async (req, res) => {
  try {
    const s = await stripe.checkout.sessions.retrieve(req.params.id);
    const order = findBy("session_id", req.params.id);
    res.json({ id: s.id, mode: s.mode, amount_total: s.amount_total ?? order?.amount, email: s.customer_details?.email || order?.email, order });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post("/api/portal", async (req, res) => {
  try {
    const order = findBy("session_id", req.body.session_id);
    if (!order?.customer) return res.status(400).json({ error: "No customer on this order yet" });
    const portal = await stripe.billingPortal.sessions.create({ customer: order.customer, return_url: `${BASE_URL}/orders.html` });
    res.json({ url: portal.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/orders", (_req, res) => res.json({ orders: listOrders() }));
app.post("/api/quote", (req, res) => {
  const q = quote(req.body.plan, req.body.code);
  res.status(q.error ? 422 : 200).json(q);
});
app.get("/api/outbox", (_req, res) => res.json({ emails: listOutbox() }));
app.get("/orders.html", (_req, res) => res.redirect(301, "/invoices.html"));

app.listen(PORT, () => console.log(`Stripe demo on ${BASE_URL}${mock ? " (stripe-mock)" : ""}`));
