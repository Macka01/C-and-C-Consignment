import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

describe("deleteStore", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cotton-clay-delete-store-"));

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

  it("removes the store and product data that exists only there", async () => {
    const { getDb } = await import("./db.ts");
    const { deleteStore, productImagePath } = await import("./data.ts");
    const db = getDb();
    const now = "2026-10-20T00:00:00.000Z";
    const insertStore = db.prepare(
      `INSERT INTO stores (name, address, phone, contact_name, rent_amount, commission_rate, created_at, updated_at)
       VALUES (?, '', '', '', NULL, NULL, ?, ?)`,
    );
    const love = Number(insertStore.run("Love Local", now, now).lastInsertRowid);
    const harbour = Number(insertStore.run("Harbour Linen", now, now).lastInsertRowid);
    const insertProduct = db.prepare(
      `INSERT INTO products (product_group, name, description, retail_price, image_url, image_name, image_mime, created_at, updated_at)
       VALUES (?, ?, '', 18, ?, ?, 'image/jpeg', ?, ?)`,
    );
    const onlyHere = Number(
      insertProduct.run("Tableware", "Flax Mug — Khaki", "https://cdn.example/mug.jpg", "only-love.jpg", now, now)
        .lastInsertRowid,
    );
    const shared = Number(
      insertProduct.run("Tableware", "Flax Serve Bowl — Duck Egg", "https://cdn.example/bowl.jpg", "shared-bowl.jpg", now, now)
        .lastInsertRowid,
    );
    const elsewhere = Number(insertProduct.run("Glass", "Harbour Window Vase", null, null, now, now).lastInsertRowid);
    const historyOnly = Number(insertProduct.run("Decor", "Sold Out Bell", null, "bell.jpg", now, now).lastInsertRowid);
    const keptByHistory = Number(insertProduct.run("Decor", "Moved Pitcher", null, null, now, now).lastInsertRowid);
    const catalogOnly = Number(insertProduct.run("Decor", "Unplaced Pitcher", null, null, now, now).lastInsertRowid);

    db.prepare(`INSERT INTO product_photos (product_id, shopify_url, stored_name, mime, sort_order) VALUES (?, ?, ?, 'image/jpeg', 0)`).run(
      onlyHere,
      "https://cdn.example/mug-full.jpg",
      "only-love-full.jpg",
    );
    const insertStock = db.prepare(
      `INSERT INTO store_stock (store_id, product_id, consignee_code, quantity) VALUES (?, ?, ?, ?)`,
    );
    insertStock.run(love, onlyHere, "LL-MUG", 4);
    insertStock.run(love, shared, "LL-BOWL", 2);
    insertStock.run(harbour, shared, "HL-BOWL", 5);
    insertStock.run(harbour, elsewhere, "HL-VASE", 3);
    insertStock.run(love, keptByHistory, "LL-PITCH", 1);
    const insertMove = db.prepare(
      `INSERT INTO movements (store_id, product_id, type, quantity, unit_price, occurred_on, notes, created_at, shopify_gid)
       VALUES (?, ?, 'sale', 1, 18, '2026-10-12', NULL, ?, ?)`,
    );
    insertMove.run(love, onlyHere, now, "gid://shopify/Line/only-love");
    insertMove.run(love, historyOnly, now, "gid://shopify/Line/bell");
    insertMove.run(harbour, keptByHistory, now, "gid://shopify/Line/pitcher");
    db.prepare(
      `INSERT INTO invoices (store_id, period, invoice_date, rent_paid, commission_paid, notes, created_at)
       VALUES (?, '2026-09', '2026-10-01', 0, 12, NULL, ?)`,
    ).run(love, now);
    db.prepare(
      `INSERT INTO reports (store_id, period, original_name, stored_name, mime_type, size_bytes, notes, created_at)
       VALUES (?, '2026-09', 'sheet.pdf', 'love-local-sheet.pdf', 'application/pdf', 4, NULL, ?)`,
    ).run(love, now);

    fs.mkdirSync(path.dirname(productImagePath("only-love.jpg")), { recursive: true });
    fs.writeFileSync(productImagePath("only-love.jpg"), "mug");
    fs.writeFileSync(productImagePath("only-love-full.jpg"), "mug-full");
    fs.writeFileSync(productImagePath("shared-bowl.jpg"), "bowl");
    fs.writeFileSync(productImagePath("bell.jpg"), "bell");
    const reportsDir = path.join(dir, "reports");
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(path.join(reportsDir, "love-local-sheet.pdf"), "pdf");

    deleteStore(love);

    assert.equal(db.prepare(`SELECT id FROM stores WHERE id = ?`).get(love), undefined);
    assert.equal(db.prepare(`SELECT id FROM stores WHERE id = ?`).get(harbour)?.id, harbour);
    assert.equal(db.prepare(`SELECT id FROM products WHERE id = ?`).get(onlyHere), undefined);
    assert.equal(db.prepare(`SELECT id FROM products WHERE id = ?`).get(historyOnly), undefined);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM product_photos WHERE product_id = ?`).get(onlyHere)?.n, 0);
    assert.equal(db.prepare(`SELECT id FROM products WHERE id = ?`).get(shared)?.id, shared);
    assert.equal(db.prepare(`SELECT id FROM products WHERE id = ?`).get(elsewhere)?.id, elsewhere);
    assert.equal(db.prepare(`SELECT id FROM products WHERE id = ?`).get(catalogOnly)?.id, catalogOnly);
    assert.equal(db.prepare(`SELECT id FROM products WHERE id = ?`).get(keptByHistory)?.id, keptByHistory);
    const remainingStock = db
      .prepare(`SELECT store_id, product_id, consignee_code, quantity FROM store_stock ORDER BY product_id`)
      .all() as Array<{ store_id: number; product_id: number; consignee_code: string; quantity: number }>;
    assert.deepEqual(remainingStock, [
      { store_id: harbour, product_id: shared, consignee_code: "HL-BOWL", quantity: 5 },
      { store_id: harbour, product_id: elsewhere, consignee_code: "HL-VASE", quantity: 3 },
    ]);
    const remainingMoves = db.prepare(`SELECT store_id, product_id FROM movements`).all() as Array<{
      store_id: number;
      product_id: number;
    }>;
    assert.deepEqual(remainingMoves, [{ store_id: harbour, product_id: keptByHistory }]);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM invoices`).get()?.n, 0);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM reports`).get()?.n, 0);
    assert.equal(fs.existsSync(productImagePath("only-love.jpg")), false);
    assert.equal(fs.existsSync(productImagePath("only-love-full.jpg")), false);
    assert.equal(fs.existsSync(productImagePath("bell.jpg")), false);
    assert.equal(fs.existsSync(productImagePath("shared-bowl.jpg")), true);
    assert.equal(fs.existsSync(path.join(reportsDir, "love-local-sheet.pdf")), false);
  });
});
