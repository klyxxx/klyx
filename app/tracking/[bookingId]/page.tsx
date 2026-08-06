"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Navigation,
  Play,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile } from "@/lib/account-switcher";

type ServiceStatus =
  | "scheduled"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  service_status: ServiceStatus | null;
  provider_finished_at: string | null;
  provider_finish_note: string | null;
  client_confirmed_at: string | null;
};

type TrackingEvent = {
  id: string;
  actor_id: string | null;
  status: ServiceStatus;
  note: string | null;
  created_at: string;
};

const STEPS = [
  {
    status: "scheduled" as const,
    label: "Prestation planifiée",
    icon: <Clock3 size={18} />,
  },
  {
    status: "en_route" as const,
    label: "Prestataire en route",
    icon: <Navigation size={18} />,
  },
  {
    status: "arrived" as const,
    label: "Prestataire arrivé",
    icon: <MapPin size={18} />,
  },
  {
    status: "in_progress" as const,
    label: "Prestation en cours",
    icon: <Play size={18} />,
  },
  {
    status: "completed" as const,
    label: "Mission confirmée",
    icon: <CheckCircle2 size={18} />,
  },
];

const NEXT_STATUS: Partial<
  Record<ServiceStatus, ServiceStatus>
> = {
  scheduled: "en_route",
  en_route: "arrived",
  arrived: "in_progress",
};

const ACTION_LABELS: Partial<
  Record<ServiceStatus, string>
> = {
  en_route: "Je suis en route",
  arrived: "Je suis arrivé",
  in_progress: "Commencer la prestation",
};

export default function TrackingPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  const router = useRouter();

  const [booking, setBooking] =
    useState<BookingRow | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [currentProfileId, setCurrentProfileId] =
    useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadTracking = useCallback(async () => {
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const activeProfile = await getActiveClientProfile();
      setCurrentProfileId(activeProfile.id);

      const [bookingResult, eventsResult] =
        await Promise.all([
          supabase
            .from("bookings")
            .select(
              "id, parent_id, provider_id, babysitter_id, booking_date, start_time, end_time, status, payment_status, service_status, provider_finished_at, provider_finish_note, client_confirmed_at"
            )
            .eq("id", bookingId)
            .maybeSingle(),
          supabase
            .from("booking_tracking_events")
            .select(
              "id, actor_id, status, note, created_at"
            )
            .eq("booking_id", bookingId)
            .order("created_at", { ascending: true }),
        ]);

      if (bookingResult.error) {
        throw new Error(bookingResult.error.message);
      }

      if (eventsResult.error) {
        throw new Error(eventsResult.error.message);
      }

      if (!bookingResult.data) {
        throw new Error("Réservation introuvable.");
      }

      const loadedBooking =
        bookingResult.data as BookingRow;
      const providerId =
        loadedBooking.provider_id ??
        loadedBooking.babysitter_id;

      if (
        activeProfile.id !== loadedBooking.parent_id &&
        activeProfile.id !== providerId
      ) {
        throw new Error("Accès refusé.");
      }

      setBooking(loadedBooking);
      setEvents(
        (eventsResult.data ?? []) as TrackingEvent[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger le suivi."
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    void loadTracking();

    const channel = supabase
      .channel(`tracking-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_tracking_events",
          filter: `booking_id=eq.${bookingId}`,
        },
        () => void loadTracking()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `id=eq.${bookingId}`,
        },
        () => void loadTracking()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, loadTracking]);

  const currentStatus =
    booking?.service_status ?? "scheduled";
  const providerId =
    booking?.provider_id ?? booking?.babysitter_id;
  const isProvider =
    Boolean(providerId) &&
    currentProfileId === providerId;
  const isClient =
    Boolean(booking) &&
    currentProfileId === booking?.parent_id;
  const awaitingClientConfirmation = Boolean(
    booking?.provider_finished_at &&
      !booking?.client_confirmed_at
  );

  const currentStepIndex = useMemo(() => {
    if (awaitingClientConfirmation) {
      return STEPS.findIndex(
        (step) => step.status === "in_progress"
      );
    }

    return STEPS.findIndex(
      (step) => step.status === currentStatus
    );
  }, [awaitingClientConfirmation, currentStatus]);

  async function sendAction(
    action: ServiceStatus | "provider_finished" | "client_confirmed"
  ) {
    setUpdating(true);
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

      const response = await fetch(
        "/api/bookings/tracking",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            bookingId,
            action,
            note,
          }),
        }
      );

      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error || "Mise à jour impossible."
        );
      }

      setNote("");
      setSuccessMessage(
        result.message || "Suivi mis à jour."
      );
      await loadTracking();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour le suivi."
      );
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle
          className="animate-spin text-violet-600"
          size={38}
        />
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-3xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-700 dark:text-rose-300">
          {errorMessage || "Réservation introuvable."}
        </div>
      </main>
    );
  }

  const nextStatus = NEXT_STATUS[currentStatus];
  const canProviderAdvance =
    isProvider &&
    booking.status === "accepted" &&
    booking.payment_status === "paid" &&
    !awaitingClientConfirmation &&
    Boolean(nextStatus);

  const canProviderFinish =
    isProvider &&
    booking.status === "accepted" &&
    booking.payment_status === "paid" &&
    currentStatus === "in_progress" &&
    !awaitingClientConfirmation;

  const canClientConfirm =
    isClient &&
    booking.status === "accepted" &&
    awaitingClientConfirmation;

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/bookings/${bookingId}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
          >
            <ArrowLeft size={17} />
            Retour à la réservation
          </Link>

          <Link
            href={`/messages/${bookingId}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-violet-600 dark:text-violet-400"
          >
            <MessageCircle size={17} />
            Messagerie
          </Link>
        </div>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <ShieldCheck size={15} />
            Suivi sécurisé KLYX
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            État de la mission
          </h1>

          <p className="mt-4 text-sm text-white/70">
            {booking.booking_date} ·{" "}
            {booking.start_time.slice(0, 5)}–
            {booking.end_time.slice(0, 5)}
          </p>
        </section>

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        <section className="klyx-card mt-8 p-6 sm:p-8">
          <div className="space-y-3">
            {STEPS.map((step, index) => {
              const completed =
                currentStatus === "completed" ||
                index <= currentStepIndex;

              return (
                <div
                  key={step.status}
                  className={`flex items-center gap-4 rounded-2xl border p-4 ${
                    completed
                      ? "border-violet-500/30 bg-violet-500/10"
                      : "border-border bg-background"
                  }`}
                >
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-full ${
                      completed
                        ? "bg-violet-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {completed ? step.icon : <Circle size={18} />}
                  </div>

                  <p className="font-black">{step.label}</p>
                </div>
              );
            })}
          </div>

          {awaitingClientConfirmation && (
            <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
              <p className="font-black text-amber-800 dark:text-amber-200">
                Confirmation du client attendue
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-700 dark:text-amber-300">
                Le prestataire a déclaré la mission terminée.
                Le client doit vérifier puis confirmer.
              </p>
              {booking.provider_finish_note && (
                <p className="mt-3 text-sm font-semibold">
                  « {booking.provider_finish_note} »
                </p>
              )}
            </div>
          )}

          {(canProviderFinish || canClientConfirm) && (
            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-bold">
                Note facultative
              </span>
              <textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                className="klyx-input resize-none"
                placeholder={
                  canProviderFinish
                    ? "Ex. Mission terminée, tout s’est bien passé."
                    : "Ex. Mission vérifiée et terminée."
                }
              />
            </label>
          )}

          {canProviderAdvance && nextStatus && (
            <button
              type="button"
              onClick={() => void sendAction(nextStatus)}
              disabled={updating}
              className="mt-7 h-14 w-full rounded-2xl bg-violet-600 px-6 font-black text-white disabled:opacity-60"
            >
              {updating
                ? "Mise à jour..."
                : ACTION_LABELS[nextStatus]}
            </button>
          )}

          {canProviderFinish && (
            <button
              type="button"
              onClick={() =>
                void sendAction("provider_finished")
              }
              disabled={updating}
              className="mt-7 h-14 w-full rounded-2xl bg-violet-600 px-6 font-black text-white disabled:opacity-60"
            >
              {updating
                ? "Envoi..."
                : "Déclarer la mission terminée"}
            </button>
          )}

          {canClientConfirm && (
            <button
              type="button"
              onClick={() =>
                void sendAction("client_confirmed")
              }
              disabled={updating}
              className="mt-7 h-14 w-full rounded-2xl bg-emerald-600 px-6 font-black text-white disabled:opacity-60"
            >
              {updating
                ? "Confirmation..."
                : "Confirmer la fin de mission"}
            </button>
          )}
        </section>

        <section className="klyx-card mt-8 p-6 sm:p-8">
          <h2 className="text-2xl font-black">Historique</h2>

          {events.length === 0 ? (
            <p className="mt-4 text-muted-foreground">
              Aucun événement enregistré.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-border bg-background p-4"
                >
                  <p className="font-black">
                    {event.status === "en_route"
                      ? "Prestataire en route"
                      : event.status === "arrived"
                        ? "Prestataire arrivé"
                        : event.status === "in_progress"
                          ? "Mission en cours"
                          : event.status === "completed"
                            ? "Mission confirmée"
                            : event.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(
                      event.created_at
                    ).toLocaleString("fr-BE")}
                  </p>
                  {event.note && (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {event.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
