import type { StockLine } from "@/lib/types";

export function stockOnHand(line: StockLine) {
  return line.shopifyQtyOnHand ?? line.quantity;
}

export function StockMovementSummary({ line }: { line: StockLine }) {
  const onHand = stockOnHand(line);
  return (
    <div className="mt-3 grid gap-2">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <div className="rounded-lg bg-secondary px-3 py-2 ring-1 ring-foreground/20">
          <dt className="text-xs text-muted-foreground">On hand</dt>
          <dd className="font-heading text-3xl leading-none">{onHand}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        {line.transferredIn} − {line.transferredOut} − {line.sales} = {onHand}
      </p>
    </div>
  );
}
