import type { MetadataRoute } from "next";

const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/support", changeFrequency: "monthly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
  { path: "/legal", changeFrequency: "yearly", priority: 0.4 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const baseUrl = new URL(appUrl);

  return PUBLIC_ROUTES.map((route) => ({
    url: new URL(route.path, baseUrl).toString(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
