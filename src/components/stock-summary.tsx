import { otherFromOnHand, stockOnHand } from "@/lib/stock-totals";
import type { StockLine } from "@/lib/types";

export { stockOnHand };

export function stockOther(line: StockLine) {
  return otherFromOnHand(stockOnHand(line), {
    transferredIn: line.transferredIn,
    transferredOut: line.transferredOut,
    sales: line.sales,
  });
}

function signedTerm(value: number) {
  const abs = Math.abs(value);
  return value < 0 ? `− ${abs}` : `+ ${abs}`;
}

/** Compact in/out/sales/other for a product row on a store shelf. */
export function StockListingCounts({ line }: { line: StockLine }) {
  return (
    <p className="text-xs text-muted-foreground">
      In {line.transferredIn} · Out {line.transferredOut} · Sales {line.sales} · Other {stockOther(line)}
    </p>
  );
}

export function StockOnHandBox({ line }: { line: StockLine }) {
  return (
    <div className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-right ring-1 ring-foreground/20">
      <p className="text-xs text-muted-foreground">On hand</p>
      <p className="font-heading text-3xl leading-none">{stockOnHand(line)}</p>
    </div>
  );
}

export function StockMovementSummary({ line }: { line: StockLine }) {
  const onHand = stockOnHand(line);
  const other = stockOther(line);
  return (
    <div className="mt-3 grid gap-2">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <dt className="text-xs text-muted-foreground">Transferred in</dt>
          <dd className="font-heading text-2xl leading-none">{line.transferredIn}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Transferred out</dt>
          <dd className="font-heading text-2xl leading-none">{line.transferredOut}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Sales</dt>
          <dd className="font-heading text-2xl leading-none">{line.sales}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Other</dt>
          <dd className="font-heading text-2xl leading-none">{other}</dd>
        </div>
        <div className="rounded-lg bg-secondary px-3 py-2 ring-1 ring-foreground/20">
          <dt className="text-xs text-muted-foreground">On hand</dt>
          <dd className="font-heading text-3xl leading-none">{onHand}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        {line.transferredIn} − {line.transferredOut} − {line.sales} {signedTerm(other)} = {onHand}
      </p>
      {other !== 0 ? (
        <p className="text-xs text-muted-foreground">
          Other is stock Shopify has here that is not a transfer or sale we pulled — usually received, counted, or
          opening stock at this location.
        </p>
      ) : null}
    </div>
  );
}
