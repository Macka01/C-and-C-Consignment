import fs from "node:fs";
import path from "node:path";
import { getAppMeta, setAppMeta } from "@/lib/data";
import { compareStockToShopify, locationNameFromOrder, type ShopifyLocationInventory } from "@/lib/shopify-match";
import { eventsSinceMs, shouldStopEventPages } from "@/lib/shopify-refresh";
import { applyShopifyFeed, type ShopifyFeed } from "@/lib/shopify-sync";
import type { ShopifyOrderLine, ShopifyTransferLine } from "@/lib/shopify-match";
import type { ProductDetail, ShopifyStockStatus, StockLine, StoreDetail } from "@/lib/types";

const API_VERSION = "2025-10";
const FRESH_MS = 5 * 60 * 1000;
const EVENTS_SYNCED_KEY = "shopify_events_synced_at";
const FULL_EVENT_PAGES = 20;
const INCREMENTAL_EVENT_PAGES = 5;

type FeedResult = {
  feed: ShopifyFeed | null;
  error: string | null;
  warning: string | null;
};

type Cache = FeedResult & {
  key: string;
  at: number;
};

type ShopifyRuntime = {
  cache?: Cache;
  inflight?: Promise<FeedResult>;
  inflightKey?: string;
};

const globalForShopify = globalThis as unknown as { consignmentShopify?: ShopifyRuntime };

function shopifyState(): ShopifyRuntime {
  if (!globalForShopify.consignmentShopify) {
    globalForShopify.consignmentShopify = {};
  }
  return globalForShopify.consignmentShopify;
}

export type ShopifySyncOptions = { wait?: boolean };

export function shopifySyncOptions(request: Request): ShopifySyncOptions {
  return { wait: new URL(request.url).searchParams.get("refresh") === "1" };
}

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

type GraphqlVariant = {
  id: string | null;
  title: string | null;
  displayName: string | null;
  sku: string | null;
  price: string | null;
  product: { title: string; productType: string | null; description: string | null } | null;
};

type GraphqlLocation = {
  id: string;
  name: string;
  inventoryLevels: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{
      quantities: Array<{ name: string; quantity: number }>;
      item: {
        sku: string | null;
        variants: { nodes: GraphqlVariant[] };
      } | null;
    }>;
  };
};

const VARIANT_FIELDS = `
  id title displayName sku price
  product { title productType description }
`;

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
              variants(first: 1) { nodes { ${VARIANT_FIELDS} } }
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
            variants(first: 1) { nodes { ${VARIANT_FIELDS} } }
          }
        }
      }
    }
  }
`;

const SCOPES_QUERY = `
  query ShopifyAccessScopes {
    currentAppInstallation { accessScopes { handle } }
  }
`;

const ORDERS_QUERY = `
  query ShopifyOrders($cursor: String) {
    orders(first: 100, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        createdAt
        cancelledAt
        retailLocation { id name }
        fulfillments(first: 5) {
          location { id name }
        }
        lineItems(first: 50) {
          nodes {
            id
            quantity
            sku
            name
            originalUnitPriceSet { shopMoney { amount } }
            variant {
              id
              sku
              title
              price
              product { title productType description }
            }
          }
        }
      }
    }
  }
`;

const TRANSFER_QUERY = `
  query ShopifyTransfers($cursor: String) {
    inventoryTransfers(first: 50, after: $cursor, sortKey: DATE_CREATED, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        status
        dateCreated
        origin { name location { id name } }
        destination { name location { id name } }
        lineItems(first: 80) {
          nodes {
            id
            totalQuantity
            inventoryItem {
              sku
              variants(first: 1) { nodes { ${VARIANT_FIELDS} } }
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

function money(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function refFromVariant(variant: GraphqlVariant | undefined, sku: string | null) {
  const title = variant?.product?.title ?? variant?.displayName ?? variant?.title ?? "";
  return {
    variantId: variant?.id ?? null,
    sku: sku ?? variant?.sku ?? null,
    name: variant?.displayName?.trim() || [title, variant?.title].filter(Boolean).join(" — ") || title,
    productGroup: variant?.product?.productType?.trim() || "Shopify",
    description: variant?.product?.description?.trim() || "",
    retailPrice: money(variant?.price) ?? 0,
  };
}

function itemsFromLevels(nodes: GraphqlLocation["inventoryLevels"]["nodes"]) {
  const items: ShopifyLocationInventory["items"] = [];
  for (const node of nodes) {
    const variant = node.item?.variants.nodes[0];
    items.push({
      variantId: variant?.id ?? null,
      sku: node.item?.sku ?? variant?.sku ?? null,
      title: variant?.product?.title ?? variant?.displayName ?? variant?.title ?? "",
      variantTitle: variant?.title ?? null,
      displayName: variant?.displayName ?? null,
      productType: variant?.product?.productType ?? null,
      description: variant?.product?.description ?? null,
      price: money(variant?.price),
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
  const body = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
  };
  if (!response.ok) {
    throw new Error(`Shopify returned ${response.status}. Check the shop domain and Admin API token.`);
  }
  if (body.data && !body.errors?.length) {
    return body.data;
  }
  if (body.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join(" "));
  }
  throw new Error("Shopify returned no inventory data.");
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

async function fetchLocations(): Promise<ShopifyLocationInventory[]> {
  const locations: ShopifyLocationInventory[] = [];
  let cursor: string | null = null;
  do {
    const page: {
      locations: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GraphqlLocation[] };
    } = await shopifyGraphql(LOCATION_QUERY, { cursor });
    locations.push(...(await Promise.all(page.locations.nodes.map((node) => loadLocationLevels(node)))));
    cursor = page.locations.pageInfo.hasNextPage ? page.locations.pageInfo.endCursor : null;
  } while (cursor);
  return locations;
}

type GraphqlOrder = {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  retailLocation: { id: string; name: string } | null;
  fulfillments: Array<{ location: { id: string; name: string } | null }>;
  lineItems: {
    nodes: Array<{
      id: string;
      quantity: number;
      sku: string | null;
      name: string | null;
      originalUnitPriceSet: { shopMoney: { amount: string } | null } | null;
      variant: GraphqlVariant | null;
    }>;
  };
};

type OrdersPage = {
  orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GraphqlOrder[] };
};

async function tokenScopes(): Promise<string[]> {
  try {
    const data: { currentAppInstallation: { accessScopes: Array<{ handle: string }> } } = await shopifyGraphql(SCOPES_QUERY);
    return data.currentAppInstallation.accessScopes.map((scope) => scope.handle);
  } catch {
    return [];
  }
}

function explainOrdersError(shopifyText: string, scopes: string[]) {
  if (scopes.includes("read_orders")) {
    return `Shopify denied the orders query even though this token includes read_orders. ${shopifyText}`;
  }
  if (scopes.length) {
    return `This Admin API token does not include read_orders (it has ${scopes.join(", ")}). Enable read_orders, then create a new Admin API access token and put it in server/macos/host.env.`;
  }
  return shopifyText;
}

async function fetchOrders(sinceMs: number | null): Promise<ShopifyOrderLine[]> {
  const lines: ShopifyOrderLine[] = [];
  let cursor: string | null = null;
  const maxPages = sinceMs == null ? FULL_EVENT_PAGES : INCREMENTAL_EVENT_PAGES;
  try {
    for (let page = 0; page < maxPages; page += 1) {
      const data: OrdersPage = await shopifyGraphql(ORDERS_QUERY, { cursor });
      if (!data.orders) {
        throw new Error("Shopify returned no orders.");
      }
      for (const order of data.orders.nodes) {
        const locationName = locationNameFromOrder(order);
        for (const item of order.lineItems.nodes) {
          if (item.quantity <= 0) continue;
          const variant = item.variant ?? undefined;
          const unitPrice = money(item.originalUnitPriceSet?.shopMoney?.amount) ?? money(variant?.price);
          lines.push({
            id: item.id,
            orderName: order.name,
            createdAt: order.createdAt,
            cancelled: Boolean(order.cancelledAt),
            locationName,
            quantity: item.quantity,
            unitPrice,
            product: {
              variantId: variant?.id ?? null,
              sku: item.sku ?? variant?.sku ?? null,
              name: item.name?.trim() || refFromVariant(variant, item.sku).name,
              productGroup: variant?.product?.productType?.trim() || "Shopify",
              description: variant?.product?.description?.trim() || "",
              retailPrice: unitPrice ?? 0,
            },
          });
        }
      }
      if (!data.orders.pageInfo.hasNextPage) break;
      const oldest = data.orders.nodes.at(-1)?.createdAt;
      if (shouldStopEventPages(oldest, sinceMs)) break;
      cursor = data.orders.pageInfo.endCursor;
      if (!cursor) break;
    }
    return lines;
  } catch (error) {
    const shopifyText = error instanceof Error ? error.message : "Shopify sales could not be read.";
    throw new Error(explainOrdersError(shopifyText, await tokenScopes()));
  }
}

async function fetchTransfers(sinceMs: number | null): Promise<ShopifyTransferLine[]> {
  const lines: ShopifyTransferLine[] = [];
  let cursor: string | null = null;
  const maxPages = sinceMs == null ? FULL_EVENT_PAGES : INCREMENTAL_EVENT_PAGES;
  type TransferPage = {
    inventoryTransfers: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<{
        id: string;
        status: string;
        dateCreated: string | null;
        origin: { name: string | null; location: { id: string; name: string } | null } | null;
        destination: { name: string | null; location: { id: string; name: string } | null } | null;
        lineItems: {
          nodes: Array<{
            id: string;
            totalQuantity: number;
            inventoryItem: { sku: string | null; variants: { nodes: GraphqlVariant[] } } | null;
          }>;
        };
      }>;
    };
  };
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page: TransferPage = await shopifyGraphql(TRANSFER_QUERY, { cursor });
    for (const transfer of page.inventoryTransfers.nodes) {
      const originName = transfer.origin?.location?.name ?? transfer.origin?.name ?? "";
      const destinationName = transfer.destination?.location?.name ?? transfer.destination?.name ?? "";
      for (const item of transfer.lineItems.nodes) {
        const variant = item.inventoryItem?.variants.nodes[0];
        lines.push({
          id: item.id,
          status: transfer.status ?? "",
          occurredOn: transfer.dateCreated ?? new Date().toISOString(),
          originName,
          destinationName,
          quantity: item.totalQuantity,
          product: refFromVariant(variant, item.inventoryItem?.sku ?? null),
        });
      }
    }
    if (!page.inventoryTransfers.pageInfo.hasNextPage) break;
    const oldest = page.inventoryTransfers.nodes.at(-1)?.dateCreated;
    if (shouldStopEventPages(oldest, sinceMs)) break;
    cursor = page.inventoryTransfers.pageInfo.endCursor;
    if (!cursor) break;
  }
  return lines;
}

async function fetchShopifyFeed(): Promise<{ feed: ShopifyFeed; warning: string | null }> {
  const mock = mockPath();
  if (mock) {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(mock), "utf8")) as ShopifyFeed;
    return {
      feed: {
        locations: parsed.locations ?? [],
        orders: parsed.orders ?? [],
        transfers: parsed.transfers ?? [],
      },
      warning: null,
    };
  }

  const sinceMs = eventsSinceMs(getAppMeta(EVENTS_SYNCED_KEY));
  const warnings: string[] = [];
  const [locations, orders, transfers] = await Promise.all([
    fetchLocations(),
    fetchOrders(sinceMs).catch((error) => {
      warnings.push(error instanceof Error ? error.message : "Shopify sales could not be read.");
      return [] as ShopifyOrderLine[];
    }),
    fetchTransfers(sinceMs).catch((error) => {
      warnings.push(error instanceof Error ? error.message : "Shopify transfers could not be read.");
      return [] as ShopifyTransferLine[];
    }),
  ]);
  if (!warnings.length) {
    setAppMeta(EVENTS_SYNCED_KEY, new Date().toISOString());
  }
  return { feed: { locations, orders, transfers }, warning: warnings.join(" ") || null };
}

function emptyFeedResult(): FeedResult {
  return { feed: null, error: null, warning: null };
}

function snapshot(cache: Cache): FeedResult {
  return { feed: cache.feed, error: cache.error, warning: cache.warning };
}

async function refreshFeed(key: string): Promise<FeedResult> {
  const state = shopifyState();
  try {
    const { feed, warning } = await fetchShopifyFeed();
    if (feed) applyShopifyFeed(feed);
    const result: FeedResult = { feed, error: null, warning };
    state.cache = { key, at: Date.now(), ...result };
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shopify could not be read.";
    const result: FeedResult = { feed: null, error: message, warning: null };
    state.cache = { key, at: Date.now(), ...result };
    return result;
  }
}

async function loadFeed(options?: ShopifySyncOptions): Promise<FeedResult> {
  if (!shopifyConfigured()) {
    return emptyFeedResult();
  }
  const key = cacheKey();
  const state = shopifyState();
  const cache = state.cache;
  const fresh = Boolean(cache && cache.key === key && Date.now() - cache.at < FRESH_MS);
  if (fresh && cache && !options?.wait) {
    return snapshot(cache);
  }
  if (!state.inflight || state.inflightKey !== key) {
    state.inflightKey = key;
    state.inflight = refreshFeed(key).finally(() => {
      if (state.inflightKey === key) {
        state.inflight = undefined;
        state.inflightKey = undefined;
      }
    });
  }
  if (!options?.wait && cache && cache.key === key) {
    return snapshot(cache);
  }
  return state.inflight;
}

function attachLine(line: StockLine, locations: ShopifyLocationInventory[] | null): StockLine {
  return { ...line, ...compareStockToShopify(line, locations) };
}

export async function syncFromShopify(options?: ShopifySyncOptions): Promise<ShopifyStockStatus> {
  const { error, warning } = await loadFeed(options);
  return { configured: shopifyConfigured(), error, warning };
}

export async function withShopifyStock<T extends StoreDetail | ProductDetail>(
  load: () => T,
  options?: ShopifySyncOptions,
): Promise<T> {
  const shopify = await syncFromShopify(options);
  const { feed } = await loadFeed(options);
  const detail = load();
  return {
    ...detail,
    shopify,
    stock: detail.stock
      .map((line) => attachLine(line, feed?.locations ?? null))
      .filter((line) => line.shopifyMatch !== "no_product"),
  };
}
