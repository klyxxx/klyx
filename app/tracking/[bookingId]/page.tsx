"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  MapPin,
  Navigation,
  Play,
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
  service_status: ServiceStatus | null;
};

type TrackingEvent = {
  id: string;
  status: ServiceStatus;
  note: string | null;
  created_at: string;
};

const STEPS: Array<{
  status: ServiceStatus;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    status: "scheduled",
    label: "Prestation planifiée",
    icon: <Clock3 size={18} />,
  },
  {
    status: "en_route",
    label: "Prestataire en route",
    icon: <Navigation size={18} />,
  },
  {
    status: "arrived",
    label: "Prestataire arrivé",
    icon: <MapPin size={18} />,
  },
  {
    status: "in_progress",
    label: "Prestation commencée",
    icon: <Play size={18} />,
  },
  {
    status: "completed",
    label: "Prestation terminée",
    icon: <CheckCircle2 size={18} />,
  },
];

const NEXT_STATUS: Partial<Record<ServiceStatus, ServiceStatus>> = {
  scheduled: "en_route",
  en_route: "arrived",
  arrived: "in_progress",
  in_progress: "completed",
};

const ACTION_LABELS: Partial<Record<ServiceStatus, string>> = {
  en_route: "Je suis en route",
  arrived: "Je suis arrivé",
  in_progress: "Commencer la prestation",
  completed: "Terminer la prestation",
};

export default function TrackingPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  const router = useRouter();

  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      setCurrentUserId(activeProfile.id);

      const [
        { data: bookingData, error: bookingError },
        { data: eventsData, error: eventsError },
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, parent_id, provider_id, babysitter_id, booking_date, start_time, end_time, status, service_status"
          )
          .eq("id", bookingId)
          .maybeSingle(),

        supabase
          .from("booking_tracking_events")
          .select("id, status, note, created_at")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: true }),
      ]);

      if (bookingError) {
        throw new Error(bookingError.message);
      }

      if (eventsError) {
        throw new Error(eventsError.message);
      }

      if (!bookingData) {
        throw new Error("Réservation introuvable.");
      }

      setBooking(bookingData as BookingRow);
      setEvents((eventsData ?? []) as TrackingEvent[]);
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
        () => {
          void loadTracking();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, loadTracking]);

  const currentStatus = booking?.service_status ?? "scheduled";
  const providerId = booking?.provider_id ?? booking?.babysitter_id;
  const isProvider = Boolean(
    providerId && currentUserId === providerId
  );

  const currentStepIndex = useMemo(() => {
    return STEPS.findIndex((step) => step.status === currentStatus);
  }, [currentStatus]);

  async function updateStatus() {
    const nextStatus = NEXT_STATUS[currentStatus];

    if (!nextStatus) {
      return;
    }

    setUpdating(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/bookings/tracking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId,
          status: nextStatus,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Mise à jour impossible.");
      }

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
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Chargement du suivi...
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
          {errorMessage || "Réservation introuvable."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/messages/${bookingId}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={17} />
          Retour à la messagerie
        </Link>

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
            Suivi en direct KLYX
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            État de la prestation
          </h1>

          <p className="mt-3 text-zinc-400">
            {booking.booking_date} · {booking.start_time.slice(0, 5)}–
            {booking.end_time.slice(0, 5)}
          </p>

          {errorMessage && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="mt-8 space-y-3">
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
                      : "border-zinc-800 bg-zinc-950"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      completed
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {completed ? step.icon : <Circle size={18} />}
                  </div>

                  <p className="font-semibold">{step.label}</p>
                </div>
              );
            })}
          </div>

          {isProvider && NEXT_STATUS[currentStatus] && (
            <button
              type="button"
              onClick={updateStatus}
              disabled={updating}
              className="mt-8 w-full rounded-xl bg-violet-600 px-6 py-4 text-lg font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              {updating
                ? "Mise à jour..."
                : ACTION_LABELS[NEXT_STATUS[currentStatus] as ServiceStatus]}
            </button>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Historique</h2>

          {events.length === 0 ? (
            <p className="mt-4 text-zinc-400">
              Aucun événement enregistré pour le moment.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <p className="font-semibold">{event.status}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {new Date(event.created_at).toLocaleString("fr-BE")}
                  </p>
                  {event.note && (
                    <p className="mt-2 text-sm text-zinc-300">
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
