"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { captureKlyxProductEvent } from "@/lib/klyx-product-analytics-client";

const PROVIDER_PATH = /^\/providers\/[^/]+$/;
const BOOKING_FORM_PATH = /^\/providers\/[^/]+\/book$/;
const BOOKING_DETAIL_PATH = /^\/bookings\/[^/]+$/;

const VISIT_STARTED_STORAGE_KEY =
  "klyx:product-analytics-visit-started";

export default function KlyxProductAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  const previousPathRef = useRef<string | null>(null);
  const seenSearchesRef = useRef(new Set<string>());
  const bookingInProgressRef = useRef(false);
  const abandonmentSentRef = useRef(false);

  useEffect(() => {
    let shouldCapture = true;

    try {
      if (
        window.sessionStorage.getItem(VISIT_STARTED_STORAGE_KEY) ===
        "1"
      ) {
        shouldCapture = false;
      } else {
        window.sessionStorage.setItem(VISIT_STARTED_STORAGE_KEY, "1");
      }
    } catch {
      // Analytics storage availability must never affect navigation.
    }

    if (shouldCapture) {
      captureKlyxProductEvent("visit started");
    }
  }, []);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const currentIsBookingForm = BOOKING_FORM_PATH.test(pathname);
    const currentIsConfirmedBooking =
      BOOKING_DETAIL_PATH.test(pathname) &&
      searchParams.get("created") === "1";

    if (pathname === "/recommendations" && searchKey) {
      const localDedupeKey = `${pathname}?${searchKey}`;

      if (!seenSearchesRef.current.has(localDedupeKey)) {
        seenSearchesRef.current.add(localDedupeKey);
        captureKlyxProductEvent("service searched");
      }
    }

    if (
      PROVIDER_PATH.test(pathname) &&
      previousPath !== pathname
    ) {
      captureKlyxProductEvent("provider opened");
    }

    if (
      currentIsConfirmedBooking &&
      bookingInProgressRef.current
    ) {
      bookingInProgressRef.current = false;
      abandonmentSentRef.current = true;
      captureKlyxProductEvent("booking confirmed");
    } else if (
      bookingInProgressRef.current &&
      previousPath &&
      BOOKING_FORM_PATH.test(previousPath) &&
      !currentIsBookingForm
    ) {
      bookingInProgressRef.current = false;

      if (!abandonmentSentRef.current) {
        abandonmentSentRef.current = true;
        captureKlyxProductEvent("booking abandoned");
      }
    }

    if (
      currentIsBookingForm &&
      (!previousPath || !BOOKING_FORM_PATH.test(previousPath))
    ) {
      bookingInProgressRef.current = true;
      abandonmentSentRef.current = false;
      captureKlyxProductEvent("booking started");
    }

    previousPathRef.current = pathname;
  }, [pathname, searchKey, searchParams]);

  useEffect(() => {
    function handlePageHide() {
      if (
        bookingInProgressRef.current &&
        !abandonmentSentRef.current
      ) {
        abandonmentSentRef.current = true;
        bookingInProgressRef.current = false;
        captureKlyxProductEvent("booking abandoned");
      }
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return null;
}
