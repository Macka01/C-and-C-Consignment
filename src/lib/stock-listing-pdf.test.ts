import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inflateSync } from "node:zlib";
import { buildStockListing } from "./stock-listing.ts";
import { buildStockListingPdf } from "./stock-listing-pdf.ts";
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

function pdfPlacements(bytes: Buffer) {
  const placements: Array<{ text: string; size: number; y: number }> = [];
  let index = 0;
  while (index >= 0) {
    const start = bytes.indexOf("stream\n", index);
    if (start < 0) break;
    const dataStart = start + 7;
    const end = bytes.indexOf("endstream", dataStart);
    let chunk = bytes.subarray(dataStart, end);
    if (chunk.at(-1) === 10) chunk = chunk.subarray(0, -1);
    index = end + 9;
    if (chunk[0] !== 0x78 || chunk.length > 50_000) continue;
    let decoded: Buffer;
    try {
      decoded = inflateSync(chunk);
    } catch {
      continue;
    }
    const body = decoded.toString("latin1");
    if (!body.includes("BT")) continue;
    for (const match of body.matchAll(
      /\/Helvetica(?:-Bold)?-\d+ ([\d.]+) Tf[\s\S]*?1 0 0 1 [\d.]+ ([\d.]+) Tm\n<([0-9A-Fa-f]+)> Tj/g,
    )) {
      placements.push({
        size: Number(match[1]),
        y: Number(match[2]),
        text: Buffer.from(match[3], "hex").toString("latin1"),
      });
    }
  }
  return placements;
}

function pdfStrings(bytes: Buffer) {
  return pdfPlacements(bytes).map((placement) => placement.text);
}

describe("consignment stock listing PDF", () => {
  it("repeats column headings on every page", async () => {
    const stock = Array.from({ length: 80 }, (_, index) =>
      line({
        productName: `Flax Mug ${String(index + 1).padStart(2, "0")}`,
        quantity: 1,
        shopifyQtyOnHand: 1,
      }),
    );
    const listing = buildStockListing("Harbour Linen", "2026-10-19", stock);
    const pdf = await buildStockListingPdf(listing);
    const strings = pdfStrings(Buffer.from(pdf));
    const pageMarks = strings.filter((value) => /^Page \d+ of \d+$/.test(value));
    assert.ok(pageMarks.length >= 2, `expected more than one page, got ${pageMarks.join(", ") || "none"}`);
    assert.equal(strings.filter((value) => value === "Product Name").length, pageMarks.length);
    assert.equal(strings.filter((value) => value === "Consignee Product Code").length, pageMarks.length);
    assert.equal(strings.filter((value) => value === "Product Price").length, pageMarks.length);
    assert.equal(strings.filter((value) => value === "Quantity on Hand").length, pageMarks.length);
    assert.ok(!strings.includes("Description"));
  });

  it("keeps a gap between product types without dropping later-page headings", async () => {
    const stock = [
      ...Array.from({ length: 3 }, (_, index) =>
        line({
          productName: `Ceramic Gift Tag ${index + 1}`,
          productGroup: "Handmade Ceramics",
          quantity: 1,
          shopifyQtyOnHand: 1,
        }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        line({
          productName: `Flax Mug ${index + 1}`,
          productGroup: "Tableware - Flax",
          quantity: 2,
          shopifyQtyOnHand: 2,
        }),
      ),
    ];
    const listing = buildStockListing("Love Local", "2026-10-20", stock);
    const pdf = await buildStockListingPdf(listing);
    const placements = pdfPlacements(Buffer.from(pdf));
    const strings = placements.map((placement) => placement.text);
    const brand = placements.find((placement) => placement.text === "Cotton & Clay");
    const lastCeramic = placements.findLast((placement) => placement.text.startsWith("Ceramic Gift Tag"));
    const nextType = placements.find((placement) => placement.text === "Tableware - Flax");
    assert.equal(brand?.size, 28);
    assert.ok(lastCeramic && nextType, "expected both product types in the PDF");
    assert.ok(
      lastCeramic.y - nextType.y >= 24,
      `type heading sat too close to the previous product (${lastCeramic.y} then ${nextType.y})`,
    );
    assert.ok(strings.includes("Handmade Ceramics"));
    assert.equal(
      strings.filter((value) => value === "Product Name").length,
      strings.filter((value) => /^Page \d+ of \d+$/.test(value)).length,
    );
  });
});
