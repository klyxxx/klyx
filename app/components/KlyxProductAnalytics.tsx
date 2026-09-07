"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { captureKlyxProductEvent } from "@/lib/klyx-product-analytics-client";
import { createClient } from "@/lib/supabase/client";

const PROVIDER_PATH = /^\/providers\/[^/]+$/;
const BOOKING_FORM_PATH = /^\/providers\/[^/]+\/book$/;
const BOOKING_DETAIL_PATH = /^\/bookings\/[^/]+$/;

const FRESH_SIGNUP_WINDOW_MS = 5 * 60 * 1000;
const VISIT_STARTED_STORAGE_KEY =
  "klyx:product-analytics-visit-started";
const SIGNUP_CAPTURED_STORAGE_KEY =
  "klyx:product-analytics-signup-captured";

function isFreshlyCreatedAuthUser(user: {
  created_at?: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  confirmed_at?: string;
}): boolean {
  if (!user.last_sign_in_at) {
    return false;
  }

  const createdAt = user.created_at ? Date.parse(user.created_at) : Number.NaN;
  const lastSignInAt = Date.parse(user.last_sign_in_at);
  const confirmedAtValue = user.email_confirmed_at ?? user.confirmed_at;
  const confirmedAt = confirmedAtValue
    ? Date.parse(confirmedAtValue)
    : Number.NaN;
  const now = Date.now();

  if (!Number.isFinite(lastSignInAt)) {
    return false;
  }

  const isRecentSignIn =
    now - lastSignInAt >= 0 &&
    now - lastSignInAt <= FRESH_SIGNUP_WINDOW_MS;
  const createdMatchesSignIn =
    Number.isFinite(createdAt) &&
    Math.abs(lastSignInAt - createdAt) <= FRESH_SIGNUP_WINDOW_MS;
  const confirmationMatchesSignIn =
    Number.isFinite(confirmedAt) &&
    Math.abs(lastSignInAt - confirmedAt) <= FRESH_SIGNUP_WINDOW_MS;

  return isRecentSignIn && (createdMatchesSignIn || confirmationMatchesSignIn);
}

function wasSignupCapturedInSession(): boolean {
  try {
    return window.sessionStorage.getItem(SIGNUP_CAPTURED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSignupCapturedInSession(): void {
  try {
    window.sessionStorage.setItem(SIGNUP_CAPTURED_STORAGE_KEY, "1");
  } catch {
    // Analytics storage availability must never affect authentication.
  }
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
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") {
        return;
      }

      if (pathname === "/login") {
        captureKlyxProductEvent("account signed in");
        return;
      }

      if (
        pathname === "/signup" &&
        !signupCapturedRef.current &&
        !wasSignupCapturedInSession()
      ) {
        signupCapturedRef.current = true;
        markSignupCapturedInSession();
        captureKlyxProductEvent("account signed up");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/onboarding" || signupCapturedRef.current) {
      return;
    }

    if (wasSignupCapturedInSession()) {
      signupCapturedRef.current = true;
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
          markSignupCapturedInSession();
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
