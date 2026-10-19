import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeShopifyStatus,
  SHOPIFY_STATUS_CONNECTING,
  SHOPIFY_STATUS_CURRENT,
  SHOPIFY_STATUS_INCOMPLETE,
  SHOPIFY_STATUS_RETRIEVING,
  SHOPIFY_STATUS_SAVED,
  SHOPIFY_STATUS_UNREACHABLE,
  SHOPIFY_STATUS_UNSET,
  type ShopifyActivity,
} from "./shopify-status.ts";

function activity(overrides: Partial<ShopifyActivity> = {}): ShopifyActivity {
  return {
    configured: true,
    inflight: false,
    hasSavedCopy: false,
    error: null,
    warning: null,
    ...overrides,
  };
}

describe("sidebar Shopify status", () => {
  it("says connecting until the first copy arrives", () => {
    assert.equal(describeShopifyStatus(activity({ inflight: true })).message, SHOPIFY_STATUS_CONNECTING);
    assert.equal(describeShopifyStatus(activity()).message, SHOPIFY_STATUS_CONNECTING);
    assert.equal(describeShopifyStatus(activity({ inflight: true })).tone, "pending");
  });

  it("says retrieving while a later pull is in the background", () => {
    const status = describeShopifyStatus(activity({ inflight: true, hasSavedCopy: true }));
    assert.equal(status.message, SHOPIFY_STATUS_RETRIEVING);
    assert.equal(status.tone, "pending");
  });

  it("says the saved copy is up to date after a clean pull", () => {
    const status = describeShopifyStatus(activity({ hasSavedCopy: true }));
    assert.equal(status.message, SHOPIFY_STATUS_CURRENT);
    assert.equal(status.tone, "ok");
    assert.equal(status.detail, null);
  });

  it("says Shopify is not set up when the server has no shop", () => {
    const status = describeShopifyStatus(activity({ configured: false, hasSavedCopy: true, inflight: true }));
    assert.equal(status.message, SHOPIFY_STATUS_UNSET);
    assert.equal(status.tone, "muted");
  });

  it("says Shopify could not be reached when the first pull fails", () => {
    const status = describeShopifyStatus(activity({ error: "Shopify took too long to respond." }));
    assert.equal(status.message, SHOPIFY_STATUS_UNREACHABLE);
    assert.equal(status.tone, "error");
    assert.equal(status.detail, "Shopify took too long to respond.");
  });

  it("keeps the last saved copy visible when a later pull fails", () => {
    const status = describeShopifyStatus(
      activity({ hasSavedCopy: true, error: "Shopify took too long to respond. Showing the last saved copy." }),
    );
    assert.equal(status.message, SHOPIFY_STATUS_SAVED);
    assert.equal(status.tone, "warn");
  });

  it("says some updates could not be read when Shopify returns a warning", () => {
    const status = describeShopifyStatus(activity({ hasSavedCopy: true, warning: "Shopify sales could not be read." }));
    assert.equal(status.message, SHOPIFY_STATUS_INCOMPLETE);
    assert.equal(status.detail, "Shopify sales could not be read.");
    assert.equal(status.tone, "warn");
  });
});
