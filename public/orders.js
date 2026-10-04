const money = (c) => "$" + ((c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
const short = (id) => esc(id.slice(0, 14) + "..." + id.slice(-4));
async function load() {
  const { orders } = await (await fetch("/api/orders")).json();
  const rows = document.getElementById("rows");
  rows.innerHTML = "";
  let revenue = 0, subs = 0;
  orders.forEach((o) => {
    if (["paid", "active"].includes(o.status)) revenue += o.amount_total ?? o.amount;
    if (o.mode === "subscription" && ["paid", "active"].includes(o.status)) subs++;
    const tr = document.createElement("tr");
    const cells = [
      `<b>${esc(o.product)}</b><code>${short(o.session_id)}</code>`,
      o.email ? `${esc(o.email)}<code>${esc(o.customer)}</code>` : '<span class="muted">not yet known</span>',
      o.mode === "subscription" ? "Subscription" : "One-time",
      (o.amount_total != null && o.amount_total < o.amount ? `<span class="was">${money(o.amount)}</span>` : "") + money(o.amount_total ?? o.amount),
      `<span class="pill ${esc(o.status)}">${esc(o.status)}</span>${o.renewals ? `<span class="muted small"> ${o.renewals} renewal${o.renewals > 1 ? "s" : ""}</span>` : ""}`,
      new Date(o.updated).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    ];
    cells.forEach((html, i) => { const td = document.createElement("td"); td.innerHTML = html; if (i === 3) td.className = "n"; tr.appendChild(td); });
    rows.appendChild(tr);
  });
  document.getElementById("wrap").hidden = orders.length === 0;
  document.getElementById("empty").hidden = orders.length > 0;
  document.querySelector(".live").hidden = orders.length === 0;
  document.getElementById("revenue").textContent = money(revenue);
  document.getElementById("subs").textContent = subs;
  document.getElementById("count").textContent = orders.length;
  document.getElementById("checked").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}
load();
setInterval(load, 3000);
