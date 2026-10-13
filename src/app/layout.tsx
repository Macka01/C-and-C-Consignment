import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Outfit } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Consignment tracker",
    template: "%s · Cotton & Clay",
  },
  description:
    "Shared tracker for Cotton and Clay stock, sales, invoices, and consignee reports.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className={`${outfit.variable} ${fraunces.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
