import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMoney } from "@/lib/format";
import { pdfSafeText, wrapLines, type StockListing } from "@/lib/stock-listing";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const LOGO_SIZE = 72;
const BRAND_SIZE = 28;
const TITLE_SIZE = 16;
const META_SIZE = 11;
const HEADER_SIZE = 8;
const BODY_SIZE = 9;
const LINE = 12;
const CELL_PAD = 5;
const INK = rgb(0.16, 0.12, 0.1);
const MUTED = rgb(0.42, 0.36, 0.32);
const RULE = rgb(0.78, 0.7, 0.62);
const HEADER_FILL = rgb(0.96, 0.93, 0.88);
const COLUMNS = [
  { key: "productName" as const, label: "Product Name", width: 118, align: "left" as const },
  { key: "description" as const, label: "Description", width: 168, align: "left" as const },
  { key: "consigneeCode" as const, label: "Consignee Product Code", width: 92, align: "left" as const },
  { key: "price" as const, label: "Product Price", width: 72, align: "right" as const },
  { key: "quantityOnHand" as const, label: "Quantity on Hand", width: 61, align: "right" as const },
];

type Fonts = { regular: PDFFont; bold: PDFFont };

export function cottonClayLogoPath() {
  const files = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "cotton-and-clay-logo.png"),
  ];
  return files.find((file) => fs.existsSync(file)) ?? null;
}

async function embedLogo(doc: PDFDocument, file: string) {
  const bytes = fs.readFileSync(file);
  if (file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".jpeg")) {
    return doc.embedJpg(bytes);
  }
  return doc.embedPng(bytes);
}

function cellText(row: StockListing["rows"][number], key: (typeof COLUMNS)[number]["key"]) {
  if (key === "price") return formatMoney(row.price);
  if (key === "quantityOnHand") return String(row.quantityOnHand);
  if (key === "consigneeCode") return row.consigneeCode;
  return row[key] || "—";
}

function rowLines(row: StockListing["rows"][number], font: PDFFont, size: number) {
  return COLUMNS.map((column) =>
    wrapLines(cellText(row, column.key), (value) => font.widthOfTextAtSize(value, size), column.width - CELL_PAD * 2),
  );
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
  align: "left" | "right" = "left",
  width?: number,
) {
  const safe = pdfSafeText(text);
  const textWidth = font.widthOfTextAtSize(safe, size);
  const left = align === "right" && width != null ? x + width - textWidth : x;
  page.drawText(safe, { x: left, y, size, font, color });
}

export async function buildStockListingPdf(listing: StockListing) {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const logoFile = cottonClayLogoPath();
  let logo = null;
  if (logoFile) {
    try {
      logo = await embedLogo(doc, logoFile);
    } catch (error) {
      console.error("Stock listing logo could not be embedded.", error);
    }
  }
  const contentWidth = COLUMNS.reduce((sum, column) => sum + column.width, 0);
  const tableLeft = MARGIN;
  const headerLines = COLUMNS.map((column) =>
    wrapLines(column.label, (value) => fonts.bold.widthOfTextAtSize(value, HEADER_SIZE), column.width - CELL_PAD * 2),
  );
  const headerHeight = Math.max(...headerLines.map((lines) => lines.length)) * 10 + CELL_PAD * 2;
  const pages: PDFPage[] = [];

  const addPage = () => {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    return page;
  };

  let page = addPage();
  let y = PAGE.height - MARGIN;

  const paintHeader = () => {
    if (logo) {
      page.drawImage(logo, {
        x: tableLeft,
        y: y - LOGO_SIZE,
        width: LOGO_SIZE,
        height: LOGO_SIZE,
      });
      drawText(
        page,
        "Cotton & Clay",
        tableLeft + LOGO_SIZE + 12,
        y - LOGO_SIZE / 2 - BRAND_SIZE * 0.35,
        fonts.bold,
        BRAND_SIZE,
      );
      y -= LOGO_SIZE + 14;
    } else {
      drawText(page, "Cotton & Clay", tableLeft, y, fonts.bold, BRAND_SIZE);
      y -= BRAND_SIZE + 10;
    }
    drawText(page, listing.title, tableLeft, y, fonts.bold, TITLE_SIZE);
    y -= 20;
    drawText(page, `Store: ${listing.storeName}`, tableLeft, y, fonts.regular, META_SIZE);
    y -= 15;
    drawText(page, `Date of report: ${listing.reportDate}`, tableLeft, y, fonts.regular, META_SIZE);
    y -= 22;
    page.drawRectangle({
      x: tableLeft,
      y: y - headerHeight + 4,
      width: contentWidth,
      height: headerHeight,
      color: HEADER_FILL,
    });
    let x = tableLeft;
    headerLines.forEach((lines, index) => {
      const column = COLUMNS[index];
      lines.forEach((line, lineIndex) => {
        drawText(
          page,
          line,
          x + CELL_PAD,
          y - CELL_PAD - 8 - lineIndex * 10,
          fonts.bold,
          HEADER_SIZE,
          INK,
          column.align,
          column.width - CELL_PAD * 2,
        );
      });
      x += column.width;
    });
    y -= headerHeight;
    page.drawLine({
      start: { x: tableLeft, y },
      end: { x: tableLeft + contentWidth, y },
      thickness: 0.8,
      color: RULE,
    });
    y -= 2;
  };

  paintHeader();

  if (!listing.rows.length) {
    y -= 18;
    drawText(page, "No stock on hand at this store.", tableLeft, y, fonts.regular, BODY_SIZE, MUTED);
    y -= 16;
  }

  for (const row of listing.rows) {
    const lines = rowLines(row, fonts.regular, BODY_SIZE);
    const height = Math.max(...lines.map((cell) => cell.length)) * LINE + CELL_PAD;
    if (y - height < MARGIN + 48) {
      page = addPage();
      y = PAGE.height - MARGIN;
      paintHeader();
    }
    let x = tableLeft;
    lines.forEach((cell, index) => {
      const column = COLUMNS[index];
      cell.forEach((line, lineIndex) => {
        drawText(
          page,
          line,
          x + CELL_PAD,
          y - CELL_PAD - 8 - lineIndex * LINE,
          fonts.regular,
          BODY_SIZE,
          INK,
          column.align,
          column.width - CELL_PAD * 2,
        );
      });
      x += column.width;
    });
    y -= height;
    page.drawLine({
      start: { x: tableLeft, y },
      end: { x: tableLeft + contentWidth, y },
      thickness: 0.4,
      color: RULE,
    });
  }

  if (y < MARGIN + 36) {
    page = addPage();
    y = PAGE.height - MARGIN;
    paintHeader();
  }
  y -= 18;
  page.drawLine({
    start: { x: tableLeft, y: y + 10 },
    end: { x: tableLeft + contentWidth, y: y + 10 },
    thickness: 1,
    color: INK,
  });
  drawText(page, "Total Quantity", tableLeft + CELL_PAD, y, fonts.bold, META_SIZE);
  const qtyColumn = COLUMNS[COLUMNS.length - 1];
  drawText(
    page,
    String(listing.totalQuantity),
    tableLeft + contentWidth - qtyColumn.width + CELL_PAD,
    y,
    fonts.bold,
    META_SIZE,
    INK,
    "right",
    qtyColumn.width - CELL_PAD * 2,
  );

  const count = pages.length;
  pages.forEach((printed, index) => {
    drawText(
      printed,
      `Page ${index + 1} of ${count}`,
      tableLeft,
      MARGIN - 16,
      fonts.regular,
      8,
      MUTED,
    );
  });

  return Buffer.from(await doc.save());
}
