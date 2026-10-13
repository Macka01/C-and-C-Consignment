"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, PageHeader, RefreshButton } from "@/components/feedback";
import { InvoiceFormDialog } from "@/components/invoice-form-dialog";
import { InvoiceList } from "@/components/invoice-list";
import { useResource } from "@/lib/use-resource";
import type { Invoice, Store } from "@/lib/types";

export function InvoicesPage() {
  const invoices = useResource<Invoice[]>("/api/invoices");
  const stores = useResource<Store[]>("/api/stores");
  const [open, setOpen] = useState(false);
  const waiting = (invoices.loading && !invoices.data) || (stores.loading && !stores.data);
  const error = invoices.error ?? stores.error;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="What came back"
        title="Invoices"
        lede="Rent and commission the consignee has paid. Enter the figures from their invoice. Stock does not change."
        action={
          <>
            <RefreshButton onClick={() => void invoices.reload()} />
            <Button className="h-10" onClick={() => setOpen(true)} disabled={!stores.data?.length}>
              Enter invoice
            </Button>
          </>
        }
      />
      {waiting ? <LoadingBlock label="Loading invoices…" /> : null}
      {error && !invoices.data ? <ErrorBlock message={error} onRetry={() => void invoices.reload()} /> : null}
      {invoices.data && stores.data ? (
        <InvoiceList invoices={invoices.data} stores={stores.data} onChanged={() => void invoices.reload()} />
      ) : null}
      <InvoiceFormDialog
        open={open}
        onOpenChange={setOpen}
        stores={stores.data ?? []}
        onSaved={() => void invoices.reload()}
      />
    </div>
  );
}
