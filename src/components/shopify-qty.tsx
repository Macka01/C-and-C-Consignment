import { formatSignedCount } from "@/lib/format";
import type { ShopifyMatch, ShopifyStockStatus, StockLine } from "@/lib/types";

function matchNote(match: ShopifyMatch) {
  if (match === "no_location") return "No matching Shopify location";
  if (match === "no_product") return "No matching Shopify product";
  if (match === "unavailable") return "Shopify is not connected";
  return null;
}

function varianceClass(variance: number | null) {
  if (variance === null) return "text-muted-foreground";
  if (variance < 0) return "text-destructive";
  if (variance > 0) return "text-primary";
  return "text-foreground";
}

export function ShopifyCompare({ line }: { line: StockLine }) {
  const note = matchNote(line.shopifyMatch);
  return (
    <div className="mt-3 grid gap-2">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Shopify qty on hand</dt>
          <dd className="font-heading text-2xl leading-none">{line.shopifyQtyOnHand ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Variance</dt>
          <dd className={`font-heading text-2xl leading-none ${varianceClass(line.variance)}`}>
            {formatSignedCount(line.variance)}
          </dd>
        </div>
      </dl>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function ShopifyStockNote({ shopify }: { shopify: ShopifyStockStatus }) {
  if (shopify.error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Shopify qty could not be read: {shopify.error}
      </p>
    );
  }
  if (!shopify.configured) {
    return (
      <p className="max-w-xl text-sm text-muted-foreground">
        Add <span className="font-medium text-foreground">SHOPIFY_SHOP</span> and{" "}
        <span className="font-medium text-foreground">SHOPIFY_ACCESS_TOKEN</span> on the server. The token needs{" "}
        <span className="font-medium text-foreground">read_inventory</span>,{" "}
        <span className="font-medium text-foreground">read_locations</span>,{" "}
        <span className="font-medium text-foreground">read_products</span>,{" "}
        <span className="font-medium text-foreground">read_orders</span>, and{" "}
        <span className="font-medium text-foreground">read_inventory_transfers</span>.
      </p>
    );
  }
  return (
    <p className="max-w-xl text-sm text-muted-foreground">
      Quantity is Shopify on hand at this location. Sales and transfers are pulled from Shopify. Missing products are
      created when they appear there.
    </p>
  );
}
