import { HttpError } from "@/lib/errors";
import { fail, json, live } from "@/lib/handlers";
import { loadStockListing } from "@/lib/load-stock-listing";
import { buildStockListingEmail } from "@/lib/listing-email";
import { stockListingFilename } from "@/lib/stock-listing";
import { buildStockListingPdf } from "@/lib/stock-listing-pdf";
import { positiveId } from "@/lib/validate";

export async function GET(request: Request) {
  try {
    await live();
    const url = new URL(request.url);
    const raw = url.searchParams.get("storeId");
    if (!raw) throw new HttpError("Choose a store.", 400);
    const storeId = positiveId(raw, "Store");
    const listing = await loadStockListing(storeId);
    if (url.searchParams.get("format") === "json") {
      return json(listing);
    }
    const pdf = await buildStockListingPdf(listing);
    if (url.searchParams.get("format") === "eml") {
      const email = buildStockListingEmail(listing, pdf);
      return new Response(new Uint8Array(email.bytes), {
        headers: {
          "Content-Type": email.mimeType,
          "Content-Disposition": `attachment; filename="${email.filename}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const filename = stockListingFilename(listing.storeName, listing.reportDateIso);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Stock listing PDF failed.", error);
    return fail(error);
  }
}
