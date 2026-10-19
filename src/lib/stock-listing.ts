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

const winAnsiSwap: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": ",",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2011": "-",
  "\u2212": "-",
  "\u2026": "...",
  "\u00A0": " ",
  "\u2022": "*",
  "\u2122": "(TM)",
};

/** Helvetica on the PDF only speaks WinAnsi. Swap punctuation, drop the rest. */
export function pdfSafeText(text: string) {
  let out = "";
  for (const ch of text) {
    if (winAnsiSwap[ch]) {
      out += winAnsiSwap[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x09 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      out += ch;
    }
  }
  return out;
}

export function firstSentence(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const match = normalized.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : normalized).trim();
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
      productName: pdfSafeText(line.productName),
      description: pdfSafeText(firstSentence(line.description)),
      consigneeCode: pdfSafeText(line.consigneeCode),
      price: line.retailPrice,
      quantityOnHand: line.shopifyQtyOnHand ?? line.quantity,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName, "en", { sensitivity: "base" }));
  return {
    title: STOCK_LISTING_TITLE,
    storeName: pdfSafeText(storeName),
    reportDateIso,
    reportDate: displayDate(reportDateIso),
    rows,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantityOnHand, 0),
  };
}
