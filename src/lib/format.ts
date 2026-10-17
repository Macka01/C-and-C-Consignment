export function formatSignedCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value > 0) return `+${value}`;
  return String(value);
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value);
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function thisMonthInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export function movementLabel(type: "transfer_in" | "transfer_out" | "sale"): string {
  if (type === "transfer_in") return "Transfer in";
  if (type === "transfer_out") return "Transfer out";
  return "Sale";
}

export function rentLabel(amount: number | null): string {
  if (amount === null) return "No rent";
  return `${formatMoney(amount)} rent`;
}

export function commissionLabel(rate: number | null): string {
  if (rate === null) return "No commission";
  return `${rate}% commission`;
}
