"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/feedback";
import { Field, NativeSelect } from "@/components/fields";
import { useResource } from "@/lib/use-resource";
import type { Store } from "@/lib/types";

export function ReportsPage() {
  const router = useRouter();
  const stores = useResource<Store[]>("/api/stores");
  const [storeId, setStoreId] = useState("");
  const selected = storeId || (stores.data?.[0] ? String(stores.data[0].id) : "");
  const listingPath = selected ? `/reports/listing?storeId=${encodeURIComponent(selected)}` : "";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Print and analyse"
        title="Reports"
        lede="Run a printable listing when you need it. The listing has Print, Email, and Save PDF — the Mac Mini and iPad cannot print from a raw PDF tab. Photos and period sheets from the shops stay under Consignee Documents."
      />
      {stores.loading && !stores.data ? <LoadingBlock label="Loading stores…" /> : null}
      {stores.error && !stores.data ? <ErrorBlock message={stores.error} onRetry={() => void stores.reload()} /> : null}
      {stores.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Consignment Stock Listing</CardTitle>
            <CardDescription>
              Same products as that store’s Stock tab: on hand now, or a prior sale or transfer there. Sorted by
              consignee product code under each Shopify product type. Each row is name, consignee product code, product
              price, and quantity on hand, with total quantity at the bottom. Run report and Print or email both open
              the listing. Use Print for the printer dialog, Email for a Mail draft with the PDF attached, or Save PDF.
              The tracker does not send email itself.
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
            <div className="flex flex-wrap gap-2">
              <Button className="h-10" disabled={!selected} onClick={() => listingPath && router.push(listingPath)}>
                Run report
              </Button>
              <Button
                className="h-10"
                variant="outline"
                disabled={!selected}
                onClick={() => listingPath && router.push(listingPath)}
              >
                Print or email
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
