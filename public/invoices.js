const money = (c) => "$" + ((c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const label = { paid: "Paid", active: "Active", pending: "Waiting for payment", canceled: "Canceled", expired: "Expired", failed: "Failed", processing: "Processing" };
const monthly = (o) => o.mode !== "subscription" || !["paid", "active"].includes(o.status) ? 0 : o.plan === "pro_year" ? (o.amount_total ?? o.amount) / 12 : (o.amount_total ?? o.amount);

function spark(orders) {
  const subs = orders.filter((o) => o.mode === "subscription").sort((a, b) => a.created - b.created);
  if (!subs.length) return "";
  const start = subs[0].created, end = Date.now(), days = Math.max(1, Math.ceil((end - start) / 864e5));
  const pts = [];
  for (let d = 0; d <= days; d++) {
    const t = start + d * 864e5;
    pts.push(subs.filter((o) => o.created <= t && !(o.status === "canceled" && o.updated <= t)).reduce((s, o) => s + monthly({ ...o, status: o.status === "canceled" ? "paid" : o.status }), 0));
  }
  const max = Math.max(...pts) || 1;
  const xy = pts.map((v, i) => `${(i / Math.max(1, pts.length - 1)) * 216 + 2},${42 - (v / max) * 38}`).join(" ");
  return `<polyline points="${xy}" fill="none" stroke="#6B2D5C" stroke-width="1.8" stroke-linejoin="round"/>`;
}

async function load() {
  let orders;
  try { orders = (await (await fetch("/api/orders")).json()).orders; document.getElementById("err").hidden = true; }
  catch { document.getElementById("err").hidden = false; return; }
  document.getElementById("wrap").hidden = !orders.length;
  document.getElementById("empty").hidden = !!orders.length;
  document.getElementById("mrr").textContent = money(orders.reduce((s, o) => s + monthly(o), 0));
  document.getElementById("spark").innerHTML = spark(orders);
  const collected = orders.filter((o) => ["paid", "active"].includes(o.status)).reduce((s, o) => s + (o.amount_total ?? o.amount), 0);
  document.getElementById("collected").textContent = money(collected);
  document.getElementById("sub").textContent = `${orders.length} invoices. Every row is written by the Stripe webhook.`;
  document.getElementById("rows").innerHTML = orders.map((o) => {
    const total = o.amount_total ?? o.amount;
    const plan = o.plan === "guide" ? "Field guide" : o.plan === "pro_year" ? "Pro, yearly" : "Pro, monthly";
    return `<tr><td><span class="id">${esc("in_" + o.session_id.slice(-10))}</span></td>
<td>${o.email ? esc(o.email) : '<span class="sub">Not confirmed yet</span>'}</td>
<td>${plan}${o.renewals ? `<span class="sub">Renewed ${o.renewals} time${o.renewals > 1 ? "s" : ""}</span>` : ""}</td>
<td>${new Date(o.created).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
<td><span class="st ${esc(o.status)}">${label[o.status] || esc(o.status)}</span></td>
<td class="n">${total < o.amount ? `<span class="was">${money(o.amount)}</span>` : ""}${money(total)}</td></tr>`;
  }).join("");
}
load();
setInterval(load, 4000);
