"use client";

import { BadgeCheck, MessageSquareText, Star, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxPublicReviewCount,
  getKlyxPublicReviewsIntlLocale,
  translateKlyxPublicReviews,
  type KlyxPublicReviewsMessageKey,
} from "@/lib/klyx-public-reviews-i18n";

// KLYX_PUBLIC_REVIEWS_I18N
// KLYX_PUBLIC_REVIEWS_READ_ONLY
// KLYX_PUBLIC_REVIEWS_CONVERSATIONAL_20260912

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

function reviewDate(value: string | null, locale: string): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function PublicReviews({ providerId }: { providerId: string }) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxPublicReviewsMessageKey) =>
    translateKlyxPublicReviews(locale, key);
  const intlLocale = getKlyxPublicReviewsIntlLocale(locale);

  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReviews() {
      setLoading(true);
      setLoadError(false);

      try {
        const response = await fetch(`/api/providers/${providerId}/reviews`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as ReviewResponse;

        if (!response.ok) {
          throw new Error("KLYX_PUBLIC_REVIEWS_LOAD_FAILED");
        }

        setAverageRating(Number(body.averageRating ?? 0));
        setReviewCount(Number(body.reviewCount ?? 0));
        setReviews(body.reviews ?? []);
      } catch {
        if (controller.signal.aborted) return;
        setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadReviews();
    return () => controller.abort();
  }, [providerId]);

  return (
    <section className="mt-6" data-testid="klyx-public-reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>

        {!loading && !loadError && reviewCount > 0 && (
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <Star size={17} className="text-amber-500" fill="currentColor" />
            <span>{averageRating.toFixed(1)}/5</span>
            <span className="text-muted-foreground">
              · {formatKlyxPublicReviewCount(locale, reviewCount)}
            </span>
          </p>
        )}
      </div>

      {loading && (
        <p className="mt-5 border-y border-border py-5 text-sm text-muted-foreground">
          {t("loading")}
        </p>
      )}

      {!loading && loadError && (
        <p className="mt-5 border-y border-red-500/30 py-5 text-sm text-red-700 dark:text-red-300">
          {t("loadError")}
        </p>
      )}

      {!loading && !loadError && reviews.length === 0 && (
        <div className="mt-5 border-y border-border py-6 text-center">
          <MessageSquareText size={24} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      )}

      {!loading && !loadError && reviews.length > 0 && (
        <div className="mt-5 divide-y divide-border border-y border-border">
          {reviews.map((review) => (
            <article key={review.id} className="py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                    {review.authorAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={review.authorAvatarUrl}
                        alt={review.authorName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound size={19} className="text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-medium">{review.authorName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {reviewDate(review.createdAt, intlLocale)}
                    </p>
                  </div>
                </div>

                {review.verified && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <BadgeCheck size={13} />
                    {t("verifiedBadge")}
                  </span>
                )}
              </div>

              <div className="mt-3 flex gap-1" aria-label={`${review.rating}/5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    className={
                      star <= review.rating
                        ? "text-amber-500"
                        : "text-muted-foreground/30"
                    }
                    fill={star <= review.rating ? "currentColor" : "none"}
                  />
                ))}
              </div>

              {review.comment ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground/80">
                  {review.comment}
                </p>
              ) : (
                <p className="mt-3 text-sm italic text-muted-foreground">
                  {t("noComment")}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
