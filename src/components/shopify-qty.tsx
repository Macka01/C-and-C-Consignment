import type { ShopifyMatch, ShopifyStockStatus, StockLine } from "@/lib/types";

function matchNote(match: ShopifyMatch) {
  if (match === "no_location") return "No matching Shopify location. This count is the tracker’s last quantity.";
  if (match === "unavailable") return "Shopify is not connected. This count is the tracker’s last quantity.";
  return null;
}

export function ShopifyMatchNote({ line }: { line: StockLine }) {
  const note = matchNote(line.shopifyMatch);
  if (!note) return null;
  return <p className="mt-3 text-xs text-muted-foreground">{note}</p>;
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
    <div className="grid max-w-xl gap-2">
      {shopify.warning ? (
        <p className="text-sm text-destructive" role="alert">
          {shopify.warning}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Quantity is Shopify on hand at this location. Sales and transfers are pulled from Shopify. Other is received or
        adjusted stock that is not a transfer or sale. Missing products are created when they appear there.
      </p>
    </div>
  );
}
