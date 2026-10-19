import type { Metadata } from "next";
import { DocumentsPage } from "@/components/pages/documents-page";

export const metadata: Metadata = { title: "Consignee Documents" };

export default function Page() {
  return <DocumentsPage />;
}
