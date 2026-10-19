"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useShopifyRetrieving } from "@/components/shopify-retrieving";
import { api } from "@/lib/api-client";

type ResourceState<T> = {
  url: string | null;
  data: T | null;
  error: string | null;
};

type ResourceOptions = {
  refreshMs?: number;
  shopify?: boolean;
};

function withRefreshParam(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}refresh=1`;
}

export function useResource<T>(url: string | null, refreshOrOptions?: number | ResourceOptions) {
  const refreshMs = typeof refreshOrOptions === "number" ? refreshOrOptions : refreshOrOptions?.refreshMs;
  const shopify = typeof refreshOrOptions === "object" ? Boolean(refreshOrOptions?.shopify) : false;
  const requestId = useRef(0);
  const [state, setState] = useState<ResourceState<T>>({
    url: null,
    data: null,
    error: null,
  });

  const reload = useCallback(async (opts?: { fresh?: boolean }) => {
    if (!url) return;
    const id = requestId.current;
    const requested = url;
    const fetchUrl = opts?.fresh ? withRefreshParam(url) : url;
    try {
      const next = await api<T>(fetchUrl);
      if (requestId.current !== id) return;
      setState({ url: requested, data: next, error: null });
    } catch (err) {
      if (requestId.current !== id) return;
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setState((current) => ({
        url: requested,
        data: current.url === requested ? current.data : null,
        error: message,
      }));
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const id = ++requestId.current;
    const requested = url;
    let cancelled = false;
    void (async () => {
      try {
        const next = await api<T>(requested);
        if (cancelled || requestId.current !== id) return;
        setState({ url: requested, data: next, error: null });
      } catch (err) {
        if (cancelled || requestId.current !== id) return;
        setState({
          url: requested,
          data: null,
          error: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  useEffect(() => {
    if (!refreshMs) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs, reload]);

  const matches = state.url === url;
  const loading = Boolean(url) && !matches;
  useShopifyRetrieving(shopify && loading);
  return {
    data: matches ? state.data : null,
    error: matches ? state.error : null,
    loading,
    reload,
  };
}
