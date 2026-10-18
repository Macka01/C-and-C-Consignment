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
import { MovementList } from "@/components/movement-list";
import { InvoiceList } from "@/components/invoice-list";
import { InvoiceFormDialog } from "@/components/invoice-form-dialog";
import { ReportPanel } from "@/components/report-panel";
import { ShopifyMatchNote, ShopifyStockNote } from "@/components/shopify-qty";
import { StockMovementSummary } from "@/components/stock-summary";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/use-resource";
import { commissionLabel, formatMoney, rentLabel } from "@/lib/format";
import type { StockLine, StoreDetail } from "@/lib/types";

export function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const detail = useResource<StoreDetail>(id ? `/api/stores/${id}` : null, { shopify: true });
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [invoicing, setInvoicing] = useState(false);

  const store = detail.data?.store;

  return (
    <div className="grid gap-6">
      <Link href="/stores" className="text-sm text-muted-foreground hover:text-foreground">
        All stores
      </Link>
      {detail.loading && !detail.data ? <LoadingBlock label="Retrieving Shopify data…" /> : null}
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
                <div className="grid gap-2">
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Quantity, sales, and transfers come from Shopify for this location. Other is received or adjusted
                    stock that Shopify does not list as a transfer or sale. Invoices and report files are still entered
                    here.
                  </p>
                  <ShopifyStockNote shopify={detail.data.shopify} />
                </div>
              </div>
              {detail.data.stock.length === 0 ? (
                <EmptyBlock
                  title="Nothing on this shelf"
                  body="When Shopify has stock at a location that matches this store name, products appear here."
                />
              ) : (
                <ul className="grid gap-3">
                  {detail.data.stock.map((line) => (
                    <StockCard
                      key={`${line.id}:${line.consigneeCode}`}
                      line={line}
                      storeId={store.id}
                      onChanged={() => void detail.reload()}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <MovementList
                movements={detail.data.movements}
                emptyTitle="No history for this store"
                emptyBody="Shopify sales and transfers for this location will be listed here."
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
          <InvoiceFormDialog
            open={invoicing}
            onOpenChange={setInvoicing}
            stores={[store]}
            fixedStoreId={store.id}
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
}: {
  line: StockLine;
  storeId: number;
  onChanged: () => void;
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
      <div>
        <Link href={`/products/${line.productId}`} className="font-medium hover:underline">
          {line.productName}
        </Link>
        <p className="text-sm text-muted-foreground">
          {line.productGroup} · retail {formatMoney(line.retailPrice)}
        </p>
      </div>
      <StockMovementSummary line={line} />
      <ShopifyMatchNote line={line} />
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
    </li>
  );
}
