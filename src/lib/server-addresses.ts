export type ServerAddressGroup = "mac" | "wifi" | "remote";

export type ServerAddress = {
  href: string;
  group: ServerAddressGroup;
  label: string;
  detail: string;
};

export type ServerAddressSection = {
  id: ServerAddressGroup;
  title: string;
  explanation: string;
  addresses: ServerAddress[];
};

const SECTION_COPY: Record<ServerAddressGroup, { title: string; explanation: string }> = {
  mac: {
    title: "On this Mac",
    explanation:
      "These open the tracker on the computer that is running it. 127.0.0.1 means this computer. A Docker address, often 172.17 or 192.168.65, is a virtual adapter on the Mac. Phones, iPads, and the Mac Mini use one of the addresses further down.",
  },
  wifi: {
    title: "Same Wi-Fi — local addresses",
    explanation:
      "Use these from a phone, iPad, or another computer on the same Wi-Fi as the Mac. No Tailscale app is required. A name ending in .local is the Mac’s Bonjour name. A 192.168, 10, or 172.16 number is the Mac’s address on that Wi-Fi. If several local numbers are listed, pick the one shown in System Settings → Network on the Mac. These addresses work only while the device is on that Wi-Fi.",
  },
  remote: {
    title: "Away from that Wi-Fi — non-local addresses",
    explanation:
      "These stay reachable when the device is not on the shop Wi-Fi. A number from 100.64 to 100.127 is a Tailscale address, separate from the Wi-Fi address above. Use it from the Mac Mini, or from an iPhone or iPad with Tailscale connected. A short name such as homeserver is the Tailscale machine name. An address ending in ts.net is the Tailscale web link. Any other hostname here was set on the server, for example a Caddy name.",
  },
};

function hostnameOf(href: string) {
  try {
    return new URL(href).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return "";
  }
}

function ipv4(host: string) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return null;
  return parts;
}

function isTailscaleIpv4(parts: number[]) {
  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

function isDockerIpv4(parts: number[]) {
  if (parts[0] === 172 && parts[1] === 17) return true;
  if (parts[0] === 192 && parts[1] === 168 && (parts[2] === 64 || parts[2] === 65)) return true;
  return false;
}

function isPrivateIpv4(parts: number[]) {
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function addressKind(href: string): { group: ServerAddressGroup; label: string; detail: string; sort: number } {
  const host = hostnameOf(href);
  const parts = ipv4(host);
  if (host === "localhost" || host === "::1" || parts?.[0] === 127) {
    return { group: "mac", label: "This Mac", detail: "Browser on the Mac that is running the app.", sort: 0 };
  }
  if (parts && isDockerIpv4(parts)) {
    return {
      group: "mac",
      label: "Docker on this Mac",
      detail: "A virtual adapter on the Mac. Phones on the Wi-Fi should use a local address below.",
      sort: 1,
    };
  }
  if (host.endsWith(".local")) {
    return { group: "wifi", label: "Bonjour name", detail: "The Mac’s name on the local network.", sort: 0 };
  }
  if (parts && isPrivateIpv4(parts)) {
    return { group: "wifi", label: "Wi-Fi address", detail: "Local network address for devices on this Wi-Fi.", sort: 1 };
  }
  if (parts && isTailscaleIpv4(parts)) {
    return {
      group: "remote",
      label: "Tailscale address",
      detail: "Works off the shop Wi-Fi when Tailscale is connected.",
      sort: 1,
    };
  }
  if (host.startsWith("fd7a:115c:a1e0:")) {
    return {
      group: "remote",
      label: "Tailscale address",
      detail: "Works off the shop Wi-Fi when Tailscale is connected.",
      sort: 1,
    };
  }
  if (host.endsWith(".ts.net")) {
    return { group: "remote", label: "Tailscale web address", detail: "The Tailscale link for this Mac.", sort: 2 };
  }
  if (host && !host.includes(".")) {
    return {
      group: "remote",
      label: "Tailscale name",
      detail: "The Tailscale machine name. It resolves when Tailscale is connected.",
      sort: 0,
    };
  }
  if (parts) {
    return {
      group: "remote",
      label: "Public address",
      detail: "A public internet address, outside the home Wi-Fi and outside Tailscale’s 100.64–100.127 range.",
      sort: 3,
    };
  }
  return {
    group: "remote",
    label: "Other address",
    detail: "A hostname set on the server, outside the home Wi-Fi numbers.",
    sort: 4,
  };
}

export function describeServerAddress(href: string): ServerAddress {
  const kind = addressKind(href);
  return { href, group: kind.group, label: kind.label, detail: kind.detail };
}

export function serverAddressSections(urls: string[], port: number): ServerAddressSection[] {
  const hrefs = [...urls];
  const loopback = `http://127.0.0.1:${port}`;
  const seenHosts = new Set(hrefs.map(hostnameOf));
  if (!seenHosts.has("127.0.0.1") && !seenHosts.has("localhost")) hrefs.unshift(loopback);

  const unique = new Map<string, ReturnType<typeof addressKind> & { href: string }>();
  for (const href of hrefs) {
    if (unique.has(href)) continue;
    unique.set(href, { href, ...addressKind(href) });
  }
  const described = [...unique.values()];

  return (["mac", "wifi", "remote"] as const).map((id) => ({
    id,
    title: SECTION_COPY[id].title,
    explanation: SECTION_COPY[id].explanation,
    addresses: described
      .filter((address) => address.group === id)
      .sort((left, right) => left.sort - right.sort || left.href.localeCompare(right.href))
      .map(({ href, group, label, detail }) => ({ href, group, label, detail })),
  }));
}
