"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from "@/components/feedback";
import { LocationStockList } from "@/components/location-stock-list";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { MovementList } from "@/components/movement-list";
import { ShopifyMatchNote, ShopifyStockNote } from "@/components/shopify-qty";
import { StockMovementSummary } from "@/components/stock-summary";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/use-resource";
import { formatMoney } from "@/lib/format";
import type { ProductDetail, StockLine, Store } from "@/lib/types";

export function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const detail = useResource<ProductDetail>(params.id ? `/api/products/${params.id}` : null, { shopify: true });
  const stores = useResource<Store[]>("/api/stores");
  const [editing, setEditing] = useState(false);
  const product = detail.data?.product;
  const stockedStoreIds = useMemo(
    () => new Set((detail.data?.stock ?? []).map((line) => line.storeId)),
    [detail.data?.stock],
  );
  const availableStores = useMemo(
    () => (stores.data ?? []).filter((store) => !stockedStoreIds.has(store.id)),
    [stores.data, stockedStoreIds],
  );

  return (
    <div className="grid gap-6">
      <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground">
        Catalog
      </Link>
      {detail.loading && !detail.data ? <LoadingBlock label="Retrieving Shopify data…" /> : null}
      {detail.error && !detail.data ? <ErrorBlock message={detail.error} onRetry={() => void detail.reload()} /> : null}
      {product && detail.data ? (
        <>
          <PageHeader
            eyebrow={product.productGroup}
            title={product.name}
            lede={product.description}
            action={
              <>
                <Link href={`/showcase/${product.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}>
                  Showcase
                </Link>
                <Button variant="outline" className="h-10" onClick={() => setEditing(true)}>
                  Edit product
                </Button>
              </>
            }
          />
          <p className="text-sm">
            Retail {formatMoney(product.retailPrice)} · {product.units} on shelves across {product.storeCount}{" "}
            {product.storeCount === 1 ? "store" : "stores"}
          </p>

          <section className="grid gap-3">
            <h2 className="font-heading text-2xl">Stock on hand</h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Every Shopify location with quantity for this product, including 63 Ferndale St.
            </p>
            <div className="max-w-md rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <LocationStockList locations={product.locationStock ?? []} empty="No Shopify on-hand at any location yet" />
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="font-heading text-2xl">Stock by store</h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Consignee shops only: transferred in, transferred out, sales, other, and boxed on-hand. History is below.
              Save a consignee code to list made-to-order items at a store with no stock yet.
            </p>
            <ShopifyStockNote shopify={detail.data.shopify} />
            {detail.data.stock.length === 0 ? (
              <EmptyBlock
                title="Not at a store yet"
                body="Shopify will place it here when it has quantity at a matching location. Or save a consignee code below for made-to-order."
              />
            ) : (
              <ul className="grid gap-3">
                {detail.data.stock.map((line) => (
                  <li key={line.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                    <div>
                      <Link href={`/stores/${line.storeId}`} className="font-medium hover:underline">
                        {line.storeName}
                      </Link>
                    </div>
                    <StockMovementSummary line={line} />
                    <ShopifyMatchNote line={line} />
                    <ConsigneeCodeField
                      key={`${line.id}:${line.consigneeCode}`}
                      line={line}
                      onChanged={() => void detail.reload()}
                    />
                  </li>
                ))}
              </ul>
            )}
            {availableStores.length > 0 ? (
              <MarkAvailableAtStore
                key={availableStores.map((store) => store.id).join("-")}
                productId={product.id}
                stores={availableStores}
                onChanged={() => void detail.reload()}
              />
            ) : null}
          </section>

          <section className="grid gap-3">
            <h2 className="font-heading text-2xl">History</h2>
            <MovementList
              movements={detail.data.movements}
              showStore
              showProduct={false}
              emptyTitle="No history for this product"
              emptyBody="Shopify sales and transfers of this piece will be listed here."
            />
          </section>

          <ProductFormDialog open={editing} onOpenChange={setEditing} initial={product} onSaved={() => void detail.reload()} />
        </>
      ) : null}
    </div>
  );
}

function ConsigneeCodeField({ line, onChanged }: { line: StockLine; onChanged: () => void }) {
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
        body: JSON.stringify({ storeId: line.storeId, productId: line.productId, consigneeCode: code }),
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
    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor={`code-${line.id}`}>
          Consignee code
        </label>
        <Input
          id={`code-${line.id}`}
          className="h-10"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Store’s own code"
        />
      </div>
      <Button variant="outline" className="h-10" disabled={!dirty || saving} onClick={() => void saveCode()}>
        {saving ? "Saving…" : "Save code"}
      </Button>
      {error ? <p className="sm:col-span-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function MarkAvailableAtStore({
  productId,
  stores,
  onChanged,
}: {
  productId: number;
  stores: Store[];
  onChanged: () => void;
}) {
  const [storeId, setStoreId] = useState(String(stores[0]?.id ?? ""));
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = code.trim();
    if (!storeId || !trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/stock", {
        method: "PATCH",
        body: JSON.stringify({ storeId: Number(storeId), productId, consigneeCode: trimmed }),
      });
      toast.success("Available at store");
      setCode("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark this product available.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 className="font-medium">Made to order at a store</h3>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        Save that shop’s product code to put this on their Stock tab and Consignment Stock Listing at quantity 0.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor={`mto-store-${productId}`}>
            Store
          </label>
          <select
            id={`mto-store-${productId}`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor={`mto-code-${productId}`}>
            Consignee code
          </label>
          <Input
            id={`mto-code-${productId}`}
            className="h-10"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Store’s own code"
          />
        </div>
        <Button
          variant="outline"
          className="h-10"
          disabled={!storeId || !code.trim() || saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save code"}
        </Button>
        {error ? <p className="sm:col-span-3 text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
