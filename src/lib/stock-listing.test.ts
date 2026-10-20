import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStockListing,
  calendarDateInSydney,
  pdfSafeText,
  stockListingFilename,
  wrapLines,
} from "./stock-listing.ts";
import type { StockLine } from "./types.ts";

function line(partial: Partial<StockLine> & Pick<StockLine, "productName" | "quantity">): StockLine {
  return {
    id: 1,
    storeId: 1,
    productId: 1,
    consigneeCode: "HLB-MUG-KH",
    productGroup: "Flax ceramics",
    description: "Matte flax mug.",
    retailPrice: 18,
    imageUrl: null,
    shopifyQtyOnHand: null,
    variance: null,
    shopifyMatch: "matched",
    transferredIn: 0,
    transferredOut: 0,
    sales: 0,
    ...partial,
  };
}

describe("consignment stock listing", () => {
  it("uses Shopify on hand when present and totals quantity", () => {
    const listing = buildStockListing("Harbour Linen", "2026-10-19", [
      line({ productName: "Flax Mug — Khaki", quantity: 5, shopifyQtyOnHand: 8 }),
      line({
        productName: "Flax Serve Bowl — Duck Egg",
        quantity: 10,
        description: "Irregular flax serve bowl.",
        consigneeCode: "HLB-BOWL-DE",
        retailPrice: 15,
      }),
    ]);
    assert.equal(listing.title, "Consignment Stock Listing");
    assert.equal(listing.storeName, "Harbour Linen");
    assert.equal(listing.reportDate, "19 Oct 2026");
    assert.equal(listing.groups.length, 1);
    assert.equal(listing.groups[0]?.group, "Flax ceramics");
    assert.equal(listing.rows[0]?.productName, "Flax Mug - Khaki");
    assert.equal(listing.rows[0]?.consigneeCode, "HLB-MUG-KH");
    assert.equal(listing.rows[0]?.quantityOnHand, 8);
    assert.equal(listing.rows[1]?.quantityOnHand, 10);
    assert.equal(listing.totalQuantity, 18);
    assert.equal("description" in listing.rows[0]!, false);
  });

  it("sits products under their Shopify product type", () => {
    const listing = buildStockListing("Harbour Linen", "2026-10-19", [
      line({ productName: "Everyday Bowl — Speckle Grey", productGroup: "Handmade", quantity: 5 }),
      line({ productName: "Flax Mug — Khaki", productGroup: "Flax ceramics", quantity: 3, shopifyQtyOnHand: 3 }),
      line({ productName: "Loose stem", productGroup: "", quantity: 1 }),
      line({ productName: "Flax Serve Bowl — Duck Egg", productGroup: "Flax ceramics", quantity: 2 }),
    ]);
    assert.deepEqual(
      listing.groups.map((section) => [section.group, section.rows.map((row) => row.productName)]),
      [
        ["Flax ceramics", ["Flax Mug - Khaki", "Flax Serve Bowl - Duck Egg"]],
        ["Handmade", ["Everyday Bowl - Speckle Grey"]],
        ["", ["Loose stem"]],
      ],
    );
  });

  it("leaves consignee code blank when none was saved", () => {
    const listing = buildStockListing("Love Local", "2026-10-19", [
      line({ productName: "Cheese Sticks", quantity: 2, consigneeCode: "" }),
    ]);
    assert.equal(listing.rows[0]?.consigneeCode, "");
  });

  it("strips characters Helvetica cannot print", () => {
    assert.equal(pdfSafeText("Flax Mug — Khaki"), "Flax Mug - Khaki");
    assert.equal(pdfSafeText("smart ‘quotes’"), "smart 'quotes'");
    assert.equal(pdfSafeText("bowl 🪵"), "bowl ");
  });

  it("names the PDF from the store and the report date", () => {
    assert.equal(
      stockListingFilename("Harbour Linen", "2026-10-19"),
      "consignment-stock-listing-harbour-linen-2026-10-19.pdf",
    );
  });

  it("wraps words and long codes to the column width", () => {
    const widthOf = (value: string) => value.length;
    assert.deepEqual(wrapLines("Flax Mug Khaki", widthOf, 8), ["Flax Mug", "Khaki"]);
    assert.deepEqual(wrapLines("HLB-BOWL-DE", widthOf, 6), ["HLB-BO", "WL-DE"]);
  });

  it("formats a Sydney calendar date as YYYY-MM-DD", () => {
    assert.match(calendarDateInSydney(new Date("2026-10-19T03:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
  });
});
