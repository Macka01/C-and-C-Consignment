export type ShopifyStatusTone = "pending" | "ok" | "warn" | "error" | "muted";

export type ShopifyActivity = {
  configured: boolean;
  inflight: boolean;
  hasSavedCopy: boolean;
  error: string | null;
  warning: string | null;
};

export type ShopifyStatusView = {
  message: string;
  tone: ShopifyStatusTone;
  detail: string | null;
};

export const SHOPIFY_STATUS_CONNECTING = "Connecting to Shopify";
export const SHOPIFY_STATUS_RETRIEVING = "Retrieving Shopify updates";
export const SHOPIFY_STATUS_CURRENT = "Shopify data up to date";
export const SHOPIFY_STATUS_UNSET = "Shopify is not set up";
export const SHOPIFY_STATUS_UNREACHABLE = "Could not reach Shopify";
export const SHOPIFY_STATUS_SAVED = "Showing the last saved copy";
export const SHOPIFY_STATUS_INCOMPLETE = "Some Shopify updates could not be read";

/** Short sidebar line for the background Shopify pull. */
export function describeShopifyStatus(activity: ShopifyActivity): ShopifyStatusView {
  if (!activity.configured) {
    return { message: SHOPIFY_STATUS_UNSET, tone: "muted", detail: null };
  }
  if (activity.inflight) {
    if (activity.hasSavedCopy) {
      return { message: SHOPIFY_STATUS_RETRIEVING, tone: "pending", detail: null };
    }
    return { message: SHOPIFY_STATUS_CONNECTING, tone: "pending", detail: null };
  }
  if (activity.error) {
    if (activity.hasSavedCopy) {
      return { message: SHOPIFY_STATUS_SAVED, tone: "warn", detail: activity.error };
    }
    return { message: SHOPIFY_STATUS_UNREACHABLE, tone: "error", detail: activity.error };
  }
  if (activity.warning) {
    return { message: SHOPIFY_STATUS_INCOMPLETE, tone: "warn", detail: activity.warning };
  }
  if (activity.hasSavedCopy) {
    return { message: SHOPIFY_STATUS_CURRENT, tone: "ok", detail: null };
  }
  return { message: SHOPIFY_STATUS_CONNECTING, tone: "pending", detail: null };
}
