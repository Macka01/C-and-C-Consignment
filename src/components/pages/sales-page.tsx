"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, RefreshButton } from "@/components/feedback";
import { Field, NativeSelect } from "@/components/fields";
import { SalesChart } from "@/components/sales-chart";
import { useResource } from "@/lib/use-resource";
import { formatDate, formatMoney, todayInputValue } from "@/lib/format";
import { monthBounds, shiftDays, shiftMonths } from "@/lib/sales-series";
import type { SalesResponse, Store } from "@/lib/types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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
  const rows = sales.data?.sales ?? [];
  const units = rows.reduce((sum, sale) => sum + sale.quantity, 0);
  const total = roundMoney(rows.reduce((sum, sale) => sum + (sale.lineTotal ?? 0), 0));
  const today = todayInputValue();
  const thisMonth = monthBounds(today);
  const last30 = { from: shiftDays(today, -29), to: today };
  const last90 = { from: shiftMonths(today, -3), to: today };
  const presets = [
    { id: "all", label: "All dates", from: "", to: "" },
    { id: "month", label: "This month", ...thisMonth },
    { id: "30", label: "Last 30 days", ...last30 },
    { id: "90", label: "Last 3 months", ...last90 },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="From the shops"
        title="Sales history"
        lede="Filter by store and dates. The totals, the chart, and the list all use that same selection."
        action={<RefreshButton onClick={() => void sales.reload()} />}
      />
      <Card>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
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
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const active = from === preset.from && to === preset.to;
              return (
                <Button
                  key={preset.id}
                  type="button"
                  variant={active ? "secondary" : "outline"}
                  className="h-9"
                  onClick={() => {
                    setFrom(preset.from);
                    setTo(preset.to);
                  }}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {sales.loading && !sales.data ? <LoadingBlock label="Loading sales…" /> : null}
      {sales.error && !sales.data ? <ErrorBlock message={sales.error} onRetry={() => void sales.reload()} /> : null}

      {sales.data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Totals for the current selection">
            <Total label="Sales" value={String(rows.length)} detail={rows.length === 1 ? "line in this view" : "lines in this view"} />
            <Total label="Pieces" value={String(units)} detail={units === 1 ? "piece sold" : "pieces sold"} />
            <Total label="Amount" value={formatMoney(total)} detail="Sum of the line totals shown" />
          </section>

          <Card>
            <CardContent className="grid gap-2">
              <h2 className="font-heading text-2xl">Sales over time</h2>
              <SalesChart sales={rows} from={from} to={to} />
            </CardContent>
          </Card>

          {rows.length === 0 ? (
            <EmptyBlock
              title="No sales in this view"
              body="Widen the dates, pick another store, or record a sale from a store’s stock page."
            />
          ) : (
            <>
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
                    {rows.map((sale) => (
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
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40 font-medium">
                      <td className="px-4 py-3" colSpan={3}>
                        Total for this selection
                      </td>
                      <td className="px-4 py-3">{units}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3">{formatMoney(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <ul className="grid gap-3 md:hidden">
                {rows.map((sale) => (
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
                <li className="rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/10">
                  <p className="text-sm text-muted-foreground">Total for this selection</p>
                  <p className="mt-1 font-heading text-2xl">{formatMoney(total)}</p>
                  <p className="text-sm text-muted-foreground">
                    {units} {units === 1 ? "piece" : "pieces"} · {rows.length} {rows.length === 1 ? "sale" : "sales"}
                  </p>
                </li>
              </ul>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

function Total({ label, value, detail }: { label: string; value: string; detail: string }) {
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
