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

type ShareFn = (data: { files: File[]; title: string }) => Promise<void>;

/** Try the iPad share sheet. Do not require canShare — iOS often says no and then shares anyway. */
export async function trySharePdf(file: File, title: string, shareFn?: ShareFn): Promise<"shared" | "unsupported"> {
  const share =
    shareFn ??
    (typeof navigator !== "undefined" && typeof navigator.share === "function"
      ? (data: { files: File[]; title: string }) => navigator.share(data)
      : undefined);
  if (typeof share !== "function") return "unsupported";
  try {
    await share({ files: [file], title });
    return "shared";
  } catch (error) {
    if (isShareCancel(error)) throw error;
    return "unsupported";
  }
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadPdf(file: File) {
  downloadFile(file);
}
