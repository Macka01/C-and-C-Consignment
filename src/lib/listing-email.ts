import { stockListingFilename, type StockListing } from "@/lib/stock-listing";

const CRLF = "\r\n";

export type ListingEmailMeta = Pick<StockListing, "title" | "storeName" | "reportDate" | "reportDateIso">;

export function stockListingEmailFilename(storeName: string, reportDateIso: string) {
  return stockListingFilename(storeName, reportDateIso).replace(/\.pdf$/i, ".eml");
}

export function listingEmailHref(listingHref: string) {
  const [path, query] = listingHref.split("?");
  const params = new URLSearchParams(query);
  params.set("format", "eml");
  return `${path}?${params.toString()}`;
}

function asciiHeader(value: string) {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function foldBase64(value: string) {
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += 76) {
    lines.push(value.slice(index, index + 76));
  }
  return lines.join(CRLF);
}

function rfcDate(now: Date) {
  return now.toUTCString().replace(/GMT$/, "+0000");
}

/** Apple Mail opens X-Unsent .eml as a compose draft. mailto cannot attach the PDF. */
export function buildStockListingEmail(
  listing: ListingEmailMeta,
  pdf: Uint8Array,
  options?: { now?: Date; boundary?: string },
) {
  const pdfName = stockListingFilename(listing.storeName, listing.reportDateIso);
  const filename = stockListingEmailFilename(listing.storeName, listing.reportDateIso);
  const boundary = options?.boundary ?? `----=_CottonClay_${Date.now().toString(36)}`;
  const subject = `${listing.title} - ${listing.storeName}`;
  const body = [
    `${listing.title} for ${listing.storeName}.`,
    `Date of report: ${listing.reportDate}.`,
    "",
    "The PDF listing is attached.",
  ].join(CRLF);
  const rfc822 = [
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Date: ${rfcDate(options?.now ?? new Date())}`,
    'From: "Cotton & Clay" <consignment@localhost>',
    "To: ",
    `Subject: ${asciiHeader(subject)}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${pdfName}"`,
    "",
    foldBase64(Buffer.from(pdf).toString("base64")),
    `--${boundary}--`,
    "",
  ].join(CRLF);

  return {
    filename,
    mimeType: "message/rfc822",
    bytes: Buffer.from(rfc822, "utf8"),
    rfc822,
  };
}
