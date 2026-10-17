"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from "@/components/feedback";
import { StoreFormDialog } from "@/components/store-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MovementDialog } from "@/components/movement-dialog";
import { PlaceDialog } from "@/components/place-dialog";
import { MovementList } from "@/components/movement-list";
import { InvoiceList } from "@/components/invoice-list";
import { InvoiceFormDialog } from "@/components/invoice-form-dialog";
import { ReportPanel } from "@/components/report-panel";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/use-resource";
import { commissionLabel, formatMoney, rentLabel } from "@/lib/format";
import type { MovementType, Product, StockLine, StoreDetail } from "@/lib/types";

export function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const detail = useResource<StoreDetail>(id ? `/api/stores/${id}` : null);
  const products = useResource<Product[]>("/api/products");
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [movement, setMovement] = useState<{ mode: MovementType; line: StockLine } | null>(null);

  const store = detail.data?.store;

  return (
    <div className="grid gap-6">
      <Link href="/stores" className="text-sm text-muted-foreground hover:text-foreground">
        All stores
      </Link>
      {detail.loading && !detail.data ? <LoadingBlock label="Loading this store…" /> : null}
      {detail.error && !detail.data ? <ErrorBlock message={detail.error} onRetry={() => void detail.reload()} /> : null}
      {store && detail.data ? (
        <>
          <PageHeader
            eyebrow={store.contactName}
            title={store.name}
            lede={`${store.address} · ${store.phone}`}
            action={
              <>
                <Button variant="outline" className="h-10" onClick={() => setEditing(true)}>
                  Edit store
                </Button>
                <Button variant="ghost" className="h-10" onClick={() => setRemoving(true)}>
                  Delete
                </Button>
              </>
            }
          />
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{rentLabel(store.rentAmount)}</Badge>
            <Badge variant="outline">{commissionLabel(store.commissionRate)}</Badge>
            <Badge variant="outline">
              {store.units} on hand · {formatMoney(store.retailValue)}
            </Badge>
          </div>

          <Tabs defaultValue="stock">
            <TabsList className="h-auto w-full max-w-full flex-wrap justify-start">
              <TabsTrigger value="stock" className="h-9 px-3">
                Stock
              </TabsTrigger>
              <TabsTrigger value="history" className="h-9 px-3">
                History
              </TabsTrigger>
              <TabsTrigger value="invoices" className="h-9 px-3">
                Invoices
              </TabsTrigger>
              <TabsTrigger value="reports" className="h-9 px-3">
                Reports
              </TabsTrigger>
            </TabsList>
            <TabsContent value="stock" className="mt-4 grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-sm text-muted-foreground">
                  Quantity is shared. A sale or transfer saved here updates the shelf for everyone else. A transfer out or sale will not take the count below zero.
                </p>
                <Button className="h-10" onClick={() => setPlacing(true)}>
                  Place a product
                </Button>
              </div>
              {detail.data.stock.length === 0 ? (
                <EmptyBlock
                  title="Nothing on this shelf"
                  body="Place a catalog product here, then transfer stock in."
                  action={
                    <Button className="h-10" onClick={() => setPlacing(true)}>
                      Place a product
                    </Button>
                  }
                />
              ) : (
                <ul className="grid gap-3">
                  {detail.data.stock.map((line) => (
                    <StockCard
                      key={`${line.id}:${line.consigneeCode}`}
                      line={line}
                      storeId={store.id}
                      onChanged={() => void detail.reload()}
                      onMove={(mode) => setMovement({ mode, line })}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <MovementList
                movements={detail.data.movements}
                emptyTitle="No history for this store"
                emptyBody="Transfers and sales recorded against this shop will be listed here. History is kept; correct a mistake with another movement."
              />
            </TabsContent>
            <TabsContent value="invoices" className="mt-4 grid gap-4">
              <div className="flex justify-end">
                <Button className="h-10" onClick={() => setInvoicing(true)}>
                  Enter invoice
                </Button>
              </div>
              <InvoiceList invoices={detail.data.invoices} stores={[store]} onChanged={() => void detail.reload()} showStore={false} />
            </TabsContent>
            <TabsContent value="reports" className="mt-4">
              <ReportPanel stores={[store]} reports={detail.data.reports} fixedStoreId={store.id} onChanged={() => void detail.reload()} />
            </TabsContent>
          </Tabs>

          <StoreFormDialog open={editing} onOpenChange={setEditing} initial={store} onSaved={() => void detail.reload()} />
          <ConfirmDialog
            open={removing}
            onOpenChange={setRemoving}
            title={`Delete ${store.name}?`}
            body="Stock, transfers, sales, invoices, and saved reports for this store are removed from the shared tracker."
            confirmLabel="Delete store"
            onConfirm={async () => {
              await api(`/api/stores/${store.id}`, { method: "DELETE" });
              toast.success("Store deleted");
              router.push("/stores");
            }}
          />
          <PlaceDialog
            open={placing}
            onOpenChange={setPlacing}
            storeId={store.id}
            choices={(products.data ?? []).map((product) => ({ id: product.id, label: `${product.productGroup} · ${product.name}` }))}
            takenIds={detail.data.stock.map((line) => line.productId)}
            onSaved={() => void detail.reload()}
          />
          <InvoiceFormDialog
            open={invoicing}
            onOpenChange={setInvoicing}
            stores={[store]}
            fixedStoreId={store.id}
            onSaved={() => void detail.reload()}
          />
          <MovementDialog
            open={Boolean(movement)}
            onOpenChange={(open) => {
              if (!open) setMovement(null);
            }}
            mode={movement?.mode ?? "transfer_in"}
            storeId={store.id}
            product={
              movement
                ? {
                    id: movement.line.productId,
                    name: movement.line.productName,
                    retailPrice: movement.line.retailPrice,
                    quantity: movement.line.quantity,
                  }
                : null
            }
            onSaved={() => void detail.reload()}
          />
        </>
      ) : null}
    </div>
  );
}

function StockCard({
  line,
  storeId,
  onChanged,
  onMove,
}: {
  line: StockLine;
  storeId: number;
  onChanged: () => void;
  onMove: (mode: MovementType) => void;
}) {
  const [code, setCode] = useState(line.consigneeCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = code !== line.consigneeCode;

  async function saveCode() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/stock", {
        method: "PATCH",
        body: JSON.stringify({ storeId, productId: line.productId, consigneeCode: code }),
      });
      toast.success("Consignee code saved");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The code could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href={`/products/${line.productId}`} className="font-medium hover:underline">
            {line.productName}
          </Link>
          <p className="text-sm text-muted-foreground">
            {line.productGroup} · retail {formatMoney(line.retailPrice)}
          </p>
        </div>
        <p className="font-heading text-3xl leading-none">{line.quantity}</p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor={`code-${line.id}`}>
            Consignee code
          </label>
          <Input id={`code-${line.id}`} className="h-10" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Store’s own code" />
        </div>
        <Button variant="outline" className="h-10" disabled={!dirty || saving} onClick={() => void saveCode()}>
          {saving ? "Saving…" : "Save code"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="h-10" onClick={() => onMove("transfer_in")}>
          Transfer in
        </Button>
        <Button variant="outline" className="h-10" onClick={() => onMove("transfer_out")}>
          Transfer out
        </Button>
        <Button variant="secondary" className="h-10" onClick={() => onMove("sale")}>
          Record sale
        </Button>
      </div>
    </li>
  );
}
