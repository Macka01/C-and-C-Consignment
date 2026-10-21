import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { ShopifyInventoryItem } from "./shopify-match.ts";

function item(
  variant: string,
  sku: string,
  title: string,
  productType: string,
  productStatus: string,
  onHand: number,
): ShopifyInventoryItem {
  return {
    variantId: `gid://shopify/ProductVariant/${variant}`,
    sku,
    title,
    variantTitle: null,
    displayName: title,
    productType,
    productStatus,
    description: null,
    price: 10,
    onHand,
  };
}

describe("shopify catalog filter", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cotton-clay-shopify-filter-"));

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

  it("keeps active products and hides discontinued or draft ones", async () => {
    const { getDb } = await import("./db.ts");
    const { applyShopifyFeed } = await import("./shopify-sync.ts");
    const { listProducts, listStock } = await import("./data.ts");
    const db = getDb();
    const now = "2026-10-21T00:00:00.000Z";
    const storeId = Number(
      db
        .prepare(
          `INSERT INTO stores (name, address, phone, contact_name, rent_amount, commission_rate, created_at, updated_at)
           VALUES ('Harbour Linen', '', '', '', NULL, NULL, ?, ?)`,
        )
        .run(now, now).lastInsertRowid,
    );
    const draftId = Number(
      db
        .prepare(
          `INSERT INTO products (product_group, name, description, retail_price, shopify_variant_id, created_at, updated_at)
           VALUES ('Mug', 'Draft Mug', '', 12, 'gid://shopify/ProductVariant/3', ?, ?)`,
        )
        .run(now, now).lastInsertRowid,
    );
    db.prepare(`INSERT INTO store_stock (store_id, product_id, consignee_code, quantity) VALUES (?, ?, 'HL-DRAFT', 3)`).run(
      storeId,
      draftId,
    );

    applyShopifyFeed({
      locations: [
        {
          locationId: "gid://shopify/Location/1",
          locationName: "Harbour Linen",
          items: [
            item("1", "BOWL", "Serve Bowl", "Bowl", "ACTIVE", 4),
            item("2", "OLD", "Old Vase", "Discontinued", "ACTIVE", 2),
            item("3", "DRAFT", "Draft Mug", "Mug", "DRAFT", 3),
            item("4", "ARCH", "Archived Plate", "Plate", "ARCHIVED", 1),
          ],
        },
      ],
      orders: [
        {
          id: "gid://shopify/LineItem/9",
          orderName: "#9",
          createdAt: "2026-10-20T00:00:00.000Z",
          cancelled: false,
          locationName: "Harbour Linen",
          quantity: 1,
          unitPrice: 10,
          product: {
            variantId: "gid://shopify/ProductVariant/9",
            sku: "GONE",
            name: "Discontinued Bowl",
            productGroup: "discontinued",
            productStatus: "ACTIVE",
            description: "",
            retailPrice: 10,
            imageUrl: null,
          },
        },
      ],
      transfers: [],
    });

    assert.deepEqual(
      listProducts()
        .map((product) => product.name)
        .sort(),
      ["Archived Plate", "Serve Bowl"],
    );
    assert.deepEqual(
      listStock(storeId)
        .map((line) => line.productName)
        .sort(),
      ["Archived Plate", "Serve Bowl"],
    );
    const kept = db.prepare(`SELECT consignee_code, quantity FROM store_stock WHERE product_id = ?`).get(draftId) as {
      consignee_code: string;
      quantity: number;
    };
    assert.deepEqual(kept, { consignee_code: "HL-DRAFT", quantity: 3 });
    assert.equal(
      (db.prepare(`SELECT catalog_excluded AS n FROM products WHERE id = ?`).get(draftId) as { n: number }).n,
      1,
    );
    assert.equal(db.prepare(`SELECT id FROM products WHERE name = 'Old Vase'`).get(), undefined);
    assert.equal(db.prepare(`SELECT id FROM products WHERE name = 'Discontinued Bowl'`).get(), undefined);

    applyShopifyFeed({
      locations: [
        {
          locationId: "gid://shopify/Location/1",
          locationName: "Harbour Linen",
          items: [item("3", "DRAFT", "Draft Mug", "Mug", "ACTIVE", 6)],
        },
      ],
      orders: [],
      transfers: [],
    });

    assert.equal(listProducts().some((product) => product.name === "Draft Mug"), true);
    assert.equal(
      (db.prepare(`SELECT catalog_excluded AS n FROM products WHERE id = ?`).get(draftId) as { n: number }).n,
      0,
    );
    assert.equal(
      (db.prepare(`SELECT quantity FROM store_stock WHERE product_id = ?`).get(draftId) as { quantity: number }).quantity,
      6,
    );
  });
});
