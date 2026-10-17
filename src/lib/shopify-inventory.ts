import fs from "node:fs";
import path from "node:path";
import { compareStockToShopify, type ShopifyLocationInventory } from "@/lib/shopify-match";
import type { ProductDetail, ShopifyStockStatus, StockLine, StoreDetail } from "@/lib/types";

const API_VERSION = "2025-10";
const CACHE_MS = 60_000;

type Snapshot = {
  locations: ShopifyLocationInventory[];
  fetchedAt: string;
};

type Cache = {
  key: string;
  at: number;
  snapshot: Snapshot | null;
  error: string | null;
};

const globalForShopify = globalThis as unknown as { consignmentShopify?: Cache };

function shopDomain() {
  const raw = (process.env.SHOPIFY_SHOP ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!raw) return "";
  return raw.includes(".") ? raw : `${raw}.myshopify.com`;
}

function accessToken() {
  return (process.env.SHOPIFY_ACCESS_TOKEN ?? "").trim();
}

function mockPath() {
  return (process.env.SHOPIFY_MOCK_JSON ?? "").trim();
}

export function shopifyConfigured() {
  return Boolean(mockPath() || (shopDomain() && accessToken()));
}

function cacheKey() {
  return mockPath() || `${shopDomain()}|${accessToken()}`;
}

type GraphqlLocation = {
  id: string;
  name: string;
  inventoryLevels: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{
      quantities: Array<{ name: string; quantity: number }>;
      item: {
        sku: string | null;
        variants: {
          nodes: Array<{
            title: string | null;
            displayName: string | null;
            sku: string | null;
            product: { title: string } | null;
          }>;
        };
      } | null;
    }>;
  };
};

const LOCATION_QUERY = `
  query ShopifyLocations($cursor: String) {
    locations(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        inventoryLevels(first: 100) {
          pageInfo { hasNextPage endCursor }
          nodes {
            quantities(names: ["on_hand"]) { name quantity }
            item {
              sku
              variants(first: 1) {
                nodes { title displayName sku product { title } }
              }
            }
          }
        }
      }
    }
  }
`;

const LEVELS_QUERY = `
  query ShopifyLocationLevels($id: ID!, $cursor: String) {
    location(id: $id) {
      id
      name
      inventoryLevels(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          quantities(names: ["on_hand"]) { name quantity }
          item {
            sku
            variants(first: 1) {
              nodes { title displayName sku product { title } }
            }
          }
        }
      }
    }
  }
`;

function quantityOnHand(quantities: Array<{ name: string; quantity: number }>) {
  return quantities.find((entry) => entry.name === "on_hand")?.quantity ?? 0;
}

function itemsFromLevels(nodes: GraphqlLocation["inventoryLevels"]["nodes"]) {
  const items: ShopifyLocationInventory["items"] = [];
  for (const node of nodes) {
    const variant = node.item?.variants.nodes[0];
    items.push({
      sku: node.item?.sku ?? variant?.sku ?? null,
      title: variant?.product?.title ?? variant?.displayName ?? variant?.title ?? "",
      variantTitle: variant?.title ?? null,
      displayName: variant?.displayName ?? null,
      onHand: quantityOnHand(node.quantities),
    });
  }
  return items;
}

async function shopifyGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`https://${shopDomain()}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken(),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok) {
    throw new Error(`Shopify returned ${response.status}. Check the shop domain and Admin API token.`);
  }
  if (body.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join(" "));
  }
  if (!body.data) {
    throw new Error("Shopify returned no inventory data.");
  }
  return body.data;
}

async function loadLocationLevels(location: GraphqlLocation): Promise<ShopifyLocationInventory> {
  const items = itemsFromLevels(location.inventoryLevels.nodes);
  let cursor = location.inventoryLevels.pageInfo.hasNextPage ? location.inventoryLevels.pageInfo.endCursor : null;
  while (cursor) {
    const extra = await shopifyGraphql<{ location: GraphqlLocation | null }>(LEVELS_QUERY, { id: location.id, cursor });
    const page = extra.location?.inventoryLevels;
    if (!page) break;
    items.push(...itemsFromLevels(page.nodes));
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  }
  return { locationId: location.id, locationName: location.name, items };
}

async function fetchShopifySnapshot(): Promise<Snapshot> {
  const mock = mockPath();
  if (mock) {
    const file = path.resolve(mock);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { locations: ShopifyLocationInventory[] };
    return { locations: parsed.locations, fetchedAt: new Date().toISOString() };
  }

  const locations: ShopifyLocationInventory[] = [];
  let cursor: string | null = null;
  do {
    const page: {
      locations: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GraphqlLocation[] };
    } = await shopifyGraphql(LOCATION_QUERY, { cursor });
    for (const node of page.locations.nodes) {
      locations.push(await loadLocationLevels(node));
    }
    cursor = page.locations.pageInfo.hasNextPage ? page.locations.pageInfo.endCursor : null;
  } while (cursor);

  return { locations, fetchedAt: new Date().toISOString() };
}

async function loadSnapshot(): Promise<{ snapshot: Snapshot | null; error: string | null }> {
  if (!shopifyConfigured()) {
    return { snapshot: null, error: null };
  }
  const key = cacheKey();
  const existing = globalForShopify.consignmentShopify;
  if (existing && existing.key === key && Date.now() - existing.at < CACHE_MS) {
    return { snapshot: existing.snapshot, error: existing.error };
  }
  try {
    const snapshot = await fetchShopifySnapshot();
    globalForShopify.consignmentShopify = { key, at: Date.now(), snapshot, error: null };
    return { snapshot, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shopify inventory could not be read.";
    globalForShopify.consignmentShopify = { key, at: Date.now(), snapshot: null, error: message };
    return { snapshot: null, error: message };
  }
}

function attachLine(line: StockLine, locations: ShopifyLocationInventory[] | null): StockLine {
  return { ...line, ...compareStockToShopify(line, locations) };
}

export async function withShopifyStock<T extends StoreDetail | ProductDetail>(detail: T): Promise<T> {
  const { snapshot, error } = await loadSnapshot();
  const shopify: ShopifyStockStatus = {
    configured: shopifyConfigured(),
    error,
  };
  return {
    ...detail,
    shopify,
    stock: detail.stock.map((line) => attachLine(line, snapshot?.locations ?? null)),
  };
}
