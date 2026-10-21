import { cn } from "cn";
import type { LocationStock } from "@/lib/types";

/** Location name and on-hand quantity only. */
export function LocationStockList({
  locations,
  empty = "No Shopify on-hand yet",
  className,
}: {
  locations: LocationStock[];
  empty?: string;
  className?: string;
}) {
  if (locations.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  }
  return (
    <ul className={cn("grid gap-0.5 text-sm", className)}>
      {locations.map((row) => (
        <li key={row.locationName} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">{row.locationName}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{row.quantity}</span>
        </li>
      ))}
    </ul>
  );
}
