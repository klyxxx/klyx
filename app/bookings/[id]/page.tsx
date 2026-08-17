// KLYX_BOOKING_DETAIL_CURRENCY_PHASE_5G
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  MapPin,
  MessageCircle,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile, type SavedAccount } from "@/lib/account-switcher";
import BookingContactCard from "@/app/components/BookingContactCard";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  service_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  message: string | null;
  status: string;
  payment_status: string | null;
  service_status: string | null;
  pricing_type_snapshot: string | null;
  unit_price_cents: number | null;
  estimated_amount_cents: number | null;
  amount_total: number | null;
  currency: string | null;
  payment_failure_message: string | null;
  provider_response: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type ServiceRow = {
  id: string;
  slug: string;
};

type StatusEventRow = {
  id: string;
  actor_id: string | null;
  previous_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
};

type TimelineEvent = StatusEventRow & {
  actorName: string;
};

type BookingStatusAction = "accepted" | "rejected" | "cancelled";

const SERVICE_LABELS: Record<string, string> = {
  babysitting: "Baby-sitting",
  cleaning: "Ménage",
  moving: "Déménagement",
  handyman: "Bricolage",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Demande envoyée",
  accepted: "Réservation acceptée",
  rejected: "Demande refusée",
  cancelled: "Réservation annulée",
  completed: "Prestation terminée",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  accepted: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-300",
  cancelled: "border-border dark:border-zinc-700 bg-muted dark:bg-zinc-800 text-foreground/80 dark:text-zinc-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

function formatName(profile: ProfileRow | undefined): string {
  if (!profile) return "Utilisateur KLYX";

  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "Utilisateur KLYX"
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(
  amount: number | null,
  currency: string
): string {
  if (
    amount == null
  ) {
    return "Prix à confirmer";
  }

  const code =
    currency
      ?.trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      code
    )
  ) {
    return (
      (
        amount /
        100
      ).toFixed(2) +
      " · devise indisponible"
    );
  }

  return new Intl.NumberFormat(
    "fr-BE",
    {
      style:
        "currency",
      currency:
        code,
    }
  ).format(
    amount /
    100
  );
}

export default function BookingDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = params.id;

  const [activeProfile, setActiveProfile] = useState<SavedAccount | null>(null);
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [otherProfile, setOtherProfile] = useState<ProfileRow | null>(null);
  const [serviceLabel, setServiceLabel] = useState("Service KLYX");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState(
    searchParams.get("created") === "1"
      ? "Demande envoyée. Le prestataire vient d’être averti."
      : searchParams.get("payment") === "success"
        ? "Paiement effectué avec succès."
        : ""
  );

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const profile = await getActiveClientProfile();
      const [bookingResult, eventsResult] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, parent_id, provider_id, babysitter_id, service_id, booking_date, start_time, end_time, message, status, payment_status, service_status, pricing_type_snapshot, unit_price_cents, estimated_amount_cents, amount_total, currency, payment_failure_message, provider_response, cancellation_reason, cancelled_by, created_at, accepted_at, rejected_at, cancelled_at, completed_at"
          )
          .eq("id", bookingId)
          .maybeSingle(),
        supabase
          .from("booking_status_events")
          .select("id, actor_id, previous_status, new_status, note, created_at")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: true }),
      ]);

      if (bookingResult.error) throw new Error(bookingResult.error.message);
      if (eventsResult.error) throw new Error(eventsResult.error.message);
      if (!bookingResult.data) throw new Error("Réservation introuvable.");

      const bookingData = bookingResult.data as BookingRow;
      const providerId = bookingData.provider_id ?? bookingData.babysitter_id;
      const participant =
        bookingData.parent_id === profile.id || providerId === profile.id;

      if (!participant) throw new Error("Accès refusé.");

      const otherProfileId =
        bookingData.parent_id === profile.id ? providerId : bookingData.parent_id;
      const statusEvents = (eventsResult.data ?? []) as StatusEventRow[];
      const profileIds = Array.from(
        new Set(
          [otherProfileId, profile.id, ...statusEvents.map((event) => event.actor_id)].filter(
            (value): value is string => Boolean(value)
          )
        )
      );

      const [profilesResult, serviceResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", profileIds),
        bookingData.service_id
          ? supabase
              .from("services")
              .select("id, slug")
              .eq("id", bookingData.service_id)
              .maybeSingle()
          : Promise.resolve({ data: null as ServiceRow | null, error: null }),
      ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message);
      if (serviceResult.error) throw new Error(serviceResult.error.message);

      const profiles = (profilesResult.data ?? []) as ProfileRow[];
      const profileById = new Map(profiles.map((item) => [item.id, item]));
      const service = serviceResult.data as ServiceRow | null;

      setActiveProfile(profile);
      setBooking(bookingData);
      setOtherProfile(otherProfileId ? profileById.get(otherProfileId) ?? null : null);
      setServiceLabel(
        service ? SERVICE_LABELS[service.slug] ?? service.slug : "Baby-sitting"
      );
      setEvents(
        statusEvents.map((event) => ({
          ...event,
          actorName: event.actor_id
            ? formatName(profileById.get(event.actor_id))
            : "KLYX",
        }))
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de charger la réservation."
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBooking();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBooking]);

  const role = useMemo<"client" | "provider" | null>(() => {
    if (!booking || !activeProfile) return null;

    return booking.parent_id === activeProfile.id ? "client" : "provider";
  }, [activeProfile, booking]);

  async function updateStatus(status: BookingStatusAction) {
    setActiveAction(status);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/bookings/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ bookingId, status, note }),
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) throw new Error(result.error || "Action impossible.");

      setNote("");
      setSuccessMessage(result.message || "Réservation mise à jour.");
      await loadBooking();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setActiveAction(null);
    }
  }

  async function payBooking() {
    setActiveAction("pay");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ bookingId }),
        });
        const result = (await response.json()) as {
          url?: string;
          error?: string;
          alreadyPaid?: boolean;
          paymentPending?: boolean;
        };

        if (result.alreadyPaid) {
          setSuccessMessage("Paiement effectué avec succès.");
          await loadBooking();
          return;
        }

        if (result.paymentPending && attempt < 4) {
          await new Promise((resolve) => window.setTimeout(resolve, 700));
          continue;
        }

        if (!response.ok || !result.url) {
          throw new Error(
            result.paymentPending
              ? "Le paiement sécurisé ne s’est pas ouvert. Clique de nouveau sur Payer la réservation."
              : result.error || "Paiement impossible."
          );
        }

        window.location.href = result.url;
        return;
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Paiement impossible.");
      setActiveAction(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 text-foreground dark:text-white">
        Chargement de la réservation...
      </main>
    );
  }

  if (!booking || !activeProfile) {
    return (
      <main className="min-h-screen bg-background dark:bg-zinc-950 px-5 py-10 text-foreground dark:text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
          {errorMessage || "Réservation introuvable."}
        </div>
      </main>
    );
  }

  const amount = booking.estimated_amount_cents ?? booking.amount_total;
  const canProviderAnswer = role === "provider" && booking.status === "pending";
  const canCancel =
    ["pending", "accepted"].includes(booking.status) &&
    !(role === "provider" && booking.status === "pending");
  const canPay =
    role === "client" &&
    booking.status === "accepted" &&
    booking.payment_status !== "paid";
  const canTrack =
    booking.status === "accepted" && booking.payment_status === "paid";
  const otherName = formatName(otherProfile ?? undefined);
  const paymentLabel =
    booking.payment_status === "paid"
      ? role === "provider"
        ? "Paiement reçu avec succès"
        : "Paiement effectué avec succès"
      : booking.payment_failure_message && role === "client"
        ? "Paiement refusé"
        : role === "provider"
          ? "En attente du paiement du client"
          : "À payer";

  return (
    <main className="min-h-screen bg-background dark:bg-zinc-950 px-5 py-10 text-foreground dark:text-white">
      <div className="mx-auto max-w-6xl">
        {/* KLYX_AI_FIRST_BOOKING_UI_15_01 */}
        {/* KLYX_BOOKING_NEXT_ACTION_13_69 */}
        <section className="mb-6 overflow-hidden rounded-[2rem] border border-violet-500/20 bg-[linear-gradient(135deg,rgba(124,58,237,0.12),rgba(76,29,149,0.04),transparent)]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
                  Suivi KLYX
                </p>

                <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                  {booking.status === "pending"
                    ? role === "provider"
                      ? "Une demande attend ta réponse"
                      : "En attente de la réponse du prestataire"
                    : booking.status === "accepted" &&
                        booking.payment_status !== "paid"
                      ? role === "client"
                        ? "Le prestataire a accepté. Le paiement est la prochaine étape."
                        : "Réservation acceptée. En attente du paiement du client."
                      : booking.status === "accepted" &&
                          booking.payment_status === "paid"
                        ? "Tout est prêt pour la prestation"
                        : booking.status === "completed"
                          ? "Prestation terminée"
                          : booking.status === "cancelled"
                            ? "Cette réservation est annulée"
                            : booking.status === "rejected"
                              ? "Cette demande a été refusée"
                              : "Suivi de la réservation"}
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {booking.status === "pending"
                    ? role === "provider"
                      ? "Vérifie la mission puis accepte ou refuse explicitement la demande."
                      : "Aucune action n’est nécessaire pour le moment. KLYX attend la décision du prestataire."
                    : booking.status === "accepted" &&
                        booking.payment_status !== "paid"
                      ? role === "client"
                        ? "La réservation est acceptée. Rien n’est débité automatiquement : tu décides quand lancer le paiement sécurisé."
                        : "Le client doit encore effectuer le paiement avant le démarrage de la prestation."
                      : booking.status === "accepted" &&
                          booking.payment_status === "paid"
                        ? "Le paiement est confirmé. La prestation peut maintenant être suivie."
                        : booking.status === "completed"
                          ? "La prestation est terminée. L’évaluation devient la prochaine étape."
                          : booking.status === "cancelled"
                            ? "Le parcours de cette réservation est arrêté."
                            : booking.status === "rejected"
                              ? "Cette demande ne poursuivra pas le parcours."
                              : "KLYX affiche ici l’état actuel et la prochaine action utile."}
                </p>
              </div>

              {canPay && (
                <button
                  type="button"
                  disabled={activeAction === "pay"}
                  onClick={() => void payBooking()}
                  className="klyx-button shrink-0 lg:min-w-[220px]"
                >
                  {activeAction === "pay" ? (
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <CreditCard size={17} />
                  )}

                  Payer maintenant
                </button>
              )}
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <JourneyStep
                number="1"
                label="Demande"
                state={
                  booking.status === "pending"
                    ? "current"
                    : booking.status === "rejected" ||
                        booking.status === "cancelled"
                      ? "stopped"
                      : "done"
                }
              />

              <JourneyStep
                number="2"
                label="Acceptation"
                state={
                  booking.status === "pending"
                    ? "upcoming"
                    : booking.status === "rejected" ||
                        booking.status === "cancelled"
                      ? "stopped"
                      : "done"
                }
              />

              <JourneyStep
                number="3"
                label="Paiement"
                state={
                  booking.payment_status === "paid"
                    ? "done"
                    : booking.status === "accepted"
                      ? "current"
                      : booking.status === "rejected" ||
                          booking.status === "cancelled"
                        ? "stopped"
                        : "upcoming"
                }
              />

              <JourneyStep
                number="4"
                label="Prestation"
                state={
                  booking.status === "completed"
                    ? "done"
                    : canTrack
                      ? "current"
                      : booking.status === "rejected" ||
                          booking.status === "cancelled"
                        ? "stopped"
                        : "upcoming"
                }
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-border bg-background px-3 py-1.5">
                Réservation : {STATUS_LABELS[booking.status] ?? booking.status}
              </span>

              <span className="rounded-full border border-border bg-background px-3 py-1.5">
                Paiement : {paymentLabel}
              </span>

              {canPay && (
                <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-violet-700 dark:text-violet-300">
                  Action requise : paiement
                </span>
              )}

              {canTrack && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-300">
                  Prestation prête
                </span>
              )}
            </div>

            {canPay && (
              <p className="mt-5 text-xs font-bold text-muted-foreground">
                Paiement manuel uniquement · aucun débit automatique.
              </p>
            )}
          </div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:text-white"
          >
            <ArrowLeft size={17} /> Retour aux réservations
          </Link>
          <button
            type="button"
            onClick={() => void loadBooking()}
            className="inline-flex items-center gap-2 rounded-xl border border-border dark:border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-card dark:bg-zinc-900"
          >
            <RefreshCw size={16} /> Actualiser
          </button>
        </div>

        {successMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-200">
            <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            <section className="rounded-3xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
                    {serviceLabel}
                  </p>
                  <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                    {STATUS_LABELS[booking.status] ?? booking.status}
                  </h1>
                </div>
                <span
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    STATUS_STYLES[booking.status] ?? STATUS_STYLES.cancelled
                  }`}
                >
                  {STATUS_LABELS[booking.status] ?? booking.status}
                </span>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <InfoItem
                  icon={<CalendarDays size={19} />}
                  label="Date"
                  value={formatDate(booking.booking_date)}
                />
                <InfoItem
                  icon={<Clock3 size={19} />}
                  label="Horaire"
                  value={`${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`}
                />
                <InfoItem
                  icon={<CreditCard size={19} />}
                  label="Paiement"
                  value={paymentLabel}
                />
                <InfoItem
                  icon={<MapPin size={19} />}
                  label="Total estimé"
                  value={formatMoney(amount, booking.currency ?? "")}
                />
              </div>

              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border dark:border-zinc-800 bg-background dark:bg-zinc-950 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
                  {otherProfile?.avatar_url ? (
                    <img
                      src={otherProfile.avatar_url}
                      alt={otherName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound className="text-muted-foreground dark:text-zinc-500" size={24} />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground dark:text-zinc-500">
                    {role === "client" ? "Prestataire" : "Client"}
                  </p>
                  <p className="font-bold">{otherName}</p>
                </div>
              </div>

              {/* KLYX_SECURE_CONTACT_UI_12_68B */}
              <BookingContactCard
                bookingId={booking.id}
                bookingStatus={booking.status}
                otherName={otherName}
              />
              {booking.message && (
                <div className="mt-6 rounded-2xl border border-border dark:border-zinc-800 p-5">
                  <p className="text-sm font-semibold text-muted-foreground dark:text-zinc-400">Demande du client</p>
                  <p className="mt-2 whitespace-pre-wrap leading-7 text-zinc-200">
                    {booking.message}
                  </p>
                </div>
              )}

              {booking.provider_response && (
                <div className="mt-4 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
                  <p className="text-sm font-semibold text-violet-300">
                    Réponse du prestataire
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-200">
                    {booking.provider_response}
                  </p>
                </div>
              )}

              {booking.cancellation_reason && (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                  <p className="text-sm font-semibold text-red-300">Motif d’annulation</p>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-200">
                    {booking.cancellation_reason}
                  </p>
                </div>
              )}

              {role === "client" &&
                booking.payment_status !== "paid" &&
                booking.payment_failure_message && (
                  <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                    <p className="text-sm font-semibold text-red-300">
                      Paiement refusé
                    </p>
                    <p className="mt-2 text-zinc-200">
                      {booking.payment_failure_message}
                    </p>
                  </div>
                )}
            </section>

            <section className="rounded-3xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <History className="text-violet-400" size={24} />
                <h2 className="text-2xl font-bold">Historique</h2>
              </div>

              {events.length === 0 ? (
                <p className="mt-5 text-muted-foreground dark:text-zinc-400">Aucun événement enregistré.</p>
              ) : (
                <div className="mt-6 space-y-5">
                  {events.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4">
                      {index < events.length - 1 && (
                        <span className="absolute left-[11px] top-7 h-[calc(100%+4px)] w-px bg-zinc-700" />
                      )}
                      <span className="relative mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-zinc-900 bg-violet-500" />
                      <div className="pb-3">
                        <p className="font-semibold">
                          {STATUS_LABELS[event.new_status] ?? event.new_status}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground dark:text-zinc-500">
                          {event.actorName} · {formatDateTime(event.created_at)}
                        </p>
                        {event.note && (
                          <p className="mt-2 text-sm leading-6 text-foreground/80 dark:text-zinc-300">{event.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="h-fit rounded-3xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 p-6 lg:sticky lg:top-6">
            <h2 className="text-xl font-bold">Actions</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-zinc-400">
              {canProviderAnswer
                ? "Réponds à la demande. Ton message sera visible par le client."
                : "Les actions disponibles dépendent de l’état de la réservation."}
            </p>

            {(canProviderAnswer || canCancel) && (
              <label className="mt-5 block">
                <span className="mb-2 block text-sm text-foreground/80 dark:text-zinc-300">
                  {canProviderAnswer ? "Message de réponse" : "Motif d’annulation"}
                </span>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    canProviderAnswer
                      ? "Ex. Je confirme, à bientôt."
                      : "Explique brièvement l’annulation."
                  }
                  className="w-full resize-none rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 p-4 outline-none focus:border-violet-500"
                />
              </label>
            )}

            {canProviderAnswer && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button
                  type="button"
                  disabled={activeAction !== null}
                  onClick={() => void updateStatus("accepted")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-semibold hover:bg-violet-700 disabled:opacity-50"
                >
                  <Check size={18} /> Accepter
                </button>
                <button
                  type="button"
                  disabled={activeAction !== null}
                  onClick={() => void updateStatus("rejected")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <X size={18} /> Refuser
                </button>
              </div>
            )}

            {canPay && (
              <button
                type="button"
                disabled={activeAction !== null}
                onClick={() => void payBooking()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-4 font-semibold hover:bg-violet-700 disabled:opacity-50"
              >
                <CreditCard size={19} /> Payer la réservation
              </button>
            )}

            {canTrack && (
              <Link
                href={`/tracking/${booking.id}`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-4 font-semibold hover:bg-violet-700"
              >
                <MapPin size={19} /> Suivre la prestation
              </Link>
            )}

            <Link
              href={`/messages/${booking.id}`}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border dark:border-zinc-700 px-4 py-3 font-semibold hover:bg-muted dark:bg-zinc-800"
            >
              <MessageCircle size={18} /> Ouvrir la messagerie
            </Link>

            {canCancel && (
              <button
                type="button"
                disabled={activeAction !== null}
                onClick={() => void updateStatus("cancelled")}
                className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                Annuler la réservation
              </button>
            )}

            {!canProviderAnswer && !canPay && !canTrack && !canCancel && (
              <div className="mt-5 rounded-xl border border-border dark:border-zinc-800 bg-background dark:bg-zinc-950 p-4 text-sm text-muted-foreground dark:text-zinc-400">
                Aucune action supplémentaire pour le moment.
              </div>
            )}
          </aside>
        </div>

        {/* KLYX_VERIFIED_REVIEW_CTA_13_70 */}
        {role === "client" && booking.status === "completed" && (
          <section className="mb-6 overflow-hidden rounded-3xl border border-amber-500/25 bg-amber-500/5">
            <div className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                  Avis vérifié KLYX
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Comment s’est passée la prestation ?
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Partage ton expérience sur cette mission.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold">
                    Mission terminée
                  </span>

                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    Réservation vérifiée
                  </span>
                </div>
              </div>

              <Link
                href={`/reviews/${booking.id}`}
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-black text-white transition hover:bg-violet-700"
              >
                Laisser mon avis
              </Link>
            </div>

            <div className="border-t border-amber-500/15 px-6 py-4 text-xs leading-5 text-muted-foreground sm:px-8">
              Avis disponible après mission terminée.
            </div>
          </section>
        )}
</div>
    </main>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border dark:border-zinc-800 bg-background dark:bg-zinc-950 p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground dark:text-zinc-500">
        {icon} {label}
      </p>
      <p className="mt-2 font-semibold capitalize">{value}</p>
    </div>
  );
}
function JourneyStep({
  number,
  label,
  state,
}: {
  number: string;
  label: string;
  state:
    | "done"
    | "current"
    | "upcoming"
    | "stopped";
}) {
  const className =
    state === "done"
      ? "border-emerald-500/25 bg-emerald-500/10"
      : state === "current"
        ? "border-violet-500/30 bg-violet-500/10"
        : state === "stopped"
          ? "border-rose-500/20 bg-rose-500/10"
          : "border-border bg-background";

  const numberClassName =
    state === "done"
      ? "bg-emerald-600 text-white"
      : state === "current"
        ? "bg-violet-600 text-white"
        : state === "stopped"
          ? "bg-rose-500/15 text-rose-600"
          : "bg-muted text-muted-foreground";

  return (
    <div
      className={`rounded-2xl border p-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${numberClassName}`}
        >
          {state === "done" ? (
            <Check size={15} />
          ) : (
            number
          )}
        </span>

        <div>
          <p className="font-black">
            {label}
          </p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {state === "done"
              ? "Terminé"
              : state === "current"
                ? "Étape actuelle"
                : state === "stopped"
                  ? "Arrêté"
                  : "À venir"}
          </p>
        </div>
      </div>
    </div>
  );
}
