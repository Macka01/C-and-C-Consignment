"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-heading text-3xl font-medium tracking-tight text-balance text-foreground sm:text-4xl">
          {title}
        </h1>
        {lede ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{lede}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl bg-card px-4 py-5 ring-1 ring-destructive/30" role="alert">
      <p className="font-medium text-foreground">That didn’t load</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button className="mt-4 h-10" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyBlock({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-8 text-center">
      <p className="font-heading text-xl text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <Button variant="outline" className="h-10" onClick={onClick} disabled={busy}>
      {busy ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
