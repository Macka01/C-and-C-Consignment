import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingBlock } from "@/components/feedback";
import { StockListingPage } from "@/components/pages/stock-listing-page";

export const metadata: Metadata = { title: "Consignment Stock Listing" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading listing…" />}>
      <StockListingPage />
    </Suspense>
  );
}
