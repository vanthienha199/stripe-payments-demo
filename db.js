import fs from "node:fs";
import path from "node:path";

const FILE = process.env.DB_FILE || path.resolve("data/orders.json");

function read() {
  try { return { outbox: [], ...JSON.parse(fs.readFileSync(FILE, "utf8")) }; } catch { return { orders: [], events: [], outbox: [] }; }
}

function write(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(db, null, 2));
  fs.renameSync(FILE + ".tmp", FILE);
}

export function listOrders() {
  return read().orders.sort((a, b) => b.created - a.created);
}

export function createOrder(order) {
  const db = read();
  db.orders.push({ ...order, status: "pending", created: Date.now(), updated: Date.now() });
  write(db);
}

export function updateOrder(sessionId, patch) {
  const db = read();
  const o = db.orders.find((x) => x.session_id === sessionId);
  if (!o) return null;
  Object.assign(o, patch, { updated: Date.now() });
  write(db);
  return o;
}

export function findBy(field, value) {
  return read().orders.find((x) => x[field] === value) || null;
}

export function seenEvent(id) {
  const db = read();
  if (db.events.includes(id)) return true;
  db.events.push(id);
  if (db.events.length > 500) db.events = db.events.slice(-500);
  write(db);
  return false;
}

export function queueEmail(email) {
  const db = read();
  db.outbox.unshift({ ...email, queued: Date.now() });
  db.outbox = db.outbox.slice(0, 50);
  write(db);
}

export function listOutbox() {
  return read().outbox;
}
