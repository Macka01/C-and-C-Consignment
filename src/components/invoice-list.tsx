"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyBlock } from "@/components/feedback";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InvoiceFormDialog } from "@/components/invoice-form-dialog";
import { api } from "@/lib/api-client";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import type { Invoice, Store } from "@/lib/types";

export function InvoiceList({
  invoices,
  stores,
  onChanged,
  showStore = true,
}: {
  invoices: Invoice[];
  stores: Store[];
  onChanged: () => void;
  showStore?: boolean;
}) {
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [removing, setRemoving] = useState<Invoice | null>(null);

  if (invoices.length === 0) {
    return (
      <EmptyBlock
        title="No invoices yet"
        body="When a consignee pays rent or commission, enter the amount here. It does not change stock."
      />
    );
  }

  return (
    <>
      <ul className="grid gap-3">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{formatPeriod(invoice.period)}</p>
                <p className="text-sm text-muted-foreground">
                  {showStore ? `${invoice.storeName} · ` : ""}
                  Paid {formatDate(invoice.invoiceDate)}
                </p>
              </div>
              <div className="text-right text-sm">
                <p>Rent {formatMoney(invoice.rentPaid)}</p>
                <p>Commission {formatMoney(invoice.commissionPaid)}</p>
              </div>
            </div>
            {invoice.notes ? <p className="mt-2 text-sm text-muted-foreground">{invoice.notes}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" className="h-9" onClick={() => setEditing(invoice)}>
                Edit
              </Button>
              <Button variant="ghost" className="h-9" onClick={() => setRemoving(invoice)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <InvoiceFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        stores={stores}
        initial={editing}
        onSaved={onChanged}
      />
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Delete this invoice?"
        body="The payment record is removed. Stock and sales stay as they are."
        confirmLabel="Delete invoice"
        onConfirm={async () => {
          if (!removing) return;
          await api(`/api/invoices/${removing.id}`, { method: "DELETE" });
          toast.success("Invoice deleted");
          onChanged();
        }}
      />
    </>
  );
}
