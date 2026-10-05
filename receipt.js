const money = (c) => "$" + (c / 100).toFixed(2);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function receiptEmail(order) {
  const total = order.amount_total ?? order.amount;
  const discount = order.amount - total;
  const when = order.mode === "subscription" ? (order.plan === "pro_year" ? "Renews in 12 months. You can cancel any time from your billing page." : "Renews monthly. You can cancel any time from your billing page.") : "One-time purchase. The guide is yours to keep.";
  const rows = [[esc(order.product), money(order.amount)]];
  if (discount > 0) rows.push([`Discount${order.coupon ? " (" + esc(order.coupon) + ")" : ""}`, "&minus;" + money(discount)]);
  const html = `<div style="font-family:'Public Sans',Helvetica,Arial,sans-serif;color:#16181D;max-width:480px;margin:0 auto;padding:32px 28px;background:#fff">
<p style="font:600 20px 'Schibsted Grotesk',Helvetica,sans-serif;margin:0 0 24px">Fieldnote</p>
<p style="font-size:22px;font-weight:600;margin:0 0 6px">Thanks, your payment went through.</p>
<p style="color:#5E6068;margin:0 0 24px">Receipt for order ${esc(order.session_id.slice(-8))}</p>
<table style="width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums">${rows.map(([a, b]) => `<tr><td style="padding:10px 0;border-top:1px solid #E6E4DE">${a}</td><td style="padding:10px 0;border-top:1px solid #E6E4DE;text-align:right">${b}</td></tr>`).join("")}
<tr><td style="padding:12px 0;border-top:1.5px solid #16181D;font-weight:600">Paid</td><td style="padding:12px 0;border-top:1.5px solid #16181D;text-align:right;font-weight:600">${money(total)}</td></tr></table>
<p style="color:#5E6068;font-size:14px;margin:20px 0 0">${when}</p></div>`;
  return { to: order.email, subject: `Your Fieldnote receipt, ${money(total)}`, session_id: order.session_id, html };
}
