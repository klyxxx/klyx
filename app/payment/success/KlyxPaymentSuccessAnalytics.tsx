"use client";

import { useEffect } from "react";

import { captureKlyxProductEvent } from "@/lib/klyx-product-analytics-client";

export default function KlyxPaymentSuccessAnalytics() {
  useEffect(() => {
    captureKlyxProductEvent("payment confirmed");
  }, []);

  return null;
}
