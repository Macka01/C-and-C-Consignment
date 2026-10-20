import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";
import {
  BELONGS_ON_STORE_SHELF_SQL,
  DELETE_UNSTOCKED_SHELF_SQL,
  belongsOnStoreShelf,
} from "./shelf-membership.ts";

function listingSql(db: Database.Database, storeId: number) {
  return db
    .prepare(
      `
      SELECT p.name AS product_name, st.consignee_code, st.quantity
      FROM store_stock st
      JOIN products p ON p.id = st.product_id
      WHERE st.store_id = ? AND (${BELONGS_ON_STORE_SHELF_SQL})
      ORDER BY p.name COLLATE NOCASE
    `,
    )
    .all(storeId) as Array<{ product_name: string; consignee_code: string; quantity: number }>;
}

function seedLoveLocalLeftovers(db: Database.Database) {
  db.exec(`
    CREATE TABLE stores (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      product_group TEXT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE store_stock (
      id INTEGER PRIMARY KEY,
      store_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      consignee_code TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 0,
      UNIQUE (store_id, product_id)
    );
    CREATE TABLE movements (
      id INTEGER PRIMARY KEY,
      store_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      shopify_gid TEXT
    );
  `);

  db.prepare(`INSERT INTO stores (id, name) VALUES (1, 'Love Local'), (2, 'Harbour Linen')`).run();
  const insertProduct = db.prepare(`INSERT INTO products (id, product_group, name) VALUES (?, ?, ?)`);
  insertProduct.run(1, "Bowl", "Handmade Ceramic Trinket Dish - Hearts - Sage");
  insertProduct.run(2, "Christmas Decorations", "Christmas Bell - Large");
  insertProduct.run(3, "Tableware - Flax", "Flax Mug - Duck Egg");
  insertProduct.run(4, "Basket", "Honey Pot Rattan Basket (Small)");
  insertProduct.run(5, "Gift Card", "Handmade Ceramic Gift Tag - thank you");

  const insertStock = db.prepare(
    `INSERT INTO store_stock (store_id, product_id, consignee_code, quantity) VALUES (?, ?, ?, ?)`,
  );
  insertStock.run(1, 1, "4221", 3);
  insertStock.run(1, 2, "", 0);
  insertStock.run(1, 3, "", 0);
  insertStock.run(1, 4, "", 0);
  insertStock.run(1, 5, "4234", 0);
  insertStock.run(2, 2, "", 8);
  insertStock.run(2, 3, "", 12);

  db.prepare(
    `INSERT INTO movements (store_id, product_id, type, quantity, shopify_gid) VALUES (1, 5, 'sale', 2, 'gid://shopify/Line/gift-tag')`,
  ).run();
}

describe("store shelf membership SQL", () => {
  it("is qty > 0 at that store, or a sale/transfer there", () => {
    assert.equal(belongsOnStoreShelf(3, 0), true);
    assert.equal(belongsOnStoreShelf(0, 1), true);
    assert.equal(belongsOnStoreShelf(0, 0), false);
  });

  it("does not list leftover qty-0 Love Local inventory-level rows", () => {
    const db = new Database(":memory:");
    seedLoveLocalLeftovers(db);
    const rows = listingSql(db, 1);
    assert.deepEqual(
      rows.map((row) => [row.product_name, row.consignee_code, row.quantity]),
      [
        ["Handmade Ceramic Gift Tag - thank you", "4234", 0],
        ["Handmade Ceramic Trinket Dish - Hearts - Sage", "4221", 3],
      ],
    );
    assert.ok(!rows.some((row) => /Christmas Bell|Flax Mug|Honey Pot/.test(row.product_name)));
  });

  it("deletes leftover qty-0 rows that have no code and no movements", () => {
    const db = new Database(":memory:");
    seedLoveLocalLeftovers(db);
    db.prepare(`INSERT INTO products (id, product_group, name) VALUES (6, 'Bowl', 'Uncoded trinket still on the shelf')`).run();
    db.prepare(`INSERT INTO store_stock (store_id, product_id, consignee_code, quantity) VALUES (1, 6, '', 2)`).run();
    db.prepare(`INSERT INTO products (id, product_group, name) VALUES (7, 'Bowl', 'Coded dish now at zero')`).run();
    db.prepare(`INSERT INTO store_stock (store_id, product_id, consignee_code, quantity) VALUES (1, 7, '4220', 0)`).run();
    db.exec(DELETE_UNSTOCKED_SHELF_SQL);
    const leftover = db
      .prepare(
        `SELECT p.name FROM store_stock st JOIN products p ON p.id = st.product_id WHERE st.store_id = 1 ORDER BY p.name`,
      )
      .all() as Array<{ name: string }>;
    assert.deepEqual(
      leftover.map((row) => row.name),
      [
        "Coded dish now at zero",
        "Handmade Ceramic Gift Tag - thank you",
        "Handmade Ceramic Trinket Dish - Hearts - Sage",
        "Uncoded trinket still on the shelf",
      ],
    );
  });
});

describe("listStock leftover Love Local rows", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cotton-clay-shelf-"));

  before(async () => {
    process.env.CONSIGNMENT_DATA_DIR = dir;
    process.env.CONSIGNMENT_SEED = "0";
    const { resetDb } = await import("./db.ts");
    resetDb();
  });

  after(async () => {
    const { resetDb } = await import("./db.ts");
    resetDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("omits leftover store_stock rows from the Stock tab and listing query", async () => {
    const { getDb } = await import("./db.ts");
    const { listStock, getStoreDetail } = await import("./data.ts");
    const { buildStockListing } = await import("./stock-listing.ts");
    const db = getDb();
    const now = "2026-10-20T00:00:00.000Z";
    db.prepare(
      `INSERT INTO stores (name, address, phone, contact_name, rent_amount, commission_rate, created_at, updated_at)
       VALUES ('Love Local', '', '', '', NULL, NULL, ?, ?)`,
    ).run(now, now);
    const storeId = Number(db.prepare(`SELECT id FROM stores WHERE name = 'Love Local'`).get()?.id);
    const insertProduct = db.prepare(
      `INSERT INTO products (product_group, name, description, retail_price, created_at, updated_at)
       VALUES (?, ?, '', ?, ?, ?)`,
    );
    insertProduct.run("Bowl", "Handmade Ceramic Trinket Dish - Hearts - Sage", 14, now, now);
    insertProduct.run("Christmas Decorations", "Christmas Bell - Large", 18, now, now);
    insertProduct.run("Tableware - Flax", "Flax Mug - Duck Egg", 18, now, now);
    insertProduct.run("Basket", "Honey Pot Rattan Basket (Small)", 25, now, now);
    insertProduct.run("Gift Card", "Handmade Ceramic Gift Tag - thank you", 7.5, now, now);
    const ids = db.prepare(`SELECT id, name FROM products`).all() as Array<{ id: number; name: string }>;
    const idByName = Object.fromEntries(ids.map((row) => [row.name, row.id]));
    const insertStock = db.prepare(
      `INSERT INTO store_stock (store_id, product_id, consignee_code, quantity) VALUES (?, ?, ?, ?)`,
    );
    insertStock.run(storeId, idByName["Handmade Ceramic Trinket Dish - Hearts - Sage"], "4221", 3);
    insertStock.run(storeId, idByName["Christmas Bell - Large"], "", 0);
    insertStock.run(storeId, idByName["Flax Mug - Duck Egg"], "", 0);
    insertStock.run(storeId, idByName["Honey Pot Rattan Basket (Small)"], "", 0);
    insertStock.run(storeId, idByName["Handmade Ceramic Gift Tag - thank you"], "4234", 0);
    db.prepare(
      `INSERT INTO movements (store_id, product_id, type, quantity, unit_price, occurred_on, notes, created_at, shopify_gid)
       VALUES (?, ?, 'sale', 2, 7.5, '2026-10-12', 'Shopify #100', ?, 'gid://shopify/Line/gift-tag')`,
    ).run(storeId, idByName["Handmade Ceramic Gift Tag - thank you"], now);

    const stock = listStock(storeId);
    assert.deepEqual(
      stock.map((line) => [line.productName, line.consigneeCode, line.quantity]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      [
        ["Handmade Ceramic Gift Tag - thank you", "4234", 0],
        ["Handmade Ceramic Trinket Dish - Hearts - Sage", "4221", 3],
      ],
    );

    const leftover = db
      .prepare(`SELECT p.name FROM store_stock st JOIN products p ON p.id = st.product_id WHERE st.store_id = ?`)
      .all(storeId) as Array<{ name: string }>;
    assert.ok(!leftover.some((row) => /Christmas Bell|Flax Mug|Honey Pot/.test(row.name)));

    const listing = buildStockListing("Love Local", "2026-10-20", getStoreDetail(storeId).stock);
    assert.deepEqual(
      listing.rows.map((row) => [row.productName, row.consigneeCode, row.quantityOnHand]),
      [
        ["Handmade Ceramic Trinket Dish - Hearts - Sage", "4221", 3],
        ["Handmade Ceramic Gift Tag - thank you", "4234", 0],
      ],
    );
  });
});
