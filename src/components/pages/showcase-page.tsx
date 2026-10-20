"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CopyShowcaseLink } from "@/components/copy-showcase-link";
import { ErrorBlock, LoadingBlock } from "@/components/feedback";
import { formatMoney } from "@/lib/format";
import type { ProductShowcase, ShowcasePhoto, ShowcaseVariant } from "@/lib/showcase";
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
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {showcase.loading && !piece ? (
        <div className="px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <LoadingBlock label="Loading this piece…" />
        </div>
      ) : null}
      {showcase.error && !piece ? (
        <div className="px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <ErrorBlock message={showcase.error} onRetry={() => void showcase.reload()} />
        </div>
      ) : null}
      {piece ? <ShowcaseFloor piece={piece} /> : null}
    </div>
  );
}

function ShowcaseFloor({ piece }: { piece: ProductShowcase }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = piece.photos[photoIndex];
  const activeVariantId = photo?.productId ?? piece.variants[0]?.id;

  function showPhotoForVariant(variant: ShowcaseVariant) {
    const index = piece.photos.findIndex((item) => item.productId === variant.id);
    if (index >= 0) setPhotoIndex(index);
  }

  return (
    <div className="grid min-h-[100dvh] flex-1 overflow-x-clip lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.85fr)]">
      <ShowcaseStage
        title={piece.title}
        photos={piece.photos}
        index={photoIndex}
        onIndex={setPhotoIndex}
      />
      <aside className="flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-y-contain px-[max(1.25rem,env(safe-area-inset-right))] py-6 pl-[max(1.25rem,env(safe-area-inset-left))] lg:py-8 lg:pl-8 lg:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pt-[max(1.25rem,env(safe-area-inset-top))] lg:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cotton-and-clay-logo.png"
              alt=""
              width={56}
              height={56}
              className="size-12 shrink-0 rounded-full bg-white object-cover ring-1 ring-foreground/15 sm:size-14"
            />
            <div className="min-w-0">
              <p className="font-heading text-2xl leading-none sm:text-3xl">Cotton & Clay</p>
            </div>
          </div>
          <CopyShowcaseLink path={piece.path} />
        </header>

        <div className="grid gap-3">
          {piece.productGroup ? (
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">{piece.productGroup}</p>
          ) : null}
          <h1 className="font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl">{piece.title}</h1>
          {piece.description ? (
            <p className="max-w-xl text-lg leading-8 text-pretty text-foreground/85">{piece.description}</p>
          ) : null}
        </div>

        <section className="grid gap-4">
          <h2 className="font-heading text-2xl sm:text-3xl">
            {piece.variants.length === 1 ? "Retail price" : "Finishes and prices"}
          </h2>
          <ul className="grid gap-3">
            {piece.variants.map((variant) => {
              const selected = variant.id === activeVariantId;
              return (
                <li key={variant.id}>
                  <button
                    type="button"
                    onClick={() => showPhotoForVariant(variant)}
                    aria-pressed={selected}
                    className={`flex min-h-20 w-full touch-manipulation items-center gap-4 rounded-2xl px-5 py-4 text-left ring-2 transition-colors ${
                      selected ? "bg-card ring-primary" : "bg-card/80 ring-foreground/10"
                    }`}
                  >
                    {variant.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={variant.imageUrl}
                        alt=""
                        draggable={false}
                        className="size-16 shrink-0 rounded-xl bg-secondary object-cover sm:size-20"
                      />
                    ) : (
                      <div className="size-16 shrink-0 rounded-xl bg-secondary sm:size-20" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 font-heading text-2xl leading-tight sm:text-3xl">{variant.label}</span>
                    <span className="shrink-0 font-heading text-3xl tabular-nums sm:text-4xl">
                      {formatMoney(variant.price)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="mt-auto text-base leading-7 text-muted-foreground">
          Retail prices for this piece. How many sit in a shop is agreed separately.
        </p>
      </aside>
    </div>
  );
}

function ShowcaseStage({
  title,
  photos,
  index,
  onIndex,
}: {
  title: string;
  photos: ShowcasePhoto[];
  index: number;
  onIndex: (index: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (next: number) => {
      if (!photos.length) return;
      const clamped = Math.max(0, Math.min(photos.length - 1, next));
      onIndex(clamped);
      const root = scrollerRef.current;
      const slide = root?.children[clamped] as HTMLElement | undefined;
      slide?.scrollIntoView({ inline: "start", block: "nearest", behavior: "smooth" });
    },
    [onIndex, photos.length],
  );

  function onScroll() {
    const root = scrollerRef.current;
    if (!root?.clientWidth) return;
    const next = Math.round(root.scrollLeft / root.clientWidth);
    if (next !== index && next >= 0 && next < photos.length) onIndex(next);
  }

  if (!photos.length) {
    return (
      <div className="grid min-h-[46dvh] place-items-center bg-secondary px-8 text-center lg:min-h-full">
        <p className="max-w-md font-heading text-2xl leading-snug text-muted-foreground">
          Photos for {title} appear here once they have been pulled from Shopify.
        </p>
      </div>
    );
  }

  return (
    <section className="relative min-h-[46dvh] bg-secondary lg:min-h-[100dvh]">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex h-[46dvh] snap-x snap-mandatory overflow-x-auto overscroll-x-contain lg:h-[100dvh] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {photos.map((item) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${item.productId}-${item.url}`}
            src={item.url}
            alt={item.alt || title}
            draggable={false}
            className="h-full w-full min-w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      {photos.length > 1 ? (
        <>
          <button
            type="button"
            className="absolute top-1/2 left-[max(0.75rem,env(safe-area-inset-left))] z-10 flex size-14 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm ring-1 ring-foreground/10 disabled:opacity-40"
            aria-label="Previous photo"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
          >
            <ChevronLeft className="size-8" />
          </button>
          <button
            type="button"
            className="absolute top-1/2 right-[max(0.75rem,env(safe-area-inset-right))] z-10 flex size-14 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm ring-1 ring-foreground/10 disabled:opacity-40 lg:right-3"
            aria-label="Next photo"
            onClick={() => goTo(index + 1)}
            disabled={index === photos.length - 1}
          >
            <ChevronRight className="size-8" />
          </button>
          <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex justify-center gap-2 lg:bottom-6">
            {photos.map((item, photoIndex) => (
              <button
                key={`${item.productId}-${item.url}-dot`}
                type="button"
                aria-label={`Photo ${photoIndex + 1} of ${photos.length}`}
                aria-current={photoIndex === index}
                onClick={() => goTo(photoIndex)}
                className={`h-4 touch-manipulation rounded-full ${
                  photoIndex === index ? "w-10 bg-primary" : "w-4 bg-background/80 ring-1 ring-foreground/20"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
