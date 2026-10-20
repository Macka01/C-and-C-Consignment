import { belongsOnStoreShelf } from "@/lib/shelf-membership";
import type { StockLine } from "@/lib/types";

export const STOCK_LISTING_TITLE = "Consignment Stock Listing";

export type StockListingRow = {
  productGroup: string;
  productName: string;
  consigneeCode: string;
  price: number;
  quantityOnHand: number;
};

export type StockListingGroup = {
  group: string;
  rows: StockListingRow[];
};

export type StockListing = {
  title: string;
  storeName: string;
  reportDate: string;
  reportDateIso: string;
  groups: StockListingGroup[];
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

function compareListingRows(a: StockListingRow, b: StockListingRow) {
  const left = a.consigneeCode.trim();
  const right = b.consigneeCode.trim();
  if (!left && right) return 1;
  if (left && !right) return -1;
  const byCode = left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
  if (byCode !== 0) return byCode;
  return a.productName.localeCompare(b.productName, "en", { sensitivity: "base" });
}

function listingQuantity(line: StockLine) {
  return line.shopifyQtyOnHand ?? line.quantity;
}

export function buildStockListing(
  storeName: string,
  reportDateIso: string,
  stock: StockLine[],
): StockListing {
  const mapped = stock
    .filter(
      (line) =>
        belongsOnStoreShelf(line.quantity, line.transferredIn + line.transferredOut + line.sales) &&
        pdfSafeText(line.productName).trim(),
    )
    .map((line) => ({
      productGroup: pdfSafeText(line.productGroup),
      productName: pdfSafeText(line.productName),
      consigneeCode: pdfSafeText(line.consigneeCode),
      price: line.retailPrice,
      quantityOnHand: listingQuantity(line),
    }));
  const grouped = new Map<string, StockListingRow[]>();
  for (const row of mapped) {
    const group = row.productGroup.trim();
    const list = grouped.get(group) ?? [];
    list.push(row);
    grouped.set(group, list);
  }
  const groups = [...grouped.entries()]
    .sort(([left], [right]) => {
      if (!left && right) return 1;
      if (left && !right) return -1;
      return left.localeCompare(right, "en", { sensitivity: "base" });
    })
    .map(([group, items]) => ({
      group,
      rows: items.sort(compareListingRows),
    }));
  const rows = groups.flatMap((section) => section.rows);
  return {
    title: STOCK_LISTING_TITLE,
    storeName: pdfSafeText(storeName),
    reportDateIso,
    reportDate: displayDate(reportDateIso),
    groups,
    rows,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantityOnHand, 0),
  };
}
