import type { Metadata } from "next";
import { StoresPage } from "@/components/pages/stores-page";

export const metadata: Metadata = { title: "Stores" };

export default function Page() {
  return <StoresPage />;
}
