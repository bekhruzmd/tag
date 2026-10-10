import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TAG — Campus hide & seek",
    short_name: "TAG",
    description: "The campus is your playground.",
    start_url: "/",
    display: "standalone",
    background_color: "#111512",
    theme_color: "#111512",
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
