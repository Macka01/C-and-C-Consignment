"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/fields";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "That access code is not right.");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Could not reach the tracker. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6">
      <div>
        <p className="font-heading text-3xl text-foreground">Cotton & Clay</p>
        <p className="mt-1 text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Consignment tracker</p>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Enter the shared access code. The same code is used on the Mini, iPad, and iPhone.
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border border-border bg-card p-5">
        <Field label="Access code" htmlFor="access-code">
          <Input
            id="access-code"
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="h-11 text-base"
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={busy || !code.trim()}>
          {busy ? "Checking…" : "Open the tracker"}
        </Button>
      </form>
    </div>
  );
}
