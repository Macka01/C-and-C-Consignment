import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filenameFromDisposition, isShareCancel, trySharePdf } from "./share-pdf.ts";

describe("PDF share helpers", () => {
  it("reads the filename from a Content-Disposition header", () => {
    assert.equal(
      filenameFromDisposition('inline; filename="consignment-stock-listing-harbour-linen-2026-10-19.pdf"'),
      "consignment-stock-listing-harbour-linen-2026-10-19.pdf",
    );
    assert.equal(
      filenameFromDisposition("attachment; filename*=UTF-8''Love%20Local.pdf"),
      "Love Local.pdf",
    );
    assert.equal(filenameFromDisposition(null), null);
  });

  it("treats a cancelled share sheet as a cancel, not a failure", () => {
    assert.equal(isShareCancel(new DOMException("The operation was aborted.", "AbortError")), true);
    assert.equal(isShareCancel(new Error("network")), false);
  });

  it("shares a PDF when the device share sheet accepts files", async () => {
    const file = new File(["pdf"], "listing.pdf", { type: "application/pdf" });
    const calls: unknown[] = [];
    const result = await trySharePdf(file, "Consignment Stock Listing", async (data) => {
      calls.push(data);
    });
    assert.equal(result, "shared");
    assert.equal((calls[0] as { title: string }).title, "Consignment Stock Listing");
  });

  it("falls back when share is missing or rejects files", async () => {
    const file = new File(["pdf"], "listing.pdf", { type: "application/pdf" });
    assert.equal(await trySharePdf(file, "Consignment Stock Listing", undefined), "unsupported");
    assert.equal(
      await trySharePdf(file, "Consignment Stock Listing", async () => {
        throw new Error("files are not allowed");
      }),
      "unsupported",
    );
  });
});
