import fs from "node:fs";
import path from "node:path";
import { getAppMeta, setAppMeta } from "@/lib/app-meta";
import {
  compareStockToShopify,
  locationNameFromOrder,
  shopifyCatalogName,
  shopifyProductGroup,
  shopifyProductName,
  stockLineOnShelf,
  type ShopifyLocationInventory,
} from "@/lib/shopify-match";
import { collectShopifyImageUrls } from "@/lib/shopify-product-image";
import {
  eventsSinceMs,
  lastShopifyCopy,
  nextPageCursor,
  shopifyReadMessage,
  shopifyRequestSignal,
  shouldStopEventPages,
  waitForShopifyPull,
  SHOPIFY_PULL_TIMEOUT_MS,
  type ShopifySyncOptions,
} from "@/lib/shopify-refresh";
import { listShopifyCatalogVariants, listShopifyProductsMissingImages } from "@/lib/data";
import { cacheShopifyProductImages, type ProductImageJob } from "@/lib/shopify-image-cache";
import { applyShopifyFeed, type ShopifyFeed } from "@/lib/shopify-sync";
import type { ShopifyOrderLine, ShopifyTransferLine } from "@/lib/shopify-match";
import type { ShopifyActivity } from "@/lib/shopify-status";
import type { ProductDetail, ShopifyStockStatus, StockLine, StoreDetail } from "@/lib/types";

const API_VERSION = "2025-10";
const FRESH_MS = 5 * 60 * 1000;
const EVENTS_SYNCED_KEY = "shopify_events_synced_at";
const FULL_EVENT_PAGES = 20;
const INCREMENTAL_EVENT_PAGES = 5;
const LOCATION_PAGES = 10;
const LEVEL_PAGES = 40;

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
  savedCopy?: boolean;
};

const globalForShopify = globalThis as unknown as { consignmentShopify?: ShopifyRuntime };

function shopifyState(): ShopifyRuntime {
  if (!globalForShopify.consignmentShopify) {
    globalForShopify.consignmentShopify = {};
  }
  return globalForShopify.consignmentShopify;
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

type GraphqlImage = { url: string | null } | null;

type GraphqlVariant = {
  id: string | null;
  title: string | null;
  displayName: string | null;
  sku: string | null;
  price: string | null;
  image: GraphqlImage;
  product: {
    title: string;
    productType: string | null;
    description: string | null;
    featuredImage: GraphqlImage;
  } | null;
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
  image { url }
  product { title productType description featuredImage { url } }
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
              ${VARIANT_FIELDS}
            }
          }
        }
      }
    }
  }
`;

const TRANSFER_QUERY = `
  query ShopifyTransfers($cursor: String) {
    inventoryTransfers(first: 50, after: $cursor, sortKey: CREATED_AT, reverse: true) {
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

function shopifyImageUrl(variant: { image?: GraphqlImage; product?: { featuredImage?: GraphqlImage } | null } | undefined) {
  return variant?.image?.url?.trim() || variant?.product?.featuredImage?.url?.trim() || null;
}

const VARIANT_IMAGES_QUERY = `
  query VariantImages($ids: [ID!]!) {
    nodes(ids: $ids) {
      id
      ... on ProductVariant {
        image { url }
        product {
          featuredImage { url }
          media(first: 50) {
            nodes {
              ... on MediaImage { image { url } }
            }
          }
        }
      }
    }
  }
`;

type VariantGalleryNode = {
  id?: string | null;
  image?: GraphqlImage;
  product?: {
    featuredImage?: GraphqlImage;
    media?: { nodes?: Array<{ image?: GraphqlImage } | null> | null } | null;
  } | null;
};

function galleryUrlsFromVariant(node: VariantGalleryNode) {
  return collectShopifyImageUrls([
    node.image?.url,
    node.product?.featuredImage?.url,
    ...(node.product?.media?.nodes ?? []).map((media) => media?.image?.url),
  ]);
}

/** All Shopify photos for catalog variants: variant image, product gallery, and media. */
async function fetchProductGalleries(thumbProductIds: Set<number>) {
  const rows = listShopifyCatalogVariants();
  const missingThumbs = new Set(listShopifyProductsMissingImages().map((row) => row.id));
  const jobs: Array<{ productId: number; url: string; kind: "thumb" | "gallery" }> = [];
  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    const data = await shopifyGraphql<{ nodes: Array<VariantGalleryNode | null> }>(VARIANT_IMAGES_QUERY, {
      ids: batch.map((row) => row.variantId),
    });
    const byVariant = new Map(batch.map((row) => [row.variantId, row.id]));
    for (const node of data.nodes ?? []) {
      if (!node?.id) continue;
      const productId = byVariant.get(node.id);
      if (!productId) continue;
      const urls = galleryUrlsFromVariant(node);
      for (const url of urls) {
        jobs.push({ productId, url, kind: "gallery" });
      }
      const thumb = urls[0] ?? shopifyImageUrl(node);
      if (thumb && !thumbProductIds.has(productId) && missingThumbs.has(productId)) {
        jobs.push({ productId, url: thumb, kind: "thumb" });
      }
    }
  }
  return jobs;
}

function refFromVariant(variant: GraphqlVariant | undefined, sku: string | null) {
  return {
    variantId: variant?.id ?? null,
    sku: sku ?? variant?.sku ?? null,
    name: shopifyCatalogName(
      shopifyProductName({
        title: variant?.product?.title,
        variantTitle: variant?.title,
        displayName: variant?.displayName,
      }),
      sku ?? variant?.sku,
    ),
    productGroup: shopifyProductGroup(variant?.product?.productType),
    description: variant?.product?.description?.trim() || "",
    retailPrice: money(variant?.price) ?? 0,
    imageUrl: shopifyImageUrl(variant),
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
      imageUrl: shopifyImageUrl(variant),
    });
  }
  return items;
}

async function shopifyGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  try {
    const response = await fetch(`https://${shopDomain()}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken(),
      },
      body: JSON.stringify({ query, variables }),
      signal: shopifyRequestSignal(signal),
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
  } catch (error) {
    throw new Error(shopifyReadMessage(error));
  }
}

async function loadLocationLevels(location: GraphqlLocation, signal?: AbortSignal): Promise<ShopifyLocationInventory> {
  const items = itemsFromLevels(location.inventoryLevels.nodes);
  const seen = new Set<string>();
  let cursor = nextPageCursor(
    location.inventoryLevels.pageInfo.hasNextPage,
    location.inventoryLevels.pageInfo.endCursor,
    seen,
  );
  for (let pageIndex = 0; cursor && pageIndex < LEVEL_PAGES; pageIndex += 1) {
    const extra = await shopifyGraphql<{ location: GraphqlLocation | null }>(
      LEVELS_QUERY,
      { id: location.id, cursor },
      signal,
    );
    const page = extra.location?.inventoryLevels;
    if (!page) break;
    items.push(...itemsFromLevels(page.nodes));
    cursor = nextPageCursor(page.pageInfo.hasNextPage, page.pageInfo.endCursor, seen);
  }
  return { locationId: location.id, locationName: location.name, items };
}

async function fetchLocations(signal?: AbortSignal): Promise<ShopifyLocationInventory[]> {
  const locations: ShopifyLocationInventory[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let pageIndex = 0; pageIndex < LOCATION_PAGES; pageIndex += 1) {
    const page: {
      locations: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GraphqlLocation[] };
    } = await shopifyGraphql(LOCATION_QUERY, { cursor }, signal);
    locations.push(...(await Promise.all(page.locations.nodes.map((node) => loadLocationLevels(node, signal)))));
    cursor = nextPageCursor(page.locations.pageInfo.hasNextPage, page.locations.pageInfo.endCursor, seen);
    if (!cursor) break;
  }
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

async function tokenScopes(signal?: AbortSignal): Promise<string[]> {
  try {
    const data: { currentAppInstallation: { accessScopes: Array<{ handle: string }> } } = await shopifyGraphql(
      SCOPES_QUERY,
      {},
      signal,
    );
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

async function fetchOrders(sinceMs: number | null, signal?: AbortSignal): Promise<ShopifyOrderLine[]> {
  const lines: ShopifyOrderLine[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  const maxPages = sinceMs == null ? FULL_EVENT_PAGES : INCREMENTAL_EVENT_PAGES;
  try {
    for (let page = 0; page < maxPages; page += 1) {
      const data: OrdersPage = await shopifyGraphql(ORDERS_QUERY, { cursor }, signal);
      if (!data.orders) {
        throw new Error("Shopify returned no orders.");
      }
      for (const order of data.orders.nodes) {
        const locationName = locationNameFromOrder(order);
        for (const item of order.lineItems.nodes) {
          if (item.quantity <= 0) continue;
          const variant = item.variant ?? undefined;
          const unitPrice = money(item.originalUnitPriceSet?.shopMoney?.amount) ?? money(variant?.price);
          const product = refFromVariant(variant, item.sku);
          lines.push({
            id: item.id,
            orderName: order.name,
            createdAt: order.createdAt,
            cancelled: Boolean(order.cancelledAt),
            locationName,
            quantity: item.quantity,
            unitPrice,
            product: {
              ...product,
              name: shopifyProductName({
                title: variant?.product?.title,
                variantTitle: variant?.title,
                displayName: item.name || variant?.displayName,
              }) || product.name,
              retailPrice: unitPrice ?? product.retailPrice,
            },
          });
        }
      }
      if (!data.orders.pageInfo.hasNextPage) break;
      const oldest = data.orders.nodes.at(-1)?.createdAt;
      if (shouldStopEventPages(oldest, sinceMs)) break;
      cursor = nextPageCursor(true, data.orders.pageInfo.endCursor, seen);
      if (!cursor) break;
    }
    return lines;
  } catch (error) {
    const shopifyText = error instanceof Error ? error.message : "Shopify sales could not be read.";
    throw new Error(explainOrdersError(shopifyText, await tokenScopes(signal)));
  }
}

async function fetchTransfers(sinceMs: number | null, signal?: AbortSignal): Promise<ShopifyTransferLine[]> {
  const lines: ShopifyTransferLine[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
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
    const page: TransferPage = await shopifyGraphql(TRANSFER_QUERY, { cursor }, signal);
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
    cursor = nextPageCursor(true, page.inventoryTransfers.pageInfo.endCursor, seen);
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
  const pull = AbortSignal.timeout(SHOPIFY_PULL_TIMEOUT_MS);
  const [locations, orders, transfers] = await Promise.all([
    fetchLocations(pull),
    fetchOrders(sinceMs, pull).catch((error) => {
      warnings.push(error instanceof Error ? error.message : "Shopify sales could not be read.");
      return [] as ShopifyOrderLine[];
    }),
    fetchTransfers(sinceMs, pull).catch((error) => {
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
    if (feed) {
      const applied = applyShopifyFeed(feed);
      state.savedCopy = true;
      let images: ProductImageJob[] = applied.images.map((job) => ({ ...job, kind: "thumb" as const }));
      if (!mockPath()) {
        try {
          const extra = await fetchProductGalleries(new Set(images.map((job) => job.productId)));
          images = [...images, ...extra];
        } catch {
          // Stock is already saved. The next pull tries the missing photos again.
        }
      }
      await cacheShopifyProductImages(images);
    }
    const result: FeedResult = { feed, error: null, warning };
    state.cache = { key, at: Date.now(), ...result };
    return result;
  } catch (error) {
    const message = shopifyReadMessage(error);
    const result: FeedResult = { feed: null, error: message, warning: null };
    state.cache = { key, at: Date.now(), ...result };
    return result;
  }
}

function ensureInflight(state: ShopifyRuntime, key: string) {
  if (state.inflight && state.inflightKey === key) return state.inflight;
  const inflight = refreshFeed(key).finally(() => {
    if (state.inflightKey === key) {
      state.inflight = undefined;
      state.inflightKey = undefined;
    }
  });
  state.inflightKey = key;
  state.inflight = inflight;
  return inflight;
}

async function loadFeed(options?: ShopifySyncOptions): Promise<FeedResult> {
  if (!shopifyConfigured()) {
    return emptyFeedResult();
  }
  const key = cacheKey();
  const state = shopifyState();
  const cache = state.cache?.key === key ? state.cache : undefined;
  const fresh = Boolean(cache && Date.now() - cache.at < FRESH_MS);
  if (fresh && cache && !options?.wait) {
    return snapshot(cache);
  }
  const inflight = ensureInflight(state, key);
  // Opening a page serves SQLite (and a finished in-memory copy) immediately.
  // The pull keeps going in the background. Refresh is the path that waits.
  if (!options?.wait) {
    return cache ? snapshot(cache) : emptyFeedResult();
  }
  return waitForShopifyPull(
    inflight,
    () => lastShopifyCopy(state.cache?.key === key ? state.cache : undefined),
    SHOPIFY_PULL_TIMEOUT_MS,
  );
}

function attachLine(line: StockLine, locations: ShopifyLocationInventory[] | null): StockLine {
  return { ...line, ...compareStockToShopify(line, locations) };
}

function hasSavedShopifyCopy(state: ShopifyRuntime, cache: Cache | undefined) {
  if (state.savedCopy || cache?.feed) {
    state.savedCopy = true;
    return true;
  }
  if (getAppMeta(EVENTS_SYNCED_KEY)) {
    state.savedCopy = true;
    return true;
  }
  return false;
}

/** Start a background pull when the copy is stale, then report what the sidebar should say. */
export async function readShopifyActivity(): Promise<ShopifyActivity> {
  if (!shopifyConfigured()) {
    return { configured: false, inflight: false, hasSavedCopy: false, error: null, warning: null };
  }
  const result = await loadFeed();
  const state = shopifyState();
  const key = cacheKey();
  const cache = state.cache?.key === key ? state.cache : undefined;
  return {
    configured: true,
    inflight: Boolean(state.inflight),
    hasSavedCopy: hasSavedShopifyCopy(state, cache),
    error: state.inflight ? null : result.error,
    warning: state.inflight ? null : result.warning,
  };
}

export async function syncFromShopify(options?: ShopifySyncOptions): Promise<ShopifyStockStatus> {
  const { error, warning } = await loadFeed(options);
  return { configured: shopifyConfigured(), error, warning };
}

export async function withShopifyStock<T extends StoreDetail | ProductDetail>(
  load: () => T,
  options?: ShopifySyncOptions,
): Promise<T> {
  const { feed, error, warning } = await loadFeed(options);
  const detail = load();
  return {
    ...detail,
    shopify: { configured: shopifyConfigured(), error, warning },
    stock: detail.stock
      .map((line) => attachLine(line, feed?.locations ?? null))
      .filter((line) => stockLineOnShelf(line)), // store_stock.quantity > 0 or a sale/transfer; leftover qty-0 rows stay off
  };
}
