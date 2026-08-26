"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  Send,
  UserRound,
} from "lucide-react";
import { formatKlyxMoney } from "@/lib/klyx-money";
import { supabase } from "@/lib/supabase";

// KLYX_QUOTE_BOOKING_CURRENCY_UI_15_06
type QuoteData = {
  id: string;
  provider_profile_id: string;
  user_service_id: string;
  country_code: string;
  currency: string;
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

function toMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  const [hours, minutes] = value.split(":").map(Number);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(
    2,
    "0"
  )}:${String(total % 60).padStart(2, "0")}`;
}

function QuoteBookingStep({
  number,
  title,
  text,
  done,
}: {
  number: string;
  title: string;
  text: string;
  done: boolean;
}) {
  return (
    <div className="bg-card p-5">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${
            done
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "border border-border bg-background text-muted-foreground"
          }`}
        >
          {done ? (
            <CheckCircle2
              size={16}
            />
          ) : (
            number
          )}
        </span>

        <p className="font-black">
          {title}
        </p>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
function calculateEndTime(
  startTime: string,
  durationHours: number
): string {
  const start = toMinutes(startTime);
  const durationMinutes = Math.round(durationHours * 60);

  if (
    start === null ||
    durationMinutes <= 0 ||
    start + durationMinutes >= 24 * 60
  ) {
    return "";
  }

  return fromMinutes(start + durationMinutes);
}

export default function QuoteBookingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quoteId = params.id;

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [availability, setAvailability] = useState<
    AvailabilityRow[]
  >([]);
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

        const response = await fetch(`/api/quotes/${quoteId}`, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const body = (await response.json()) as {
          quote?: QuoteData;
          error?: string;
        };

        if (!response.ok || !body.quote) {
          throw new Error(body.error || "Devis introuvable.");
        }

        const loadedQuote = body.quote;

        if (loadedQuote.bookingId) {
          router.replace(`/bookings/${loadedQuote.bookingId}`);
          return;
        }

        if (loadedQuote.status !== "accepted") {
          throw new Error(
            "Ce devis doit être accepté avant la réservation."
          );
        }

        if (!loadedQuote.serviceSlug) {
          throw new Error("Service du devis introuvable.");
        }

        const date = loadedQuote.requested_date ?? "";
        const start =
          loadedQuote.requested_time?.slice(0, 5) ?? "";
        const duration = Math.max(
          0.25,
          Number(loadedQuote.duration_hours ?? 1) || 1
        );

        setQuote(loadedQuote);
        setBookingDate(date);
        setStartTime(start);
        setEndTime(
          start ? calculateEndTime(start, duration) : ""
        );
        setMessage(loadedQuote.description);

        const { data: slots, error: slotError } = await supabase
          .from("availability_slots")
          .select("day_of_week, start_time, end_time")
          .eq("user_service_id", loadedQuote.user_service_id)
          .eq("is_active", true)
          .order("day_of_week", { ascending: true });

        if (slotError) {
          throw new Error(slotError.message);
        }

        setAvailability((slots ?? []) as AvailabilityRow[]);
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

  const durationHours = Math.max(
    0.25,
    Number(quote?.duration_hours ?? 1) || 1
  );

  useEffect(() => {
    if (!startTime) {
      setEndTime("");
      return;
    }

    setEndTime(calculateEndTime(startTime, durationHours));
  }, [startTime, durationHours]);

  const daySlots = useMemo(() => {
    if (!bookingDate) return [];

    const day = new Date(
      `${bookingDate}T12:00:00Z`
    ).getUTCDay();

    return availability.filter(
      (slot) => Number(slot.day_of_week) === day
    );
  }, [availability, bookingDate]);

  const slotState = useMemo(() => {
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);

    if (
      !bookingDate ||
      start === null ||
      end === null
    ) {
      return {
        valid: false,
        message: "Choisis un créneau complet.",
      };
    }

    const compatible = daySlots.some((slot) => {
      const slotStart = toMinutes(
        slot.start_time.slice(0, 5)
      );
      const slotEnd = toMinutes(
        slot.end_time.slice(0, 5)
      );

      return (
        slotStart !== null &&
        slotEnd !== null &&
        start >= slotStart &&
        end <= slotEnd
      );
    });

    if (compatible) {
      return {
        valid: true,
        message: "Ce créneau est compatible.",
      };
    }

    if (daySlots.length === 0) {
      return {
        valid: false,
        message:
          "Le prestataire n’a pas déclaré de disponibilité pour ce jour.",
      };
    }

    return {
      valid: false,
      message:
        "Ce créneau est hors disponibilité. Choisis une heure comprise dans la plage affichée.",
    };
  }, [bookingDate, daySlots, startTime, endTime]);

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!quote?.serviceSlug || !slotState.valid) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const accessToken = await token();

      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          providerId: quote.provider_profile_id,
          serviceSlug: quote.serviceSlug,
          bookingDate,
          startTime,
          endTime,
          message,
          quoteId: quote.id,
        }),
      });

      const body = (await response.json()) as {
        bookingId?: string;
        error?: string;
      };

      if (!response.ok || !body.bookingId) {
        throw new Error(
          body.error || "Impossible de créer la réservation."
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
            Le prix du devis reste protégé. Le créneau doit être
            compatible avec les disponibilités actuelles.
          </p>
        </section>
        {/* KLYX_BOOKING_CONTINUITY_13_68 */}
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Étape 1 · terminée
            </p>

            <p className="mt-2 font-black">
              Prestataire choisi
            </p>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tu as déjà accepté cette offre.
            </p>
          </div>

          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
              Étape 2 · maintenant
            </p>

            <p className="mt-2 font-black">
              Confirmer le créneau
            </p>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Vérifie la date et les heures avant de créer la réservation.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
              Étape 3 · ensuite
            </p>

            <p className="mt-2 font-black">
              Paiement
            </p>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Aucun paiement n’est effectué sur cet écran.
            </p>
          </div>
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
                  : formatKlyxMoney(
                      Number(quote.provider_price),
                      quote.country_code,
                      quote.currency
                    )}
              </p>
            </div>
          </div>
        </section>

                {/* KLYX_QUOTE_TO_BOOKING_HANDOFF_13_96 */}
        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card">
          <div className="border-b border-border p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
              Étape suivante
            </p>

            <h2 className="mt-2 text-xl font-black sm:text-2xl">
              Le devis est accepté. La réservation ne l’est pas encore.
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Le prix et le prestataire sont maintenant connus,
              mais tu dois encore vérifier le créneau avant de créer
              réellement la réservation.
            </p>
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <QuoteBookingStep
              number="1"
              title="Devis accepté"
              text="Le prestataire et le prix ont été validés."
              done
            />

            <QuoteBookingStep
              number="2"
              title="Créneau"
              text="Vérifie la date et les horaires disponibles."
              done={false}
            />

            <QuoteBookingStep
              number="3"
              title="Réservation"
              text="La réservation est créée seulement après ta confirmation."
              done={false}
            />

            <QuoteBookingStep
              number="4"
              title="Suivi"
              text="Une fois créée, la mission apparaît dans tes réservations."
              done={false}
            />
          </div>

          {/* KLYX_BOOKING_CONTROL_REMINDER_13_96 */}
          <div className="flex items-start gap-3 border-t border-border bg-emerald-500/[0.035] p-4 sm:px-6">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />

            <p className="text-sm leading-6 text-muted-foreground">
              Accepter un devis ne crée pas automatiquement une réservation.
              Cette page ne déclenche également aucun paiement :
              tu gardes le contrôle de chaque étape.
            </p>
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
                  setBookingDate(event.target.value)
                }
                className="klyx-input"
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
                  setStartTime(event.target.value)
                }
                className="klyx-input"
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
                className="klyx-input"
              />
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            {daySlots.length > 0
              ? `Disponibilités déclarées : ${daySlots
                  .map(
                    (slot) =>
                      `${slot.start_time.slice(
                        0,
                        5
                      )}–${slot.end_time.slice(0, 5)}`
                  )
                  .join(", ")}`
              : "Aucune disponibilité habituelle déclarée pour ce jour."}
          </div>

          <div
            className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
              slotState.valid
                ? "border-emerald-500/25 bg-emerald-500/10"
                : "border-amber-500/25 bg-amber-500/10"
            }`}
          >
            {slotState.valid ? (
              <CheckCircle2
                className="mt-0.5 shrink-0 text-emerald-600"
                size={18}
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 shrink-0 text-amber-600"
                size={18}
              />
            )}
            <p className="text-muted-foreground">
              {slotState.message}
            </p>
          </div>

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

          <div className="mt-6 rounded-3xl border border-violet-500/20 bg-violet-500/5 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 shrink-0 text-violet-600"
                size={19}
              />

              <div>
                <p className="font-black">
                  Dernière vérification avant réservation
                </p>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  En confirmant, KLYX crée la réservation avec ce prestataire et ce créneau.
                  Aucun paiement n’est déclenché ici.
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="text-xs font-bold text-muted-foreground">
                      Prestataire
                    </p>

                    <p className="mt-1 font-black">
                      {providerName}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="text-xs font-bold text-muted-foreground">
                      Prix accepté
                    </p>

                    <p className="mt-1 font-black">
                      {quote.provider_price == null
                        ? "—"
                        : formatKlyxMoney(
                            Number(quote.provider_price),
                            quote.country_code,
                            quote.currency
                          )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="text-xs font-bold text-muted-foreground">
                      Date
                    </p>

                    <p className="mt-1 font-black">
                      {bookingDate || "À confirmer"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="text-xs font-bold text-muted-foreground">
                      Horaire
                    </p>

                    <p className="mt-1 font-black">
                      {startTime && endTime
                        ? `${startTime} → ${endTime}`
                        : "À confirmer"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              !bookingDate ||
              !startTime ||
              !endTime ||
              !slotState.valid
            }
            className="klyx-button mt-6 w-full disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? (
              <LoaderCircle
                className="animate-spin"
                size={18}
              />
            ) : (
              <Send size={18} />
            )}
            Confirmer et créer la réservation
          </button>
        </form>
      </div>
    </main>
  );
}
