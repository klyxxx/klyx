"use client";

import {
  BadgeCheck,
  MessageSquareText,
  Star,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  verified: boolean;
};

type ReviewResponse = {
  averageRating?: number;
  reviewCount?: number;
  reviews?: PublicReview[];
  error?: string;
};

function reviewDate(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("fr-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function PublicReviews({
  providerId,
}: {
  providerId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] =
    useState(0);
  const [reviewCount, setReviewCount] =
    useState(0);
  const [reviews, setReviews] =
    useState<PublicReview[]>([]);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadReviews() {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(
          `/api/providers/${providerId}/reviews`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const body =
          (await response.json()) as ReviewResponse;

        if (!response.ok) {
          throw new Error(
            body.error ||
              "Impossible de charger les avis."
          );
        }

        setAverageRating(
          Number(body.averageRating ?? 0)
        );
        setReviewCount(
          Number(body.reviewCount ?? 0)
        );
        setReviews(body.reviews ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les avis."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadReviews();

    return () => controller.abort();
  }, [providerId]);

  const stars = useMemo(
    () => [1, 2, 3, 4, 5],
    []
  );

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
            Confiance KLYX
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Avis vérifiés
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Seuls les clients ayant terminé une
            mission avec ce prestataire peuvent
            publier ici.
          </p>
        </div>

        {!loading && reviewCount > 0 && (
          <div className="rounded-2xl border border-border bg-card px-5 py-3 text-right dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <Star
                size={20}
                className="text-amber-500"
                fill="currentColor"
              />

              <span className="text-2xl font-black">
                {averageRating.toFixed(1)}
              </span>

              <span className="text-sm text-muted-foreground">
                /5
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {reviewCount} avis vérifié
              {reviewCount > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900">
          Chargement des avis...
        </div>
      )}

      {!loading && errorMessage && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {!loading &&
        !errorMessage &&
        reviews.length === 0 && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <MessageSquareText
              size={28}
              className="mx-auto text-muted-foreground"
            />

            <p className="mt-3 font-black">
              Aucun avis vérifié pour le moment
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              Les premiers avis apparaîtront après
              des missions terminées et confirmées.
            </p>
          </div>
        )}

      {!loading &&
        !errorMessage &&
        reviews.length > 0 && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted dark:bg-zinc-800">
                      {review.authorAvatarUrl ? (
                        <img
                          src={
                            review.authorAvatarUrl
                          }
                          alt={review.authorName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound
                          size={21}
                          className="text-muted-foreground"
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-black">
                        {review.authorName}
                      </p>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {reviewDate(
                          review.createdAt
                        )}
                      </p>
                    </div>
                  </div>

                  {review.verified && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                      <BadgeCheck size={13} />
                      Vérifié
                    </span>
                  )}
                </div>

                <div className="mt-4 flex gap-1">
                  {stars.map((star) => (
                    <Star
                      key={star}
                      size={17}
                      className={
                        star <= review.rating
                          ? "text-amber-500"
                          : "text-muted-foreground/30"
                      }
                      fill={
                        star <= review.rating
                          ? "currentColor"
                          : "none"
                      }
                    />
                  ))}
                </div>

                {review.comment ? (
                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-foreground/80">
                    {review.comment}
                  </p>
                ) : (
                  <p className="mt-4 text-sm italic text-muted-foreground">
                    Aucun commentaire.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
    </section>
  );
}
