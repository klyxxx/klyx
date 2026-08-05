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

const SERVICE_LABELS: Record<string, string> = {
  babysitting: "Baby-sitting",
  cleaning: "Ménage",
  moving: "Déménagement",
  handyman: "Bricolage",
};

const DAY_LABELS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

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

function formatPrice(price: number | null, pricingType: string | null): string {
  if (price == null) return "Prix à confirmer";

  return pricingType === "fixed"
    ? `${Number(price).toFixed(2)} € forfait`
    : `${Number(price).toFixed(2)} €/h`;
}

export default function ProviderBookingPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const providerId = params.id;
  const serviceSlug = searchParams.get("service")?.trim() || "babysitting";
  const requestedDate = validRequestedDate(searchParams.get("date"));
  const requestedTime = validRequestedTime(searchParams.get("time"));
  const requestedEndTime = endTimeFromRequest(
    requestedTime,
    searchParams.get("duration")
  );

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [serviceProfile, setServiceProfile] = useState<ServiceProfileRow | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [bookingDate, setBookingDate] = useState(requestedDate);
  const [startTime, setStartTime] = useState(requestedTime);
  const [endTime, setEndTime] = useState(requestedEndTime);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMessage("");

      try {
        const [{ data: profileData, error: profileError }, serviceResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id, first_name, last_name, avatar_url")
              .eq("id", providerId)
              .maybeSingle(),
            supabase
              .from("services")
              .select("id, slug")
              .eq("slug", serviceSlug)
              .maybeSingle(),
          ]);

        if (profileError) throw new Error(profileError.message);
        if (serviceResult.error) throw new Error(serviceResult.error.message);
        if (!profileData) throw new Error("Prestataire introuvable.");
        if (!serviceResult.data) throw new Error("Service introuvable.");

        const { data: userService, error: userServiceError } = await supabase
          .from("user_services")
          .select("id")
          .eq("user_id", providerId)
          .eq("service_id", serviceResult.data.id)
          .eq("active", true)
          .eq("provider_enabled", true)
          .maybeSingle();

        if (userServiceError) throw new Error(userServiceError.message);
        if (!userService) throw new Error("Ce prestataire ne propose pas ce service.");

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

        if (serviceProfileResult.error) {
          throw new Error(serviceProfileResult.error.message);
        }

        if (availabilityResult.error) {
          throw new Error(availabilityResult.error.message);
        }

        if (!serviceProfileResult.data?.available) {
          throw new Error("Ce service n’est pas disponible actuellement.");
        }

        setProfile(profileData as ProfileRow);
        setServiceProfile(serviceProfileResult.data as ServiceProfileRow);
        setAvailability((availabilityResult.data ?? []) as AvailabilityRow[]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger la réservation."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [providerId, serviceSlug]);

  const estimatedAmount = useMemo(() => {
    if (serviceProfile?.price == null) return null;
    if (serviceProfile.pricing_type === "fixed") return Number(serviceProfile.price);

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
    setErrorMessage("");

    try {
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
          message,
        }),
      });

      const result = (await response.json()) as {
        bookingId?: string;
        error?: string;
      };

      if (!response.ok || !result.bookingId) {
        throw new Error(result.error || "Impossible de créer la réservation.");
      }

      router.push(`/bookings/${result.bookingId}?created=1`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Une erreur est survenue."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Chargement...
      </main>
    );
  }

  if (errorMessage && !profile) {
    return (
      <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
          {errorMessage}
        </div>
      </main>
    );
  }

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Prestataire KLYX";
  const minimumDate = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/providers/${providerId}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={17} />
          Retour au profil
        </Link>

        <section className="mt-8 grid overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 md:grid-cols-[280px_1fr]">
          <div className="flex min-h-72 items-center justify-center bg-zinc-800">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={fullName}
                className="h-full min-h-72 w-full object-cover"
              />
            ) : (
              <UserRound size={80} className="text-zinc-500" />
            )}
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
              {SERVICE_LABELS[serviceSlug] || serviceSlug}
            </p>
            <h1 className="mt-3 text-3xl font-bold">{fullName}</h1>
            <p className="mt-3 text-zinc-400">
              {serviceProfile?.city || "Ville non renseignée"}
            </p>
            <p className="mt-4 text-2xl font-bold text-violet-400">
              {formatPrice(serviceProfile?.price ?? null, serviceProfile?.pricing_type ?? null)}
            </p>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
              Le prix affiché est enregistré avec ta demande. Une future modification du tarif ne changera pas cette réservation.
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]"
        >
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8">
            <h2 className="text-2xl font-bold">Choisis ton créneau</h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <label>
                <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
                  <CalendarDays size={17} /> Date
                </span>
                <input
                  type="date"
                  min={minimumDate}
                  required
                  value={bookingDate}
                  onChange={(event) => setBookingDate(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-violet-500"
                />
              </label>

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
                  <Clock3 size={17} /> Début
                </span>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-violet-500"
                />
              </label>

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
                  <Clock3 size={17} /> Fin
                </span>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-violet-500"
                />
              </label>
            </div>

            {bookingDate && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                {selectedDayAvailability.length > 0 ? (
                  <>
                    Disponible {DAY_LABELS[new Date(`${bookingDate}T12:00:00Z`).getUTCDay()]} :{" "}
                    {selectedDayAvailability
                      .map(
                        (slot) =>
                          `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`
                      )
                      .join(", ")}
                  </>
                ) : (
                  "Aucune disponibilité déclarée pour ce jour."
                )}
              </div>
            )}

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-zinc-300">
                Détails de la demande
              </span>
              <textarea
                rows={6}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Décris précisément ce dont tu as besoin."
                className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-violet-500"
              />
              <p className="mt-2 text-right text-xs text-zinc-500">
                {message.length}/2000
              </p>
            </label>

            {errorMessage && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {errorMessage}
              </div>
            )}
          </section>

          <aside className="h-fit rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 lg:sticky lg:top-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Récapitulatif
            </p>
            <h2 className="mt-3 text-xl font-bold">
              {SERVICE_LABELS[serviceSlug] || "Service KLYX"}
            </h2>

            <div className="mt-5 space-y-3 border-y border-zinc-800 py-5 text-sm">
              <p className="flex justify-between gap-3">
                <span className="text-zinc-500">Prestataire</span>
                <span className="text-right font-semibold">{fullName}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-zinc-500">Créneau</span>
                <span className="text-right font-semibold">
                  {startTime && endTime ? `${startTime}–${endTime}` : "À choisir"}
                </span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-zinc-500">Tarif</span>
                <span className="text-right font-semibold">
                  {formatPrice(serviceProfile?.price ?? null, serviceProfile?.pricing_type ?? null)}
                </span>
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-zinc-400">
                <Euro size={18} /> Total estimé
              </span>
              <strong className="text-2xl text-violet-300">
                {estimatedAmount == null ? "—" : `${estimatedAmount.toFixed(2)} €`}
              </strong>
            </div>

            <button
              type="submit"
              disabled={submitting || estimatedAmount == null}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              <Send size={20} />
              {submitting ? "Envoi en cours..." : "Envoyer la demande"}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-zinc-500">
              Aucun paiement n’est débité avant l’acceptation du prestataire.
            </p>
          </aside>
        </form>
      </div>
    </main>
  );
}
