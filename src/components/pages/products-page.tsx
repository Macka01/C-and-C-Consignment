"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, RefreshButton } from "@/components/feedback";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { useResource } from "@/lib/use-resource";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductsPage() {
  const products = useResource<Product[]>("/api/products", { shopify: true });
  const [open, setOpen] = useState(false);
  const groups = new Map<string, Product[]>();
  for (const product of products.data ?? []) {
    const list = groups.get(product.productGroup) ?? [];
    list.push(product);
    groups.set(product.productGroup, list);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        lede="The catalog. Shopify creates products when they appear at a consignee location. Quantity and sales come from Shopify."
        action={
          <>
            <RefreshButton onClick={() => void products.reload()} />
            <Button className="h-10" onClick={() => setOpen(true)}>
              Add a product
            </Button>
          </>
        }
      />
      {products.loading && !products.data ? <LoadingBlock label="Retrieving Shopify data…" /> : null}
      {products.error && !products.data ? <ErrorBlock message={products.error} onRetry={() => void products.reload()} /> : null}
      {products.data && products.data.length === 0 ? (
        <EmptyBlock
          title="The catalog is empty"
          body="Shopify creates products when they appear at a consignee location, or add one here."
          action={
            <Button className="h-10" onClick={() => setOpen(true)}>
              Add a product
            </Button>
          }
        />
      ) : null}
      {[...groups.entries()].map(([group, items]) => (
        <section key={group} className="grid gap-3">
          <h2 className="font-heading text-2xl">{group}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((product) => (
              <li key={product.id}>
                <Link href={`/products/${product.id}`} className="block h-full rounded-xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-primary/40">
                  <p className="font-medium">{product.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                  <p className="mt-3 text-sm">
                    {formatMoney(product.retailPrice)} · {product.units} on shelves · {product.storeCount}{" "}
                    {product.storeCount === 1 ? "store" : "stores"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ProductFormDialog open={open} onOpenChange={setOpen} onSaved={() => void products.reload()} />
    </div>
  );
}
