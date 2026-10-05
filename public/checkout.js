const $ = (id) => document.getElementById(id);
const money = (c) => "$" + (c / 100).toFixed(2);
let applied = "";
let current = null;

function renderTotal(cents) {
  const el = $("total");
  const text = money(cents);
  const cols = el.querySelectorAll(".roll");
  if (cols.length && el.dataset.text && el.dataset.text.length === text.length) {
    let i = 0;
    for (const ch of text) {
      if (/\d/.test(ch)) cols[i++].firstChild.style.transform = `translateY(${-Number(ch) * 1.15}em)`;
    }
  } else {
    el.innerHTML = [...text].map((ch) => /\d/.test(ch) ? `<span class="roll"><span style="transform:translateY(${-Number(ch) * 1.15}em)">${"0123456789".split("").map((d) => `<i style="font-style:normal">${d}</i>`).join("")}</span></span>` : `<span>${ch}</span>`).join("");
  }
  el.dataset.text = text;
  el.setAttribute("aria-label", "Total " + text);
}

function show(q) {
  current = q;
  $("r-item").textContent = q.label.replace("Fieldnote Pro, ", "Pro, ").replace("Starter Guide", "Field guide");
  $("r-sub").textContent = money(q.subtotal);
  $("r-disc").hidden = !q.discount;
  if (q.discount) { $("r-disc-label").textContent = `${q.code}, ${q.coupon_label.split(", ").pop()}`; $("r-disc-amt").textContent = "−" + money(q.discount); }
  renderTotal(q.total);
  $("r-when").textContent = q.interval ? `Then ${money(q.subtotal)} every ${q.interval}${q.discount ? ", the code applies to the first payment" : ""}.` : "One payment. No subscription.";
}

async function getQuote(code) {
  const plan = document.querySelector('input[name="plan"]:checked').value;
  const r = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, code }) });
  return { ok: r.ok, data: await r.json() };
}

async function refresh() {
  const { ok, data } = await getQuote(applied);
  if (ok) show(data);
}

document.querySelectorAll('input[name="plan"]').forEach((r) => r.addEventListener("change", refresh));

$("coupon").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("code").value.trim();
  const { ok, data } = await getQuote(code);
  $("code-err").hidden = ok;
  $("code").setAttribute("aria-invalid", String(!ok));
  if (!ok) { $("code-err").textContent = data.error; return; }
  applied = code;
  show(data);
});

$("pay").addEventListener("click", async () => {
  const btn = $("pay");
  btn.disabled = true;
  btn.textContent = "Opening secure payment...";
  $("pay-err").hidden = true;
  try {
    const plan = document.querySelector('input[name="plan"]:checked').value;
    const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, code: applied }) });
    const d = await r.json();
    if (d.url) { location = d.url; return; }
    throw new Error(d.error || "Checkout could not start.");
  } catch (err) {
    $("pay-err").textContent = `${err.message} Nothing was charged. Try again in a moment.`;
    $("pay-err").hidden = false;
    btn.disabled = false;
    btn.textContent = "Continue to payment";
  }
});

const pre = new URLSearchParams(location.search);
if (pre.get("plan")) { const r = document.querySelector(`input[value="${pre.get("plan")}"]`); if (r) r.checked = true; }
if (pre.has("canceled")) { $("pay-err").textContent = "Payment was canceled. Nothing was charged."; $("pay-err").hidden = false; }
refresh();
