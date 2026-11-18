"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/feedback";
import { Field, NativeSelect } from "@/components/fields";
import { formatMoney } from "@/lib/format";
import { listingEmailHref } from "@/lib/listing-email";
import { downloadFile, downloadPdf, filenameFromDisposition } from "@/lib/share-pdf";
import { stockListingSort, type StockListing } from "@/lib/stock-listing";
import { useResource } from "@/lib/use-resource";

export function StockListingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId");
  const sort = stockListingSort(searchParams.get("sort"));
  const listingQuery = new URLSearchParams();
  if (storeId) listingQuery.set("storeId", storeId);
  if (sort === "code") listingQuery.set("sort", sort);
  const listingHref = storeId ? `/api/print/stock-listing?${listingQuery.toString()}` : "";

  function changeSort(value: string) {
    const next = stockListingSort(value);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "code") params.set("sort", next);
    else params.delete("sort");
    router.replace(`/reports/listing?${params.toString()}`);
  }
  const listing = useResource<StockListing>(listingHref ? `${listingHref}&format=json` : null, {
    wait: true,
  });
  const [busy, setBusy] = useState<"email" | "pdf" | null>(null);
  const report = listing.data;

  async function listingPdf() {
    if (!listingHref) throw new Error("Choose a store on Reports first.");
    const response = await fetch(listingHref);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "The report could not be created.");
    }
    const blob = await response.blob();
    const filename =
      filenameFromDisposition(response.headers.get("content-disposition")) ?? "consignment-stock-listing.pdf";
    return new File([blob], filename, { type: "application/pdf" });
  }

  async function emailListing() {
    if (!listingHref) throw new Error("Choose a store on Reports first.");
    setBusy("email");
    try {
      const response = await fetch(listingEmailHref(listingHref));
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "The report could not be emailed.");
      }
      const blob = await response.blob();
      const filename =
        filenameFromDisposition(response.headers.get("content-disposition")) ?? "consignment-stock-listing.eml";
      downloadFile(new File([blob], filename, { type: "message/rfc822" }));
      toast.success("Mail draft saved with the PDF attached. Open it in Mail to send.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The report could not be emailed.");
    } finally {
      setBusy(null);
    }
  }

  async function savePdf() {
    setBusy("pdf");
    try {
      downloadPdf(await listingPdf());
      toast.success("PDF saved to Downloads.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The PDF could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <Link href="/reports" className="mb-2 text-sm text-muted-foreground hover:text-foreground">
            Back to Reports
          </Link>
          <Field label="Sort" htmlFor="listing-sort">
            <NativeSelect
              id="listing-sort"
              className="w-72"
              value={sort}
              disabled={!storeId}
              onChange={(event) => changeSort(event.target.value)}
            >
              <option value="group">Product type</option>
              <option value="code">Consignee code (ungrouped)</option>
            </NativeSelect>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="h-10" disabled={!report} onClick={() => window.print()}>
            Print
          </Button>
          <Button className="h-10" variant="outline" disabled={!report || busy !== null} onClick={() => void emailListing()}>
            {busy === "email" ? "Preparing…" : "Email"}
          </Button>
          <Button className="h-10" variant="outline" disabled={!report || busy !== null} onClick={() => void savePdf()}>
            {busy === "pdf" ? "Saving…" : "Save PDF"}
          </Button>
        </div>
      </div>
      {!storeId ? <ErrorBlock message="Choose a store on Reports first." /> : null}
      {storeId && listing.loading && !report ? <LoadingBlock label="Retrieving Shopify data…" /> : null}
      {storeId && listing.error && !report ? (
        <ErrorBlock message={listing.error} onRetry={() => void listing.reload()} />
      ) : null}
      {report ? (
        <article className="print-listing grid gap-4 text-foreground">
          <header className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cotton-and-clay-logo.png"
              alt=""
              width={56}
              height={56}
              className="size-14 rounded-full bg-white object-cover"
            />
            <div>
              <p className="font-heading text-2xl leading-none">Cotton & Clay</p>
              <h1 className="mt-2 text-lg font-medium">{report.title}</h1>
            </div>
          </header>
          <p className="text-sm">
            Store: {report.storeName}
            <br />
            Date of report: {report.reportDate}
          </p>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="print:table-header-group">
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-2 py-2 font-medium">Product Name</th>
                  <th className="px-2 py-2 font-medium">Consignee Product Code</th>
                  <th className="px-2 py-2 text-right font-medium">Product Price</th>
                  <th className="px-2 py-2 text-right font-medium">Quantity on Hand</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-muted-foreground">
                      No stock on hand at this store.
                    </td>
                  </tr>
                ) : (
                  report.groups.map((section, sectionIndex) => (
                    <Fragment key={`${section.group}-${sectionIndex}`}>
                      {section.group ? (
                        <tr>
                          <th
                            colSpan={4}
                            className="bg-muted/60 px-2 py-2 text-left font-heading text-base font-medium"
                          >
                            {section.group}
                          </th>
                        </tr>
                      ) : null}
                      {section.rows.map((row, index) => (
                        <tr
                          key={`${row.productName}-${row.consigneeCode}-${index}`}
                          className="border-b border-border/80 align-top"
                        >
                          <td className="px-2 py-2">{row.productName}</td>
                          <td className="px-2 py-2">{row.consigneeCode}</td>
                          <td className="px-2 py-2 text-right">{formatMoney(row.price)}</td>
                          <td className="px-2 py-2 text-right">{row.quantityOnHand}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="px-2 py-2" colSpan={3}>
                    Total Quantity
                  </td>
                  <td className="px-2 py-2 text-right">{report.totalQuantity}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>
      ) : null}
    </div>
  );
}
