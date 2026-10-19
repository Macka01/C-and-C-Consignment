"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  const [dismissed, setDismissed] = useState(false);
  const begin = useCallback(() => setCount((n) => n + 1), []);
  const end = useCallback(() => setCount((n) => Math.max(0, n - 1)), []);
  const api = useMemo(() => ({ begin, end }), [begin, end]);

  useEffect(() => {
    if (count <= 0) {
      setOpen(false);
      setDismissed(false);
      return;
    }
    if (dismissed) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 150);
    return () => window.clearTimeout(timer);
  }, [count, dismissed]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDismissed(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <ShopifyRetrievingContext.Provider value={api}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setDismissed(true);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
              Retrieving Shopify data
            </DialogTitle>
            <DialogDescription>
              Stock, sales, and transfers are being read from Shopify. This can take a little while. Close to keep using
              the last saved copy while it finishes.
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
