import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStockListingEmail, listingEmailHref, stockListingEmailFilename } from "./listing-email.ts";
import { buildStockListing } from "./stock-listing.ts";
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
    shopifyQtyOnHand: 1,
    variance: 0,
    shopifyMatch: "matched",
    transferredIn: 0,
    transferredOut: 0,
    sales: 0,
    ...partial,
  };
}

describe("consignment listing Mail draft", () => {
  it("names the .eml from the store and report date", () => {
    assert.equal(
      stockListingEmailFilename("Harbour Linen", "2026-10-19"),
      "consignment-stock-listing-harbour-linen-2026-10-19.eml",
    );
  });

  it("asks the print route for an .eml instead of a mailto link", () => {
    assert.equal(
      listingEmailHref("/api/print/stock-listing?storeId=1"),
      "/api/print/stock-listing?storeId=1&format=eml",
    );
  });

  it("attaches the PDF inside an unsent Mail message", () => {
    const listing = buildStockListing("Love Local", "2026-10-20", [
      line({ productName: "Handmade Ceramic Gift Tag - thank you", quantity: 2 }),
    ]);
    const pdf = Buffer.from("%PDF-1.4 listing");
    const email = buildStockListingEmail(listing, pdf, {
      now: new Date("2026-10-20T08:00:00Z"),
      boundary: "----=_CottonClay_test",
    });
    assert.equal(email.filename, "consignment-stock-listing-love-local-2026-10-20.eml");
    assert.equal(email.mimeType, "message/rfc822");
    assert.match(email.rfc822, /^X-Unsent: 1\r\n/);
    assert.match(email.rfc822, /Subject: Consignment Stock Listing - Love Local/);
    assert.match(email.rfc822, /filename="consignment-stock-listing-love-local-2026-10-20.pdf"/);
    assert.doesNotMatch(email.rfc822, /mailto:/);
    const encoded = email.rfc822
      .split(`filename="${email.filename.replace(/\.eml$/, ".pdf")}"`)[1]
      ?.split("--")[0]
      ?.replace(/\r\n/g, "")
      .trim();
    assert.equal(Buffer.from(encoded ?? "", "base64").toString(), "%PDF-1.4 listing");
  });
});
