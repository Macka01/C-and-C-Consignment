import type { Movement } from "@/lib/types";

export type SalesGrain = "day" | "week" | "month";

export type SalesPoint = {
  key: string;
  label: string;
  total: number;
  units: number;
};

function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function formatDay(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, days: number): string {
  const date = parseDay(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDay(date);
}

function addMonths(iso: string, months: number): string {
  const date = parseDay(iso);
  date.setUTCMonth(date.getUTCMonth() + months, 1);
  return formatDay(date);
}

export function daysInclusive(from: string, to: string): number {
  const span = parseDay(to).getTime() - parseDay(from).getTime();
  return Math.round(span / 86_400_000) + 1;
}

export function shiftDays(iso: string, days: number): string {
  return addDays(iso, days);
}

export function shiftMonths(iso: string, months: number): string {
  const date = parseDay(iso);
  date.setUTCMonth(date.getUTCMonth() + months);
  return formatDay(date);
}

export function monthBounds(iso: string): { from: string; to: string } {
  const from = `${iso.slice(0, 7)}-01`;
  const next = addMonths(from, 1);
  return { from, to: addDays(next, -1) };
}

function bucketStart(iso: string, grain: SalesGrain): string {
  if (grain === "month") return `${iso.slice(0, 7)}-01`;
  if (grain === "day") return iso;
  const date = parseDay(iso);
  const weekday = date.getUTCDay();
  const back = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - back);
  return formatDay(date);
}

function nextBucket(iso: string, grain: SalesGrain): string {
  if (grain === "day") return addDays(iso, 1);
  if (grain === "week") return addDays(iso, 7);
  return addMonths(iso, 1);
}

function grainFor(from: string, to: string): SalesGrain {
  const days = daysInclusive(from, to);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

function labelFor(iso: string, grain: SalesGrain): string {
  const date = parseDay(iso);
  if (grain === "month") {
    return new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  }
  if (grain === "week") {
    return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  }
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

export function salesRange(sales: Movement[], from: string, to: string): { from: string; to: string } {
  const dates = sales.map((sale) => sale.occurredOn).sort();
  const start = from || dates[0] || to;
  const end = to || dates[dates.length - 1] || from;
  if (!start || !end) return { from: "", to: "" };
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}

export function salesSeries(sales: Movement[], from: string, to: string): { grain: SalesGrain; points: SalesPoint[] } {
  const range = salesRange(sales, from, to);
  if (!range.from || !range.to) return { grain: "day", points: [] };
  const grain = grainFor(range.from, range.to);
  const totals = new Map<string, { total: number; units: number }>();
  for (const sale of sales) {
    if (sale.occurredOn < range.from || sale.occurredOn > range.to) continue;
    const key = bucketStart(sale.occurredOn, grain);
    const current = totals.get(key) ?? { total: 0, units: 0 };
    current.total += sale.lineTotal ?? 0;
    current.units += sale.quantity;
    totals.set(key, current);
  }
  const points: SalesPoint[] = [];
  let cursor = bucketStart(range.from, grain);
  const end = bucketStart(range.to, grain);
  while (cursor <= end && points.length < 400) {
    const value = totals.get(cursor) ?? { total: 0, units: 0 };
    points.push({
      key: cursor,
      label: labelFor(cursor, grain),
      total: Math.round(value.total * 100) / 100,
      units: value.units,
    });
    cursor = nextBucket(cursor, grain);
  }
  return { grain, points };
}

export function grainLabel(grain: SalesGrain): string {
  if (grain === "day") return "each day";
  if (grain === "week") return "each week";
  return "each month";
}
