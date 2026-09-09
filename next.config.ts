import type { NextConfig } from "next";

import { buildKlyxSecurityHeaders } from "./lib/security-headers";

const isVercelProduction = process.env.VERCEL_ENV === "production";
const turnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

if (isVercelProduction && !turnstileSiteKey) {
  throw new Error(
    "KLYX production deploy blocked: NEXT_PUBLIC_TURNSTILE_SITE_KEY is required."
  );
}

const securityHeaders = buildKlyxSecurityHeaders({
  production: isVercelProduction,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85, 92],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
