"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Star,
  UserRound,
} from "lucide-react";

type ReviewApiResponse = {
  bookingId?: string;
  providerId?: string;
  targetName?: string;
  avatarUrl?: string | null;
  review?: {
    id: string;
    rating: number;
    comment: string;
  } | null;
  message?: string;
  error?: string;
};

async function readResponse(
  response: Response
): Promise<ReviewApiResponse> {
  const body =
    (await response.json()) as ReviewApiResponse;

  if (!response.ok) {
    throw new Error(
      body.error || "Une erreur inattendue est survenue."
    );
  }

  return body;
}

export default function ReviewPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();

  const bookingId = params.bookingId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [targetName, setTargetName] =
    useState("Prestataire KLYX");
  const [avatarUrl, setAvatarUrl] =
    useState<string | null>(null);
  const [reviewId, setReviewId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/reviews?bookingId=${encodeURIComponent(
          bookingId
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const body = await readResponse(response);

      setProviderId(body.providerId ?? "");
      setTargetName(
        body.targetName ?? "Prestataire KLYX"
      );
      setAvatarUrl(body.avatarUrl ?? null);

      if (body.review) {
        setReviewId(body.review.id);
        setRating(body.review.rating);
        setComment(body.review.comment);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Chargement impossible."
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function saveReview(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId,
          rating,
          comment,
        }),
      });

      const body = await readResponse(response);

      setReviewId(body.review?.id ?? reviewId);
      setMessage(body.message ?? "Avis enregistré.");

      const nextProviderId =
        body.providerId ?? providerId;

      window.setTimeout(() => {
        router.push(
          nextProviderId
            ? `/providers/${nextProviderId}`
            : "/bookings"
        );
      }, 700);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Enregistrement impossible."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground dark:bg-zinc-950">
        <div className="inline-flex items-center gap-3 text-sm text-muted-foreground">
          <LoaderCircle
            size={19}
            className="animate-spin"
          />
          Chargement de l’avis...
        </div>
      </main>
    );
  }

  if (errorMessage && !providerId) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground dark:bg-zinc-950">
        <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-7 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-2xl font-black">
            Avis indisponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-red-600 dark:text-red-300">
            {errorMessage}
          </p>
          <Link
            href="/bookings"
            className="mt-6 inline-flex rounded-xl bg-violet-600 px-6 py-3 text-sm font-black text-white hover:bg-violet-700"
          >
            Retour aux réservations
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground dark:bg-zinc-950 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/bookings/${bookingId}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={17} />
          Retour à la mission
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-border p-6 text-center dark:border-zinc-800 sm:p-8">
            <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-3xl border border-border bg-muted dark:border-zinc-700 dark:bg-zinc-800">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={targetName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound
                  size={38}
                  className="text-muted-foreground"
                />
              )}
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
              Avis vérifié KLYX
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
              {reviewId
                ? "Modifier mon avis"
                : "Comment s’est passée la mission ?"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Ton avis concerne{" "}
              <strong className="text-foreground">
                {targetName}
              </strong>
              . Seules les missions terminées peuvent être
              évaluées.
            </p>
          </div>

          <form
            onSubmit={saveReview}
            className="space-y-7 p-6 sm:p-8"
          >
            <div>
              <p className="text-sm font-black">
                Ta note
              </p>

              <div
                className="mt-3 flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Note sur 5"
              >
                {[1, 2, 3, 4, 5].map((value) => {
                  const selected = value <= rating;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`grid h-12 w-12 place-items-center rounded-xl border transition ${
                        selected
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-500"
                          : "border-border bg-background text-muted-foreground hover:bg-muted dark:border-zinc-700 dark:bg-zinc-950"
                      }`}
                      aria-label={`${value} étoile${
                        value > 1 ? "s" : ""
                      }`}
                      aria-pressed={rating === value}
                    >
                      <Star
                        size={24}
                        fill={
                          selected
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                  );
                })}
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {rating}/5
              </p>
            </div>

            <div>
              <label
                htmlFor="review-comment"
                className="text-sm font-black"
              >
                Commentaire
              </label>

              <textarea
                id="review-comment"
                rows={5}
                maxLength={1000}
                value={comment}
                onChange={(event) =>
                  setComment(event.target.value)
                }
                placeholder="Décris ton expérience, la ponctualité, la qualité du service..."
                className="mt-3 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-950"
              />

              <p className="mt-2 text-right text-xs text-muted-foreground">
                {comment.length}/1000
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={18} />
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 text-base font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              )}

              {saving
                ? "Enregistrement..."
                : reviewId
                  ? "Modifier mon avis"
                  : "Publier mon avis"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
