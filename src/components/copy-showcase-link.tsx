"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CopyShowcaseLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Showcase link copied.");
    } catch {
      toast.message("Select the link and copy it.");
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="showcase-link">
          Share this page
        </label>
        <Input id="showcase-link" className="h-10" readOnly value={url} onFocus={(event) => event.target.select()} />
      </div>
      <Button className="h-10" type="button" onClick={() => void copy()}>
        Copy link
      </Button>
    </div>
  );
}
