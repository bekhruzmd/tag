import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TAG: campus hide and seek",
    short_name: "TAG",
    description: "Hide and seek on your phone with a shrinking safe zone.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1230",
    theme_color: "#0a1230",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
