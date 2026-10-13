import type { NextConfig } from "next";
import os from "node:os";

function devOrigins() {
  const hosts = new Set(["127.0.0.1", "localhost"]);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4") hosts.add(entry.address);
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  // Live stock must render on each request. Cache Components blocks
  // usePathname/useParams and leaves the browser on the loading shell.
  cacheComponents: false,
  // Dev assets are tied to localhost. Phones and 127.0.0.1 need an explicit allow.
  allowedDevOrigins: devOrigins(),
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
