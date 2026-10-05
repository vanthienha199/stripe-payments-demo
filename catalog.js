export const CATALOG = {
  guide: { lookup_key: "fieldnote_guide_once", name: "Fieldnote Starter Guide", amount: 2900, mode: "payment", label: "Starter Guide" },
  pro_month: { lookup_key: "fieldnote_pro_month", name: "Fieldnote Pro", amount: 900, mode: "subscription", interval: "month", label: "Fieldnote Pro, monthly" },
  pro_year: { lookup_key: "fieldnote_pro_year", name: "Fieldnote Pro", amount: 9000, mode: "subscription", interval: "year", label: "Fieldnote Pro, yearly" },
};

export const COUPONS = {
  FIELD15: { percent_off: 15, label: "Field season, 15% off" },
};

export function quote(plan, code) {
  const item = CATALOG[plan];
  if (!item) return { error: "Unknown plan" };
  const key = (code || "").trim().toUpperCase();
  const coupon = key ? COUPONS[key] : null;
  if (key && !coupon) return { error: "That code is not valid. Check the spelling or leave it blank." };
  const discount = coupon ? Math.round((item.amount * coupon.percent_off) / 100) : 0;
  return { plan, label: item.label, interval: item.interval || null, subtotal: item.amount, discount, total: item.amount - discount, code: coupon ? key : null, coupon_label: coupon?.label || null };
}
