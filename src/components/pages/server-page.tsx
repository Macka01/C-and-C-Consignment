"use client";

import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/feedback";
import { useResource } from "@/lib/use-resource";
import type { NetworkInfo } from "@/lib/types";

export function ServerPage() {
  const network = useResource<NetworkInfo>("/api/network");
  const onMac = network.data?.externalData === true;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Where the data lives"
        title="The server"
        lede="The iPhone, Mac Mini, and any other shop computer only open this page. The records stay on the Mac that is running the app."
      />

      {network.loading && !network.data ? <LoadingBlock label="Looking up the server…" /> : null}
      {network.error && !network.data ? <ErrorBlock message={network.error} onRetry={() => void network.reload()} /> : null}

      <section className="rounded-xl border border-primary/20 bg-card px-4 py-4 ring-1 ring-foreground/5">
        <h2 className="font-heading text-xl text-foreground">The Mac running the app keeps the records</h2>
        <p className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">
          {onMac ? (
            <>
              Stores, stock, sales, invoices, and shop reports are on that Mac in{" "}
              <span className="text-foreground">Library/Application Support/CottonAndClay/data</span> (
              <span className="text-foreground">consignment.db</span> and the reports folder).
            </>
          ) : (
            <>
              Stores, stock, sales, invoices, and shop reports are in the <span className="text-foreground">data</span> folder next to the app (
              <span className="text-foreground">consignment.db</span> and the reports folder).
            </>
          )}{" "}
          The device you are using to view this page does not keep its own copy.
        </p>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          On iPhone or iPad: Safari → Share → Add to Home Screen, using one of the addresses below.
        </p>
        {network.data ? (
          <div className="mt-4">
            <p className="text-base">Open the app from another device:</p>
            {network.data.urls.length > 0 ? (
              <ul className="mt-2 grid gap-1">
                {network.data.urls.map((href) => (
                  <li key={href}>
                    <a className="block break-all text-base font-medium text-primary underline-offset-2 hover:underline" href={href}>
                      {href}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-base leading-7 text-muted-foreground">
                No network address was found. From another device, open http://&lt;the Mac’s address&gt;:{network.data.port} while the app is running.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
