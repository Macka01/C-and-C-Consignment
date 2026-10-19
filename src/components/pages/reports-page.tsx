"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/feedback";
import { Field, NativeSelect } from "@/components/fields";
import { canShareFiles, filenameFromDisposition, isShareCancel } from "@/lib/share-pdf";
import { useResource } from "@/lib/use-resource";
import type { Store } from "@/lib/types";

export function ReportsPage() {
  const stores = useResource<Store[]>("/api/stores");
  const [storeId, setStoreId] = useState("");
  const [sharing, setSharing] = useState(false);
  const selected = storeId || (stores.data?.[0] ? String(stores.data[0].id) : "");
  const listingHref = selected ? `/api/print/stock-listing?storeId=${encodeURIComponent(selected)}` : "";

  async function printOrEmail() {
    if (!listingHref) return;
    setSharing(true);
    try {
      const response = await fetch(listingHref);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "The report could not be created.");
      }
      const blob = await response.blob();
      const filename =
        filenameFromDisposition(response.headers.get("content-disposition")) ?? "consignment-stock-listing.pdf";
      const file = new File([blob], filename, { type: "application/pdf" });
      if (canShareFiles([file])) {
        await navigator.share({ files: [file], title: "Consignment Stock Listing" });
        return;
      }
      window.open(listingHref, "_blank", "noopener,noreferrer");
      toast.message("On an iPad, tap Share on the PDF, then choose Print or Mail.");
    } catch (error) {
      if (isShareCancel(error)) return;
      toast.error(error instanceof Error ? error.message : "The report could not be shared.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Print and analyse"
        title="Reports"
        lede="Run a printable listing when you need it. On an iPad, tap Print or email, then choose Print or Mail. Photos and period sheets from the shops stay under Consignee Documents."
      />
      {stores.loading && !stores.data ? <LoadingBlock label="Loading stores…" /> : null}
      {stores.error && !stores.data ? <ErrorBlock message={stores.error} onRetry={() => void stores.reload()} /> : null}
      {stores.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Consignment Stock Listing</CardTitle>
            <CardDescription>
              Product name, description, consignee product code, product price, and quantity on hand for one store, with
              total quantity at the bottom. Print uses AirPrint. Mail sends the PDF as an attachment. The tracker does
              not send email itself.
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
              <Button
                className="h-10"
                nativeButton={false}
                disabled={!selected}
                render={listingHref ? <a href={listingHref} target="_blank" rel="noreferrer" /> : undefined}
              >
                Run report
              </Button>
              <Button
                className="h-10"
                variant="outline"
                disabled={!selected || sharing}
                onClick={() => void printOrEmail()}
              >
                {sharing ? "Preparing…" : "Print or email"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
