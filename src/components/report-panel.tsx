"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyBlock } from "@/components/feedback";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FormError, NativeSelect } from "@/components/fields";
import { api } from "@/lib/api-client";
import { formatBytes, formatDateTime, formatPeriod, thisMonthInputValue } from "@/lib/format";
import type { ReportRecord, Store } from "@/lib/types";

export function ReportPanel({
  stores,
  reports,
  fixedStoreId,
  onChanged,
}: {
  stores: Store[];
  reports: ReportRecord[];
  fixedStoreId?: number;
  onChanged: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [storeId, setStoreId] = useState(fixedStoreId ? String(fixedStoreId) : stores[0] ? String(stores[0].id) : "");
  const [period, setPeriod] = useState(thisMonthInputValue());
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [replaceId, setReplaceId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<ReportRecord | null>(null);

  const activeStoreId = fixedStoreId ? String(fixedStoreId) : storeId;

  function choose(next: File | null) {
    setFile(next);
    setError(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a photo or PDF first.");
      return;
    }
    if (!activeStoreId) {
      setError("Choose a store first.");
      return;
    }
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set("storeId", activeStoreId);
    body.set("period", period);
    body.set("notes", notes);
    body.set("file", file);
    try {
      await api("/api/reports", { method: "POST", body });
      toast.success("Report saved on the server");
      setFile(null);
      setNotes("");
      if (cameraRef.current) cameraRef.current.value = "";
      if (uploadRef.current) uploadRef.current.value = "";
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The report could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function replaceFile(next: File | null) {
    if (!next || replaceId === null) return;
    const current = reports.find((report) => report.id === replaceId);
    if (!current) return;
    const body = new FormData();
    body.set("storeId", String(current.storeId));
    body.set("period", current.period);
    body.set("notes", current.notes ?? "");
    body.set("replaceId", String(current.id));
    body.set("file", next);
    try {
      await api("/api/reports", { method: "POST", body });
      toast.success("Report file replaced");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The file could not be replaced.");
    } finally {
      setReplaceId(null);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="grid gap-4">
          <div>
            <p className="font-medium">Save a consignee report</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Take a photo on this phone or upload a picture or PDF. The file stays on the server, so every device can open it later. You can add another file for the same month or replace one.
            </p>
          </div>
          <form className="grid gap-4" onSubmit={(event) => void save(event)}>
            {fixedStoreId ? null : (
              <Field label="Store" htmlFor="report-store">
                <NativeSelect id="report-store" value={activeStoreId} onChange={(event) => setStoreId(event.target.value)} required>
                  {stores.length === 0 ? <option value="">No stores yet</option> : null}
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Period" htmlFor="report-period">
              <Input id="report-period" className="h-10" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} required />
            </Field>
            <Field label="Notes" htmlFor="report-notes">
              <Textarea id="report-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional. What this sheet covers." />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="h-11" onClick={() => cameraRef.current?.click()}>
                Take a photo
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => uploadRef.current?.click()}>
                Upload photo or PDF
              </Button>
            </div>
            <input
              ref={cameraRef}
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => choose(event.target.files?.[0] ?? null)}
            />
            <input
              ref={uploadRef}
              className="sr-only"
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => choose(event.target.files?.[0] ?? null)}
            />
            <p className="text-sm text-muted-foreground">
              {file ? `${file.name} · ${formatBytes(file.size)}` : "No file chosen yet."}
            </p>
            <FormError message={error} />
            <Button type="submit" className="h-11 sm:w-fit" disabled={pending || stores.length === 0}>
              {pending ? "Saving…" : "Save report"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <input
        ref={replaceRef}
        className="sr-only"
        type="file"
        accept="image/*,application/pdf"
        onChange={(event) => void replaceFile(event.target.files?.[0] ?? null)}
      />

      {reports.length === 0 ? (
        <EmptyBlock
          title="No reports saved"
          body="A photo of the shop’s monthly sheet, or their PDF, will sit here against the store and period."
        />
      ) : (
        <ul className="grid gap-4">
          {reports.map((report) => (
            <li key={report.id} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {report.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/reports/${report.id}/file`}
                  alt={`${report.storeName} report for ${formatPeriod(report.period)}`}
                  className="max-h-96 w-full bg-muted object-contain"
                />
              ) : report.mimeType === "application/pdf" ? (
                <iframe title={report.originalName} src={`/api/reports/${report.id}/file`} className="h-80 w-full bg-muted sm:h-96" />
              ) : null}
              <div className="grid gap-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {report.storeName} · {formatPeriod(report.period)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {report.originalName} · {formatBytes(report.sizeBytes)} · saved {formatDateTime(report.createdAt)}
                    </p>
                  </div>
                </div>
                {report.notes ? <p className="text-sm text-muted-foreground">{report.notes}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="h-9"
                    nativeButton={false}
                    render={<a href={`/api/reports/${report.id}/file`} target="_blank" rel="noreferrer" />}
                  >
                    Open file
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      setReplaceId(report.id);
                      replaceRef.current?.click();
                    }}
                  >
                    Replace file
                  </Button>
                  <Button variant="ghost" className="h-9" onClick={() => setRemoving(report)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Delete this report?"
        body="The file is removed from the server. You can upload it again later."
        confirmLabel="Delete report"
        onConfirm={async () => {
          if (!removing) return;
          await api(`/api/reports/${removing.id}`, { method: "DELETE" });
          toast.success("Report deleted");
          onChanged();
        }}
      />
    </div>
  );
}
