"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  MapPin,
  Sparkles,
  UserRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxClientActivity,
  type KlyxClientActivityMessageKey,
} from "@/lib/klyx-client-activity-i18n";

export type ClientActivityFilter =
  | "actions"
  | "upcoming"
  | "history"
  | "all";

export type ClientMarketOffer = {
  id: string;
  amount: number;
  currency?: string | null;
  message: string | null;
  status: string;
  provider: {
    first_name: string | null;
    last_name: string | null;
    avatar_url?: string | null;
  } | null;
  providerStats: {
    klyxScore: number;
    rating: number;
    reviewCount: number;
    yearsExperience: number;
    isVerified: boolean;
  };
  ranking: {
    score: number;
    reasons: string[];
    priceScore: number;
    trustScore: number;
  };
  isRecommended: boolean;
  isCheapest: boolean;
};

export type ClientMarketRequest = {
  id: string;
  title: string;
  description: string;
  city: string;
  requested_date: string | null;
  requested_time: string | null;
  budget_max: number | null;
  currency?: string | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  service: {
    name: string;
    slug: string;
  } | null;
  bookingQuote: {
    id: string;
    status: string;
  } | null;
  offers: ClientMarketOffer[];
};

export function marketRequestNeedsAction(request: ClientMarketRequest): boolean {
  if (request.bookingQuote) return true;

  return (
    request.status === "open" &&
    request.offers.some((offer) => offer.status === "sent")
  );
}

export function marketRequestIsHistory(request: ClientMarketRequest): boolean {
  return ["cancelled", "closed", "expired"].includes(
    request.status.toLowerCase()
  );
}

export function marketRequestMatchesFilter(
  request: ClientMarketRequest,
  filter: ClientActivityFilter
): boolean {
  if (filter === "actions") return marketRequestNeedsAction(request);
  if (filter === "upcoming") return !marketRequestIsHistory(request);
  if (filter === "history") return marketRequestIsHistory(request);
  return true;
}

export function marketRequestPrimaryHref(request: ClientMarketRequest): string {
  if (request.bookingQuote) {
    return `/quotes/${request.bookingQuote.id}/book`;
  }

  return `#request-${request.id}`;
}

function providerName(offer: ClientMarketOffer): string {
  const name = [offer.provider?.first_name, offer.provider?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "KLYX";
}

function money(locale: string, value: number, currency?: string | null): string {
  const normalizedCurrency =
    typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency)
      ? currency.toUpperCase()
      : "EUR";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${normalizedCurrency}`;
  }
}

function requestStatusLabel(
  request: ClientMarketRequest,
  t: (key: KlyxClientActivityMessageKey) => string
): string {
  if (request.status === "open") return t("requestOpen");
  if (request.status === "matched") return t("requestMatched");
  if (marketRequestIsHistory(request)) return t("requestCancelled");
  return request.status;
}

export default function ClientMarketActivitySection({
  requests,
  filter,
  busyId,
  priorityRequestId,
  onCancelRequest,
  onOfferAction,
}: {
  requests: ClientMarketRequest[];
  filter: ClientActivityFilter;
  busyId: string;
  priorityRequestId?: string | null;
  onCancelRequest: (requestId: string) => Promise<void>;
  onOfferAction: (
    requestId: string,
    offerId: string,
    action: "accept" | "reject"
  ) => Promise<void>;
}) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxClientActivityMessageKey) =>
    translateKlyxClientActivity(locale, key);

  const visible = requests.filter((request) =>
    marketRequestMatchesFilter(request, filter)
  );

  if (visible.length === 0) return null;

  return (
    <section className="mt-8" aria-label={t("requests")}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles size={16} className="text-blue-600" />
        <span>{t("requests")}</span>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card">
        {visible.map((request, index) => {
          const sentOffers = request.offers.filter(
            (offer) => offer.status === "sent"
          );
          const displayedOffers = (
            request.status === "matched"
              ? request.offers.filter((offer) => offer.status === "accepted")
              : sentOffers
          ).slice(0, 3);
          const needsAction = marketRequestNeedsAction(request);
          const detailsOpen = request.id === priorityRequestId && sentOffers.length > 0;

          return (
            <article
              id={`request-${request.id}`}
              key={request.id}
              className={`scroll-mt-24 p-5 sm:p-6 ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-[-0.02em]">
                      {request.service?.name || request.title}
                    </h3>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        needsAction
                          ? "border-blue-600/20 bg-blue-600/[0.06] text-blue-700 dark:text-blue-300"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {requestStatusLabel(request, t)}
                    </span>
                  </div>

                  {request.service?.name && request.title && (
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {request.title}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} />
                      {request.city}
                    </span>
                    {request.requested_date && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={14} />
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(`${request.requested_date}T12:00:00`))}
                      </span>
                    )}
                    {request.budget_max != null && (
                      <span>
                        {t("budgetMax")} · {money(locale, request.budget_max, request.currency)}
                      </span>
                    )}
                  </div>

                  {request.status === "open" && sentOffers.length === 0 && (
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {t("waitingOffers")}
                    </p>
                  )}

                  {request.bookingQuote && (
                    <p className="mt-4 max-w-2xl border-l-2 border-blue-600 pl-3 text-sm leading-6 text-muted-foreground">
                      {t("selectionReady")}
                    </p>
                  )}
                </div>

                {request.bookingQuote ? (
                  <Link
                    href={`/quotes/${request.bookingQuote.id}/book`}
                    className="klyx-button inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm font-semibold"
                  >
                    {t("finalizeBooking")}
                    <ArrowRight size={16} />
                  </Link>
                ) : null}
              </div>

              {request.status === "open" && sentOffers.length > 0 && (
                <details className="group mt-5 border-t border-border pt-4" open={detailsOpen}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground marker:hidden">
                    <span>
                      {t("offersReceived")} · {sentOffers.length}
                    </span>
                    <ChevronDown
                      size={17}
                      className="text-muted-foreground transition group-open:rotate-180"
                    />
                  </summary>

                  <div className="mt-4 grid gap-3">
                    {displayedOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className={`rounded-2xl border p-4 ${
                          offer.isRecommended
                            ? "border-blue-600/25 bg-blue-600/[0.04]"
                            : "border-border bg-background"
                        }`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                              {offer.provider?.avatar_url ? (
                                <img
                                  src={offer.provider.avatar_url}
                                  alt={providerName(offer)}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <UserRound size={18} className="text-muted-foreground" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">{providerName(offer)}</p>
                                {offer.isRecommended && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                    <Sparkles size={11} />
                                    {t("recommended")}
                                  </span>
                                )}
                                {offer.providerStats.isVerified && (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                                    <BadgeCheck size={13} />
                                    {t("verified")}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {offer.providerStats.reviewCount > 0 && (
                                  <span>
                                    {offer.providerStats.rating.toFixed(1)} · {offer.providerStats.reviewCount} {t("reviews")}
                                  </span>
                                )}
                                {offer.providerStats.yearsExperience > 0 && (
                                  <span>
                                    {offer.providerStats.yearsExperience} {t("experience")}
                                  </span>
                                )}
                                {offer.isCheapest && <span>{t("cheapest")}</span>}
                              </div>

                              {offer.message && (
                                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                                  {offer.message}
                                </p>
                              )}
                            </div>
                          </div>

                          <p className="shrink-0 text-lg font-semibold text-foreground">
                            {money(locale, Number(offer.amount), offer.currency || request.currency)}
                          </p>
                        </div>

                        {offer.status === "sent" && (
                          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              disabled={busyId === offer.id}
                              onClick={() =>
                                void onOfferAction(request.id, offer.id, "reject")
                              }
                              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                            >
                              {t("rejectOffer")}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === offer.id}
                              onClick={() =>
                                void onOfferAction(request.id, offer.id, "accept")
                              }
                              className="klyx-button inline-flex min-h-11 items-center justify-center px-5 text-sm font-semibold disabled:opacity-50"
                            >
                              {t("acceptOffer")}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {request.status === "open" && (
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => void onCancelRequest(request.id)}
                  className="mt-4 inline-flex min-h-10 items-center text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                >
                  {t("cancelRequest")}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
