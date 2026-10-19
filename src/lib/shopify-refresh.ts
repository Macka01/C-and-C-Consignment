export type ShopifySyncOptions = { wait?: boolean };

export function shopifySyncOptions(request: Request): ShopifySyncOptions {
  return { wait: new URL(request.url).searchParams.get("refresh") === "1" };
}

/** First page after a restart returns the last SQLite copy instead of waiting forever. */
export const SHOPIFY_PULL_WAIT_MS = 15_000;
/** Refresh waits longer, but the Admin API read still has a hard stop. */
export const SHOPIFY_PULL_TIMEOUT_MS = 60_000;
/** One hung GraphQL request must not block the rest of the pull. */
export const SHOPIFY_GRAPHQL_TIMEOUT_MS = 20_000;
export const SHOPIFY_TIMEOUT_MESSAGE = "Shopify took too long to respond. Showing the last saved copy.";

export const SHOPIFY_EVENT_OVERLAP_MS = 2 * 24 * 60 * 60 * 1000;

export function isShopifyAbortError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return name === "AbortError" || name === "TimeoutError" || /aborted due to timeout/i.test(message);
}

export function shopifyReadMessage(error: unknown) {
  if (isShopifyAbortError(error)) return SHOPIFY_TIMEOUT_MESSAGE;
  return error instanceof Error ? error.message : "Shopify could not be read.";
}

export function lastShopifyCopy<T extends { feed: unknown; error: string | null; warning: string | null }>(
  cache: T | null | undefined,
): { feed: T["feed"] | null; error: string | null; warning: string | null } {
  return {
    feed: cache?.feed ?? null,
    error: SHOPIFY_TIMEOUT_MESSAGE,
    warning: cache?.warning ?? null,
  };
}

export function shopifyRequestSignal(parent?: AbortSignal) {
  const timeout = AbortSignal.timeout(SHOPIFY_GRAPHQL_TIMEOUT_MS);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

/** Wait for a pull, or return the last copy when the clock runs out. The pull itself keeps going. */
export async function waitForShopifyPull<T>(
  inflight: Promise<T>,
  onTimeout: () => T,
  timeoutMs = SHOPIFY_PULL_WAIT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      inflight,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Last successful pull, minus overlap, so we do not miss a late fulfillment. Null means fetch history. */
export function eventsSinceMs(
  lastSyncIso: string | null | undefined,
  nowMs = Date.now(),
  overlapMs = SHOPIFY_EVENT_OVERLAP_MS,
) {
  if (!lastSyncIso) return null;
  const t = Date.parse(lastSyncIso);
  if (!Number.isFinite(t)) return null;
  return Math.min(t, nowMs) - overlapMs;
}

/** Orders and transfers are newest-first. Stop when the oldest row on the page is already before the overlap window. */
export function shouldStopEventPages(oldestOnPageIso: string | null | undefined, sinceMs: number | null) {
  if (sinceMs == null || !oldestOnPageIso) return false;
  const t = Date.parse(oldestOnPageIso);
  return Number.isFinite(t) && t < sinceMs;
}
