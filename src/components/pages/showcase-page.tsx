"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CopyShowcaseLink } from "@/components/copy-showcase-link";
import { ErrorBlock, LoadingBlock } from "@/components/feedback";
import { formatMoney } from "@/lib/format";
import type { ProductShowcase } from "@/lib/showcase";
import { useResource } from "@/lib/use-resource";

export function ShowcasePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const showcase = useResource<ProductShowcase>(params.id ? `/api/showcase/${params.id}` : null);
  const piece = showcase.data;

  useEffect(() => {
    if (!piece || !params.id) return;
    if (piece.path !== `/showcase/${params.id}`) router.replace(piece.path);
  }, [piece, params.id, router]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cotton-and-clay-logo.png"
          alt=""
          width={56}
          height={56}
          className="size-14 rounded-full bg-white object-cover ring-1 ring-foreground/15"
        />
        <div>
          <p className="font-heading text-2xl leading-none">Cotton & Clay</p>
          <p className="mt-1 text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">For shop owners</p>
        </div>
      </header>

      {showcase.loading && !piece ? <LoadingBlock label="Loading this piece…" /> : null}
      {showcase.error && !piece ? <ErrorBlock message={showcase.error} onRetry={() => void showcase.reload()} /> : null}
      {piece ? <ShowcaseBody piece={piece} /> : null}
    </div>
  );
}

function ShowcaseBody({ piece }: { piece: ProductShowcase }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = piece.photos[photoIndex] ?? piece.photos[0];

  return (
    <article className="grid gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
        <ShowcasePhotos
          photos={piece.photos}
          title={piece.title}
          selectedIndex={photoIndex}
          onSelect={setPhotoIndex}
          selected={photo}
        />
        <div className="grid gap-5">
          {piece.productGroup ? (
            <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">{piece.productGroup}</p>
          ) : null}
          <div>
            <h1 className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">{piece.title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-pretty text-muted-foreground">
              What Cotton & Clay can supply to your shop. Retail prices for each finish we keep in the catalog.
            </p>
          </div>
          {piece.description ? <p className="max-w-xl text-base leading-7">{piece.description}</p> : null}
          <CopyShowcaseLink path={piece.path} />
        </div>
      </div>

      <section className="grid gap-3">
        <h2 className="font-heading text-2xl">Available variants</h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          {piece.variants.length === 1
            ? "This piece is listed as one finish in the catalog."
            : "Each finish has its own retail price. Quantities at a shop are agreed separately."}
        </p>
        <ul className="grid gap-3">
          {piece.variants.map((variant) => (
            <li
              key={variant.id}
              className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              {variant.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={variant.imageUrl}
                  alt=""
                  className="size-16 shrink-0 rounded-lg bg-secondary object-cover ring-1 ring-foreground/10"
                />
              ) : (
                <div className="size-16 shrink-0 rounded-lg bg-secondary ring-1 ring-foreground/10" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{variant.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{variant.catalogName}</p>
              </div>
              <p className="shrink-0 text-base font-medium">{formatMoney(variant.price)}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm leading-6 text-muted-foreground">
        Cotton & Clay places work on consignment. This page is the piece itself — not a shop’s current shelf.
      </p>
    </article>
  );
}

function ShowcasePhotos({
  photos,
  title,
  selectedIndex,
  onSelect,
  selected,
}: {
  photos: ProductShowcase["photos"];
  title: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
  selected?: ProductShowcase["photos"][number];
}) {
  if (!photos.length) {
    return (
      <div className="grid aspect-square place-items-center rounded-2xl bg-secondary text-center ring-1 ring-foreground/10">
        <p className="max-w-xs px-4 text-sm text-muted-foreground">
          Photos for {title} appear here once they have been pulled from Shopify.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={selected?.url}
        alt={selected?.alt || title}
        className="aspect-square w-full rounded-2xl bg-secondary object-cover ring-1 ring-foreground/10"
      />
      {photos.length > 1 ? (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <li key={`${photo.productId}-${photo.url}`}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-pressed={index === selectedIndex}
                className={`block overflow-hidden rounded-lg ring-2 ${
                  index === selectedIndex ? "ring-primary" : "ring-transparent hover:ring-foreground/20"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.alt} className="aspect-square w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
