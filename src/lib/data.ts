import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { getDb, dataDir, reportsDir, usesExternalDataDir } from "@/lib/db";
import { publicProductImageUrl } from "@/lib/shopify-product-image";
import { HttpError } from "@/lib/errors";
import { keepConsigneeCode, shopifyCatalogName, shopifyProductGroup, stripShopifyDefaultTitle } from "@/lib/shopify-match";
import { BELONGS_ON_STORE_SHELF_SQL, DELETE_UNSTOCKED_SHELF_SQL } from "@/lib/shelf-membership";
import { attachStockTotals } from "@/lib/stock-totals";
import { buildShowcase, type ProductShowcase, type ShowcaseCatalogRow } from "@/lib/showcase";
import type {
  Dashboard,
  Invoice,
  Movement,
  MovementType,
  NetworkInfo,
  Product,
  ProductDetail,
  ReportRecord,
  SalesResponse,
  StockLine,
  Store,
  StoreDetail,
} from "@/lib/types";

const unsetShopify = { configured: false, error: null, warning: null };

type StoreRow = {
  id: number;
  name: string;
  address: string;
  phone: string;
  contact_name: string;
  rent_amount: number | null;
  commission_rate: number | null;
  units: number;
  retail_value: number;
};

type ProductRow = {
  id: number;
  product_group: string;
  name: string;
  description: string;
  retail_price: number;
  units: number;
  store_count: number;
  image_url: string | null;
  image_name: string | null;
};

type StockRow = {
  id: number;
  store_id: number;
  product_id: number;
  consignee_code: string;
  quantity: number;
  product_name: string;
  product_group: string;
  description: string;
  retail_price: number;
  image_url: string | null;
  image_name: string | null;
  store_name: string | null;
};

type MovementRow = {
  id: number;
  store_id: number;
  store_name: string;
  product_id: number;
  product_name: string;
  product_group: string;
  type: MovementType;
  quantity: number;
  unit_price: number | null;
  occurred_on: string;
  notes: string | null;
};

type InvoiceRow = {
  id: number;
  store_id: number;
  store_name: string;
  period: string;
  invoice_date: string;
  rent_paid: number;
  commission_paid: number;
  notes: string | null;
};

type ReportRow = {
  id: number;
  store_id: number;
  store_name: string;
  period: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  notes: string | null;
  created_at: string;
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function mapStore(row: StoreRow): Store {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    contactName: row.contact_name,
    rentAmount: row.rent_amount,
    commissionRate: row.commission_rate,
    units: row.units ?? 0,
    retailValue: money(row.retail_value ?? 0),
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    productGroup: row.product_group,
    name: stripShopifyDefaultTitle(row.name) || row.name,
    description: row.description,
    retailPrice: row.retail_price,
    units: row.units ?? 0,
    storeCount: row.store_count ?? 0,
    imageUrl: row.image_name ? publicProductImageUrl(row.id, row.image_name) : null,
  };
}

function mapStock(row: StockRow): StockLine {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    consigneeCode: row.consignee_code,
    quantity: row.quantity,
    productName: stripShopifyDefaultTitle(row.product_name) || row.product_name,
    productGroup: row.product_group,
    description: row.description,
    retailPrice: row.retail_price,
    imageUrl: row.image_name ? publicProductImageUrl(row.product_id, row.image_name) : null,
    storeName: row.store_name ?? undefined,
    shopifyQtyOnHand: null,
    variance: null,
    shopifyMatch: "unavailable",
    transferredIn: 0,
    transferredOut: 0,
    sales: 0,
  };
}

function mapMovement(row: MovementRow): Movement {
  const lineTotal = row.type === "sale" && row.unit_price !== null ? money(row.quantity * row.unit_price) : null;
  return {
    id: row.id,
    storeId: row.store_id,
    storeName: row.store_name,
    productId: row.product_id,
    productName: stripShopifyDefaultTitle(row.product_name) || row.product_name,
    productGroup: row.product_group,
    type: row.type,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal,
    occurredOn: row.occurred_on,
    notes: row.notes,
  };
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    storeId: row.store_id,
    storeName: row.store_name,
    period: row.period,
    invoiceDate: row.invoice_date,
    rentPaid: row.rent_paid,
    commissionPaid: row.commission_paid,
    notes: row.notes,
  };
}

function mapReport(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    storeId: row.store_id,
    storeName: row.store_name,
    period: row.period,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const stockedShelf = BELONGS_ON_STORE_SHELF_SQL;

const storeSelect = `
  SELECT s.id, s.name, s.address, s.phone, s.contact_name, s.rent_amount, s.commission_rate,
         COALESCE(SUM(st.quantity), 0) AS units,
         COALESCE(SUM(st.quantity * p.retail_price), 0) AS retail_value
  FROM stores s
  LEFT JOIN store_stock st ON st.store_id = s.id AND (${stockedShelf})
  LEFT JOIN products p ON p.id = st.product_id
`;

const movementSelect = `
  SELECT m.id, m.store_id, s.name AS store_name, m.product_id, p.name AS product_name,
         p.product_group, m.type, m.quantity, m.unit_price, m.occurred_on, m.notes
  FROM movements m
  JOIN stores s ON s.id = m.store_id
  JOIN products p ON p.id = m.product_id
`;

export type StoreInput = {
  name: string;
  address: string;
  phone: string;
  contactName: string;
  rentAmount: number | null;
  commissionRate: number | null;
};

export type ProductInput = {
  productGroup: string;
  name: string;
  description: string;
  retailPrice: number;
  shopifyVariantId?: string | null;
};

export type InvoiceInput = {
  storeId: number;
  period: string;
  invoiceDate: string;
  rentPaid: number;
  commissionPaid: number;
  notes: string | null;
};

export function productImagesDir() {
  const dir = path.join(/*turbopackIgnore: true*/ dataDir(), "product-images");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function productImagePath(storedName: string) {
  return path.join(/*turbopackIgnore: true*/ productImagesDir(), storedName);
}

function requireStore(id: number) {
  const store = getStore(id);
  if (!store) throw new HttpError("That store was not found.", 404);
  return store;
}

function requireProduct(id: number) {
  const product = getProduct(id);
  if (!product) throw new HttpError("That product was not found.", 404);
  return product;
}

export function listStores(): Store[] {
  const rows = getDb()
    .prepare(`${storeSelect} GROUP BY s.id ORDER BY s.name COLLATE NOCASE`)
    .all() as StoreRow[];
  return rows.map(mapStore);
}

export function getStore(id: number): Store | null {
  const row = getDb().prepare(`${storeSelect} WHERE s.id = ? GROUP BY s.id`).get(id) as StoreRow | undefined;
  return row ? mapStore(row) : null;
}

export function createStore(input: StoreInput): Store {
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(`
      INSERT INTO stores (name, address, phone, contact_name, rent_amount, commission_rate, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(input.name, input.address, input.phone, input.contactName, input.rentAmount, input.commissionRate, now, now);
  return getStore(Number(info.lastInsertRowid))!;
}

export function updateStore(id: number, input: StoreInput): Store {
  requireStore(id);
  getDb()
    .prepare(`
      UPDATE stores
      SET name = ?, address = ?, phone = ?, contact_name = ?, rent_amount = ?, commission_rate = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(input.name, input.address, input.phone, input.contactName, input.rentAmount, input.commissionRate, new Date().toISOString(), id);
  return getStore(id)!;
}

function unlinkStored(name: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return;
  fs.rmSync(path.join(/*turbopackIgnore: true*/ reportsDir(), name), { force: true });
}

export function deleteStore(id: number) {
  requireStore(id);
  const db = getDb();
  const files = db.prepare(`SELECT stored_name FROM reports WHERE store_id = ?`).all(id) as { stored_name: string }[];
  db.prepare(`DELETE FROM stores WHERE id = ?`).run(id);
  for (const file of files) unlinkStored(file.stored_name);
}

let defaultTitlesScrubbed = false;

function mergeDuplicateProduct(db: ReturnType<typeof getDb>, keepId: number, donorId: number) {
  if (keepId === donorId) return;
  const donorStock = db
    .prepare(`SELECT id, store_id, consignee_code, quantity FROM store_stock WHERE product_id = ?`)
    .all(donorId) as { id: number; store_id: number; consignee_code: string; quantity: number }[];
  const findKeep = db.prepare(`SELECT id, consignee_code FROM store_stock WHERE store_id = ? AND product_id = ?`);
  const updateKeep = db.prepare(`UPDATE store_stock SET consignee_code = ? WHERE id = ?`);
  const moveStock = db.prepare(`UPDATE store_stock SET product_id = ? WHERE id = ?`);
  const dropStock = db.prepare(`DELETE FROM store_stock WHERE id = ?`);
  for (const row of donorStock) {
    const keep = findKeep.get(row.store_id, keepId) as { id: number; consignee_code: string } | undefined;
    if (keep) {
      const code = keepConsigneeCode(keep.consignee_code, row.consignee_code);
      if (code !== keep.consignee_code) updateKeep.run(code, keep.id);
      dropStock.run(row.id);
    } else {
      moveStock.run(keepId, row.id);
    }
  }
  db.prepare(`UPDATE movements SET product_id = ? WHERE product_id = ?`).run(keepId, donorId);
  const donorImage = getProductImageRecord(donorId);
  const keepImage = getProductImageRecord(keepId);
  if (donorImage?.imageName && donorImage.imageName !== keepImage?.imageName) {
    fs.rmSync(productImagePath(donorImage.imageName), { force: true });
  }
  db.prepare(`DELETE FROM products WHERE id = ?`).run(donorId);
}

export function scrubShopifyDefaultTitleNames() {
  if (defaultTitlesScrubbed) return;
  defaultTitlesScrubbed = true;
  const db = getDb();
  const write = db.transaction(() => {
    const named = db.prepare(`SELECT id, name FROM products`).all() as { id: number; name: string }[];
    const now = new Date().toISOString();
    const rename = db.prepare(`UPDATE products SET name = ?, updated_at = ? WHERE id = ?`);
    for (const row of named) {
      const cleaned = stripShopifyDefaultTitle(row.name);
      if (cleaned && cleaned !== row.name) {
        rename.run(cleaned, now, row.id);
        row.name = cleaned;
      }
    }
    const groups = new Map<string, number[]>();
    for (const row of named) {
      const key = stripShopifyDefaultTitle(row.name).toLowerCase();
      if (!key) continue;
      const list = groups.get(key) ?? [];
      list.push(row.id);
      groups.set(key, list);
    }
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      const keepId = Math.min(...ids);
      for (const donorId of ids) {
        if (donorId !== keepId) mergeDuplicateProduct(db, keepId, donorId);
      }
    }
    db.prepare(
      `UPDATE store_stock SET consignee_code = ''
       WHERE TRIM(consignee_code) = ''
          OR consignee_code = '—'
          OR LOWER(consignee_code) = 'default title'`,
    ).run();
  });
  write();
}

export function listProducts(): Product[] {
  scrubShopifyDefaultTitleNames();
  const rows = getDb()
    .prepare(`
      SELECT p.id, p.product_group, p.name, p.description, p.retail_price, p.image_url, p.image_name,
             COALESCE(SUM(st.quantity), 0) AS units,
             COUNT(st.id) AS store_count
      FROM products p
      LEFT JOIN store_stock st ON st.product_id = p.id AND (${stockedShelf})
      WHERE TRIM(p.name) != ''
      GROUP BY p.id
      ORDER BY p.product_group COLLATE NOCASE, p.name COLLATE NOCASE
    `)
    .all() as ProductRow[];
  return rows.map(mapProduct);
}

function listCatalogShowcaseRows(): ShowcaseCatalogRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, product_group, name, description, retail_price, image_name
       FROM products
       WHERE TRIM(name) != ''
       ORDER BY id`,
    )
    .all() as Array<{
    id: number;
    product_group: string;
    name: string;
    description: string;
    retail_price: number;
    image_name: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    productGroup: row.product_group,
    name: stripShopifyDefaultTitle(row.name) || row.name,
    description: row.description,
    retailPrice: row.retail_price,
    imageUrl: row.image_name ? publicProductImageUrl(row.id, row.image_name) : null,
  }));
}

export function getShowcase(productId: number): ProductShowcase | null {
  return buildShowcase(productId, listCatalogShowcaseRows());
}

export function getProduct(id: number): Product | null {
  const row = getDb()
    .prepare(`
      SELECT p.id, p.product_group, p.name, p.description, p.retail_price, p.image_url, p.image_name,
             COALESCE(SUM(st.quantity), 0) AS units,
             COUNT(st.id) AS store_count
      FROM products p
      LEFT JOIN store_stock st ON st.product_id = p.id AND (${stockedShelf})
      WHERE p.id = ?
      GROUP BY p.id
    `)
    .get(id) as ProductRow | undefined;
  return row ? mapProduct(row) : null;
}

export function createProduct(input: ProductInput): Product {
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(`
      INSERT INTO products (product_group, name, description, retail_price, shopify_variant_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.productGroup,
      input.name,
      input.description,
      input.retailPrice,
      input.shopifyVariantId ?? null,
      now,
      now,
    );
  return getProduct(Number(info.lastInsertRowid))!;
}

export function updateProduct(id: number, input: ProductInput): Product {
  requireProduct(id);
  getDb()
    .prepare(`
      UPDATE products
      SET product_group = ?, name = ?, description = ?, retail_price = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(input.productGroup, input.name, input.description, input.retailPrice, new Date().toISOString(), id);
  return getProduct(id)!;
}

export function deleteProduct(id: number) {
  requireProduct(id);
  const db = getDb();
  const used = db
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM store_stock WHERE product_id = ?) +
        (SELECT COUNT(*) FROM movements WHERE product_id = ?) AS n
    `)
    .get(id, id) as { n: number };
  if (used.n > 0) {
    throw new HttpError("This product is on a shelf or already has history. Edit it instead of deleting it.", 409);
  }
  const image = getProductImageRecord(id);
  if (image?.imageName) fs.rmSync(productImagePath(image.imageName), { force: true });
  db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
}

export function purgeUnstockedShelves() {
  getDb().prepare(DELETE_UNSTOCKED_SHELF_SQL).run();
}

/** Stock tab, listing page, and PDF: qty > 0 at this store, or a sale/transfer there. */
export function listStock(storeId: number): StockLine[] {
  purgeUnstockedShelves();
  const rows = getDb()
    .prepare(`
      SELECT st.id, st.store_id, st.product_id, st.consignee_code, st.quantity,
             p.name AS product_name, p.product_group, p.description, p.retail_price, p.image_url, p.image_name,
             s.name AS store_name
      FROM store_stock st
      JOIN products p ON p.id = st.product_id
      JOIN stores s ON s.id = st.store_id
      WHERE st.store_id = ? AND (${stockedShelf})
      ORDER BY p.product_group COLLATE NOCASE, p.name COLLATE NOCASE
    `)
    .all(storeId) as StockRow[];
  return rows.map(mapStock);
}

export function listStockForProduct(productId: number): StockLine[] {
  purgeUnstockedShelves();
  const rows = getDb()
    .prepare(`
      SELECT st.id, st.store_id, st.product_id, st.consignee_code, st.quantity,
             p.name AS product_name, p.product_group, p.description, p.retail_price, p.image_url, p.image_name,
             s.name AS store_name
      FROM store_stock st
      JOIN products p ON p.id = st.product_id
      JOIN stores s ON s.id = st.store_id
      WHERE st.product_id = ? AND (${stockedShelf})
      ORDER BY s.name COLLATE NOCASE
    `)
    .all(productId) as StockRow[];
  return rows.map(mapStock);
}

export function placeProduct(input: {
  storeId: number;
  productId: number;
  consigneeCode: string;
  quantity: number;
  occurredOn: string | null;
  notes: string | null;
}) {
  requireStore(input.storeId);
  requireProduct(input.productId);
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM store_stock WHERE store_id = ? AND product_id = ?`)
    .get(input.storeId, input.productId);
  if (existing) {
    throw new HttpError("That product is already on the shelf at this store. Transfer more in instead.", 409);
  }
  if (input.quantity > 0 && !input.occurredOn) {
    throw new HttpError("A transfer in needs a date.", 400);
  }

  const place = db.transaction(() => {
    db.prepare(`
      INSERT INTO store_stock (store_id, product_id, consignee_code, quantity)
      VALUES (?, ?, ?, 0)
    `).run(input.storeId, input.productId, input.consigneeCode);
    if (input.quantity > 0 && input.occurredOn) {
      applyMovement(db, {
        type: "transfer_in",
        storeId: input.storeId,
        productId: input.productId,
        quantity: input.quantity,
        occurredOn: input.occurredOn,
        unitPrice: null,
        notes: input.notes,
      });
    }
  });

  try {
    place.immediate();
  } catch (error) {
    rethrowStockError(error);
  }
}

export function updateConsigneeCode(storeId: number, productId: number, consigneeCode: string) {
  requireStore(storeId);
  const info = getDb()
    .prepare(`UPDATE store_stock SET consignee_code = ? WHERE store_id = ? AND product_id = ?`)
    .run(consigneeCode, storeId, productId);
  if (info.changes === 0) {
    throw new HttpError("That product is not on the shelf at this store.", 404);
  }
}

type MovementInput = {
  type: MovementType;
  storeId: number;
  productId: number;
  quantity: number;
  occurredOn: string;
  unitPrice: number | null;
  notes: string | null;
};

function applyMovement(db: ReturnType<typeof getDb>, input: MovementInput) {
  const stock = db
    .prepare(`SELECT id, quantity FROM store_stock WHERE store_id = ? AND product_id = ?`)
    .get(input.storeId, input.productId) as { id: number; quantity: number } | undefined;
  if (!stock) {
    throw new HttpError("That product is not on the shelf at this store yet. Place it first.", 400);
  }
  if (input.type !== "transfer_in" && stock.quantity < input.quantity) {
    throw new HttpError(
      stock.quantity === 0
        ? "Nothing is on hand to move."
        : `Only ${stock.quantity} on hand. Reduce the quantity and try again.`,
      409,
    );
  }
  const delta = input.type === "transfer_in" ? input.quantity : -input.quantity;
  db.prepare(`UPDATE store_stock SET quantity = quantity + ? WHERE id = ?`).run(delta, stock.id);
  const info = db
    .prepare(`
      INSERT INTO movements (store_id, product_id, type, quantity, unit_price, occurred_on, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.storeId,
      input.productId,
      input.type,
      input.quantity,
      input.unitPrice,
      input.occurredOn,
      input.notes,
      new Date().toISOString(),
    );
  return Number(info.lastInsertRowid);
}

function rethrowStockError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: string }).code) : "";
  if (code === "SQLITE_BUSY" || code === "SQLITE_BUSY_SNAPSHOT") {
    throw new HttpError("Someone else is saving stock right now. Wait a moment and try again.", 503);
  }
  if (code === "SQLITE_CONSTRAINT_UNIQUE") {
    throw new HttpError("That product is already on the shelf at this store. Transfer more in instead.", 409);
  }
  if (code.startsWith("SQLITE_CONSTRAINT")) {
    throw new HttpError("The quantity on hand changed while this was saving. Refresh and try again.", 409);
  }
  throw error;
}

export function findProductIdForShopify(ref: {
  variantId: string | null;
  sku: string | null;
  name: string;
}): number | null {
  const db = getDb();
  if (ref.variantId) {
    const byVariant = db.prepare(`SELECT id FROM products WHERE shopify_variant_id = ?`).get(ref.variantId) as
      | { id: number }
      | undefined;
    if (byVariant) return byVariant.id;
  }
  if (ref.sku && !/^default title$/i.test(ref.sku.trim())) {
    const bySku = db
      .prepare(`SELECT product_id AS id FROM store_stock WHERE consignee_code = ? COLLATE NOCASE LIMIT 1`)
      .get(ref.sku) as { id: number } | undefined;
    if (bySku) return bySku.id;
  }
  const wanted = stripShopifyDefaultTitle(ref.name).toLowerCase();
  if (!wanted) return null;
  const named = db.prepare(`SELECT id, name FROM products`).all() as { id: number; name: string }[];
  const matches = named.filter((row) => stripShopifyDefaultTitle(row.name).toLowerCase() === wanted);
  if (!matches.length) return null;
  return matches.sort((left, right) => left.id - right.id)[0]?.id ?? null;
}

export function ensureShopifyProduct(ref: {
  variantId: string | null;
  sku: string | null;
  name: string;
  productGroup: string;
  description: string;
  retailPrice: number;
  imageUrl?: string | null;
}): { id: number; created: boolean } | null {
  const name = shopifyCatalogName(ref.name, ref.sku);
  const existing = findProductIdForShopify({ ...ref, name });
  if (existing) {
    const db = getDb();
    const now = new Date().toISOString();
    if (ref.variantId) {
      db.prepare(`UPDATE products SET shopify_variant_id = COALESCE(shopify_variant_id, ?) WHERE id = ?`).run(
        ref.variantId,
        existing,
      );
    }
    if (name) {
      const current = db.prepare(`SELECT name FROM products WHERE id = ?`).get(existing) as { name: string } | undefined;
      if (current && !shopifyCatalogName(current.name)) {
        db.prepare(`UPDATE products SET name = ?, updated_at = ? WHERE id = ?`).run(name, now, existing);
      }
    }
    const productGroup = shopifyProductGroup(ref.productGroup);
    if (productGroup) {
      db.prepare(`UPDATE products SET product_group = ?, updated_at = ? WHERE id = ?`).run(productGroup, now, existing);
    }
    return { id: existing, created: false };
  }
  if (!name) return null;
  const created = createProduct({
    productGroup: shopifyProductGroup(ref.productGroup),
    name,
    description: ref.description,
    retailPrice: ref.retailPrice,
    shopifyVariantId: ref.variantId,
  });
  return { id: created.id, created: true };
}

export function listShopifyProductsMissingImages(): { id: number; variantId: string }[] {
  return getDb()
    .prepare(
      `SELECT id, shopify_variant_id AS variantId
       FROM products
       WHERE shopify_variant_id IS NOT NULL AND shopify_variant_id != ''
         AND (image_name IS NULL OR image_name = '')`,
    )
    .all() as { id: number; variantId: string }[];
}

export function getProductImageRecord(id: number): {
  shopifyUrl: string | null;
  imageName: string | null;
  imageMime: string | null;
} | null {
  const row = getDb()
    .prepare(`SELECT image_url, image_name, image_mime FROM products WHERE id = ?`)
    .get(id) as { image_url: string | null; image_name: string | null; image_mime: string | null } | undefined;
  if (!row) return null;
  return { shopifyUrl: row.image_url, imageName: row.image_name, imageMime: row.image_mime };
}

export function saveProductImage(id: number, shopifyUrl: string, storedName: string, mime: string) {
  const previous = getProductImageRecord(id);
  getDb()
    .prepare(`UPDATE products SET image_url = ?, image_name = ?, image_mime = ?, updated_at = ? WHERE id = ?`)
    .run(shopifyUrl, storedName, mime, new Date().toISOString(), id);
  if (previous?.imageName && previous.imageName !== storedName) {
    fs.rmSync(productImagePath(previous.imageName), { force: true });
  }
}

export function readProductImage(id: number): { bytes: Buffer; mime: string } | null {
  const row = getProductImageRecord(id);
  if (!row?.imageName) return null;
  const file = productImagePath(row.imageName);
  if (!fs.existsSync(file)) return null;
  return { bytes: fs.readFileSync(file), mime: row.imageMime || "image/jpeg" };
}

export function rememberShopifyLocation(storeId: number, locationId: string) {
  getDb().prepare(`UPDATE stores SET shopify_location_id = ? WHERE id = ?`).run(locationId, storeId);
}

export function shopifyMovementCountAtStore(storeId: number, productId: number) {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM movements WHERE store_id = ? AND product_id = ? AND shopify_gid IS NOT NULL`)
    .get(storeId, productId) as { n: number };
  return row.n;
}

export function shopifyMovementProductIds(storeId: number) {
  const rows = getDb()
    .prepare(`SELECT DISTINCT product_id FROM movements WHERE store_id = ? AND shopify_gid IS NOT NULL`)
    .all(storeId) as { product_id: number }[];
  return rows.map((row) => row.product_id);
}

export function storeShelfProductIds(storeId: number) {
  const rows = getDb().prepare(`SELECT product_id FROM store_stock WHERE store_id = ?`).all(storeId) as { product_id: number }[];
  return rows.map((row) => row.product_id);
}

export function removeShelf(storeId: number, productId: number) {
  getDb().prepare(`DELETE FROM store_stock WHERE store_id = ? AND product_id = ?`).run(storeId, productId);
}

export function ensureShopifyStock(storeId: number, productId: number, quantity: number) {
  const db = getDb();
  const qty = Math.max(0, Math.round(quantity));
  const existing = db
    .prepare(`SELECT id FROM store_stock WHERE store_id = ? AND product_id = ?`)
    .get(storeId, productId) as { id: number } | undefined;
  if (existing) {
    db.prepare(`UPDATE store_stock SET quantity = ? WHERE id = ?`).run(qty, existing.id);
    return;
  }
  db.prepare(`INSERT INTO store_stock (store_id, product_id, consignee_code, quantity) VALUES (?, ?, '', ?)`).run(
    storeId,
    productId,
    qty,
  );
}

export function insertShopifyMovement(input: {
  gid: string;
  type: MovementType;
  storeId: number;
  productId: number;
  quantity: number;
  occurredOn: string;
  unitPrice: number | null;
  notes: string | null;
}): boolean {
  const db = getDb();
  const exists = db.prepare(`SELECT id FROM movements WHERE shopify_gid = ?`).get(input.gid);
  if (exists) return false;
  const stock = db
    .prepare(`SELECT id FROM store_stock WHERE store_id = ? AND product_id = ?`)
    .get(input.storeId, input.productId);
  if (!stock) {
    db.prepare(`INSERT INTO store_stock (store_id, product_id, consignee_code, quantity) VALUES (?, ?, '', 0)`).run(
      input.storeId,
      input.productId,
    );
  }
  db.prepare(`
    INSERT INTO movements (store_id, product_id, type, quantity, unit_price, occurred_on, notes, created_at, shopify_gid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.storeId,
    input.productId,
    input.type,
    input.quantity,
    input.unitPrice,
    input.occurredOn,
    input.notes,
    `${input.occurredOn}T00:00:00.000Z`,
    input.gid,
  );
  return true;
}

export function recordMovement(input: MovementInput): Movement {
  requireStore(input.storeId);
  requireProduct(input.productId);
  if (input.type === "sale" && input.unitPrice === null) {
    throw new HttpError("A sale needs the price it sold for.", 400);
  }
  const db = getDb();
  const run = db.transaction(() => applyMovement(db, input));
  let id: number;
  try {
    id = run.immediate();
  } catch (error) {
    rethrowStockError(error);
  }
  const row = db.prepare(`${movementSelect} WHERE m.id = ?`).get(id) as MovementRow;
  return mapMovement(row);
}

export function listMovements(filters: { storeId?: number; productId?: number }): Movement[] {
  const where: string[] = [];
  const params: number[] = [];
  if (filters.storeId) {
    where.push("m.store_id = ?");
    params.push(filters.storeId);
  }
  if (filters.productId) {
    where.push("m.product_id = ?");
    params.push(filters.productId);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(`${movementSelect} ${clause} ORDER BY m.occurred_on DESC, m.id DESC`)
    .all(...params) as MovementRow[];
  return rows.map(mapMovement);
}

export function listSales(filters: { storeId: number | null; from: string | null; to: string | null }): SalesResponse {
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new HttpError("The start date is after the end date.", 400);
  }
  const where = ["m.type = 'sale'"];
  const params: Array<number | string> = [];
  if (filters.storeId) {
    where.push("m.store_id = ?");
    params.push(filters.storeId);
  }
  if (filters.from) {
    where.push("m.occurred_on >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("m.occurred_on <= ?");
    params.push(filters.to);
  }
  const rows = getDb()
    .prepare(`${movementSelect} WHERE ${where.join(" AND ")} ORDER BY m.occurred_on DESC, m.id DESC`)
    .all(...params) as MovementRow[];
  const sales = rows.map(mapMovement);
  return {
    sales,
    units: sales.reduce((sum, sale) => sum + sale.quantity, 0),
    total: money(sales.reduce((sum, sale) => sum + (sale.lineTotal ?? 0), 0)),
  };
}

export function getStoreDetail(id: number): StoreDetail {
  scrubShopifyDefaultTitleNames();
  const store = requireStore(id);
  const movements = listMovements({ storeId: id });
  return {
    store,
    stock: attachStockTotals(listStock(id), movements),
    movements,
    invoices: listInvoices(id),
    reports: listReports({ storeId: id }),
    shopify: unsetShopify,
  };
}

export function getProductDetail(id: number): ProductDetail {
  scrubShopifyDefaultTitleNames();
  const product = requireProduct(id);
  const movements = listMovements({ productId: id });
  return {
    product,
    stock: attachStockTotals(listStockForProduct(id), movements),
    movements,
    shopify: unsetShopify,
  };
}

export function listInvoices(storeId?: number | null): Invoice[] {
  const rows = storeId
    ? (getDb()
        .prepare(`
          SELECT i.*, s.name AS store_name
          FROM invoices i JOIN stores s ON s.id = i.store_id
          WHERE i.store_id = ?
          ORDER BY i.invoice_date DESC, i.id DESC
        `)
        .all(storeId) as InvoiceRow[])
    : (getDb()
        .prepare(`
          SELECT i.*, s.name AS store_name
          FROM invoices i JOIN stores s ON s.id = i.store_id
          ORDER BY i.invoice_date DESC, i.id DESC
        `)
        .all() as InvoiceRow[]);
  return rows.map(mapInvoice);
}

export function createInvoice(input: InvoiceInput): Invoice {
  requireStore(input.storeId);
  const info = getDb()
    .prepare(`
      INSERT INTO invoices (store_id, period, invoice_date, rent_paid, commission_paid, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(input.storeId, input.period, input.invoiceDate, input.rentPaid, input.commissionPaid, input.notes, new Date().toISOString());
  return listInvoices().find((invoice) => invoice.id === Number(info.lastInsertRowid))!;
}

export function updateInvoice(id: number, input: InvoiceInput): Invoice {
  requireStore(input.storeId);
  const info = getDb()
    .prepare(`
      UPDATE invoices
      SET store_id = ?, period = ?, invoice_date = ?, rent_paid = ?, commission_paid = ?, notes = ?
      WHERE id = ?
    `)
    .run(input.storeId, input.period, input.invoiceDate, input.rentPaid, input.commissionPaid, input.notes, id);
  if (info.changes === 0) throw new HttpError("That invoice was not found.", 404);
  return listInvoices().find((invoice) => invoice.id === id)!;
}

export function deleteInvoice(id: number) {
  const info = getDb().prepare(`DELETE FROM invoices WHERE id = ?`).run(id);
  if (info.changes === 0) throw new HttpError("That invoice was not found.", 404);
}

export function listReports(filters: { storeId?: number | null; period?: string | null }): ReportRecord[] {
  const where: string[] = [];
  const params: Array<number | string> = [];
  if (filters.storeId) {
    where.push("r.store_id = ?");
    params.push(filters.storeId);
  }
  if (filters.period) {
    where.push("r.period = ?");
    params.push(filters.period);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(`
      SELECT r.id, r.store_id, s.name AS store_name, r.period, r.original_name, r.stored_name,
             r.mime_type, r.size_bytes, r.notes, r.created_at
      FROM reports r
      JOIN stores s ON s.id = r.store_id
      ${clause}
      ORDER BY r.created_at DESC, r.id DESC
    `)
    .all(...params) as ReportRow[];
  return rows.map(mapReport);
}

function reportRow(id: number): ReportRow | undefined {
  return getDb()
    .prepare(`
      SELECT r.id, r.store_id, s.name AS store_name, r.period, r.original_name, r.stored_name,
             r.mime_type, r.size_bytes, r.notes, r.created_at
      FROM reports r JOIN stores s ON s.id = r.store_id
      WHERE r.id = ?
    `)
    .get(id) as ReportRow | undefined;
}

export function getReport(id: number): ReportRecord {
  const row = reportRow(id);
  if (!row) throw new HttpError("That report was not found.", 404);
  return mapReport(row);
}

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "image/svg+xml": "svg",
};

const extensionMimes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

function resolveMime(file: File) {
  if (file.type && mimeExtensions[file.type] && file.type !== "image/svg+xml") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const guessed = extensionMimes[ext];
  if (!guessed) {
    throw new HttpError("Upload a photo (JPEG, PNG, WEBP, or HEIC) or a PDF.", 400);
  }
  return guessed;
}

function safeOriginalName(name: string, ext: string) {
  const base = path.basename(name).replace(/[^\w.\- ()]+/g, "").slice(0, 180);
  return base || `report.${ext}`;
}

export async function saveReport(input: {
  storeId: number;
  period: string;
  notes: string | null;
  file: File;
  replaceId: number | null;
}): Promise<ReportRecord> {
  requireStore(input.storeId);
  const mime = resolveMime(input.file);
  if (input.file.size <= 0) throw new HttpError("That file is empty.", 400);
  if (input.file.size > 20 * 1024 * 1024) {
    throw new HttpError("Files need to be 20 MB or smaller.", 400);
  }
  const ext = mimeExtensions[mime];
  const storedName = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());
  fs.writeFileSync(path.join(/*turbopackIgnore: true*/ reportsDir(), storedName), bytes);

  const db = getDb();
  try {
    if (input.replaceId) {
      const existing = reportRow(input.replaceId);
      if (!existing || existing.store_id !== input.storeId) {
        throw new HttpError("That report was not found for this store.", 404);
      }
      const replace = db.transaction(() => {
        db.prepare(`
          UPDATE reports
          SET period = ?, original_name = ?, stored_name = ?, mime_type = ?, size_bytes = ?, notes = ?
          WHERE id = ?
        `).run(
          input.period,
          safeOriginalName(input.file.name, ext),
          storedName,
          mime,
          bytes.length,
          input.notes,
          input.replaceId,
        );
      });
      replace.immediate();
      unlinkStored(existing.stored_name);
      return getReport(input.replaceId);
    }

    const insert = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO reports (store_id, period, original_name, stored_name, mime_type, size_bytes, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.storeId,
        input.period,
        safeOriginalName(input.file.name, ext),
        storedName,
        mime,
        bytes.length,
        input.notes,
        new Date().toISOString(),
      );
      return Number(info.lastInsertRowid);
    });
    return getReport(insert.immediate());
  } catch (error) {
    unlinkStored(storedName);
    throw error;
  }
}

export function deleteReport(id: number) {
  const existing = reportRow(id);
  if (!existing) throw new HttpError("That report was not found.", 404);
  getDb().prepare(`DELETE FROM reports WHERE id = ?`).run(id);
  unlinkStored(existing.stored_name);
}

export function readReportFile(id: number) {
  const existing = reportRow(id);
  if (!existing) throw new HttpError("That report was not found.", 404);
  if (!/^[a-zA-Z0-9._-]+$/.test(existing.stored_name)) {
    throw new HttpError("That file could not be opened.", 500);
  }
  const full = path.join(/*turbopackIgnore: true*/ reportsDir(), existing.stored_name);
  if (!fs.existsSync(full)) {
    throw new HttpError("The saved file is missing from the server.", 404);
  }
  const bytes = fs.readFileSync(full);
  return {
    bytes,
    mimeType: existing.mime_type,
    originalName: existing.original_name,
  };
}

export function getDashboard(): Dashboard {
  const stores = listStores();
  const products = listProducts();
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthSales = listSales({ storeId: null, from: `${period}-01`, to: `${period}-31` });
  return {
    storeCount: stores.length,
    productCount: products.length,
    unitsOnHand: stores.reduce((sum, store) => sum + store.units, 0),
    retailValue: money(stores.reduce((sum, store) => sum + store.retailValue, 0)),
    salesThisMonth: {
      count: monthSales.sales.length,
      units: monthSales.units,
      total: monthSales.total,
      period,
    },
    stores,
    recentMovements: listMovements({}).slice(0, 8),
  };
}

function inDocker() {
  return process.env.CONSIGNMENT_DOCKER === "1";
}

function publicUrls() {
  return (process.env.CONSIGNMENT_PUBLIC_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function bonjourName() {
  const configured = process.env.CONSIGNMENT_BONJOUR?.trim().replace(/^https?:\/\//i, "");
  if (configured) return configured.replace(/\/$/, "");
  if (inDocker()) return null;
  const host = os.hostname().trim().replace(/\.local$/i, "");
  if (host === "localhost" || !/^[A-Za-z0-9-]+$/.test(host)) return null;
  return `${host}.local`;
}

export function getNetwork(): NetworkInfo {
  const port = Number(process.env.PORT) || 43123;
  const addresses: string[] = [];
  if (!inDocker()) {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family !== "IPv4" || entry.internal) continue;
        if (entry.address.startsWith("169.254.")) continue;
        addresses.push(entry.address);
      }
    }
  }
  const bonjour = bonjourName();
  const urls = [...publicUrls()];
  if (bonjour) {
    const local = `http://${bonjour}:${port}`;
    if (!urls.includes(local)) urls.push(local);
  }
  for (const address of addresses) {
    const href = `http://${address}:${port}`;
    if (!urls.includes(href)) urls.push(href);
  }
  return { port, addresses, bonjour, urls, externalData: usesExternalDataDir() };
}
