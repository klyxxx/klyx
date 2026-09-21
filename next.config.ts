import type { NextConfig } from "next";

import { buildKlyxSecurityHeaders } from "./lib/security-headers";

const isVercelProduction = process.env.VERCEL_ENV === "production";
const releaseSha = process.env.KLYX_RELEASE_SHA?.trim().toLowerCase() ?? "";
const releaseShaValid = /^[0-9a-f]{40}$/.test(releaseSha);
const turnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

if (isVercelProduction && !releaseShaValid) {
  throw new Error(
    "KLYX production deploy blocked: KLYX_RELEASE_SHA must be the exact 40-character certified main SHA."
  );
}

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
  env: {
    KLYX_BUILD_RELEASE_SHA: releaseShaValid ? releaseSha : "",
  },
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
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/brain/respond",
          destination: "/api/assistant/respond",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
