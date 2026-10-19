export type ShopifySyncOptions = { wait?: boolean };

export function shopifySyncOptions(request: Request): ShopifySyncOptions {
  return { wait: new URL(request.url).searchParams.get("refresh") === "1" };
}

export const SHOPIFY_EVENT_OVERLAP_MS = 2 * 24 * 60 * 60 * 1000;

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
