const pro = { month: { price: "$9", unit: "per month", note: "Billed monthly. Switch to yearly and save $18.", plan: "pro_month", btn: "Start Pro monthly" },
              year: { price: "$90", unit: "per year", note: "Billed once a year, $7.50 a month.", plan: "pro_year", btn: "Start Pro yearly" } };
document.querySelectorAll(".switch button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".switch button").forEach((x) => x.classList.toggle("on", x === b));
  const p = pro[b.dataset.interval];
  document.getElementById("pro-price").textContent = p.price;
  document.getElementById("pro-unit").textContent = p.unit;
  document.getElementById("pro-note").textContent = p.note;
  const btn = document.getElementById("pro-btn");
  btn.dataset.plan = p.plan;
  btn.textContent = p.btn;
}));
document.querySelectorAll(".buy").forEach((b) => b.addEventListener("click", async () => {
  b.disabled = true;
  const label = b.textContent;
  b.textContent = "Opening checkout...";
  const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: b.dataset.plan }) });
  const d = await r.json();
  if (d.url) { window.location = d.url; return; }
  document.getElementById("msg").textContent = d.error || "Could not start checkout.";
  b.disabled = false;
  b.textContent = label;
}));
if (new URLSearchParams(location.search).has("canceled")) document.getElementById("msg").textContent = "Checkout was canceled. You have not been charged.";
