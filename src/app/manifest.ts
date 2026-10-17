import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cotton & Clay",
    short_name: "Cotton & Clay",
    description: "Shared consignment tracker for Cotton and Clay.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F4EEE4",
    theme_color: "#C45A32",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
