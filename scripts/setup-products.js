import Stripe from "stripe";
import { CATALOG } from "../catalog.js";

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) { console.error("Use a test mode key"); process.exit(1); }
const stripe = new Stripe(key);
const products = {};
for (const item of Object.values(CATALOG)) {
  const existing = await stripe.prices.list({ lookup_keys: [item.lookup_key], limit: 1 });
  if (existing.data.length) { console.log("exists", item.lookup_key); continue; }
  if (!products[item.name]) products[item.name] = await stripe.products.create({ name: item.name });
  await stripe.prices.create({
    product: products[item.name].id,
    unit_amount: item.amount,
    currency: "usd",
    lookup_key: item.lookup_key,
    ...(item.interval ? { recurring: { interval: item.interval } } : {}),
  });
  console.log("created", item.lookup_key);
}

import { COUPONS } from "../catalog.js";
for (const [id, c] of Object.entries(COUPONS)) {
  try { await stripe.coupons.retrieve(id); console.log("exists coupon", id); }
  catch { await stripe.coupons.create({ id, percent_off: c.percent_off, duration: "once", name: c.label }); console.log("created coupon", id); }
}
