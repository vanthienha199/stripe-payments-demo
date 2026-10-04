const id = new URLSearchParams(location.search).get("session_id");
const money = (c) => (c == null ? "" : "$" + (c / 100).toFixed(2));
async function load() {
  const r = await fetch("/api/session/" + encodeURIComponent(id));
  const d = await r.json();
  if (!r.ok) { document.getElementById("product").textContent = "Order not found"; return; }
  const o = d.order || {};
  document.getElementById("product").textContent = o.product || d.mode;
  document.getElementById("amount").textContent = money(o.amount_total ?? d.amount_total) + (o.mode === "subscription" ? (o.plan === "pro_year" ? " per year" : " per month") : "");
  document.getElementById("email").textContent = o.email || d.email || "";
  const s = document.getElementById("status");
  s.textContent = o.status || "pending";
  s.className = "pill " + (o.status || "pending");
  document.getElementById("wh").textContent = o.status && o.status !== "pending" ? "confirmed by Stripe webhook" : "waiting for Stripe webhook";
  document.getElementById("portal").hidden = !(o.mode === "subscription" && o.customer);
  if (!o.status || o.status === "pending") setTimeout(load, 2000);
}
document.getElementById("portal").addEventListener("click", async () => {
  const r = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: id }) });
  const d = await r.json();
  if (d.url) location = d.url;
});
load();
