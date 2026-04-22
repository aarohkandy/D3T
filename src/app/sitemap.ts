import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = new URL(siteUrl);
  const now = new Date();

  return ["/", "/privacy", "/terms", "/presskit"].map((path) => ({
    url: new URL(path, baseUrl).toString(),
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "yearly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
