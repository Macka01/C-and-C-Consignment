import type { Metadata } from "next";
import { SalesPage } from "@/components/pages/sales-page";

export const metadata: Metadata = { title: "Sales" };

export default function Page() {
  return <SalesPage />;
}
