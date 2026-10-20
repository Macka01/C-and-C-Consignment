"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/feedback";
import { formatMoney } from "@/lib/format";
import { downloadPdf, filenameFromDisposition, isShareCancel, trySharePdf } from "@/lib/share-pdf";
import { buildStockListing, calendarDateInSydney } from "@/lib/stock-listing";
import { useResource } from "@/lib/use-resource";
import type { StoreDetail } from "@/lib/types";

export function StockListingPage() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId");
  const detail = useResource<StoreDetail>(storeId ? `/api/stores/${storeId}` : null, { shopify: true });
  const [busy, setBusy] = useState<"email" | "pdf" | null>(null);
  const listingHref = storeId ? `/api/print/stock-listing?storeId=${encodeURIComponent(storeId)}` : "";
  const listing = useMemo(() => {
    if (!detail.data) return null;
    return buildStockListing(detail.data.store.name, calendarDateInSydney(), detail.data.stock);
  }, [detail.data]);

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
    if (!listing) return;
    setBusy("email");
    try {
      const file = await listingPdf();
      const result = await trySharePdf(file, listing.title);
      if (result === "unsupported") {
        downloadPdf(file);
        const subject = encodeURIComponent(`${listing.title} — ${listing.storeName}`);
        const body = encodeURIComponent(
          `The ${listing.title} for ${listing.storeName} (${listing.reportDate}) was saved as ${file.name}. Attach that PDF from Downloads.`,
        );
        window.setTimeout(() => {
          window.location.href = `mailto:?subject=${subject}&body=${body}`;
        }, 400);
        toast.message("The PDF was saved to Downloads. Attach it in the Mail message.");
      }
    } catch (error) {
      if (isShareCancel(error)) return;
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
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/reports" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Reports
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button className="h-10" disabled={!listing} onClick={() => window.print()}>
            Print
          </Button>
          <Button className="h-10" variant="outline" disabled={!listing || busy !== null} onClick={() => void emailListing()}>
            {busy === "email" ? "Preparing…" : "Email"}
          </Button>
          <Button className="h-10" variant="outline" disabled={!listing || busy !== null} onClick={() => void savePdf()}>
            {busy === "pdf" ? "Saving…" : "Save PDF"}
          </Button>
        </div>
      </div>
      {!storeId ? <ErrorBlock message="Choose a store on Reports first." /> : null}
      {storeId && detail.loading && !detail.data ? <LoadingBlock label="Retrieving Shopify data…" /> : null}
      {storeId && detail.error && !detail.data ? (
        <ErrorBlock message={detail.error} onRetry={() => void detail.reload()} />
      ) : null}
      {listing ? (
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
              <h1 className="mt-2 text-lg font-medium">{listing.title}</h1>
            </div>
          </header>
          <p className="text-sm">
            Store: {listing.storeName}
            <br />
            Date of report: {listing.reportDate}
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
                {listing.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-muted-foreground">
                      No stock on hand at this store.
                    </td>
                  </tr>
                ) : (
                  listing.groups.map((section, sectionIndex) => (
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
                  <td className="px-2 py-2 text-right">{listing.totalQuantity}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>
      ) : null}
    </div>
  );
}
