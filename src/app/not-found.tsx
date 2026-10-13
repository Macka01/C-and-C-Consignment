import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-xl bg-card px-4 py-6 ring-1 ring-foreground/10">
      <h1 className="font-heading text-2xl">That page isn’t in the tracker</h1>
      <p className="mt-2 text-sm text-muted-foreground">The link may be old. Head back to the shelves.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
