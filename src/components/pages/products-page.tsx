"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, RefreshButton } from "@/components/feedback";
import { ProductPhoto } from "@/components/product-photo";
import { groupByProductGroup } from "@/lib/product-groups";
import { matchesProductSearch } from "@/lib/stock-search";
import { useResource } from "@/lib/use-resource";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductsPage() {
  const products = useResource<Product[]>("/api/products", { refreshMs: 15000, shopify: true });
  const [query, setQuery] = useState("");
  const catalog = products.data;
  const visible = useMemo(
    () => (catalog ?? []).filter((product) => matchesProductSearch(product, query)),
    [catalog, query],
  );
  const groups = useMemo(() => groupByProductGroup(visible), [visible]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        lede="The catalog comes from Shopify. Products appear when they are at a consignee location. Open Showcase on a piece to send that page to a shop owner."
        action={<RefreshButton onClick={() => void products.reload({ fresh: true })} />}
      />
      {products.loading && !products.data ? <LoadingBlock label="Retrieving Shopify data…" /> : null}
      {products.error && !products.data ? <ErrorBlock message={products.error} onRetry={() => void products.reload()} /> : null}
      {catalog && catalog.length === 0 ? (
        <EmptyBlock
          title="The catalog is empty"
          body="Shopify creates products when they appear at a consignee location."
        />
      ) : null}
      {catalog && catalog.length > 0 ? (
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="catalog-search">
            Find a product
          </label>
          <Input
            id="catalog-search"
            type="search"
            className="h-10 max-w-md"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, group, or description"
            autoComplete="off"
          />
        </div>
      ) : null}
      {catalog && catalog.length > 0 && visible.length === 0 ? (
        <EmptyBlock title="No products match" body="Try a different name, group, or description." />
      ) : null}
      {groups.map(({ group, items }) => (
        <section key={group || "ungrouped"} className="grid gap-3">
          {group ? <h2 className="font-heading text-2xl">{group}</h2> : null}
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((product) => (
              <li key={product.id} className="flex h-full flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <Link href={`/products/${product.id}`} className="flex min-w-0 flex-1 gap-3 hover:opacity-90">
                  <ProductPhoto url={product.imageUrl} name={product.name} />
                  <div className="min-w-0">
                    <p className="font-medium">{product.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                    <p className="mt-3 text-sm">
                      {formatMoney(product.retailPrice)} · {product.units} on shelves · {product.storeCount}{" "}
                      {product.storeCount === 1 ? "store" : "stores"}
                    </p>
                  </div>
                </Link>
                <div className="mt-4">
                  <Link
                    href={`/showcase/${product.id}`}
                    className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}
                  >
                    Showcase
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
