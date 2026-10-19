import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eventsSinceMs, shouldStopEventPages, SHOPIFY_EVENT_OVERLAP_MS } from "./shopify-refresh.ts";

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
