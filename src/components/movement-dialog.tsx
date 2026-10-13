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
import { formatMoney, todayInputValue } from "@/lib/format";
import type { MovementType } from "@/lib/types";

const copy: Record<MovementType, { title: string; body: string; done: string }> = {
  transfer_in: {
    title: "Transfer in",
    body: "Stock arriving at this store. Quantity on the shelf goes up.",
    done: "Transfer in recorded",
  },
  transfer_out: {
    title: "Transfer out",
    body: "Stock leaving this store. Quantity cannot drop below zero.",
    done: "Transfer out recorded",
  },
  sale: {
    title: "Record a sale",
    body: "Taken from the shop’s periodic report. The price sold can differ from retail.",
    done: "Sale recorded",
  },
};

export function MovementDialog({
  open,
  onOpenChange,
  mode,
  storeId,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MovementType;
  storeId: number;
  product: { id: number; name: string; retailPrice: number; quantity: number } | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && product ? (
        <MovementForm
          key={`${mode}-${product.id}`}
          mode={mode}
          storeId={storeId}
          product={product}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function MovementForm({
  mode,
  storeId,
  product,
  onOpenChange,
  onSaved,
}: {
  mode: MovementType;
  storeId: number;
  product: { id: number; name: string; retailPrice: number; quantity: number };
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [occurredOn, setOccurredOn] = useState(todayInputValue());
  const [unitPrice, setUnitPrice] = useState(product.retailPrice.toFixed(2));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const text = copy[mode];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/api/movements", {
        method: "POST",
        body: JSON.stringify({
          type: mode,
          storeId,
          productId: product.id,
          quantity: Number(quantity),
          occurredOn,
          unitPrice: mode === "sale" ? Number(unitPrice) : null,
          notes,
        }),
      });
      toast.success(text.done);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That movement could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>
            {product.name}. {product.quantity} on hand. Retail {formatMoney(product.retailPrice)}. {text.body}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantity" htmlFor="move-qty">
              <Input id="move-qty" className="h-10" type="number" inputMode="numeric" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
            </Field>
            <Field label="Date" htmlFor="move-date">
              <Input id="move-date" className="h-10" type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} required />
            </Field>
          </div>
          {mode === "sale" ? (
            <Field label="Price sold" hint="Per piece. Use the amount on the shop’s report, even if it isn’t retail." htmlFor="move-price">
              <Input id="move-price" className="h-10" type="number" inputMode="decimal" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} required />
            </Field>
          ) : null}
          <Field label="Notes" htmlFor="move-notes">
            <Textarea id="move-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="h-10" disabled={pending}>
              {pending ? "Saving…" : text.title}
            </Button>
          </DialogFooter>
        </form>
    </DialogContent>
  );
}
