import { HttpError } from "@/lib/errors";
import { fail, json, live } from "@/lib/handlers";
import { loadStockListing } from "@/lib/load-stock-listing";
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
