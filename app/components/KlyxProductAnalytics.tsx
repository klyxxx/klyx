"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { captureKlyxProductEvent } from "@/lib/klyx-product-analytics-client";
import { createClient } from "@/lib/supabase/client";

const PROVIDER_PATH = /^\/providers\/[^/]+$/;
const BOOKING_FORM_PATH = /^\/providers\/[^/]+\/book$/;
const BOOKING_DETAIL_PATH = /^\/bookings\/[^/]+$/;

const FRESH_SIGNUP_WINDOW_MS = 5 * 60 * 1000;

function isFreshlyCreatedAuthUser(user: {
  created_at?: string;
  last_sign_in_at?: string;
}): boolean {
  if (!user.created_at || !user.last_sign_in_at) {
    return false;
  }

  const createdAt = Date.parse(user.created_at);
  const lastSignInAt = Date.parse(user.last_sign_in_at);
  const now = Date.now();

  if (!Number.isFinite(createdAt) || !Number.isFinite(lastSignInAt)) {
    return false;
  }

  return (
    Math.abs(lastSignInAt - createdAt) <= FRESH_SIGNUP_WINDOW_MS &&
    now - lastSignInAt >= 0 &&
    now - lastSignInAt <= FRESH_SIGNUP_WINDOW_MS
  );
}

export default function KlyxProductAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  const previousPathRef = useRef<string | null>(null);
  const seenSearchesRef = useRef(new Set<string>());
  const bookingInProgressRef = useRef(false);
  const abandonmentSentRef = useRef(false);
  const signupCapturedRef = useRef(false);

  useEffect(() => {
    if (pathname !== "/onboarding" || signupCapturedRef.current) {
      return;
    }

    let active = true;
    const supabase = createClient();

    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();

        if (
          active &&
          !signupCapturedRef.current &&
          data.user &&
          isFreshlyCreatedAuthUser(data.user)
        ) {
          signupCapturedRef.current = true;
          captureKlyxProductEvent("account signed up");
        }
      } catch {
        // Analytics classification must never affect onboarding.
      }
    })();

    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const currentIsBookingForm = BOOKING_FORM_PATH.test(pathname);
    const currentIsConfirmedBooking =
      BOOKING_DETAIL_PATH.test(pathname) &&
      searchParams.get("created") === "1";

    if (previousPath === "/login" && pathname === "/dashboard") {
      captureKlyxProductEvent("account signed in");
    }

    if (
      previousPath === "/signup" &&
      pathname === "/onboarding" &&
      !signupCapturedRef.current
    ) {
      signupCapturedRef.current = true;
      captureKlyxProductEvent("account signed up");
    }

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
