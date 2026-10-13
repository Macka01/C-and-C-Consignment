"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, RefreshButton } from "@/components/feedback";
import { StoreFormDialog } from "@/components/store-form-dialog";
import { useResource } from "@/lib/use-resource";
import { commissionLabel, formatMoney, rentLabel } from "@/lib/format";
import type { Store } from "@/lib/types";

export function StoresPage() {
  const stores = useResource<Store[]>("/api/stores");
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Consignees"
        title="Stores"
        lede="Shops holding Cotton & Clay stock. Rent and commission stay blank when they don’t apply."
        action={
          <>
            <RefreshButton onClick={() => void stores.reload()} />
            <Button className="h-10" onClick={() => setOpen(true)}>
              Add a store
            </Button>
          </>
        }
      />
      {stores.loading && !stores.data ? <LoadingBlock label="Loading stores…" /> : null}
      {stores.error && !stores.data ? <ErrorBlock message={stores.error} onRetry={() => void stores.reload()} /> : null}
      {stores.data && stores.data.length === 0 ? (
        <EmptyBlock
          title="No stores yet"
          body="Add the first shop that sells on Cotton & Clay’s behalf."
          action={
            <Button className="h-10" onClick={() => setOpen(true)}>
              Add a store
            </Button>
          }
        />
      ) : null}
      {stores.data && stores.data.length > 0 ? (
        <ul className="grid gap-3">
          {stores.data.map((store) => (
            <li key={store.id}>
              <Link href={`/stores/${store.id}`} className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-primary/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-heading text-2xl">{store.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{store.address}</p>
                    <p className="mt-1 text-sm">
                      {store.contactName} · <span className="text-muted-foreground">{store.phone}</span>
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p>
                      {store.units} on hand · {formatMoney(store.retailValue)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                      <Badge variant="secondary">{rentLabel(store.rentAmount)}</Badge>
                      <Badge variant="outline">{commissionLabel(store.commissionRate)}</Badge>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <StoreFormDialog open={open} onOpenChange={setOpen} onSaved={() => void stores.reload()} />
    </div>
  );
}
