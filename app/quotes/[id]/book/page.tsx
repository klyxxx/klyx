"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  Send,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type QuoteData = {
  id: string;
  provider_profile_id: string;
  user_service_id: string;
  title: string;
  description: string;
  requested_date: string | null;
  requested_time: string | null;
  duration_hours: number | null;
  pricing_type: "hourly" | "fixed";
  provider_price: number | null;
  provider_message: string | null;
  status: string;
  expires_at: string | null;
  serviceSlug: string | null;
  serviceName: string;
  bookingId: string | null;
  provider: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
};

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

function timeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  const [hours, minutes] =
    value.split(":").map(Number);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function endTimeFromDuration(
  startTime: string,
  durationHours: number | null
): string {
  const start = timeToMinutes(startTime);

  if (start === null) return "";

  const duration =
    durationHours && durationHours > 0
      ? durationHours
      : 1;

  const end = start + duration * 60;

  if (end >= 24 * 60) return "";

  return `${String(
    Math.floor(end / 60)
  ).padStart(2, "0")}:${String(
    Math.round(end % 60)
  ).padStart(2, "0")}`;
}

export default function QuoteBookingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quoteId = params.id;

  const [quote, setQuote] =
    useState<QuoteData | null>(null);
  const [availability, setAvailability] =
    useState<AvailabilityRow[]>([]);
  const [bookingDate, setBookingDate] =
    useState("");
  const [startTime, setStartTime] =
    useState("");
  const [endTime, setEndTime] =
    useState("");
  const [message, setMessage] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [submitting, setSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage("");

      try {
        const accessToken = await token();
        const response = await fetch(
          `/api/quotes/${quoteId}`,
          {
            cache: "no-store",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

        const body = (await response.json()) as {
          quote?: QuoteData;
          error?: string;
        };

        if (!response.ok || !body.quote) {
          throw new Error(
            body.error || "Devis introuvable."
          );
        }

        const loadedQuote = body.quote;

        if (loadedQuote.bookingId) {
          router.replace(
            `/bookings/${loadedQuote.bookingId}`
          );
          return;
        }

        if (loadedQuote.status !== "accepted") {
          throw new Error(
            "Ce devis doit être accepté avant la réservation."
          );
        }

        if (!loadedQuote.serviceSlug) {
          throw new Error(
            "Service du devis introuvable."
          );
        }

        const date =
          loadedQuote.requested_date ?? "";
        const start =
          loadedQuote.requested_time?.slice(
            0,
            5
          ) ?? "";
        const end = endTimeFromDuration(
          start,
          loadedQuote.duration_hours
        );

        setQuote(loadedQuote);
        setBookingDate(date);
        setStartTime(start);
        setEndTime(end);
        setMessage(loadedQuote.description);

        const { data: slots, error: slotError } =
          await supabase
            .from("availability_slots")
            .select(
              "day_of_week, start_time, end_time"
            )
            .eq(
              "user_service_id",
              loadedQuote.user_service_id
            )
            .eq("is_active", true)
            .order("day_of_week", {
              ascending: true,
            });

        if (slotError) {
          throw new Error(slotError.message);
        }

        setAvailability(
          (slots ?? []) as AvailabilityRow[]
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Chargement impossible."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [quoteId, router]);

  const selectedAvailability = useMemo(() => {
    if (!bookingDate) return [];

    const day = new Date(
      `${bookingDate}T12:00:00Z`
    ).getUTCDay();

    return availability.filter(
      (slot) => Number(slot.day_of_week) === day
    );
  }, [availability, bookingDate]);

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!quote?.serviceSlug) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const accessToken = await token();

      const response = await fetch(
        "/api/bookings/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            providerId:
              quote.provider_profile_id,
            serviceSlug: quote.serviceSlug,
            bookingDate,
            startTime,
            endTime,
            message,
            quoteId: quote.id,
          }),
        }
      );

      const body = (await response.json()) as {
        bookingId?: string;
        error?: string;
      };

      if (!response.ok || !body.bookingId) {
        throw new Error(
          body.error ||
            "Impossible de créer la réservation."
        );
      }

      router.push(
        `/bookings/${body.bookingId}?created=1&quote=1`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Réservation impossible."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="klyx-page grid min-h-[70vh] place-items-center">
        <LoaderCircle
          className="animate-spin text-violet-600"
          size={38}
        />
      </main>
    );
  }

  if (!quote) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-3xl rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 text-rose-700 dark:text-rose-300">
          {errorMessage || "Devis introuvable."}
        </div>
      </main>
    );
  }

  const providerName =
    `${quote.provider?.first_name ?? ""} ${
      quote.provider?.last_name ?? ""
    }`.trim() || "Prestataire KLYX";

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground"
        >
          <ArrowLeft size={17} />
          Mes devis
        </Link>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <FileText size={15} />
            Devis accepté
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Confirmer la réservation
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Le prix du devis est verrouillé côté serveur.
            Vérifie le créneau puis envoie toi-même la demande.
          </p>
        </section>

        <section className="klyx-card mt-8 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-violet-500/10 text-violet-600">
              {quote.provider?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={quote.provider.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={34} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="klyx-eyebrow">
                {quote.serviceName}
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {providerName}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {quote.title}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-right">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Prix accepté
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-600">
                {quote.provider_price == null
                  ? "—"
                  : `${Number(
                      quote.provider_price
                    ).toFixed(2)} €`}
              </p>
            </div>
          </div>
        </section>

        <form
          onSubmit={submit}
          className="klyx-card mt-6 p-6 sm:p-8"
        >
          <h2 className="text-2xl font-black">
            Vérifie le créneau
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <CalendarDays size={17} />
                Date
              </span>
              <input
                type="date"
                required
                value={bookingDate}
                onChange={(event) =>
                  setBookingDate(
                    event.target.value
                  )
                }
                disabled={Boolean(
                  quote.requested_date
                )}
                className="klyx-input disabled:opacity-60"
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Clock3 size={17} />
                Début
              </span>
              <input
                type="time"
                required
                value={startTime}
                onChange={(event) =>
                  setStartTime(
                    event.target.value
                  )
                }
                disabled={Boolean(
                  quote.requested_time
                )}
                className="klyx-input disabled:opacity-60"
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Clock3 size={17} />
                Fin
              </span>
              <input
                type="time"
                required
                value={endTime}
                onChange={(event) =>
                  setEndTime(event.target.value)
                }
                disabled={Boolean(
                  quote.duration_hours
                )}
                className="klyx-input disabled:opacity-60"
              />
            </label>
          </div>

          {bookingDate && (
            <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
              {selectedAvailability.length > 0
                ? `Disponibilités déclarées : ${selectedAvailability
                    .map(
                      (slot) =>
                        `${slot.start_time.slice(
                          0,
                          5
                        )}–${slot.end_time.slice(
                          0,
                          5
                        )}`
                    )
                    .join(", ")}`
                : "Aucune disponibilité habituelle déclarée pour ce jour."}
            </div>
          )}

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-black">
              Détails de la mission
            </span>
            <textarea
              rows={6}
              maxLength={2000}
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              className="klyx-input resize-none"
            />
          </label>

          {quote.provider_message && (
            <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Message du prestataire
              </p>
              <p className="mt-2 text-sm leading-6">
                {quote.provider_message}
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-muted-foreground">
            <CheckCircle2
              className="mt-0.5 shrink-0 text-emerald-600"
              size={18}
            />
            Cette action crée uniquement une demande de réservation.
            Le paiement reste séparé et ne démarre pas automatiquement.
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              !bookingDate ||
              !startTime ||
              !endTime
            }
            className="klyx-button mt-6 w-full"
          >
            {submitting ? (
              <LoaderCircle
                className="animate-spin"
                size={18}
              />
            ) : (
              <Send size={18} />
            )}
            Envoyer la demande de réservation
          </button>
        </form>
      </div>
    </main>
  );
}
