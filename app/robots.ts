import type { MetadataRoute } from "next";

const PRIVATE_PREFIXES = [
  "/api/",
  "/admin/",
  "/founder/",
  "/accounts",
  "/dashboard",
  "/messages",
  "/notifications",
  "/settings",
  "/profile",
  "/bookings",
  "/booking-groups",
  "/connect",
  "/checkout",
  "/payments",
  "/provider/",
  "/reset-password",
  "/delete-account",
] as const;

export default function robots(): MetadataRoute.Robots {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const baseUrl = new URL(appUrl);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_PREFIXES],
    },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
    host: baseUrl.origin,
  };
}
