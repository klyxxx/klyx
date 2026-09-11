"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Euro,
  Send,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxProviderBooking,
  type KlyxProviderBookingMessageKey,
  type KlyxProviderBookingMessageValues,
} from "@/lib/klyx-provider-booking-i18n";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type ServiceProfileRow = {
  price: number | null;
  pricing_type: string | null;
  city: string | null;
  available: boolean | null;
};

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const satisfies readonly KlyxProviderBookingMessageKey[];

class BookingPageError extends Error {
  constructor(readonly key: KlyxProviderBookingMessageKey) {
    super(key);
  }
}

function validRequestedDate(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function validRequestedTime(value: string | null): string {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return "";

  const [hours, minutes] = value.split(":").map(Number);

  return hours <= 23 && minutes <= 59 ? value : "";
}

function validRequestedChildren(value: string | null): string {
  if (!value) return "1";

  const count = Number(value);

  return Number.isInteger(count) && count >= 1 ? String(count) : "1";
}

function timeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  const [hours, minutes] = value.split(":").map(Number);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function endTimeFromRequest(startTime: string, durationText: string | null): string {
  if (!startTime) return "";

  const duration = Number(durationText);
  const safeDuration =
    Number.isInteger(duration) && duration >= 1 && duration <= 12 ? duration : 1;
  const startMinutes = timeToMinutes(startTime);

  if (startMinutes === null) return "";

  const endMinutes = startMinutes + safeDuration * 60;

  if (endMinutes >= 24 * 60) return "";

  return `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(
    endMinutes % 60
  ).padStart(2, "0")}`;
}

function formatPrice(
  price: number | null,
  pricingType: string | null,
  locale: string
): string {
  if (price == null) {
    return translateKlyxProviderBooking(locale, "priceToConfirm");
  }

  const formattedPrice = Number(price).toFixed(2);

  return translateKlyxProviderBooking(
    locale,
    pricingType === "fixed" ? "fixedPrice" : "hourlyPrice",
    { price: formattedPrice }
  );
}

export default function ProviderBookingPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (
    key: KlyxProviderBookingMessageKey,
    values?: KlyxProviderBookingMessageValues
  ) => translateKlyxProviderBooking(locale, key, values);

  const providerId = params.id;
  const serviceSlug = searchParams.get("service")?.trim() || "";
  const isBabysitting = serviceSlug === "babysitting";
  const requestedDate = validRequestedDate(searchParams.get("date"));
  const requestedTime = validRequestedTime(
    searchParams.get("start") ?? searchParams.get("time")
  );
  const requestedExplicitEndTime = validRequestedTime(searchParams.get("end"));
  const requestedEndTime =
    requestedExplicitEndTime ||
    endTimeFromRequest(requestedTime, searchParams.get("duration"));
  const requestedChildren = validRequestedChildren(searchParams.get("children"));

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [serviceName, setServiceName] = useState("Service KLYX");
  const [serviceProfile, setServiceProfile] = useState<ServiceProfileRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [bookingDate, setBookingDate] = useState(requestedDate);
  const [startTime, setStartTime] = useState(requestedTime);
  const [endTime, setEndTime] = useState(requestedEndTime);
  const [children, setChildren] = useState(requestedChildren);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] =
    useState<KlyxProviderBookingMessageKey | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorKey(null);

      try {
        if (!serviceSlug) {
          throw new BookingPageError("noServiceSelected");
        }

        const [{ data: profileData, error: profileError }, serviceResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id, first_name, last_name, avatar_url")
              .eq("id", providerId)
              .maybeSingle(),
            supabase
              .from("services")
              .select("id, slug, name")
              .eq("slug", serviceSlug)
              .maybeSingle(),
          ]);

        if (profileError || serviceResult.error) {
          throw new BookingPageError("loadFailed");
        }
        if (!profileData) {
          throw new BookingPageError("providerNotFound");
        }
        if (!serviceResult.data) {
          throw new BookingPageError("serviceNotFound");
        }

        const { data: userService, error: userServiceError } = await supabase
          .from("user_services")
          .select("id")
          .eq("user_id", providerId)
          .eq("service_id", serviceResult.data.id)
          .eq("active", true)
          .eq("provider_enabled", true)
          .maybeSingle();

        if (userServiceError) {
          throw new BookingPageError("loadFailed");
        }
        if (!userService) {
          throw new BookingPageError("providerDoesNotOffer");
        }

        const [serviceProfileResult, availabilityResult] = await Promise.all([
          supabase
            .from("service_profiles")
            .select("price, pricing_type, city, available")
            .eq("user_service_id", userService.id)
            .maybeSingle(),
          supabase
            .from("availability_slots")
            .select("day_of_week, start_time, end_time")
            .eq("user_service_id", userService.id)
            .eq("is_active", true)
            .order("day_of_week", { ascending: true }),
        ]);

        if (serviceProfileResult.error || availabilityResult.error) {
          throw new BookingPageError("loadFailed");
        }

        if (!serviceProfileResult.data?.available) {
          throw new BookingPageError("serviceUnavailable");
        }

        setProfile(profileData as ProfileRow);
        setServiceName(
          typeof serviceResult.data.name === "string" &&
            serviceResult.data.name.trim()
            ? serviceResult.data.name.trim()
            : serviceResult.data.slug
        );
        setServiceProfile(serviceProfileResult.data as ServiceProfileRow);
        setAvailability((availabilityResult.data ?? []) as AvailabilityRow[]);
      } catch (error) {
        setErrorKey(
          error instanceof BookingPageError ? error.key : "loadFailed"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [providerId, serviceSlug]);

  const estimatedAmount = useMemo(() => {
    if (serviceProfile?.price == null) return null;
    if (serviceProfile.pricing_type === "fixed") {
      return Number(serviceProfile.price);
    }

    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);

    if (start === null || end === null || end <= start) return null;

    return Number(serviceProfile.price) * ((end - start) / 60);
  }, [endTime, serviceProfile, startTime]);

  const selectedDayAvailability = useMemo(() => {
    if (!bookingDate) return [];

    const day = new Date(`${bookingDate}T12:00:00Z`).getUTCDay();

    return availability.filter((slot) => Number(slot.day_of_week) === day);
  }, [availability, bookingDate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorKey(null);

    try {
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      if (
        !bookingDate ||
        startMinutes === null ||
        endMinutes === null ||
        endMinutes <= startMinutes
      ) {
        throw new BookingPageError("invalidSlot");
      }

      if (selectedDayAvailability.length === 0) {
        throw new BookingPageError("noAvailability");
      }

      const fitsAvailability = selectedDayAvailability.some((slot) => {
        const slotStart = timeToMinutes(slot.start_time.slice(0, 5));
        const slotEnd = timeToMinutes(slot.end_time.slice(0, 5));

        return (
          slotStart !== null &&
          slotEnd !== null &&
          startMinutes >= slotStart &&
          endMinutes <= slotEnd
        );
      });

      if (!fitsAvailability) {
        throw new BookingPageError("outsideAvailability");
      }

      let bookingMessage = message.trim();

      if (isBabysitting) {
        const childrenCount = Number(children);

        if (
          Number.isNaN(childrenCount) ||
          !Number.isInteger(childrenCount) ||
          childrenCount < 1
        ) {
          throw new BookingPageError("childrenInvalid");
        }

        bookingMessage = [
          `Nombre d'enfants : ${childrenCount}`,
          bookingMessage,
        ]
          .filter(Boolean)
          .join("\n\n");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          providerId,
          serviceSlug,
          bookingDate,
          startTime,
          endTime,
          message: bookingMessage,
        }),
      });

      const result = (await response.json()) as {
        bookingId?: string;
      };

      if (!response.ok || !result.bookingId) {
        throw new BookingPageError("createFailed");
      }

      router.push(`/bookings/${result.bookingId}?created=1`);
    } catch (error) {
      setErrorKey(
        error instanceof BookingPageError ? error.key : "genericError"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground dark:bg-zinc-950 dark:text-white">
        {t("loading")}
      </main>
    );
  }

  if (errorKey && !profile) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-background px-4 py-8 text-foreground dark:bg-zinc-950 dark:text-white">
        <div className="mx-auto max-w-3xl border-y border-red-500/30 py-5 text-red-700 dark:text-red-300">
          {t(errorKey)}
        </div>
      </main>
    );
  }

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    t("providerDefault");
  const minimumDate = new Date().toISOString().slice(0, 10);
  const formattedPrice = formatPrice(
    serviceProfile?.price ?? null,
    serviceProfile?.pricing_type ?? null,
    locale
  );

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-background px-4 py-8 text-foreground dark:bg-zinc-950 dark:text-white sm:px-6 sm:py-10"
      data-klyx-contract="KLYX_PROVIDER_BOOKING_I18N_16_07"
      data-klyx-ui="KLYX_CONVERSATIONAL_BOOKING_20260911"
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/providers/${providerId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          {t("backProfile")}
        </Link>

        <section className="mt-8" data-testid="klyx-conversational-booking">
          <div className="flex gap-3">
            <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
              K
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">KLYX</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                {t("chooseSlot")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {serviceName} · {fullName} · {formattedPrice}
              </p>
            </div>
          </div>

          <div className="ml-0 mt-6 border-y border-border py-4 sm:ml-11">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                  <UserRound size={19} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{fullName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {serviceProfile?.city || t("cityUnknown")}
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formattedPrice}
              </p>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-blue-600" />
              {t("priceSnapshotNotice")}
            </p>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="ml-0 mt-7 sm:ml-11">
          <section aria-label={t("chooseSlot")}>
            <div className="grid gap-4 sm:grid-cols-3">
              <label>
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground/80">
                  <CalendarDays size={16} /> {t("date")}
                </span>
                <input
                  type="date"
                  min={minimumDate}
                  required
                  value={bookingDate}
                  onChange={(event) => setBookingDate(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </label>

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground/80">
                  <Clock3 size={16} /> {t("start")}
                </span>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </label>

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground/80">
                  <Clock3 size={16} /> {t("end")}
                </span>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </label>
            </div>

            {bookingDate && (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {selectedDayAvailability.length > 0
                  ? t("available", {
                      day: t(
                        DAY_KEYS[
                          new Date(`${bookingDate}T12:00:00Z`).getUTCDay()
                        ] ?? "sunday"
                      ),
                      slots: selectedDayAvailability
                        .map(
                          (slot) =>
                            `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`
                        )
                        .join(", "),
                    })
                  : t("noAvailabilityDay")}
              </p>
            )}

            {isBabysitting && (
              <label className="mt-5 block" htmlFor="children">
                <span className="mb-2 block text-sm font-medium text-foreground/80">
                  {t("children")}
                </span>
                <input
                  id="children"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={children}
                  onChange={(event) => setChildren(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600 sm:max-w-40"
                />
              </label>
            )}

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-foreground/80">
                {t("requestDetails")}
              </span>
              <textarea
                rows={4}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("requestPlaceholder")}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {message.length}/2000
              </p>
            </label>
          </section>

          <section
            data-testid="klyx-booking-confirmation"
            className="mt-7 border-t border-border pt-5"
            aria-label={t("summary")}
          >
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-blue-600/10 text-blue-600">
                <CheckCircle2 size={16} />
              </div>
              <p className="text-sm font-semibold">{t("summary")}</p>
            </div>

            <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <p className="flex justify-between gap-4 border-b border-border/70 pb-2">
                <span className="text-muted-foreground">{t("provider")}</span>
                <span className="text-right font-semibold">{fullName}</span>
              </p>
              <p className="flex justify-between gap-4 border-b border-border/70 pb-2">
                <span className="text-muted-foreground">{t("date")}</span>
                <span className="text-right font-semibold">{bookingDate || "—"}</span>
              </p>
              <p className="flex justify-between gap-4 border-b border-border/70 pb-2">
                <span className="text-muted-foreground">{t("slot")}</span>
                <span className="text-right font-semibold">
                  {startTime && endTime ? `${startTime}–${endTime}` : t("choose")}
                </span>
              </p>
              <p className="flex justify-between gap-4 border-b border-border/70 pb-2">
                <span className="text-muted-foreground">{t("rate")}</span>
                <span className="text-right font-semibold">{formattedPrice}</span>
              </p>
              {isBabysitting && (
                <p className="flex justify-between gap-4 border-b border-border/70 pb-2">
                  <span className="text-muted-foreground">{t("children")}</span>
                  <span className="text-right font-semibold">{children || "—"}</span>
                </p>
              )}
              <p className="flex justify-between gap-4 border-b border-border/70 pb-2">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Euro size={15} /> {t("estimatedTotal")}
                </span>
                <strong className="text-right text-blue-600 dark:text-blue-400">
                  {estimatedAmount == null ? "—" : `${estimatedAmount.toFixed(2)} €`}
                </strong>
              </p>
            </div>

            {errorKey && (
              <div className="mt-5 border-l-2 border-red-500 pl-3 text-sm text-red-700 dark:text-red-300">
                {t(errorKey)}
              </div>
            )}

            <div className="mt-6 flex flex-col items-stretch gap-3 sm:items-end">
              <button
                type="submit"
                disabled={submitting || estimatedAmount == null}
                className="klyx-button inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-semibold sm:min-w-56"
              >
                {submitting ? (
                  <Send size={18} className="animate-pulse" />
                ) : (
                  <ArrowRight size={18} />
                )}
                {submitting ? t("submitting") : t("sendRequest")}
              </button>
              <p className="max-w-md text-right text-xs leading-5 text-muted-foreground">
                {t("noChargeBeforeAcceptance")}
              </p>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}
