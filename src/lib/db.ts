import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

const globalForDb = globalThis as unknown as {
  consignmentDb?: Database.Database;
  consignmentShutdown?: boolean;
};

function expandHome(input: string) {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function usesExternalDataDir() {
  return Boolean(process.env.CONSIGNMENT_DATA_DIR?.trim());
}

export function dataDir() {
  const configured = process.env.CONSIGNMENT_DATA_DIR?.trim();
  const dir = configured ? path.resolve(expandHome(configured)) : path.join(process.cwd(), "data");
  fs.mkdirSync(path.join(/*turbopackIgnore: true*/ dir), { recursive: true });
  return dir;
}

export function reportsDir() {
  const dir = path.join(/*turbopackIgnore: true*/ dataDir(), "reports");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sampleReportSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1240" viewBox="0 0 900 1240">
  <rect width="900" height="1240" fill="#f6f1ea"/>
  <rect x="48" y="48" width="804" height="1144" rx="18" fill="#fffdf8" stroke="#e4d5c6"/>
  <text x="80" y="120" font-family="Georgia, serif" font-size="34" fill="#3a2c26">Harbour Linen</text>
  <text x="80" y="162" font-family="Georgia, serif" font-size="22" fill="#9c4a32">September 2026 consignee report</text>
  <text x="80" y="204" font-family="Georgia, serif" font-size="16" fill="#6d6258">Sample sheet for Cotton &amp; Clay. Replace it with a photo or PDF from the shop.</text>
  <text x="80" y="270" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Product</text>
  <text x="390" y="270" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Code</text>
  <text x="560" y="270" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Sold</text>
  <text x="660" y="270" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Price</text>
  <text x="760" y="270" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Total</text>
  <line x1="80" y1="286" x2="820" y2="286" stroke="#e4d5c6"/>
  <text x="80" y="330" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Flax Mug — Khaki</text>
  <text x="390" y="330" font-family="Georgia, serif" font-size="16" fill="#3a2c26">HLB-MUG-KH</text>
  <text x="560" y="330" font-family="Georgia, serif" font-size="16" fill="#3a2c26">2</text>
  <text x="660" y="330" font-family="Georgia, serif" font-size="16" fill="#3a2c26">18.00</text>
  <text x="760" y="330" font-family="Georgia, serif" font-size="16" fill="#3a2c26">36.00</text>
  <text x="80" y="372" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Everyday Bowl — Speckle Grey</text>
  <text x="390" y="372" font-family="Georgia, serif" font-size="16" fill="#3a2c26">HLB-BOWL-SG</text>
  <text x="560" y="372" font-family="Georgia, serif" font-size="16" fill="#3a2c26">1</text>
  <text x="660" y="372" font-family="Georgia, serif" font-size="16" fill="#3a2c26">36.00</text>
  <text x="760" y="372" font-family="Georgia, serif" font-size="16" fill="#3a2c26">36.00</text>
  <line x1="80" y1="400" x2="820" y2="400" stroke="#e4d5c6"/>
  <text x="80" y="444" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Sales</text>
  <text x="760" y="444" font-family="Georgia, serif" font-size="16" fill="#3a2c26">72.00</text>
  <text x="80" y="486" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Shelf rent</text>
  <text x="760" y="486" font-family="Georgia, serif" font-size="16" fill="#3a2c26">420.00</text>
  <text x="80" y="528" font-family="Georgia, serif" font-size="16" fill="#3a2c26">Commission at 25%</text>
  <text x="760" y="528" font-family="Georgia, serif" font-size="16" fill="#3a2c26">18.00</text>
  <text x="80" y="620" font-family="Georgia, serif" font-size="16" fill="#6d6258">Closing stock still on the shelf: 10 duck-egg serve bowls, 6 khaki mugs, 5 speckle bowls.</text>
  <text x="80" y="660" font-family="Georgia, serif" font-size="16" fill="#6d6258">Two serve bowls returned to the studio on 28 September.</text>
</svg>`;
}

function column(db: Database.Database, table: string, name: string, ddl: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((item) => item.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      rent_amount REAL,
      commission_rate REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      product_group TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      retail_price REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_stock (
      id INTEGER PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      consignee_code TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      UNIQUE (store_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      type TEXT NOT NULL CHECK (type IN ('transfer_in', 'transfer_out', 'sale')),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price REAL,
      occurred_on TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      period TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      rent_paid REAL NOT NULL,
      commission_paid REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      period TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stock_store ON store_stock(store_id);
    CREATE INDEX IF NOT EXISTS idx_stock_product ON store_stock(product_id);
    CREATE INDEX IF NOT EXISTS idx_movements_store ON movements(store_id, occurred_on);
    CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id, occurred_on);
    CREATE INDEX IF NOT EXISTS idx_invoices_store ON invoices(store_id, invoice_date);
    CREATE INDEX IF NOT EXISTS idx_reports_store ON reports(store_id, period);
  `);
  column(db, "stores", "rent_amount", "rent_amount REAL");
  column(db, "stores", "commission_rate", "commission_rate REAL");
}

type SeedMove = {
  store: string;
  product: string;
  type: "transfer_in" | "transfer_out" | "sale";
  quantity: number;
  date: string;
  price?: number;
  notes?: string;
};

function seedIfNeeded(db: Database.Database) {
  const already = db.prepare(`SELECT value FROM app_meta WHERE key = 'seeded'`).get();
  if (already) return;
  if (process.env.CONSIGNMENT_SEED === "0") {
    db.prepare(`INSERT INTO app_meta (key, value) VALUES ('seeded', 'skipped')`).run();
    return;
  }

  const storedName = `sample-${randomUUID()}.svg`;
  const svg = sampleReportSvg();
  fs.writeFileSync(path.join(/*turbopackIgnore: true*/ reportsDir(), storedName), svg);

  const seed = db.transaction(() => {
    const existing = db.prepare(`SELECT value FROM app_meta WHERE key = 'seeded'`).get();
    if (existing) return false;

    const insertStore = db.prepare(`
      INSERT INTO stores (name, address, phone, contact_name, rent_amount, commission_rate, created_at, updated_at)
      VALUES (@name, @address, @phone, @contact_name, @rent_amount, @commission_rate, @created_at, @updated_at)
    `);
    const stores = [
      {
        name: "Harbour Linen",
        address: "14 The Entrance Road, The Entrance NSW 2261",
        phone: "02 4334 2190",
        contact_name: "Elise Harper",
        rent_amount: 420,
        commission_rate: 25,
      },
      {
        name: "Terrigal Home Room",
        address: "3 Kurrawyba Avenue, Terrigal NSW 2260",
        phone: "02 4385 7741",
        contact_name: "Jonah Price",
        rent_amount: null,
        commission_rate: 30,
      },
      {
        name: "Gosford Goods",
        address: "Shop 2, 88 Mann Street, Gosford NSW 2250",
        phone: "02 4323 8806",
        contact_name: "Priya Nair",
        rent_amount: 260,
        commission_rate: null,
      },
      {
        name: "Woy Woy Window",
        address: "12 Railway Street, Woy Woy NSW 2256",
        phone: "02 4341 1000",
        contact_name: "Sam Cole",
        rent_amount: 180,
        commission_rate: 20,
      },
    ];
    for (const store of stores) {
      insertStore.run({ ...store, created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z" });
    }

    const insertProduct = db.prepare(`
      INSERT INTO products (product_group, name, description, retail_price, created_at, updated_at)
      VALUES (@product_group, @name, @description, @retail_price, @created_at, @updated_at)
    `);
    const products = [
      ["Flax ceramics", "Flax Serve Bowl — Duck Egg", "Irregular flax serve bowl with a glazed interior and a matte exterior.", 15],
      ["Flax ceramics", "Flax Mug — Khaki", "Matte flax mug with a glazed interior, sized for a proper cup of tea.", 18],
      ["Flax ceramics", "Flax Vue Vase — Duck Egg", "Short flax vase for a few stems or a handful of kitchen spoons.", 22],
      ["Handmade", "Everyday Bowl — Speckle Grey", "Handmade serving bowl with a gloss white interior and a raw speckle exterior.", 38],
      ["Handmade", "Everyday Bowl — Grit Large", "Large handmade everyday bowl for pasta, soup, or a salad.", 38],
      ["East of India", "Porcelain Bowl — Little Houses", "Porcelain bowl painted with a hillside of little houses.", 20],
      ["Woven", "African Woven Bowl — Terracotta", "Small woven bowl in terracotta and white.", 25],
      ["Bunting", "Bunting — Antique Lace Natural", "Natural antique-lace bunting for a mantel or a shop window.", 45],
    ] as const;
    for (const [product_group, name, description, retail_price] of products) {
      insertProduct.run({
        product_group,
        name,
        description,
        retail_price,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      });
    }

    const storeId = (name: string) =>
      (db.prepare(`SELECT id FROM stores WHERE name = ?`).get(name) as { id: number }).id;
    const productId = (name: string) =>
      (db.prepare(`SELECT id FROM products WHERE name = ?`).get(name) as { id: number }).id;

    const stock = db.prepare(`
      INSERT INTO store_stock (store_id, product_id, consignee_code, quantity)
      VALUES (?, ?, ?, 0)
    `);
    const shelves: [string, string, string][] = [
      ["Harbour Linen", "Flax Serve Bowl — Duck Egg", "HLB-BOWL-DE"],
      ["Harbour Linen", "Flax Mug — Khaki", "HLB-MUG-KH"],
      ["Harbour Linen", "Everyday Bowl — Speckle Grey", "HLB-BOWL-SG"],
      ["Terrigal Home Room", "Flax Vue Vase — Duck Egg", "THR-VASE-DE"],
      ["Terrigal Home Room", "Everyday Bowl — Grit Large", "THR-BOWL-GL"],
      ["Terrigal Home Room", "Bunting — Antique Lace Natural", "THR-BUNT-NAT"],
      ["Gosford Goods", "Porcelain Bowl — Little Houses", "GG-PORC-LH"],
      ["Gosford Goods", "African Woven Bowl — Terracotta", "GG-WOVEN-T"],
      ["Gosford Goods", "Flax Mug — Khaki", "GG-MUG-KH"],
      ["Gosford Goods", "Flax Serve Bowl — Duck Egg", "GG-BOWL-DE"],
    ];
    for (const [store, product, code] of shelves) {
      stock.run(storeId(store), productId(product), code);
    }

    const updateQty = db.prepare(`
      UPDATE store_stock SET quantity = quantity + ? WHERE store_id = ? AND product_id = ?
    `);
    const insertMove = db.prepare(`
      INSERT INTO movements (store_id, product_id, type, quantity, unit_price, occurred_on, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const moves: SeedMove[] = [
      { store: "Gosford Goods", product: "Porcelain Bowl — Little Houses", type: "transfer_in", quantity: 15, date: "2026-07-30", notes: "First delivery to Mann Street." },
      { store: "Gosford Goods", product: "African Woven Bowl — Terracotta", type: "transfer_in", quantity: 10, date: "2026-07-30" },
      { store: "Harbour Linen", product: "Flax Serve Bowl — Duck Egg", type: "transfer_in", quantity: 12, date: "2026-08-04" },
      { store: "Harbour Linen", product: "Flax Mug — Khaki", type: "transfer_in", quantity: 8, date: "2026-08-04" },
      { store: "Terrigal Home Room", product: "Flax Vue Vase — Duck Egg", type: "transfer_in", quantity: 10, date: "2026-08-11" },
      { store: "Terrigal Home Room", product: "Everyday Bowl — Grit Large", type: "transfer_in", quantity: 8, date: "2026-08-11" },
      { store: "Gosford Goods", product: "Flax Mug — Khaki", type: "transfer_in", quantity: 8, date: "2026-08-15" },
      { store: "Harbour Linen", product: "Everyday Bowl — Speckle Grey", type: "transfer_in", quantity: 6, date: "2026-08-18" },
      { store: "Terrigal Home Room", product: "Bunting — Antique Lace Natural", type: "transfer_in", quantity: 6, date: "2026-08-22" },
      { store: "Gosford Goods", product: "Porcelain Bowl — Little Houses", type: "sale", quantity: 4, date: "2026-08-29", price: 20 },
      { store: "Terrigal Home Room", product: "Flax Vue Vase — Duck Egg", type: "sale", quantity: 3, date: "2026-09-06", price: 22 },
      { store: "Gosford Goods", product: "African Woven Bowl — Terracotta", type: "sale", quantity: 2, date: "2026-09-08", price: 22, notes: "Priya sold the pair below retail." },
      { store: "Harbour Linen", product: "Flax Mug — Khaki", type: "sale", quantity: 2, date: "2026-09-12", price: 18 },
      { store: "Terrigal Home Room", product: "Bunting — Antique Lace Natural", type: "sale", quantity: 1, date: "2026-09-15", price: 45 },
      { store: "Gosford Goods", product: "Flax Serve Bowl — Duck Egg", type: "transfer_in", quantity: 4, date: "2026-09-18" },
      { store: "Harbour Linen", product: "Everyday Bowl — Speckle Grey", type: "sale", quantity: 1, date: "2026-09-20", price: 36, notes: "Markdown over the long weekend." },
      { store: "Terrigal Home Room", product: "Everyday Bowl — Grit Large", type: "sale", quantity: 2, date: "2026-09-27", price: 38 },
      { store: "Harbour Linen", product: "Flax Serve Bowl — Duck Egg", type: "transfer_out", quantity: 2, date: "2026-09-28", notes: "Returned to the studio. Hairline crack on the rim." },
      { store: "Harbour Linen", product: "Flax Mug — Khaki", type: "sale", quantity: 1, date: "2026-10-03", price: 18 },
      { store: "Gosford Goods", product: "Porcelain Bowl — Little Houses", type: "sale", quantity: 2, date: "2026-10-09", price: 20 },
      { store: "Terrigal Home Room", product: "Everyday Bowl — Grit Large", type: "sale", quantity: 1, date: "2026-10-11", price: 35, notes: "Floor sample, sold under retail." },
    ];

    for (const move of moves) {
      const sid = storeId(move.store);
      const pid = productId(move.product);
      const delta = move.type === "transfer_in" ? move.quantity : -move.quantity;
      updateQty.run(delta, sid, pid);
      insertMove.run(
        sid,
        pid,
        move.type,
        move.quantity,
        move.price ?? null,
        move.date,
        move.notes ?? null,
        `${move.date}T01:00:00.000Z`,
      );
    }

    const harbour = storeId("Harbour Linen");
    db.prepare(`
      INSERT INTO invoices (store_id, period, invoice_date, rent_paid, commission_paid, notes, created_at)
      VALUES (?, '2026-09', '2026-10-02', 420, 18, ?, '2026-10-02T02:00:00.000Z')
    `).run(
      harbour,
      "Sample invoice from Elise. September shelf rent, plus 25% of the $72 recorded in sales. Edit or delete it like any other record.",
    );

    db.prepare(`
      INSERT INTO reports (store_id, period, original_name, stored_name, mime_type, size_bytes, notes, created_at)
      VALUES (?, '2026-09', 'harbour-linen-september-2026.svg', ?, 'image/svg+xml', ?, ?, '2026-10-02T02:05:00.000Z')
    `).run(
      harbour,
      storedName,
      Buffer.byteLength(svg),
      "Sample report saved on the server. Add a photo from the iPhone camera or replace this file.",
    );

    db.prepare(`INSERT INTO app_meta (key, value) VALUES ('seeded', ?)`).run(new Date().toISOString());
    return true;
  });

  try {
    const wrote = seed.immediate();
    if (!wrote) fs.rmSync(path.join(/*turbopackIgnore: true*/ reportsDir(), storedName), { force: true });
  } catch (error) {
    fs.rmSync(path.join(/*turbopackIgnore: true*/ reportsDir(), storedName), { force: true });
    throw error;
  }
}

export function getDb() {
  if (!globalForDb.consignmentDb) {
    const dir = dataDir();
    console.log(`[consignment] data repository: ${dir}`);
    const db = new Database(path.join(/*turbopackIgnore: true*/ dir, "consignment.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    migrate(db);
    seedIfNeeded(db);
    globalForDb.consignmentDb = db;
    if (!globalForDb.consignmentShutdown) {
      globalForDb.consignmentShutdown = true;
      const close = () => {
        const open = globalForDb.consignmentDb;
        globalForDb.consignmentDb = undefined;
        open?.close();
      };
      process.once("SIGTERM", close);
      process.once("SIGINT", close);
    }
  }
  return globalForDb.consignmentDb;
}
