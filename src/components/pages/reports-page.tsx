"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorBlock, LoadingBlock, PageHeader, RefreshButton } from "@/components/feedback";
import { Field, NativeSelect } from "@/components/fields";
import { ReportPanel } from "@/components/report-panel";
import { useResource } from "@/lib/use-resource";
import type { ReportRecord, Store } from "@/lib/types";

export function ReportsPage() {
  const stores = useResource<Store[]>("/api/stores");
  const [storeId, setStoreId] = useState("");
  const [period, setPeriod] = useState("");
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (storeId) params.set("storeId", storeId);
    if (period) params.set("period", period);
    return `/api/reports?${params.toString()}`;
  }, [storeId, period]);
  const reports = useResource<ReportRecord[]>(query);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="From the counter"
        title="Consignee reports"
        lede="Photos and PDFs of each shop’s period sheet, saved on this server so the studio and the shops are looking at the same file."
        action={<RefreshButton onClick={() => void reports.reload()} />}
      />
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Show store" htmlFor="filter-store">
            <NativeSelect id="filter-store" value={storeId} onChange={(event) => setStoreId(event.target.value)}>
              <option value="">All stores</option>
              {(stores.data ?? []).map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Show period" hint="Leave blank to see every saved report." htmlFor="filter-period">
            <Input id="filter-period" className="h-10" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
          </Field>
        </CardContent>
      </Card>
      {stores.loading && !stores.data ? <LoadingBlock label="Loading stores…" /> : null}
      {stores.error && !stores.data ? <ErrorBlock message={stores.error} onRetry={() => void stores.reload()} /> : null}
      {reports.loading && !reports.data ? <LoadingBlock label="Loading reports…" /> : null}
      {reports.error && !reports.data ? <ErrorBlock message={reports.error} onRetry={() => void reports.reload()} /> : null}
      {stores.data && reports.data ? (
        <ReportPanel stores={stores.data} reports={reports.data} onChanged={() => void reports.reload()} />
      ) : null}
    </div>
  );
}
