import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildShowcase,
  sameShowcaseFamily,
  showcaseParentName,
  showcaseVariantLabel,
  type ShowcaseCatalogRow,
} from "./showcase.ts";

function row(partial: Partial<ShowcaseCatalogRow> & Pick<ShowcaseCatalogRow, "id" | "name">): ShowcaseCatalogRow {
  return {
    productGroup: "Handmade",
    description: "",
    retailPrice: 38,
    imageUrl: null,
    ...partial,
  };
}

describe("product showcase", () => {
  it("reads the parent product and variant from a catalog name", () => {
    assert.equal(showcaseParentName("Everyday Bowl — Speckle Grey"), "Everyday Bowl");
    assert.equal(showcaseVariantLabel("Everyday Bowl — Speckle Grey"), "Speckle Grey");
    assert.equal(showcaseParentName("Handmade Ceramic Gift Tag - thank you"), "Handmade Ceramic Gift Tag");
    assert.equal(showcaseVariantLabel("Handmade Ceramic Gift Tag - thank you"), "thank you");
    assert.equal(showcaseParentName("Herb Sticks"), "Herb Sticks");
    assert.equal(showcaseVariantLabel("Herb Sticks"), "");
    assert.equal(showcaseParentName("Trinket Dish - Default Title"), "Trinket Dish");
  });

  it("groups catalog variants of one piece, not every product in the type", () => {
    const speckle = row({
      id: 4,
      name: "Everyday Bowl — Speckle Grey",
      description: "Handmade serving bowl with a gloss white interior.",
      imageUrl: "/api/products/4/image?v=speckle.jpg",
    });
    const grit = row({
      id: 5,
      name: "Everyday Bowl — Grit Large",
      retailPrice: 42,
      imageUrl: "/api/products/5/image?v=grit.jpg",
    });
    const flax = row({
      id: 2,
      productGroup: "Flax ceramics",
      name: "Flax Mug — Khaki",
      retailPrice: 18,
      imageUrl: "/api/products/2/image?v=khaki.jpg",
    });
    assert.equal(sameShowcaseFamily(speckle, grit), true);
    assert.equal(sameShowcaseFamily(speckle, flax), false);
    const showcase = buildShowcase(5, [speckle, grit, flax]);
    assert.equal(showcase?.id, 4);
    assert.equal(showcase?.title, "Everyday Bowl");
    assert.equal(showcase?.path, "/showcase/4");
    assert.deepEqual(
      showcase?.variants.map((variant) => [variant.label, variant.price]),
      [
        ["Grit Large", 42],
        ["Speckle Grey", 38],
      ],
    );
    assert.deepEqual(
      showcase?.photos.map((photo) => photo.url),
      ["/api/products/5/image?v=grit.jpg", "/api/products/4/image?v=speckle.jpg"],
    );
  });

  it("keeps a single catalog product as one standard variant", () => {
    const sticks = row({
      id: 9,
      productGroup: "Herb",
      name: "Herb Sticks",
      description: "A bundle of herb sticks for the kitchen.",
      retailPrice: 12,
    });
    const showcase = buildShowcase(9, [sticks]);
    assert.equal(showcase?.title, "Herb Sticks");
    assert.equal(showcase?.description, "A bundle of herb sticks for the kitchen.");
    assert.deepEqual(
      showcase?.variants.map((variant) => [variant.label, variant.price]),
      [["Standard", 12]],
    );
    assert.deepEqual(showcase?.photos, []);
  });

  it("shows every distinct photo, not only the primary", () => {
    const speckle = row({
      id: 4,
      name: "Everyday Bowl — Speckle Grey",
      imageUrl: "/api/products/4/image?v=4-front-lg.jpg",
      photos: [
        { url: "/api/products/4/image?v=4-front-lg.jpg", identity: "https://cdn.shopify.com/bowl-front.jpg" },
        { url: "/api/products/4/image?v=4-detail-lg.jpg", identity: "https://cdn.shopify.com/bowl-detail.jpg" },
        { url: "/api/products/4/image?v=4-table-lg.jpg", identity: "https://cdn.shopify.com/bowl-table.jpg" },
        { url: "/api/products/4/image?v=4-front-again.jpg", identity: "https://cdn.shopify.com/bowl-front.jpg" },
      ],
    });
    const grit = row({
      id: 5,
      name: "Everyday Bowl — Grit Large",
      retailPrice: 42,
      imageUrl: "/api/products/5/image?v=5-grit-lg.jpg",
      photos: [
        { url: "/api/products/5/image?v=5-grit-lg.jpg", identity: "https://cdn.shopify.com/bowl-grit.jpg" },
        { url: "/api/products/5/image?v=5-detail-lg.jpg", identity: "https://cdn.shopify.com/bowl-detail.jpg" },
      ],
    });
    const showcase = buildShowcase(4, [speckle, grit]);
    assert.deepEqual(
      showcase?.photos.map((photo) => photo.url),
      [
        "/api/products/4/image?v=4-front-lg.jpg",
        "/api/products/4/image?v=4-detail-lg.jpg",
        "/api/products/4/image?v=4-table-lg.jpg",
        "/api/products/5/image?v=5-grit-lg.jpg",
      ],
    );
  });
});
