"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, NativeSelect } from "@/components/fields";
import { api } from "@/lib/api-client";
import { thisMonthInputValue, todayInputValue } from "@/lib/format";
import type { Invoice, Store } from "@/lib/types";

export function InvoiceFormDialog({
  open,
  onOpenChange,
  stores,
  initial,
  fixedStoreId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: Store[];
  initial?: Invoice | null;
  fixedStoreId?: number;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <InvoiceFormFields
          stores={stores}
          initial={initial}
          fixedStoreId={fixedStoreId}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function InvoiceFormFields({
  stores,
  initial,
  fixedStoreId,
  onOpenChange,
  onSaved,
}: {
  stores: Store[];
  initial?: Invoice | null;
  fixedStoreId?: number;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const defaultStoreId = fixedStoreId ?? initial?.storeId ?? stores[0]?.id ?? "";
  const [storeId, setStoreId] = useState(defaultStoreId ? String(defaultStoreId) : "");
  const [period, setPeriod] = useState(initial?.period ?? thisMonthInputValue());
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate ?? todayInputValue());
  const [rentPaid, setRentPaid] = useState(initial ? String(initial.rentPaid) : "0");
  const [commissionPaid, setCommissionPaid] = useState(initial ? String(initial.commissionPaid) : "0");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const payload = {
      storeId: Number(storeId),
      period,
      invoiceDate,
      rentPaid: Number(rentPaid || 0),
      commissionPaid: Number(commissionPaid || 0),
      notes,
    };
    try {
      if (initial) {
        await api(`/api/invoices/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Invoice updated");
      } else {
        await api("/api/invoices", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Invoice saved");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The invoice could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit invoice" : "Enter an invoice"}</DialogTitle>
          <DialogDescription>
            Record what the consignee actually paid for rent and commission. The tracker does not calculate it for you.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <Field label="Store" htmlFor="invoice-store">
            <NativeSelect
              id="invoice-store"
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              disabled={Boolean(fixedStoreId) || stores.length === 0}
              required
            >
              {stores.length === 0 ? <option value="">No stores yet</option> : null}
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Period" htmlFor="invoice-period">
              <Input id="invoice-period" className="h-10" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} required />
            </Field>
            <Field label="Date paid" htmlFor="invoice-date">
              <Input id="invoice-date" className="h-10" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rent paid" htmlFor="invoice-rent">
              <Input id="invoice-rent" className="h-10" type="number" inputMode="decimal" min="0" step="0.01" value={rentPaid} onChange={(event) => setRentPaid(event.target.value)} required />
            </Field>
            <Field label="Commission paid" htmlFor="invoice-commission">
              <Input id="invoice-commission" className="h-10" type="number" inputMode="decimal" min="0" step="0.01" value={commissionPaid} onChange={(event) => setCommissionPaid(event.target.value)} required />
            </Field>
          </div>
          <Field label="Notes" hint="Optional. Useful when the amount doesn’t match the sales on file." htmlFor="invoice-notes">
            <Textarea id="invoice-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="h-10" disabled={pending || !storeId}>
              {pending ? "Saving…" : initial ? "Save invoice" : "Save invoice"}
            </Button>
          </DialogFooter>
        </form>
    </DialogContent>
  );
}
