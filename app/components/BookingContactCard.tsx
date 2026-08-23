"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Phone,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  bookingContactReasonMessage,
  formatKlyxBookingContactExpiry,
  translateKlyxBookingContact,
  type KlyxBookingContactMessageKey,
} from "@/lib/klyx-booking-contact-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_REVALIDATED_PHONE_CALL_UI_12_74
// KLYX_BOOKING_CONTACT_I18N_16_11

type ContactPayload = {
  contactAllowed?: boolean;
  canReveal?: boolean;
  revealed?: boolean;
  audited?: boolean;
  phoneNumber?: string | null;
  otherName?: string;
  verified?: boolean;
  accessExpiresAt?: string | null;
  displayExpiresAt?: string | null;
  reason?: string;
  actionRequired?: string;
};

type CallPayload = {
  callAllowed?: boolean;
  phoneNumber?: string;
};

type Props = {
  bookingId: string;
  bookingStatus: string;
  otherName: string;
};

const SESSION_MISSING = "KLYX_BOOKING_CONTACT_SESSION_MISSING";

export default function BookingContactCard({
  bookingId,
  bookingStatus,
  otherName,
}: Props) {
  const { locale } = useKlyxLocale();
  const t = (
    key: KlyxBookingContactMessageKey,
    replacements: Record<string, string> = {}
  ) => translateKlyxBookingContact(locale, key, replacements);

  const [loading, setLoading] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [calling, setCalling] = useState(false);
  const [payload, setPayload] = useState<ContactPayload | null>(null);
  const [errorKey, setErrorKey] =
    useState<KlyxBookingContactMessageKey | null>(null);

  const statusAllowsContact =
    bookingStatus === "accepted" || bookingStatus === "completed";

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error(SESSION_MISSING);
    }

    return accessToken;
  }

  const loadEligibility = useCallback(async () => {
    if (!statusAllowsContact) return;

    setLoading(true);
    setErrorKey(null);

    try {
      const accessToken = await getToken();
      const response = await fetch(
        "/api/bookings/" + encodeURIComponent(bookingId) + "/contact",
        {
          cache: "no-store",
          headers: { Authorization: "Bearer " + accessToken },
        }
      );
      const result = (await response.json()) as ContactPayload;

      if (!response.ok) {
        setPayload({ canReveal: false });
        setErrorKey("contactUnavailable");
        return;
      }

      setPayload(result);
    } catch {
      setPayload({ canReveal: false });
      setErrorKey("contactUnavailable");
    } finally {
      setLoading(false);
    }
  }, [bookingId, statusAllowsContact]);

  useEffect(() => {
    setPayload(null);
    setErrorKey(null);

    if (statusAllowsContact) {
      void loadEligibility();
    }
  }, [statusAllowsContact, loadEligibility]);

  useEffect(() => {
    if (!payload?.revealed || !payload.displayExpiresAt) return;

    const delay = new Date(payload.displayExpiresAt).getTime() - Date.now();

    if (delay <= 0) {
      setPayload((current) =>
        current
          ? {
              ...current,
              revealed: false,
              phoneNumber: null,
              displayExpiresAt: null,
            }
          : current
      );
      return;
    }

    const timer = window.setTimeout(() => {
      setPayload((current) =>
        current
          ? {
              ...current,
              revealed: false,
              phoneNumber: null,
              displayExpiresAt: null,
            }
          : current
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [payload?.displayExpiresAt, payload?.revealed]);

  async function revealPhone() {
    setRevealing(true);
    setErrorKey(null);

    try {
      const accessToken = await getToken();
      const response = await fetch(
        "/api/bookings/" + encodeURIComponent(bookingId) + "/contact",
        {
          method: "POST",
          cache: "no-store",
          headers: { Authorization: "Bearer " + accessToken },
        }
      );
      const result = (await response.json()) as ContactPayload;

      if (!response.ok) {
        setErrorKey("revealFailed");
        return;
      }

      setPayload(result);
    } catch {
      setErrorKey("revealFailed");
    } finally {
      setRevealing(false);
    }
  }

  function hidePhone() {
    setPayload((current) =>
      current
        ? {
            ...current,
            revealed: false,
            phoneNumber: null,
            displayExpiresAt: null,
          }
        : current
    );
  }

  async function startCall() {
    setCalling(true);
    setErrorKey(null);

    try {
      const accessToken = await getToken();
      const response = await fetch(
        "/api/bookings/" + encodeURIComponent(bookingId) + "/contact",
        {
          method: "PUT",
          cache: "no-store",
          headers: { Authorization: "Bearer " + accessToken },
        }
      );
      const result = (await response.json()) as CallPayload;

      if (!response.ok || !result.callAllowed || !result.phoneNumber) {
        throw new Error("KLYX_BOOKING_CONTACT_CALL_DENIED");
      }

      window.location.href = "tel:" + result.phoneNumber;
    } catch {
      setPayload((current) =>
        current
          ? {
              ...current,
              revealed: false,
              phoneNumber: null,
              displayExpiresAt: null,
            }
          : current
      );

      await loadEligibility();
      setErrorKey("callFailed");
    } finally {
      setCalling(false);
    }
  }

  if (!statusAllowsContact) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <LockKeyhole size={20} className="mt-0.5 text-muted-foreground" />
          <div>
            <p className="font-black">{t("protectedTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("availableAfterAcceptance")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !payload) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <LoaderCircle size={18} className="animate-spin" />
        {t("verifying")}
      </div>
    );
  }

  const name = payload.otherName || otherName;
  const ownAction = payload.actionRequired === "verify_own_phone";

  if (!payload.canReveal) {
    const message = errorKey
      ? t(errorKey)
      : bookingContactReasonMessage(locale, payload.reason, name);

    return (
      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          {ownAction ? (
            <Smartphone size={20} className="mt-0.5 text-amber-500" />
          ) : (
            <ShieldCheck size={20} className="mt-0.5 text-violet-500" />
          )}

          <div>
            <p className="font-black">
              {payload.reason === "contact_expired"
                ? t("expiredTitle")
                : t("protectedKlyxTitle")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>

            {ownAction && (
              <Link
                href="/settings"
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white"
              >
                <Smartphone size={17} />
                {t("verifyOwnNumber")}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!payload.revealed || !payload.phoneNumber) {
    return (
      <div className="mt-4 rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black">{t("contactOf", { name })}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("maskedUntilRequest")}
            </p>

            {payload.accessExpiresAt && (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-500">
                <Clock3 size={14} />
                {t("availableUntil", {
                  date: formatKlyxBookingContactExpiry(
                    locale,
                    payload.accessExpiresAt
                  ),
                })}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={revealing}
            onClick={() => void revealPhone()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-black text-white disabled:opacity-60"
          >
            {revealing ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Eye size={18} />
            )}
            {t("revealNumber")}
          </button>
        </div>

        {errorKey && (
          <div className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">
            {t(errorKey)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Phone size={18} className="text-emerald-500" />
            <p className="font-black">{name}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-500">
              <CheckCircle2 size={13} />
              {t("verified")}
            </span>
          </div>

          <p className="mt-2 break-all text-lg font-black">{payload.phoneNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("remaskFiveMinutes")}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={hidePhone}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border px-5 text-sm font-black"
          >
            <EyeOff size={18} />
            {t("hide")}
          </button>

          <button
            type="button"
            disabled={calling}
            onClick={() => void startCall()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white disabled:opacity-60"
          >
            {calling ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Phone size={18} />
            )}
            {t("call")}
          </button>
        </div>
      </div>

      {errorKey && (
        <div className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">
          {t(errorKey)}
        </div>
      )}
    </div>
  );
}
