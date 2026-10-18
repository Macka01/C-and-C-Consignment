"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock, PageHeader, RefreshButton } from "@/components/feedback";
import { MovementList } from "@/components/movement-list";
import { useResource } from "@/lib/use-resource";
import { commissionLabel, formatMoney, formatPeriod, rentLabel } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

export function DashboardPage() {
  const dashboard = useResource<Dashboard>("/api/dashboard", 15000);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Studio desk"
        title="What’s out on consignment"
        lede="Cotton & Clay stock at consignee locations, with sales and transfers from Shopify. Invoices and shop reports stay here."
        action={<RefreshButton onClick={() => void dashboard.reload()} />}
      />

      {dashboard.loading && !dashboard.data ? <LoadingBlock label="Loading the shelves…" /> : null}
      {dashboard.error && !dashboard.data ? <ErrorBlock message={dashboard.error} onRetry={() => void dashboard.reload()} /> : null}
      {dashboard.error && dashboard.data ? (
        <p className="text-sm text-destructive" role="alert">
          Couldn’t refresh: {dashboard.error}
        </p>
      ) : null}

      {dashboard.data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Stores" value={String(dashboard.data.storeCount)} detail="Consignee shops" />
            <Stat label="On the shelves" value={String(dashboard.data.unitsOnHand)} detail="Pieces out with stores" />
            <Stat label="Retail value" value={formatMoney(dashboard.data.retailValue)} detail="At catalog price" />
            <Stat
              label="Sales this month"
              value={formatMoney(dashboard.data.salesThisMonth.total)}
              detail={`${dashboard.data.salesThisMonth.count} sales in ${formatPeriod(dashboard.data.salesThisMonth.period)}`}
            />
          </section>

          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-2xl">Stores</h2>
              <Link href="/stores" className="text-sm font-medium text-primary hover:underline">
                All stores
              </Link>
            </div>
            {dashboard.data.stores.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stores yet. Add the first consignee shop.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-3">
                {dashboard.data.stores.map((store) => (
                  <Link key={store.id} href={`/stores/${store.id}`} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-primary/40">
                    <p className="font-heading text-xl">{store.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{store.contactName}</p>
                    <p className="mt-3 text-sm">
                      {store.units} on hand · {formatMoney(store.retailValue)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">{rentLabel(store.rentAmount)}</Badge>
                      <Badge variant="outline">{commissionLabel(store.commissionRate)}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <h2 className="font-heading text-2xl">Latest movements</h2>
            <MovementList
              movements={dashboard.data.recentMovements}
              showStore
              emptyTitle="No movements yet"
              emptyBody="Transfer stock into a store, or record a sale from a shop report."
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-2 font-heading text-3xl text-foreground">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
