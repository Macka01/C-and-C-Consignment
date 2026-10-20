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
import { Field, FormError } from "@/components/fields";
import { api } from "@/lib/api-client";
import type { Product } from "@/lib/types";

const empty = { productGroup: "", name: "", description: "", retailPrice: "" };

export function ProductFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Product | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <ProductFormFields initial={initial} onOpenChange={onOpenChange} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function ProductFormFields({
  initial,
  onOpenChange,
  onSaved,
}: {
  initial?: Product | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          productGroup: initial.productGroup,
          name: initial.name,
          description: initial.description,
          retailPrice: String(initial.retailPrice),
        }
      : empty,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const payload = {
      productGroup: form.productGroup,
      name: form.name,
      description: form.description,
      retailPrice: Number(form.retailPrice),
    };
    try {
      if (initial) {
        await api(`/api/products/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Product updated");
      } else {
        await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Product added to the catalog");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The product could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit product" : "Add a product"}</DialogTitle>
          <DialogDescription>
            This is the studio catalog. Product group is Shopify’s product type when the piece comes from Shopify.
            Retail price is the usual ticket; a store can sell it for something else.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product group" htmlFor="product-group">
              <Input id="product-group" className="h-10" value={form.productGroup} onChange={(event) => setForm({ ...form, productGroup: event.target.value })} required />
            </Field>
            <Field label="Retail price" htmlFor="product-price">
              <Input id="product-price" className="h-10" type="number" inputMode="decimal" min="0" step="0.01" value={form.retailPrice} onChange={(event) => setForm({ ...form, retailPrice: event.target.value })} required />
            </Field>
          </div>
          <Field label="Product name" htmlFor="product-name">
            <Input id="product-name" className="h-10" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Description" htmlFor="product-description">
            <Textarea id="product-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="h-10" disabled={pending}>
              {pending ? "Saving…" : initial ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
    </DialogContent>
  );
}
