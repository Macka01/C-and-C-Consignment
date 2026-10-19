"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const resourceCache = new Map<string, unknown>();

function withRefreshParam(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}refresh=1`;
}

const PAGE_OPEN_TIMEOUT_MS = 20_000;
const REFRESH_TIMEOUT_MS = 70_000;

function requestSignal(timeoutMs: number) {
  return AbortSignal.timeout(timeoutMs);
}

function cachedState<T>(url: string | null): ResourceState<T> {
  if (url && resourceCache.has(url)) {
    return { url, data: resourceCache.get(url) as T, error: null };
  }
  return { url: null, data: null, error: null };
}

function remember<T>(url: string, data: T) {
  resourceCache.set(url, data);
}

export function useResource<T>(url: string | null, refreshOrOptions?: number | ResourceOptions) {
  const refreshMs = typeof refreshOrOptions === "number" ? refreshOrOptions : refreshOrOptions?.refreshMs;
  const requestId = useRef(0);
  const [state, setState] = useState<ResourceState<T>>(() => cachedState(url));

  const reload = useCallback(async (opts?: { fresh?: boolean }) => {
    if (!url) return;
    const id = requestId.current;
    const requested = url;
    const fetchUrl = opts?.fresh ? withRefreshParam(url) : url;
    try {
      const next = await api<T>(fetchUrl, {
        signal: requestSignal(opts?.fresh ? REFRESH_TIMEOUT_MS : PAGE_OPEN_TIMEOUT_MS),
      });
      if (requestId.current !== id) return;
      remember(requested, next);
      setState({ url: requested, data: next, error: null });
    } catch (err) {
      if (requestId.current !== id) return;
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setState((current) => ({
        url: requested,
        data: current.url === requested ? current.data : cachedState<T>(requested).data,
        error: message,
      }));
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const id = ++requestId.current;
    const requested = url;
    const cached = cachedState<T>(requested);
    if (cached.data !== null) {
      setState(cached);
    }
    let cancelled = false;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, requestSignal(PAGE_OPEN_TIMEOUT_MS)]);
    void (async () => {
      try {
        const next = await api<T>(requested, { signal });
        if (cancelled || requestId.current !== id) return;
        remember(requested, next);
        setState({ url: requested, data: next, error: null });
      } catch (err) {
        if (cancelled || requestId.current !== id) return;
        setState((current) => ({
          url: requested,
          data: current.url === requested ? current.data : cached.data,
          error: err instanceof Error ? err.message : "Something went wrong.",
        }));
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
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
  return {
    data: matches ? state.data : null,
    error: matches ? state.error : null,
    loading,
    reload,
  };
}
