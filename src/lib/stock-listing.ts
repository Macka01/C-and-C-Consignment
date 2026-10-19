import type { StockLine } from "@/lib/types";

export const STOCK_LISTING_TITLE = "Consignment Stock Listing";

export type StockListingRow = {
  productName: string;
  description: string;
  consigneeCode: string;
  price: number;
  quantityOnHand: number;
};

export type StockListing = {
  title: string;
  storeName: string;
  reportDate: string;
  reportDateIso: string;
  rows: StockListingRow[];
  totalQuantity: number;
};

export function calendarDateInSydney(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function displayDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function stockListingFilename(storeName: string, reportDateIso: string) {
  const slug = storeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `consignment-stock-listing-${slug || "store"}-${reportDateIso}.pdf`;
}

export function wrapLines(text: string, widthOf: (value: string) => number, maxWidth: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const lines: string[] = [];
  let current = "";

  const flush = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  const splitToken = (token: string) => {
    let chunk = "";
    for (const ch of token) {
      const next = chunk + ch;
      if (widthOf(next) <= maxWidth) {
        chunk = next;
      } else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  };

  for (const word of normalized.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (widthOf(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    flush();
    if (widthOf(word) <= maxWidth) {
      current = word;
    } else {
      splitToken(word);
    }
  }
  flush();
  return lines.length ? lines : [""];
}

export function buildStockListing(
  storeName: string,
  reportDateIso: string,
  stock: StockLine[],
): StockListing {
  const rows = [...stock]
    .map((line) => ({
      productName: line.productName,
      description: line.description,
      consigneeCode: line.consigneeCode,
      price: line.retailPrice,
      quantityOnHand: line.shopifyQtyOnHand ?? line.quantity,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName, "en", { sensitivity: "base" }));
  return {
    title: STOCK_LISTING_TITLE,
    storeName,
    reportDateIso,
    reportDate: displayDate(reportDateIso),
    rows,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantityOnHand, 0),
  };
}
