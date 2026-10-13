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
import { Field, FormError } from "@/components/fields";
import { api } from "@/lib/api-client";
import type { Store } from "@/lib/types";

const empty = {
  name: "",
  address: "",
  phone: "",
  contactName: "",
  rentAmount: "",
  commissionRate: "",
};

export function StoreFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Store | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <StoreFormFields initial={initial} onOpenChange={onOpenChange} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function StoreFormFields({
  initial,
  onOpenChange,
  onSaved,
}: {
  initial?: Store | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name,
          address: initial.address,
          phone: initial.phone,
          contactName: initial.contactName,
          rentAmount: initial.rentAmount === null ? "" : String(initial.rentAmount),
          commissionRate: initial.commissionRate === null ? "" : String(initial.commissionRate),
        }
      : empty,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set(key: keyof typeof empty, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const payload = {
      name: form.name,
      address: form.address,
      phone: form.phone,
      contactName: form.contactName,
      rentAmount: form.rentAmount === "" ? null : Number(form.rentAmount),
      commissionRate: form.commissionRate === "" ? null : Number(form.commissionRate),
    };
    try {
      if (initial) {
        await api(`/api/stores/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Store updated");
      } else {
        await api("/api/stores", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Store added");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The store could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit store" : "Add a store"}</DialogTitle>
          <DialogDescription>
            Rent and commission are optional. Leave them blank when the shop doesn’t pay that way.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <Field label="Store name" htmlFor="store-name">
            <Input id="store-name" className="h-10" value={form.name} onChange={(event) => set("name", event.target.value)} required />
          </Field>
          <Field label="Address" htmlFor="store-address">
            <Input id="store-address" className="h-10" value={form.address} onChange={(event) => set("address", event.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="store-phone">
              <Input id="store-phone" className="h-10" value={form.phone} onChange={(event) => set("phone", event.target.value)} required />
            </Field>
            <Field label="Contact name" htmlFor="store-contact">
              <Input id="store-contact" className="h-10" value={form.contactName} onChange={(event) => set("contactName", event.target.value)} required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rent" hint="Monthly shelf rent, if they pay one." htmlFor="store-rent">
              <Input id="store-rent" className="h-10" inputMode="decimal" min="0" step="0.01" type="number" value={form.rentAmount} onChange={(event) => set("rentAmount", event.target.value)} />
            </Field>
            <Field label="Commission %" hint="Percent of sales, if that’s the deal." htmlFor="store-commission">
              <Input id="store-commission" className="h-10" inputMode="decimal" min="0" max="100" step="0.01" type="number" value={form.commissionRate} onChange={(event) => set("commissionRate", event.target.value)} />
            </Field>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="h-10" disabled={pending}>
              {pending ? "Saving…" : initial ? "Save changes" : "Add store"}
            </Button>
          </DialogFooter>
        </form>
    </DialogContent>
  );
}
