import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extensionForImageMime,
  localProductImageName,
  publicProductImageUrl,
  shopifySizedImageUrl,
  shouldFetchProductImage,
} from "./shopify-product-image.ts";

describe("shopify product image cache", () => {
  it("does not fetch when the Shopify URL is unchanged and the file is on disk", () => {
    const url = "https://cdn.shopify.com/s/files/1/mug.jpg?v=12";
    assert.equal(shouldFetchProductImage(url, "9-abc.jpg", true, url), false);
  });

  it("fetches when the photo is new, the URL changed, or the file is missing", () => {
    const url = "https://cdn.shopify.com/s/files/1/mug.jpg?v=12";
    assert.equal(shouldFetchProductImage(null, null, false, url), true);
    assert.equal(shouldFetchProductImage(url, "9-abc.jpg", false, url), true);
    assert.equal(shouldFetchProductImage(url, "9-abc.jpg", true, "https://cdn.shopify.com/s/files/1/mug.jpg?v=13"), true);
    assert.equal(shouldFetchProductImage(null, null, false, ""), false);
  });

  it("names the local file from the product and the Shopify URL", () => {
    const first = localProductImageName(9, "https://cdn.shopify.com/mug.jpg?v=1", "jpg");
    const same = localProductImageName(9, "https://cdn.shopify.com/mug.jpg?v=1", "jpg");
    const changed = localProductImageName(9, "https://cdn.shopify.com/mug.jpg?v=2", "jpg");
    assert.equal(first, same);
    assert.notEqual(first, changed);
    assert.match(first, /^9-[a-f0-9]+\.jpg$/);
    assert.equal(publicProductImageUrl(9, first), `/api/products/9/image?v=${encodeURIComponent(first)}`);
  });

  it("asks Shopify’s CDN for a listing-sized photo", () => {
    const original = "https://cdn.shopify.com/s/files/1/2038/9473/products/IMG_6374.jpg?v=1604455621";
    assert.equal(
      shopifySizedImageUrl(original),
      "https://cdn.shopify.com/s/files/1/2038/9473/products/IMG_6374.jpg?v=1604455621&width=480",
    );
    assert.equal(shopifySizedImageUrl(`${original}&width=200`), `${original}&width=200`);
    assert.equal(shopifySizedImageUrl(""), "");
  });

  it("picks an extension from the content type", () => {
    assert.equal(extensionForImageMime("image/webp", "https://cdn.shopify.com/x"), "webp");
    assert.equal(extensionForImageMime("image/jpeg; charset=binary", "https://cdn.shopify.com/x.png"), "jpg");
  });
});
