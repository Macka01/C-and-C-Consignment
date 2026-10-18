import fs from "node:fs";
import path from "node:path";
import { compareStockToShopify, type ShopifyLocationInventory } from "@/lib/shopify-match";
import { applyShopifyFeed, type ShopifyFeed } from "@/lib/shopify-sync";
import type { ShopifyOrderLine, ShopifyTransferLine } from "@/lib/shopify-match";
import type { ProductDetail, ShopifyStockStatus, StockLine, StoreDetail } from "@/lib/types";

const API_VERSION = "2025-10";
const CACHE_MS = 60_000;

type Cache = {
  key: string;
  at: number;
  feed: ShopifyFeed | null;
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

const TRANSFER_QUERY = `
  query ShopifyTransfers($cursor: String) {
    inventoryTransfers(first: 50, after: $cursor) {
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

async function fetchLocations(): Promise<ShopifyLocationInventory[]> {
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
  return locations;
}

function locationNameById(locations: ShopifyLocationInventory[], id: number | string | null | undefined) {
  if (id === null || id === undefined || id === "") return null;
  const needle = String(id);
  const match = locations.find((location) => location.locationId === needle || location.locationId.endsWith(`/${needle}`));
  return match?.locationName ?? null;
}

async function fetchOrders(locations: ShopifyLocationInventory[]): Promise<ShopifyOrderLine[]> {
  const lines: ShopifyOrderLine[] = [];
  let pageInfo = "";
  for (let page = 0; page < 20; page += 1) {
    const query = pageInfo
      ? `orders.json?limit=250&status=any&page_info=${encodeURIComponent(pageInfo)}`
      : `orders.json?limit=250&status=any`;
    const response = await fetch(`https://${shopDomain()}/admin/api/${API_VERSION}/${query}`, {
      headers: { "X-Shopify-Access-Token": accessToken() },
    });
    if (!response.ok) {
      throw new Error(`Shopify orders returned ${response.status}. Add the read_orders scope.`);
    }
    const body = (await response.json()) as {
      orders?: Array<{
        id: number;
        name: string;
        created_at: string;
        cancelled_at: string | null;
        location_id: number | null;
        line_items: Array<{
          id: number;
          quantity: number;
          price: string;
          sku: string | null;
          name: string;
          variant_id: number | null;
          variant_title: string | null;
          product_id: number | null;
        }>;
      }>;
    };
    for (const order of body.orders ?? []) {
      const locationName = locationNameById(locations, order.location_id);
      for (const item of order.line_items ?? []) {
        if (item.quantity <= 0) continue;
        lines.push({
          id: `gid://shopify/LineItem/${item.id}`,
          orderName: order.name,
          createdAt: order.created_at,
          cancelled: Boolean(order.cancelled_at),
          locationName,
          quantity: item.quantity,
          unitPrice: money(item.price),
          product: {
            variantId: item.variant_id ? `gid://shopify/ProductVariant/${item.variant_id}` : null,
            sku: item.sku,
            name: item.name,
            productGroup: "Shopify",
            description: "",
            retailPrice: money(item.price) ?? 0,
          },
        });
      }
    }
    const link = response.headers.get("link") ?? "";
    const next = link.match(/<[^>]*page_info=([^&>]+)[^>]*>; rel="next"/);
    if (!next) break;
    pageInfo = decodeURIComponent(next[1]);
  }
  return lines;
}

async function fetchTransfers(): Promise<ShopifyTransferLine[]> {
  const lines: ShopifyTransferLine[] = [];
  let cursor: string | null = null;
  do {
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
    cursor = page.inventoryTransfers.pageInfo.hasNextPage ? page.inventoryTransfers.pageInfo.endCursor : null;
  } while (cursor);
  return lines;
}

async function fetchShopifyFeed(): Promise<ShopifyFeed> {
  const mock = mockPath();
  if (mock) {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(mock), "utf8")) as ShopifyFeed;
    return {
      locations: parsed.locations ?? [],
      orders: parsed.orders ?? [],
      transfers: parsed.transfers ?? [],
    };
  }

  const locations = await fetchLocations();
  const errors: string[] = [];
  let orders: ShopifyOrderLine[] = [];
  let transfers: ShopifyTransferLine[] = [];
  try {
    orders = await fetchOrders(locations);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Shopify orders could not be read.");
  }
  try {
    transfers = await fetchTransfers();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Shopify transfers could not be read.");
  }
  if (errors.length && orders.length === 0 && transfers.length === 0 && locations.length === 0) {
    throw new Error(errors.join(" "));
  }
  if (errors.length) {
    const feed = { locations, orders, transfers };
    (feed as ShopifyFeed & { warning?: string }).warning = errors.join(" ");
    return feed;
  }
  return { locations, orders, transfers };
}

async function loadFeed(): Promise<{ feed: ShopifyFeed | null; error: string | null }> {
  if (!shopifyConfigured()) {
    return { feed: null, error: null };
  }
  const key = cacheKey();
  const existing = globalForShopify.consignmentShopify;
  if (existing && existing.key === key && Date.now() - existing.at < CACHE_MS) {
    return { feed: existing.feed, error: existing.error };
  }
  try {
    const feed = await fetchShopifyFeed();
    const warning = (feed as ShopifyFeed & { warning?: string }).warning ?? null;
    globalForShopify.consignmentShopify = { key, at: Date.now(), feed, error: warning };
    return { feed, error: warning };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shopify could not be read.";
    globalForShopify.consignmentShopify = { key, at: Date.now(), feed: null, error: message };
    return { feed: null, error: message };
  }
}

function attachLine(line: StockLine, locations: ShopifyLocationInventory[] | null): StockLine {
  return { ...line, ...compareStockToShopify(line, locations) };
}

export async function syncFromShopify(): Promise<ShopifyStockStatus> {
  const { feed, error } = await loadFeed();
  if (feed) {
    applyShopifyFeed(feed);
  }
  return { configured: shopifyConfigured(), error };
}

export async function withShopifyStock<T extends StoreDetail | ProductDetail>(load: () => T): Promise<T> {
  const shopify = await syncFromShopify();
  const { feed } = await loadFeed();
  const detail = load();
  return {
    ...detail,
    shopify,
    stock: detail.stock.map((line) => attachLine(line, feed?.locations ?? null)),
  };
}
