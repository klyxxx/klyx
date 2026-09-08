import { ImageResponse } from "next/og";

import KlyxSocialCard from "@/app/components/KlyxSocialCard";

export const alt = "KLYX — Tous vos services, simplement";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<KlyxSocialCard />, size);
}
