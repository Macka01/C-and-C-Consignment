import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { uniqueProductImageJobs } from "./shopify-image-cache.ts";
import {
  collectShopifyImageUrls,
  extensionForImageMime,
  isShowcaseImageFile,
  localProductImageName,
  publicProductImageUrl,
  shopifyImageIdentity,
  shopifyMasterImageUrl,
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
    assert.equal(isShowcaseImageFile(first), false);
    const gallery = localProductImageName(9, "https://cdn.shopify.com/mug.jpg?v=1|lg", "jpg", "gallery");
    assert.match(gallery, /^9-[a-f0-9]+-lg\.jpg$/);
    assert.equal(isShowcaseImageFile(gallery), true);
    assert.notEqual(first, gallery);
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

  it("asks Shopify’s CDN for a fullscreen photo without keeping the thumbnail width", () => {
    const original = "https://cdn.shopify.com/s/files/1/2038/9473/products/IMG_6374.jpg?v=1604455621";
    assert.equal(
      shopifyMasterImageUrl(original),
      "https://cdn.shopify.com/s/files/1/2038/9473/products/IMG_6374.jpg?v=1604455621&width=2048",
    );
    assert.equal(
      shopifyMasterImageUrl(`${original}&width=480`),
      "https://cdn.shopify.com/s/files/1/2038/9473/products/IMG_6374.jpg?v=1604455621&width=2048",
    );
    assert.equal(
      shopifyMasterImageUrl("https://cdn.shopify.com/s/files/1/2038/9473/products/IMG_6374_480x480.jpg?v=1604455621"),
      "https://cdn.shopify.com/s/files/1/2038/9473/products/IMG_6374.jpg?v=1604455621&width=2048",
    );
    assert.equal(
      shopifyImageIdentity(`${original}&width=480`),
      shopifyImageIdentity(original),
    );
    assert.equal(
      shopifyImageIdentity("https://cdn.shopify.com/s/files/1/2038/9473/products/IMG_6374_480x480.jpg?v=1604455621"),
      shopifyImageIdentity(original),
    );
    assert.deepEqual(collectShopifyImageUrls([original, `${original}&width=480`, null, "https://cdn.shopify.com/other.jpg"]), [
      original,
      "https://cdn.shopify.com/other.jpg",
    ]);
  });

  it("keeps every distinct photo for a product, not only the last URL", () => {
    assert.deepEqual(
      uniqueProductImageJobs([
        { productId: 9, url: "https://cdn.shopify.com/a.jpg", kind: "gallery" },
        { productId: 9, url: "https://cdn.shopify.com/a.jpg?width=480", kind: "gallery" },
        { productId: 9, url: "https://cdn.shopify.com/b.jpg", kind: "gallery" },
        { productId: 9, url: "https://cdn.shopify.com/a.jpg", kind: "thumb" },
      ]),
      [
        { productId: 9, url: "https://cdn.shopify.com/a.jpg", kind: "gallery" },
        { productId: 9, url: "https://cdn.shopify.com/b.jpg", kind: "gallery" },
        { productId: 9, url: "https://cdn.shopify.com/a.jpg", kind: "thumb" },
      ],
    );
  });

  it("picks an extension from the content type", () => {
    assert.equal(extensionForImageMime("image/webp", "https://cdn.shopify.com/x"), "webp");
    assert.equal(extensionForImageMime("image/jpeg; charset=binary", "https://cdn.shopify.com/x.png"), "jpg");
  });
});
