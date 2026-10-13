import type { Metadata } from "next";
import { InvoicesPage } from "@/components/pages/invoices-page";

export const metadata: Metadata = { title: "Invoices" };

export default function Page() {
  return <InvoicesPage />;
}
