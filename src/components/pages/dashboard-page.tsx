"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock, PageHeader, RefreshButton } from "@/components/feedback";
import { MovementList } from "@/components/movement-list";
import { useResource } from "@/lib/use-resource";
import { commissionLabel, formatMoney, formatPeriod, rentLabel } from "@/lib/format";
import type { Dashboard, NetworkInfo } from "@/lib/types";

export function DashboardPage() {
  const dashboard = useResource<Dashboard>("/api/dashboard", 15000);
  const network = useResource<NetworkInfo>("/api/network");
  const sharedServer = network.data?.externalData === true;
  const bannerTitle = network.loading
    ? "What’s on this server"
    : sharedServer
      ? "This computer is the shared server"
      : "Sample shelves, ready to edit";
  const bannerBody = sharedServer
    ? "Stores, stock, sales, invoices, and shop reports are kept in the data repository on this computer. Every phone and shop computer that opens an address below — on Tailscale or on the studio Wi-Fi — sees those same records."
    : network.loading
      ? "Stores, stock, sales, invoices, and shop reports are kept on this computer. Every phone and shop computer that opens this server sees the same records."
      : "Harbour Linen, Terrigal Home Room, Gosford Goods, and Woy Woy Window are made-up shops so you can try the tracker. Change a phone number, record a sale, or delete a store. Nothing is locked. Every phone and shop computer that opens this server sees the same records.";

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Studio desk"
        title="What’s out on consignment"
        lede="Cotton & Clay stock sitting with consignee stores, plus the sales, invoices, and shop reports that come back."
        action={<RefreshButton onClick={() => void dashboard.reload()} />}
      />

      <div className="rounded-xl border border-primary/20 bg-card px-4 py-4 ring-1 ring-foreground/5">
        <p className="font-heading text-lg text-foreground">{bannerTitle}</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{bannerBody}</p>
        {network.data && network.data.urls.length > 0 ? (
          <p className="mt-3 text-sm">
            Other devices:{" "}
            {network.data.urls.map((href) => (
              <a key={href} className="mr-3 font-medium text-primary underline-offset-2 hover:underline" href={href}>
                {href}
              </a>
            ))}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            From another device, open http://&lt;this computer’s IP&gt;:43123 while this server is running. On Tailscale, use the Mac’s MagicDNS name on port 43123.
          </p>
        )}
      </div>

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
