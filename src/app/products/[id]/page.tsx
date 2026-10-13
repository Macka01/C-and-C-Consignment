import type { Metadata } from "next";
import { ProductDetailPage } from "@/components/pages/product-detail-page";

export const metadata: Metadata = { title: "Product" };

export default function Page() {
  return <ProductDetailPage />;
}
