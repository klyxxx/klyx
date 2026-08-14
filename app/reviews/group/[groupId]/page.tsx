"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Layers3,
  LoaderCircle,
  Star,
  UserRound,
} from "lucide-react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_GROUP_REVIEW_PAGE_12_88

type ReviewResponse = {
  groupId?: string;
  providerId?: string;
  targetName?: string;
  avatarUrl?: string | null;
  slotCount?: number;
  totalAmountCents?: number;

  review?: {
    id: string;
    rating: number;
    comment: string;
  } | null;

  message?: string;
  error?: string;
};

async function token() {
  const {
    data: {
      session,
    },
  } =
    await supabase.auth.getSession();

  if (
    !session?.access_token
  ) {
    throw new Error(
      "Session manquante."
    );
  }

  return session.access_token;
}

async function readResponse(
  response: Response
) {
  const body =
    (await response.json()) as
      ReviewResponse;

  if (!response.ok) {
    throw new Error(
      body.error ||
        "Une erreur inattendue est survenue."
    );
  }

  return body;
}

export default function GroupReviewPage() {
  const params =
    useParams<{
      groupId: string;
    }>();

  const router =
    useRouter();

  const groupId =
    params.groupId;

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    providerId,
    setProviderId,
  ] =
    useState("");

  const [
    targetName,
    setTargetName,
  ] =
    useState(
      "Prestataire KLYX"
    );

  const [
    avatarUrl,
    setAvatarUrl,
  ] =
    useState<
      string | null
    >(null);

  const [
    slotCount,
    setSlotCount,
  ] =
    useState(0);

  const [
    totalAmountCents,
    setTotalAmountCents,
  ] =
    useState(0);

  const [
    reviewId,
    setReviewId,
  ] =
    useState("");

  const [
    rating,
    setRating,
  ] =
    useState(5);

  const [
    comment,
    setComment,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const loadPage =
    useCallback(
      async () => {
        setLoading(true);
        setErrorMessage("");

        try {
          const accessToken =
            await token();

          const response =
            await fetch(
              "/api/group-reviews?groupId=" +
                encodeURIComponent(
                  groupId
                ),
              {
                method:
                  "GET",

                cache:
                  "no-store",

                headers: {
                  Authorization:
                    "Bearer " +
                    accessToken,
                },
              }
            );

          const body =
            await readResponse(
              response
            );

          setProviderId(
            body.providerId ??
              ""
          );

          setTargetName(
            body.targetName ??
              "Prestataire KLYX"
          );

          setAvatarUrl(
            body.avatarUrl ??
              null
          );

          setSlotCount(
            body.slotCount ??
              0
          );

          setTotalAmountCents(
            body.totalAmountCents ??
              0
          );

          if (body.review) {
            setReviewId(
              body.review.id
            );

            setRating(
              body.review.rating
            );

            setComment(
              body.review.comment
            );
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message ===
              "Session manquante."
          ) {
            router.replace(
              "/login"
            );

            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Chargement impossible."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        groupId,
        router,
      ]
    );

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function saveReview(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const accessToken =
        await token();

      const response =
        await fetch(
          "/api/group-reviews",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                "Bearer " +
                accessToken,
            },

            body:
              JSON.stringify({
                groupId,
                rating,
                comment,
              }),
          }
        );

      const body =
        await readResponse(
          response
        );

      setReviewId(
        body.review?.id ??
          reviewId
      );

      setMessage(
        body.message ??
          "Avis enregistre."
      );

      window.setTimeout(
        () => {
          router.push(
            "/booking-groups/" +
              groupId
          );
        },
        700
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Enregistrement impossible."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <LoaderCircle
          className="animate-spin text-violet-600"
          size={30}
        />
      </main>
    );
  }

  if (
    errorMessage &&
    !providerId
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-7 text-center">
          <h1 className="text-2xl font-black">
            Avis indisponible
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-600 dark:text-red-300">
            {errorMessage}
          </p>

          <Link
            href={
              "/booking-groups/" +
              groupId
            }
            className="mt-6 inline-flex rounded-xl bg-violet-600 px-6 py-3 text-sm font-black text-white"
          >
            Retour a la mission
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={
            "/booking-groups/" +
            groupId
          }
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft
            size={17}
          />

          Retour a la mission groupee
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6 text-center sm:p-8">
            <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-3xl border border-border bg-muted">
              {avatarUrl ? (
                <img
                  src={
                    avatarUrl
                  }
                  alt={
                    targetName
                  }
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound
                  size={38}
                  className="text-muted-foreground"
                />
              )}
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-violet-600">
              Avis mission groupee KLYX
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
              {reviewId
                ? "Modifier mon avis"
                : "Comment s est passee la mission complete ?"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Un seul avis evalue{" "}
              <strong className="text-foreground">
                {targetName}
              </strong>{" "}
              sur les{" "}
              <strong className="text-foreground">
                {slotCount}
                {" creneaux"}
              </strong>
              .
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-700 dark:text-violet-300">
              <Layers3
                size={15}
              />

              {slotCount}
              {" creneaux · "}

              {(
                totalAmountCents /
                100
              ).toFixed(
                2
              )}
              {" EUR"}
            </div>
          </div>

          <form
            onSubmit={
              saveReview
            }
            className="space-y-7 p-6 sm:p-8"
          >
            <div>
              <p className="text-sm font-black">
                Ta note globale
              </p>

              <div
                className="mt-3 flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Note sur 5"
              >
                {[
                  1,
                  2,
                  3,
                  4,
                  5,
                ].map(
                  (
                    value
                  ) => {
                    const selected =
                      value <=
                      rating;

                    return (
                      <button
                        key={
                          value
                        }
                        type="button"
                        onClick={() =>
                          setRating(
                            value
                          )
                        }
                        className={
                          "grid h-12 w-12 place-items-center rounded-xl border transition " +
                          (
                            selected
                              ? "border-amber-400/40 bg-amber-400/10 text-amber-500"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          )
                        }
                        aria-label={
                          String(
                            value
                          ) +
                          " etoile" +
                          (
                            value >
                            1
                              ? "s"
                              : ""
                          )
                        }
                        aria-pressed={
                          rating ===
                          value
                        }
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
                  }
                )}
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {rating}/5
              </p>
            </div>

            <div>
              <label
                htmlFor="group-review-comment"
                className="text-sm font-black"
              >
                Commentaire global
              </label>

              <textarea
                id="group-review-comment"
                rows={6}
                maxLength={
                  1000
                }
                value={
                  comment
                }
                onChange={(
                  event
                ) =>
                  setComment(
                    event.target.value
                  )
                }
                placeholder="Ponctualite, qualite sur les differents creneaux, communication..."
                className="mt-3 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
              />

              <p className="mt-2 text-right text-xs text-muted-foreground">
                {comment.length}
                /1000
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2
                  size={18}
                />

                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={
                saving
              }
              className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 text-base font-black text-white hover:bg-violet-700 disabled:opacity-60"
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
                  ? "Modifier mon avis global"
                  : "Publier mon avis global"}
            </button>

            <p className="text-center text-xs leading-5 text-muted-foreground">
              Cet avis compte une seule fois dans le KLYX Score, meme si la mission contient plusieurs creneaux.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}