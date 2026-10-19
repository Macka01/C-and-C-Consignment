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
  // Slim image for the Mac Docker service.
  output: "standalone",
  // Live stock must render on each request. Cache Components blocks
  // usePathname/useParams and leaves the browser on the loading shell.
  cacheComponents: false,
  // Dev assets are tied to localhost. Phones and 127.0.0.1 need an explicit allow.
  allowedDevOrigins: devOrigins(),
  serverExternalPackages: ["better-sqlite3", "pdf-lib"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/better-sqlite3/**/*",
      "./scripts/backup-data.mjs",
      "./public/cotton-and-clay-logo.png",
      "./public/icon-192.png",
      "./public/icon-512.png",
    ],
  },
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
