"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from "@/components/feedback";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MovementList } from "@/components/movement-list";
import { ShopifyMatchNote, ShopifyStockNote } from "@/components/shopify-qty";
import { StockMovementSummary } from "@/components/stock-summary";
import { api } from "@/lib/api-client";
import { useResource } from "@/lib/use-resource";
import { formatMoney } from "@/lib/format";
import type { ProductDetail } from "@/lib/types";

export function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const detail = useResource<ProductDetail>(params.id ? `/api/products/${params.id}` : null, { shopify: true });
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const product = detail.data?.product;

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
                <Button variant="outline" className="h-10" onClick={() => setEditing(true)}>
                  Edit product
                </Button>
                <Button variant="ghost" className="h-10" onClick={() => setRemoving(true)}>
                  Delete
                </Button>
              </>
            }
          />
          <p className="text-sm">
            Retail {formatMoney(product.retailPrice)} · {product.units} on shelves across {product.storeCount}{" "}
            {product.storeCount === 1 ? "store" : "stores"}
          </p>

          <section className="grid gap-3">
            <h2 className="font-heading text-2xl">Stock by store</h2>
            <ShopifyStockNote shopify={detail.data.shopify} />
            {detail.data.stock.length === 0 ? (
              <EmptyBlock title="Not at a store yet" body="Shopify will place it here when it has quantity at a matching location." />
            ) : (
              <ul className="grid gap-3">
                {detail.data.stock.map((line) => (
                  <li key={line.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                    <div>
                      <Link href={`/stores/${line.storeId}`} className="font-medium hover:underline">
                        {line.storeName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        Code {line.consigneeCode || "not set"}
                      </p>
                    </div>
                    <StockMovementSummary line={line} />
                    <ShopifyMatchNote line={line} />
                  </li>
                ))}
              </ul>
            )}
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
          <ConfirmDialog
            open={removing}
            onOpenChange={setRemoving}
            title={`Delete ${product.name}?`}
            body="A product that is already on a shelf, or that has transfers and sales, has to stay so the history still makes sense. Edit it instead."
            confirmLabel="Delete product"
            onConfirm={async () => {
              await api(`/api/products/${product.id}`, { method: "DELETE" });
              toast.success("Product deleted");
              router.push("/products");
            }}
          />
        </>
      ) : null}
    </div>
  );
}
