import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyBlock } from "@/components/feedback";
import { formatDate, formatMoney, movementLabel } from "@/lib/format";
import type { Movement } from "@/lib/types";

export function MovementList({
  movements,
  showStore = false,
  showProduct = true,
  emptyTitle = "No movements yet",
  emptyBody = "Transfers and sales for this view will show up here.",
}: {
  movements: Movement[];
  showStore?: boolean;
  showProduct?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (movements.length === 0) {
    return <EmptyBlock title={emptyTitle} body={emptyBody} />;
  }

  return (
    <ul className="grid gap-3">
      {movements.map((movement) => (
        <li key={movement.id} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {showProduct ? (
                <Link href={`/products/${movement.productId}`} className="font-medium text-foreground hover:underline">
                  {movement.productName}
                </Link>
              ) : (
                <p className="font-medium">{formatDate(movement.occurredOn)}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {showProduct ? formatDate(movement.occurredOn) : null}
                {showProduct && showStore ? " · " : null}
                {showStore ? (
                  <Link href={`/stores/${movement.storeId}`} className="hover:underline">
                    {movement.storeName}
                  </Link>
                ) : null}
                {movement.productGroup ? ` · ${movement.productGroup}` : ""}
              </p>
            </div>
            <Badge variant={movement.type === "sale" ? "default" : movement.type === "transfer_out" ? "outline" : "secondary"}>
              {movementLabel(movement.type)}
            </Badge>
          </div>
          <p className="mt-2 text-sm">
            {movement.quantity} {movement.quantity === 1 ? "piece" : "pieces"}
            {movement.type === "sale" ? ` · ${formatMoney(movement.unitPrice)} sold · ${formatMoney(movement.lineTotal)}` : null}
          </p>
          {movement.notes ? <p className="mt-1 text-sm text-muted-foreground">{movement.notes}</p> : null}
        </li>
      ))}
    </ul>
  );
}
