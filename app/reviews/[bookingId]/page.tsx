"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

function ReviewTrustStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-xs font-black text-emerald-600 dark:text-emerald-400">
          {number}
        </span>

        <p className="text-sm font-black">
          {title}
        </p>
      </div>

      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
export default function ReviewPage() {
  const params = useParams<{ bookingId: string }>();
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
  const [justSaved, setJustSaved] = useState(false);

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
    setJustSaved(false);

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
      setProviderId(nextProviderId);
      setJustSaved(true);
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

  // KLYX_REVIEW_COMPLETION_13_71
  if (justSaved) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground dark:bg-zinc-950">
        <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-emerald-500/25 bg-card shadow-sm dark:bg-zinc-900">
          <div className="p-7 text-center sm:p-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 size={32} />
            </div>

            <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
              Mission terminée
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Merci pour ton avis.
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
              Ton avis est maintenant lié à cette mission réelle.
              KLYX l’utilise dans les informations de confiance du
              prestataire pour aider les prochains clients.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Mission
                </p>

                <p className="mt-2 font-black">
                  Terminée
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Ton avis
                </p>

                <div className="mt-2 flex items-center justify-center gap-1 font-black">
                  <Star
                    size={16}
                    fill="currentColor"
                    className="text-amber-500"
                  />
                  {rating}/5
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Statut
                </p>

                <p className="mt-2 font-black text-emerald-600">
                  Avis vérifié
                </p>
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 text-left">
              <p className="font-black">
                La boucle KLYX est terminée.
              </p>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Besoin, prestataire, réservation, paiement,
                prestation et avis : cette mission est maintenant
                entièrement clôturée.
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {providerId && (
                <Link
                  href={`/providers/${providerId}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-background px-5 py-3 text-sm font-black transition hover:bg-muted"
                >
                  Voir le profil du prestataire
                </Link>
              )}

              <Link
                href="/bookings"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-background px-5 py-3 text-sm font-black transition hover:bg-muted"
              >
                Mes réservations
              </Link>
            </div>

            <Link
              href="/assistant/market"
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700"
            >
              Organiser un nouveau service
            </Link>

            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              Aucune nouvelle réservation ou dépense n’est déclenchée automatiquement.
            </p>
          </div>
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

                    {/* KLYX_VERIFIED_REVIEW_TRUST_13_99 */}
          <div className="border-b border-border bg-emerald-500/[0.035] p-5 dark:border-zinc-800 sm:p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2
                size={20}
                className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              />

              <div>
                <p className="font-black">
                  Un avis lié à une vraie mission KLYX
                </p>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cette évaluation est rattachée à la réservation
                  #{bookingId.slice(0, 8)}. Elle aide les futurs clients
                  à mieux comprendre la fiabilité réelle du prestataire.
                </p>
              </div>
            </div>

            {/* KLYX_REVIEW_TRUST_FLOW_13_99 */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <ReviewTrustStep
                number="1"
                title="Mission terminée"
                text="La prestation a réellement eu lieu."
              />

              <ReviewTrustStep
                number="2"
                title="Avis vérifié"
                text="La note est liée à cette réservation."
              />

              <ReviewTrustStep
                number="3"
                title="Confiance"
                text="L’expérience aide les prochains clients à comparer."
              />
            </div>
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

                        {/* KLYX_REVIEW_EXPLICIT_NEXT_ACTION_14_10 */}
            {message && (
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-black">
                  Que veux-tu faire maintenant ?
                </p>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Ton avis est enregistré. KLYX te laisse choisir la prochaine étape.
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {providerId && (
                    <Link
                      href={`/providers/${providerId}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700"
                    >
                      Voir le prestataire
                    </Link>
                  )}

                  <Link
                    href={`/bookings/${bookingId}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-black transition hover:bg-muted"
                  >
                    Retour à la mission
                  </Link>

                  <Link
                    href="/bookings"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-black transition hover:bg-muted sm:col-span-2"
                  >
                    Mes réservations
                  </Link>
                </div>

                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {/* KLYX_REVIEW_NO_AUTO_REDIRECT_14_10 */}
                  Aucun changement de page n’est déclenché automatiquement.
                </p>
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
