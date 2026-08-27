import type { NextConfig } from "next";

const isVercelProduction = process.env.VERCEL_ENV === "production";
const turnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

if (isVercelProduction && !turnstileSiteKey) {
  throw new Error(
    "KLYX production deploy blocked: NEXT_PUBLIC_TURNSTILE_SITE_KEY is required."
  );
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
