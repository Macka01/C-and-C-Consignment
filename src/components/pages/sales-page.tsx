"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, RefreshButton } from "@/components/feedback";
import { Field, NativeSelect } from "@/components/fields";
import { useResource } from "@/lib/use-resource";
import { formatDate, formatMoney } from "@/lib/format";
import type { SalesResponse, Store } from "@/lib/types";

export function SalesPage() {
  const stores = useResource<Store[]>("/api/stores");
  const [storeId, setStoreId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams();
  if (storeId) params.set("storeId", storeId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const sales = useResource<SalesResponse>(`/api/sales?${params.toString()}`, 15000);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="From the shops"
        title="Sales history"
        lede="Every sale recorded from a consignee report. Filter by store and the dates on the sheet."
        action={<RefreshButton onClick={() => void sales.reload()} />}
      />
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Store" htmlFor="sales-store">
            <NativeSelect id="sales-store" value={storeId} onChange={(event) => setStoreId(event.target.value)}>
              <option value="">All stores</option>
              {(stores.data ?? []).map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="From" htmlFor="sales-from">
            <Input id="sales-from" className="h-10" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="To" htmlFor="sales-to">
            <Input id="sales-to" className="h-10" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </CardContent>
      </Card>
      {(from || to || storeId) && (
        <div>
          <Button
            variant="ghost"
            className="h-9"
            onClick={() => {
              setStoreId("");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      {sales.loading && !sales.data ? <LoadingBlock label="Loading sales…" /> : null}
      {sales.error && !sales.data ? <ErrorBlock message={sales.error} onRetry={() => void sales.reload()} /> : null}
      {sales.data && sales.data.sales.length === 0 ? (
        <EmptyBlock
          title="No sales in this view"
          body="Widen the dates, pick another store, or record a sale from a store’s stock page."
        />
      ) : null}
      {sales.data && sales.data.sales.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {sales.data.sales.length} {sales.data.sales.length === 1 ? "sale" : "sales"} · {sales.data.units}{" "}
            {sales.data.units === 1 ? "piece" : "pieces"} · {formatMoney(sales.data.total)}
          </p>
          <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Store</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Price sold</th>
                  <th className="px-4 py-3 font-medium">Line total</th>
                </tr>
              </thead>
              <tbody>
                {sales.data.sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/products/${sale.productId}`} className="hover:underline">
                        {sale.productName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/stores/${sale.storeId}`} className="hover:underline">
                        {sale.storeName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatDate(sale.occurredOn)}</td>
                    <td className="px-4 py-3">{sale.quantity}</td>
                    <td className="px-4 py-3">{formatMoney(sale.unitPrice)}</td>
                    <td className="px-4 py-3">{formatMoney(sale.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {sales.data.sales.map((sale) => (
              <li key={sale.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <Link href={`/products/${sale.productId}`} className="font-medium hover:underline">
                  {sale.productName}
                </Link>
                <p className="text-sm text-muted-foreground">
                  <Link href={`/stores/${sale.storeId}`} className="hover:underline">
                    {sale.storeName}
                  </Link>
                  {" · "}
                  {formatDate(sale.occurredOn)}
                </p>
                <p className="mt-2 text-sm">
                  {sale.quantity} × {formatMoney(sale.unitPrice)} · {formatMoney(sale.lineTotal)}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
