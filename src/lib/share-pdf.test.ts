import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filenameFromDisposition, isShareCancel } from "./share-pdf.ts";

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
});
