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

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [serviceName, setServiceName] = useState("Service KLYX");
  const [serviceProfile, setServiceProfile] = useState<ServiceProfileRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [bookingDate, setBookingDate] = useState(requestedDate);
  const [startTime, setStartTime] = useState(requestedTime);
  const [endTime, setEndTime] = useState(requestedEndTime);
  const [children, setChildren] = useState("1");
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

      let bookingMessage = message;

      if (isBabysitting) {
        const childrenCount = Number(children);

        if (
          Number.isNaN(childrenCount) ||
          !Number.isInteger(childrenCount) ||
          childrenCount < 1
        ) {
          throw new BookingPageError("childrenInvalid");
        }

        bookingMessage = [`Nombre d'enfants : ${childrenCount}`, message.trim()]
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
      <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 text-foreground dark:text-white">
        {t("loading")}
      </main>
    );
  }

  if (errorKey && !profile) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-background dark:bg-zinc-950 px-3 py-5 text-foreground dark:text-white sm:px-5 sm:py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
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
      className="min-h-screen overflow-x-hidden bg-background dark:bg-zinc-950 px-3 py-5 text-foreground dark:text-white sm:px-5 sm:py-8"
      data-klyx-contract="KLYX_PROVIDER_BOOKING_I18N_16_07"
    >
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/providers/${providerId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:text-white"
        >
          <ArrowLeft size={17} />
          {t("backProfile")}
        </Link>

        <section className="mt-8 grid overflow-hidden rounded-3xl border border-border dark:border-zinc-800 bg-card/70 dark:bg-zinc-900/70 md:grid-cols-[280px_1fr]">
          <div className="flex min-h-52 items-center justify-center bg-muted dark:bg-zinc-800 sm:min-h-72">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={fullName}
                className="h-full min-h-52 w-full object-cover sm:min-h-72"
              />
            ) : (
              <UserRound size={80} className="text-muted-foreground dark:text-zinc-500" />
            )}
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2563EB]">
              {serviceName}
            </p>
            <h1 className="mt-3 text-3xl font-bold">{fullName}</h1>
            <p className="mt-3 text-muted-foreground dark:text-zinc-400">
              {serviceProfile?.city || t("cityUnknown")}
            </p>
            <p className="mt-4 text-2xl font-bold text-[#2563EB]">
              {formattedPrice}
            </p>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
              {t("priceSnapshotNotice")}
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]"
        >
          <section className="rounded-3xl border border-border dark:border-zinc-800 bg-card/70 dark:bg-zinc-900/70 p-6 sm:p-8">
            <h2 className="text-2xl font-bold">{t("chooseSlot")}</h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <label>
                <span className="mb-2 flex items-center gap-2 text-sm text-foreground/80 dark:text-zinc-300">
                  <CalendarDays size={17} /> {t("date")}
                </span>
                <input
                  type="date"
                  min={minimumDate}
                  required
                  value={bookingDate}
                  onChange={(event) => setBookingDate(event.target.value)}
                  className="w-full rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 p-4 outline-none focus:border-[#2563EB]"
                />
              </label>

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm text-foreground/80 dark:text-zinc-300">
                  <Clock3 size={17} /> {t("start")}
                </span>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="w-full rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 p-4 outline-none focus:border-[#2563EB]"
                />
              </label>

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm text-foreground/80 dark:text-zinc-300">
                  <Clock3 size={17} /> {t("end")}
                </span>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="w-full rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 p-4 outline-none focus:border-[#2563EB]"
                />
              </label>
            </div>

            {bookingDate && (
              <div className="mt-4 rounded-xl border border-border dark:border-zinc-800 bg-background dark:bg-zinc-950 p-4 text-sm text-muted-foreground dark:text-zinc-400">
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
              </div>
            )}

            {isBabysitting && (
              <label className="mt-5 block">
                <span className="mb-2 block text-sm text-foreground/80 dark:text-zinc-300">
                  {t("children")}
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={children}
                  onChange={(event) => setChildren(event.target.value)}
                  className="w-full rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 p-4 outline-none focus:border-[#2563EB]"
                />
              </label>
            )}

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-foreground/80 dark:text-zinc-300">
                {t("requestDetails")}
              </span>
              <textarea
                rows={6}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("requestPlaceholder")}
                className="w-full resize-none rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 p-4 outline-none focus:border-[#2563EB]"
              />
              <p className="mt-2 text-right text-xs text-muted-foreground dark:text-zinc-500">
                {message.length}/2000
              </p>
            </label>

            {errorKey && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {t(errorKey)}
              </div>
            )}
          </section>

          <aside className="h-fit rounded-3xl border border-border dark:border-zinc-800 bg-card/70 dark:bg-zinc-900/70 p-6 lg:sticky lg:top-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-zinc-500">
              {t("summary")}
            </p>
            <h2 className="mt-3 text-xl font-bold">{serviceName}</h2>

            <div className="mt-5 space-y-3 border-y border-border dark:border-zinc-800 py-5 text-sm">
              <p className="flex justify-between gap-3">
                <span className="text-muted-foreground dark:text-zinc-500">
                  {t("provider")}
                </span>
                <span className="text-right font-semibold">{fullName}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-muted-foreground dark:text-zinc-500">
                  {t("slot")}
                </span>
                <span className="text-right font-semibold">
                  {startTime && endTime ? `${startTime}–${endTime}` : t("choose")}
                </span>
              </p>
              {isBabysitting && (
                <p className="flex justify-between gap-3">
                  <span className="text-muted-foreground dark:text-zinc-500">
                    {t("children")}
                  </span>
                  <span className="text-right font-semibold">{children || "—"}</span>
                </p>
              )}
              <p className="flex justify-between gap-3">
                <span className="text-muted-foreground dark:text-zinc-500">
                  {t("rate")}
                </span>
                <span className="text-right font-semibold">{formattedPrice}</span>
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground dark:text-zinc-400">
                <Euro size={18} /> {t("estimatedTotal")}
              </span>
              <strong className="text-2xl text-[#2563EB]">
                {estimatedAmount == null ? "—" : `${estimatedAmount.toFixed(2)} €`}
              </strong>
            </div>

            <button
              type="submit"
              disabled={submitting || estimatedAmount == null}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#2563EB] px-6 py-4 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send size={20} />
              {submitting ? t("submitting") : t("sendRequest")}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground dark:text-zinc-500">
              {t("noChargeBeforeAcceptance")}
            </p>
          </aside>
        </form>
      </div>
    </main>
  );
}
