"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ShopifyRetrievingContext = createContext<{
  begin: () => void;
  end: () => void;
} | null>(null);

export function ShopifyRetrievingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (count <= 0) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 150);
    return () => window.clearTimeout(timer);
  }, [count]);

  return (
    <ShopifyRetrievingContext.Provider
      value={{
        begin: () => setCount((n) => n + 1),
        end: () => setCount((n) => Math.max(0, n - 1)),
      }}
    >
      {children}
      <Dialog open={open}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
              Retrieving Shopify data
            </DialogTitle>
            <DialogDescription>
              Stock, sales, and transfers are being read from Shopify. This can take a little while.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </ShopifyRetrievingContext.Provider>
  );
}

export function useShopifyRetrieving(active: boolean) {
  const ctx = useContext(ShopifyRetrievingContext);
  useEffect(() => {
    if (!active || !ctx) return;
    ctx.begin();
    return () => ctx.end();
  }, [active, ctx]);
}
