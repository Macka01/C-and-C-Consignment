export function ProductPhoto({
  url,
  name,
  size = "md",
}: {
  url: string | null | undefined;
  name: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-14" : "size-16";
  if (!url) {
    return <div className={`${box} shrink-0 rounded-lg bg-secondary ring-1 ring-foreground/10`} aria-hidden />;
  }
  return (
    // Local file from the Mac data folder, not Shopify CDN.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className={`${box} shrink-0 rounded-lg bg-secondary object-cover ring-1 ring-foreground/10`}
    />
  );
}
