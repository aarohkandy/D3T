import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "D3T",
    short_name: "D3T",
    description: "Three-layer Grandfather Tic-Tac-Toe on the web.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e8dbc9",
    theme_color: "#5a4332",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
