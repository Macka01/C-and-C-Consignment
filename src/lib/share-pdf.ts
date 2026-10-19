/** Pull the PDF filename out of a Content-Disposition header. */
export function filenameFromDisposition(header: string | null) {
  if (!header) return null;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) return decodeURIComponent(utf[1].trim());
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const plain = header.match(/filename=([^;]+)/i);
  return plain?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

export function isShareCancel(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function canShareFiles(files: File[]) {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files });
}
