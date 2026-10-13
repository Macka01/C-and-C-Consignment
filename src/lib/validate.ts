import { HttpError } from "@/lib/errors";

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError("The form could not be read. Try again.", 400);
  }
  return value as Record<string, unknown>;
}

export function requiredText(
  body: Record<string, unknown>,
  key: string,
  label: string,
  max = 240,
): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(`${label} is required.`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new HttpError(`${label} must be ${max} characters or fewer.`, 400);
  }
  return trimmed;
}

export function optionalText(
  body: Record<string, unknown>,
  key: string,
  label: string,
  max = 2000,
): string | null {
  const value = body[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpError(`${label} could not be read.`, 400);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new HttpError(`${label} must be ${max} characters or fewer.`, 400);
  }
  return trimmed;
}

export function moneyAmount(
  value: unknown,
  label: string,
  required: boolean,
): number | null {
  if (value === null || value === undefined || value === "") {
    if (required) throw new HttpError(`${label} is required.`, 400);
    return null;
  }
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1_000_000) {
    throw new HttpError(`${label} needs an amount of zero or more.`, 400);
  }
  return Math.round(numeric * 100) / 100;
}

export function commissionRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    throw new HttpError("Commission rate must be between 0 and 100, or left blank.", 400);
  }
  return Math.round(numeric * 100) / 100;
}

export function wholeQuantity(value: unknown, label = "Quantity"): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 100_000) {
    throw new HttpError(`${label} must be a whole number greater than zero.`, 400);
  }
  return numeric;
}

export function nonNegativeInt(value: unknown, label = "Quantity"): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100_000) {
    throw new HttpError(`${label} must be a whole number, zero or more.`, 400);
  }
  return numeric;
}

export function calendarDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(`${label} needs a valid date.`, 400);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(`${label} needs a valid date.`, 400);
  }
  return value;
}

export function optionalCalendarDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return calendarDate(value, label);
}

export function monthPeriod(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    throw new HttpError("Choose a month for the period.", 400);
  }
  const month = Number(value.slice(5));
  if (month < 1 || month > 12) {
    throw new HttpError("Choose a month for the period.", 400);
  }
  return value;
}

export function positiveId(value: unknown, label = "Record"): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new HttpError(`${label} was not found.`, 404);
  }
  return numeric;
}

export function queryId(url: URL, key: string): number | null {
  const raw = url.searchParams.get(key);
  if (!raw) return null;
  return positiveId(raw, "Filter");
}

export function queryDate(url: URL, key: string, label: string): string | null {
  const raw = url.searchParams.get(key);
  if (!raw) return null;
  return calendarDate(raw, label);
}

export function queryPeriod(url: URL): string | null {
  const raw = url.searchParams.get("period");
  if (!raw) return null;
  return monthPeriod(raw);
}
