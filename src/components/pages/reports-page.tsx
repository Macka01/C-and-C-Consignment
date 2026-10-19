"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/feedback";
import { Field, NativeSelect } from "@/components/fields";
import { useResource } from "@/lib/use-resource";
import type { Store } from "@/lib/types";

export function ReportsPage() {
  const stores = useResource<Store[]>("/api/stores");
  const [storeId, setStoreId] = useState("");
  const selected = storeId || (stores.data?.[0] ? String(stores.data[0].id) : "");
  const listingHref = selected ? `/api/print/stock-listing?storeId=${encodeURIComponent(selected)}` : "";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Print and analyse"
        title="Reports"
        lede="Run a printable listing when you need it. Open the PDF to print or save. Photos and period sheets from the shops stay under Consignee Documents."
      />
      {stores.loading && !stores.data ? <LoadingBlock label="Loading stores…" /> : null}
      {stores.error && !stores.data ? <ErrorBlock message={stores.error} onRetry={() => void stores.reload()} /> : null}
      {stores.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Consignment Stock Listing</CardTitle>
            <CardDescription>
              Product name, description, consignee product code, product price, and quantity on hand for one store, with
              total quantity at the bottom.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Store" htmlFor="listing-store">
              <NativeSelect
                id="listing-store"
                value={selected}
                onChange={(event) => setStoreId(event.target.value)}
                disabled={!stores.data.length}
              >
                {stores.data.length === 0 ? <option value="">No stores yet</option> : null}
                {stores.data.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button
              className="h-10"
              nativeButton={false}
              disabled={!selected}
              render={listingHref ? <a href={listingHref} target="_blank" rel="noreferrer" /> : undefined}
            >
              Run report
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
