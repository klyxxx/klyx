"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const COMMON_ROUTES = [
  "/dashboard", "/accounts", "/profile", "/settings", "/notifications", "/messages",
];

const CLIENT_ROUTES = [
  "/brain", "/search", "/bookings", "/favorites", "/memory",
  "/recommendations", "/request", "/trust",
];

const PROVIDER_ROUTES = [
  "/provider", "/provider/services/new", "/provider/zones",
  "/provider/planning", "/provider/assistant", "/provider/quotes",
  "/provider/payments", "/provider/trust", "/provider/verification",
  "/bookings", "/scores",
];

type Props = {
  accountType: "client" | "provider";
};

export default function KlyxRoutePrefetch({ accountType }: Props) {
  const router = useRouter();

  useEffect(() => {
    const routes =
      accountType === "provider"
        ? [...COMMON_ROUTES, ...PROVIDER_ROUTES]
        : [...COMMON_ROUTES, ...CLIENT_ROUTES];

    const timer = window.setTimeout(() => {
      for (const route of Array.from(new Set(routes))) {
        router.prefetch(route);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [accountType, router]);

  return null;
}
