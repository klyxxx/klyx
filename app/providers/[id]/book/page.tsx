"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
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
      <main className="min-h-screen overflow-x-hidden bg-background px-3 py-5 text-foreground dark:bg-zinc-950 dark:text-white sm:px-5 sm:py-8">
        <div className="mx-auto max-w-3xl border-l-2 border-red-500/50 py-2 pl-4 text-red-700 dark:text-red-300">
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
      className="min-h-screen overflow-x-hidden bg-background px-4 py-6 text-foreground dark:bg-zinc-950 dark:text-white sm:px-6 sm:py-10"
      data-klyx-contract="KLYX_PROVIDER_BOOKING_I18N_16_07"
      data-klyx-ui="KLYX_PROVIDER_BOOKING_CONVERSATIONAL_20260911"
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/providers/${providerId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft size={17} />
          {t("backProfile")}
        </Link>

        <div className="mt-8 space-y-8">
          <section className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
              K
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-7 text-muted-foreground">
                {serviceName}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-xl font-semibold sm:text-2xl">{fullName}</h1>
                <span className="text-sm text-muted-foreground">
                  · {serviceProfile?.city || t("cityUnknown")}
                </span>
              </div>
              <p className="mt-2 text-base font-semibold text-blue-600 dark:text-blue-400">
                {formattedPrice}
              </p>
              <p className="mt-3 inline-flex max-w-2xl items-start gap-2 text-xs leading-5 text-muted-foreground">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                {t("priceSnapshotNotice")}
              </p>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="space-y-7">
            <section className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
                K
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold sm:text-lg">{t("chooseSlot")}</h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <label>
                    <span className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <CalendarDays size={15} /> {t("date")}
                    </span>
                    <input
                      type="date"
                      min={minimumDate}
                      required
                      value={bookingDate}
                      onChange={(event) => setBookingDate(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>

                  <label>
                    <span className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Clock3 size={15} /> {t("start")}
                    </span>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>

                  <label>
                    <span className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Clock3 size={15} /> {t("end")}
                    </span>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                </div>

                {bookingDate && (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
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
                    <span className="mb-2 block text-xs font-medium text-muted-foreground">
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
                      className="w-full max-w-40 rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                )}

                <label className="mt-5 block">
                  <span className="mb-2 block text-xs font-medium text-muted-foreground">
                    {t("requestDetails")}
                  </span>
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={t("requestPlaceholder")}
                    className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {message.length}/2000
                  </p>
                </label>

                {errorKey && (
                  <div className="mt-4 border-l-2 border-red-500/50 py-1 pl-3 text-sm text-red-700 dark:text-red-300">
                    {t(errorKey)}
                  </div>
                )}
              </div>
            </section>

            <section className="flex justify-end">
              <div className="max-w-[88%] rounded-3xl bg-muted px-4 py-3 text-sm sm:max-w-[72%]">
                <p className="font-semibold">{t("summary")}</p>
                <div className="mt-2 space-y-1.5 text-muted-foreground">
                  <p>
                    {t("provider")}: <span className="text-foreground">{fullName}</span>
                  </p>
                  <p>
                    {t("slot")}: <span className="text-foreground">{startTime && endTime ? `${startTime}–${endTime}` : t("choose")}</span>
                  </p>
                  {isBabysitting && (
                    <p>
                      {t("children")}: <span className="text-foreground">{children || "—"}</span>
                    </p>
                  )}
                  <p>
                    {t("rate")}: <span className="text-foreground">{formattedPrice}</span>
                  </p>
                  <p className="inline-flex items-center gap-2 pt-1 font-semibold text-foreground">
                    <Euro size={16} />
                    {t("estimatedTotal")}: {estimatedAmount == null ? "—" : `${estimatedAmount.toFixed(2)} €`}
                  </p>
                </div>
              </div>
            </section>

            <section className="pl-11">
              <button
                type="submit"
                disabled={submitting || estimatedAmount == null}
                className="klyx-button inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-semibold disabled:opacity-50"
              >
                <Send size={17} />
                {submitting ? t("submitting") : t("sendRequest")}
              </button>
              <p className="mt-3 max-w-xl text-xs leading-5 text-muted-foreground">
                {t("noChargeBeforeAcceptance")}
              </p>
            </section>
          </form>
        </div>
      </div>
    </main>
  );
}
