import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OPSUCHT Wirtschaft",
    short_name: "OP Wirtschaft",
    description: "Inoffizielles Community-Dashboard für die OPSUCHT-Wirtschaft.",
    start_url: "/",
    display: "standalone",
    background_color: "#cfddd3",
    theme_color: "#17211d",
    lang: "de-DE",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
