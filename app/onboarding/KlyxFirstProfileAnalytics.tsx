"use client";

import { useEffect } from "react";

import { captureKlyxProductEvent } from "@/lib/klyx-product-analytics-client";

const FIRST_PROFILE_PENDING_KEY =
  "klyx:product-analytics-first-profile-pending";
const FIRST_PROFILE_CAPTURED_KEY =
  "klyx:product-analytics-first-profile-created";

type Phase = "pending" | "completed";

export function completeKlyxFirstProfileAnalytics(): void {
  try {
    if (typeof window === "undefined") {
      return;
    }

    if (
      window.sessionStorage.getItem(FIRST_PROFILE_CAPTURED_KEY) === "1"
    ) {
      window.sessionStorage.removeItem(FIRST_PROFILE_PENDING_KEY);
      return;
    }

    if (window.sessionStorage.getItem(FIRST_PROFILE_PENDING_KEY) !== "1") {
      return;
    }

    window.sessionStorage.setItem(FIRST_PROFILE_CAPTURED_KEY, "1");
    window.sessionStorage.removeItem(FIRST_PROFILE_PENDING_KEY);
    captureKlyxProductEvent("profile created");
  } catch {
    // Analytics storage availability must never affect onboarding.
  }
}

export default function KlyxFirstProfileAnalytics({ phase }: { phase: Phase }) {
  useEffect(() => {
    if (phase === "completed") {
      completeKlyxFirstProfileAnalytics();
      return;
    }

    try {
      window.sessionStorage.setItem(FIRST_PROFILE_PENDING_KEY, "1");
    } catch {
      // Analytics storage availability must never affect onboarding.
    }
  }, [phase]);

  return null;
}
