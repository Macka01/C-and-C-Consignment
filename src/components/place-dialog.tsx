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
import { todayInputValue } from "@/lib/format";

export function PlaceDialog({
  open,
  onOpenChange,
  storeId,
  productId,
  choices,
  takenIds,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: number;
  productId?: number;
  choices: { id: number; label: string }[];
  takenIds: number[];
  onSaved: () => void;
}) {
  const available = choices.filter((choice) => !takenIds.includes(choice.id));
  const availableKey = available.map((choice) => choice.id).join(",");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <PlaceForm
          key={availableKey || "empty"}
          storeId={storeId}
          productId={productId}
          available={available}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function PlaceForm({
  storeId,
  productId,
  available,
  onOpenChange,
  onSaved,
}: {
  storeId?: number;
  productId?: number;
  available: { id: number; label: string }[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [choiceId, setChoiceId] = useState(available[0] ? String(available[0].id) : "");
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [occurredOn, setOccurredOn] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pickingStore = productId !== undefined;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/api/stock", {
        method: "POST",
        body: JSON.stringify({
          storeId: storeId ?? Number(choiceId),
          productId: productId ?? Number(choiceId),
          consigneeCode: code,
          quantity: Number(quantity || 0),
          occurredOn,
          notes,
        }),
      });
      toast.success(Number(quantity) > 0 ? "Placed on the shelf and transferred in" : "Placed on the shelf");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That product could not be placed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{pickingStore ? "Place at a store" : "Place a product"}</DialogTitle>
        <DialogDescription>
          The consignee code belongs to this store only. A starting quantity is recorded as a transfer in.
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <Field label={pickingStore ? "Store" : "Product"} htmlFor="place-choice">
          <NativeSelect id="place-choice" value={choiceId} onChange={(event) => setChoiceId(event.target.value)} required disabled={available.length === 0}>
            {available.length === 0 ? <option value="">Nothing left to place</option> : null}
            {available.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Consignee product code" hint="Optional. The code the shop uses on its own report." htmlFor="place-code">
          <Input id="place-code" className="h-10" value={code} onChange={(event) => setCode(event.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starting quantity" hint="Use 0 if the code is known but nothing is there yet." htmlFor="place-qty">
            <Input id="place-qty" className="h-10" type="number" inputMode="numeric" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          </Field>
          <Field label="Date" htmlFor="place-date">
            <Input id="place-date" className="h-10" type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} required={Number(quantity) > 0} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="place-notes">
          <Textarea id="place-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" className="h-10" disabled={pending || available.length === 0}>
            {pending ? "Saving…" : "Place on shelf"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
