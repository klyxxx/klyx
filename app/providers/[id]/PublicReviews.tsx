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

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxEvaluatedMissionCount,
  formatKlyxPublicReviewCount,
  formatKlyxPublicReviewExperience,
  getKlyxPublicReviewsIntlLocale,
  translateKlyxPublicReviews,
  type KlyxPublicReviewsMessageKey,
} from "@/lib/klyx-public-reviews-i18n";

// KLYX_PUBLIC_REVIEWS_I18N
// KLYX_PUBLIC_REVIEWS_READ_ONLY

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

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function PublicReviews({
  providerId,
  klyxScore,
  verified,
  yearsExperience,
}: {
  providerId: string;
  klyxScore: number;
  verified: boolean;
  yearsExperience: number;
}) {
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
        const response = await fetch(
          `/api/providers/${providerId}/reviews`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

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
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadReviews();

    return () => controller.abort();
  }, [providerId]);

  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
            {t("eyebrow")}
          </p>

          <h2 className="mt-2 text-2xl font-black">{t("title")}</h2>

          <p className="mt-2 text-sm text-muted-foreground">
            {t("description")}
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

              <span className="text-sm text-muted-foreground">/5</span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {formatKlyxPublicReviewCount(locale, reviewCount)}
            </p>
          </div>
        )}
      </div>

      {/* KLYX_TRUST_SUMMARY_13_72 */}
      {!loading && !loadError && (
        <section className="mt-6 overflow-hidden rounded-3xl border border-violet-500/20 bg-violet-500/5">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                  {t("summaryEyebrow")}
                </p>

                <h3 className="mt-2 text-xl font-black">
                  {t("summaryTitle")}
                </h3>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("summaryDescription")}
                </p>
              </div>

              {verified && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-700 dark:text-emerald-300">
                  <BadgeCheck size={14} />
                  {t("identityVerified")}
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-bold text-muted-foreground">
                  {t("averageRating")}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <Star
                    size={18}
                    className="text-amber-500"
                    fill="currentColor"
                  />

                  <span className="text-2xl font-black">
                    {reviewCount > 0 ? averageRating.toFixed(1) : "—"}
                  </span>

                  <span className="text-sm text-muted-foreground">/5</span>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-bold text-muted-foreground">
                  {t("verifiedReviewsMetric")}
                </p>

                <p className="mt-2 text-2xl font-black">{reviewCount}</p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {formatKlyxEvaluatedMissionCount(locale, reviewCount)}
                </p>
              </div>

              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
                  {t("score")}
                </p>

                <p className="mt-2 text-2xl font-black text-violet-700 dark:text-violet-300">
                  {klyxScore.toFixed(0)}
                  <span className="text-sm">/100</span>
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {t("trustIndicator")}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-bold text-muted-foreground">
                  {t("verification")}
                </p>

                <p className="mt-2 font-black">
                  {verified ? t("identityVerified") : t("notVerified")}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {t("profileStatus")}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-bold text-muted-foreground">
                  {t("experience")}
                </p>

                <p className="mt-2 text-2xl font-black">
                  {formatKlyxPublicReviewExperience(locale, yearsExperience)}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {t("declaredExperience")}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {t("evidenceNotice")}
              </p>
            </div>
          </div>
        </section>
      )}

      {loading && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900">
          {t("loading")}
        </div>
      )}

      {!loading && loadError && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-300">
          {t("loadError")}
        </div>
      )}

      {!loading && !loadError && reviews.length === 0 && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <MessageSquareText
            size={28}
            className="mx-auto text-muted-foreground"
          />

          <p className="mt-3 font-black">{t("emptyTitle")}</p>

          <p className="mt-2 text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      )}

      {!loading && !loadError && reviews.length > 0 && (
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
                        src={review.authorAvatarUrl}
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
                    <p className="truncate font-black">{review.authorName}</p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {reviewDate(review.createdAt, intlLocale)}
                    </p>
                  </div>
                </div>

                {review.verified && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                    <BadgeCheck size={13} />
                    {t("verifiedBadge")}
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
                    fill={star <= review.rating ? "currentColor" : "none"}
                  />
                ))}
              </div>

              {review.comment ? (
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-foreground/80">
                  {review.comment}
                </p>
              ) : (
                <p className="mt-4 text-sm italic text-muted-foreground">
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
