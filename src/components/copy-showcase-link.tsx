"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export function CopyShowcaseLink({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState(path);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Showcase link copied.");
    } catch {
      toast.message(url);
    }
  }

  return (
    <Button
      className={cn("h-12 min-h-12 touch-manipulation px-5 text-base", className)}
      type="button"
      variant="outline"
      onClick={() => void copy()}
    >
      Copy link
    </Button>
  );
}
