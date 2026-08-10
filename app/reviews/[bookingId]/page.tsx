"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile } from "@/lib/account-switcher";

type BookingRow = {
  id: string;
  parent_id: string;
  babysitter_id: string;
  status: string;
};

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
};

export default function ReviewPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [reviewId, setReviewId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [targetName, setTargetName] = useState("Prestataire");
  const [errorMessage, setErrorMessage] = useState("");

  const bookingId = params.bookingId;

  const loadPage = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const activeProfile = await getActiveClientProfile();

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("id, parent_id, babysitter_id, status")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingError) throw new Error(bookingError.message);
      if (!bookingData) throw new Error("Réservation introuvable.");

      const currentBooking = bookingData as BookingRow;

      if (currentBooking.parent_id !== activeProfile.id) {
        throw new Error("Seul le client peut laisser un avis.");
      }

      if (currentBooking.status !== "completed") {
        throw new Error("La réservation doit être terminée.");
      }

      setBooking(currentBooking);

      const [
        { data: profileData, error: profileError },
        { data: reviewData, error: reviewError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, first_name, last_name")
          .eq("id", currentBooking.babysitter_id)
          .maybeSingle(),
        supabase
          .from("reviews")
          .select("id, rating, comment")
          .eq("booking_id", currentBooking.id)
          .eq("author_id", activeProfile.id)
          .maybeSingle(),
      ]);

      if (profileError) throw new Error(profileError.message);
      if (reviewError) throw new Error(reviewError.message);

      if (profileData) {
        setTargetName(
          profileData.full_name?.trim() ||
            `${profileData.first_name ?? ""} ${profileData.last_name ?? ""}`.trim() ||
            "Prestataire"
        );
      }

      if (reviewData) {
        const review = reviewData as ReviewRow;
        setReviewId(review.id);
        setRating(review.rating);
        setComment(review.comment ?? "");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Chargement impossible."
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!booking) return;

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const activeProfile = await getActiveClientProfile();

      if (reviewId) {
        const { error } = await supabase
          .from("reviews")
          .update({
            rating,
            comment: comment.trim() || null,
          })
          .eq("id", reviewId)
          .eq("author_id", activeProfile.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("reviews").insert({
          booking_id: booking.id,
          author_id: activeProfile.id,
          target_id: booking.babysitter_id,
          rating,
          comment: comment.trim() || null,
        });

        if (error) throw new Error(error.message);
      }

      alert(reviewId ? "Avis modifié." : "Avis publié.");
      router.push(`/babysitters/${booking.babysitter_id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Enregistrement impossible."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 text-foreground dark:text-white">
        Chargement...
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 px-6 text-center text-foreground dark:text-white">
        <div>
          <h1 className="text-2xl font-bold">Avis indisponible</h1>
          <p className="mt-3 text-red-400">{errorMessage}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-violet-600 px-6 py-3 font-semibold"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background dark:bg-zinc-950 px-4 py-10 text-foreground dark:text-white sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-muted-foreground dark:text-zinc-400">
          Retour au tableau de bord
        </Link>

        <section className="mt-8 rounded-3xl border border-border dark:border-zinc-800 bg-card/60 dark:bg-zinc-900/60 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
            KLYX
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            {reviewId ? "Modifier mon avis" : "Laisser un avis"}
          </h1>

          <p className="mt-3 text-muted-foreground dark:text-zinc-400">
            Note ton expérience avec {targetName}.
          </p>

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              {errorMessage}
            </div>
          )}

          <form onSubmit={saveReview} className="mt-8 space-y-6">
            <div>
              <p className="mb-3 text-sm font-medium text-foreground/80 dark:text-zinc-300">Note</p>

              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`text-4xl ${
                      value <= rating ? "text-amber-400" : "text-zinc-700"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="comment"
                className="mb-2 block text-sm font-medium text-foreground/80 dark:text-zinc-300"
              >
                Commentaire
              </label>

              <textarea
                id="comment"
                rows={6}
                maxLength={1000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Décris ton expérience..."
                className="w-full rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-violet-600 px-6 py-4 text-lg font-semibold hover:bg-violet-700 disabled:opacity-60"
            >
              {saving
                ? "Enregistrement..."
                : reviewId
                  ? "Modifier l'avis"
                  : "Publier l'avis"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
