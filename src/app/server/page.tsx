import type { Metadata } from "next";
import { ServerPage } from "@/components/pages/server-page";

export const metadata: Metadata = { title: "Server" };

export default function Page() {
  return <ServerPage />;
}
