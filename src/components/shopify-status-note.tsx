"use client";

import { createContext, useContext } from "react";
import { cn } from "cn";
import { useResource } from "@/lib/use-resource";
import {
  SHOPIFY_STATUS_CONNECTING,
  SHOPIFY_STATUS_UNREACHABLE,
  type ShopifyStatusTone,
  type ShopifyStatusView,
} from "@/lib/shopify-status";

const DOT: Record<ShopifyStatusTone, string> = {
  pending: "animate-pulse bg-amber-500",
  ok: "bg-emerald-500 shadow-[0_0_6px] shadow-emerald-500/80",
  warn: "bg-amber-600",
  error: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

const FALLBACK_CONNECTING: ShopifyStatusView = {
  message: SHOPIFY_STATUS_CONNECTING,
  tone: "pending",
  detail: null,
};

const ShopifyStatusContext = createContext<ShopifyStatusView>(FALLBACK_CONNECTING);

export function ShopifyStatusProvider({ children }: { children: React.ReactNode }) {
  const status = useResource<ShopifyStatusView>("/api/shopify/status", 3000);
  const view: ShopifyStatusView = status.data ?? (status.error
    ? { message: SHOPIFY_STATUS_UNREACHABLE, tone: "error", detail: status.error }
    : FALLBACK_CONNECTING);
  return <ShopifyStatusContext.Provider value={view}>{children}</ShopifyStatusContext.Provider>;
}

export function ShopifyStatusNote({ className }: { className?: string }) {
  const view = useContext(ShopifyStatusContext);

  return (
    <div className={cn("grid gap-0.5", className)} role="status" aria-live="polite">
      <p className="flex items-start gap-2 text-xs leading-5 text-foreground/80">
        <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", DOT[view.tone])} aria-hidden="true" />
        <span>{view.message}</span>
      </p>
      {view.detail ? (
        <p className="line-clamp-2 pl-3.5 text-[0.7rem] leading-4 text-muted-foreground">{view.detail}</p>
      ) : null}
    </div>
  );
}
