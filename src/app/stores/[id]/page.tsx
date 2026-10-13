import type { Metadata } from "next";
import { StoreDetailPage } from "@/components/pages/store-detail-page";

export const metadata: Metadata = { title: "Store" };

export default function Page() {
  return <StoreDetailPage />;
}
