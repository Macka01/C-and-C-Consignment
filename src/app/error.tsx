"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl bg-card px-4 py-6 ring-1 ring-destructive/30">
      <h1 className="font-heading text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message || "The page could not be shown."}</p>
      <Button className="mt-4 h-10" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
