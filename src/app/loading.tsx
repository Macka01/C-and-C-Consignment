import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-3" aria-busy="true">
      <p className="text-sm text-muted-foreground">Opening the tracker…</p>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
