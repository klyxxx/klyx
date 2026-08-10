"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile } from "@/lib/account-switcher";
import KlyxSelect from "@/app/components/KlyxSelect";

type Booking = {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
};

const REASONS = [
  ["provider_absent", "Prestataire absent"],
  ["client_absent", "Client absent"],
  ["major_delay", "Retard important"],
  ["unfinished_work", "Mission non terminée"],
  ["unsatisfactory_work", "Travail insatisfaisant"],
  ["unsafe_behavior", "Comportement dangereux"],
  ["payment_problem", "Problème de paiement"],
  ["other", "Autre problème"],
] as const;

export default function NewDisputePage() {
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadBookings() {
      try {
        const profile = await getActiveClientProfile();

        const { data, error } = await supabase
          .from("bookings")
          .select("id, booking_date, start_time, status")
          .or(
            `parent_id.eq.${profile.id},provider_id.eq.${profile.id},babysitter_id.eq.${profile.id}`
          )
          .neq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw new Error(error.message);

        setBookings((data ?? []) as Booking[]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les réservations."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadBookings();
  }, []);

  async function submit(event: FormEvent) {
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

      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId,
          reason,
          description,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error || "Signalement impossible."
        );
      }

      router.push("/trust?created=1");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Signalement impossible."
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/trust"
          className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground"
        >
          <ArrowLeft size={17} />
          Centre de confiance
        </Link>

        <section className="klyx-card mt-6 p-6 sm:p-8">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-500/10 text-rose-600">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="klyx-eyebrow">
                Étape 3 · Trust & Safety
              </p>
              <h1 className="mt-2 text-3xl font-black">
                Signaler un problème
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Décris précisément les faits. Un signalement
                n’annule pas automatiquement une mission et ne
                déclenche pas automatiquement un remboursement.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-6 flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle size={18} />
              {errorMessage}
            </div>
          )}

          {loading ? (
            <div className="mt-8 grid min-h-40 place-items-center">
              <LoaderCircle
                className="animate-spin text-violet-600"
                size={34}
              />
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-black">
                  Réservation concernée
                </span>
                <KlyxSelect
                  value={bookingId}
                  onChange={setBookingId}
                  placeholder="Choisir une réservation"
                  options={bookings.map((booking) => ({
                    value: booking.id,
                    label: `${booking.booking_date} à ${booking.start_time.slice(0, 5)} · ${booking.status}`,
                  }))}
                  ariaLabel="Réservation concernée"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black">
                  Motif
                </span>
                <KlyxSelect
                  value={reason}
                  onChange={setReason}
                  placeholder="Choisir un motif"
                  options={REASONS.map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  ariaLabel="Motif du signalement"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black">
                  Description détaillée
                </span>
                <textarea
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={8}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  className="klyx-input resize-none"
                  placeholder="Explique les faits, les horaires et ce qui s’est passé."
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {description.length}/2000 caractères
                </p>
              </label>

              <button
                type="submit"
                disabled={
                  submitting ||
                  !bookingId ||
                  !reason ||
                  description.trim().length < 20
                }
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-black text-white disabled:opacity-40"
              >
                {submitting && (
                  <LoaderCircle
                    className="animate-spin"
                    size={18}
                  />
                )}
                Enregistrer le signalement
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}


