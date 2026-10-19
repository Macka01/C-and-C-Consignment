import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eventsSinceMs,
  isShopifyAbortError,
  lastShopifyCopy,
  shopifyReadMessage,
  shopifyRequestSignal,
  shopifySyncOptions,
  nextPageCursor,
  shouldStopEventPages,
  waitForShopifyPull,
  SHOPIFY_EVENT_OVERLAP_MS,
  SHOPIFY_GRAPHQL_TIMEOUT_MS,
  SHOPIFY_PULL_TIMEOUT_MS,
  SHOPIFY_TIMEOUT_MESSAGE,
} from "./shopify-refresh.ts";

describe("shopify incremental event window", () => {
  it("fetches full history until a successful pull is stored", () => {
    assert.equal(eventsSinceMs(null), null);
    assert.equal(eventsSinceMs(""), null);
    assert.equal(eventsSinceMs("not-a-date"), null);
  });

  it("starts two days before the last pull", () => {
    const now = Date.parse("2026-10-19T00:00:00Z");
    assert.equal(eventsSinceMs("2026-10-19T00:00:00Z", now), now - SHOPIFY_EVENT_OVERLAP_MS);
  });

  it("stops paging once the oldest row on the page is before that window", () => {
    const since = Date.parse("2026-10-17T00:00:00Z");
    assert.equal(shouldStopEventPages("2026-10-16T12:00:00Z", since), true);
    assert.equal(shouldStopEventPages("2026-10-17T12:00:00Z", since), false);
    assert.equal(shouldStopEventPages("2026-10-16T12:00:00Z", null), false);
  });
});

describe("shopify pull timeout", () => {
  it("uses refresh=1 to wait on a new pull", () => {
    assert.deepEqual(shopifySyncOptions(new Request("http://local/api/products")), { wait: false });
    assert.deepEqual(shopifySyncOptions(new Request("http://local/api/products?refresh=1")), { wait: true });
  });

  it("lets refresh wait longer than one GraphQL call", () => {
    assert.equal(SHOPIFY_GRAPHQL_TIMEOUT_MS, 20_000);
    assert.equal(SHOPIFY_PULL_TIMEOUT_MS, 60_000);
    assert.ok(SHOPIFY_PULL_TIMEOUT_MS > SHOPIFY_GRAPHQL_TIMEOUT_MS);
    assert.equal(shopifySyncOptions(new Request("http://local/api/products")).wait, false);
  });

  it("stops when Shopify repeats a page cursor", () => {
    const seen = new Set<string>();
    assert.equal(nextPageCursor(false, "cursor-a", seen), null);
    assert.equal(nextPageCursor(true, "cursor-a", seen), "cursor-a");
    assert.equal(nextPageCursor(true, "cursor-a", seen), null);
    assert.equal(nextPageCursor(true, null, seen), null);
  });

  it("turns a hung Admin API abort into the last-copy message", () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    assert.equal(isShopifyAbortError(timeout), true);
    assert.equal(shopifyReadMessage(timeout), SHOPIFY_TIMEOUT_MESSAGE);
    const abort = new Error("This operation was aborted");
    abort.name = "AbortError";
    assert.equal(shopifyReadMessage(abort), SHOPIFY_TIMEOUT_MESSAGE);
    assert.equal(shopifyReadMessage(new Error("Shopify returned 401.")), "Shopify returned 401.");
  });

  it("serves the last in-memory copy when the wait runs out", () => {
    const cache = {
      feed: { locations: [{ locationId: "gid://shopify/Location/1", locationName: "Love Local", items: [] }], orders: [], transfers: [] },
      error: null,
      warning: null,
    };
    assert.deepEqual(lastShopifyCopy(cache), {
      feed: cache.feed,
      error: SHOPIFY_TIMEOUT_MESSAGE,
      warning: null,
    });
    assert.deepEqual(lastShopifyCopy(undefined), {
      feed: null,
      error: SHOPIFY_TIMEOUT_MESSAGE,
      warning: null,
    });
  });

  it("returns a finished pull before the wait expires", async () => {
    const result = await waitForShopifyPull(
      Promise.resolve({ feed: { ok: true }, error: null, warning: null }),
      () => lastShopifyCopy(undefined),
      50,
    );
    assert.deepEqual(result, { feed: { ok: true }, error: null, warning: null });
  });

  it("returns the last copy while the pull keeps running", async () => {
    let finished = false;
    const inflight = new Promise<{ feed: null; error: string | null; warning: string | null }>((resolve) => {
      setTimeout(() => {
        finished = true;
        resolve({ feed: null, error: null, warning: null });
      }, 80);
    });
    const result = await waitForShopifyPull(inflight, () => lastShopifyCopy(undefined), 15);
    assert.equal(result.error, SHOPIFY_TIMEOUT_MESSAGE);
    assert.equal(finished, false);
    await inflight;
    assert.equal(finished, true);
  });

  it("aborts a GraphQL request when the parent pull times out", () => {
    const parent = new AbortController();
    const signal = shopifyRequestSignal(parent.signal);
    assert.equal(signal.aborted, false);
    parent.abort();
    assert.equal(signal.aborted, true);
  });
});
