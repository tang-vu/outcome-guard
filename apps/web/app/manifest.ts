import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OutcomeGuard — policy-bound portfolio protection",
    short_name: "OutcomeGuard",
    description: "Portfolio-aware BTC and ETH protection through DreamDEX Event Contracts on Somnia Shannon.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1e9",
    theme_color: "#0b7959",
    icons: [{ src: "/icon", sizes: "32x32", type: "image/png" }]
  };
}
