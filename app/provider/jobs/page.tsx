// KLYX_PROVIDER_JOBS_UI_CURRENCY_PHASE_5C
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ChevronDown,
  Clock3,
  Layers3,
  LoaderCircle,
  MapPin,
  Send,
  Sparkles,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import ProviderConfirmedMissionsSection, {
  ProviderConfirmedMissionCard,
  providerMissionPriority,
  type ProviderMissionCard,
} from "@/app/provider/jobs/ProviderConfirmedMissionsSection";
import { buildKlyxProviderAssistantMissionPrompt } from "@/lib/klyx-provider-assistant-mission-prompt";
import {
  formatKlyxProviderJobsDate,
  formatKlyxProviderJobsDuration,
  formatKlyxProviderJobsMoney,
  translateKlyxProviderJobOfferStatus,
  translateKlyxProviderJobs,
  translateKlyxProviderJobsMatch,
  type KlyxProviderJobsMessageKey,
} from "@/lib/klyx-provider-jobs-i18n";
import {
  translateKlyxProviderMissions,
  type KlyxProviderMissionsMessageKey,
} from "@/lib/klyx-provider-missions-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_PROVIDER_MULTI_JOBS_UI_12_93
// KLYX_PROVIDER_JOBS_DESTINATION_2026_09_01
// KLYX_PROVIDER_MISSIONS_LIFECYCLE_2026_09_02

type MultiSlot = {
  id: string;
  position: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  budgetMax: number | null;
  durationMinutes: number | null;
};

type MarketRequest = {
  id: string;
  title: string;
  description: string;
  city: string;
  requested_date: string | null;
  requested_time: string | null;
  budget_max: number | null;
  country_code: string;
  currency: string;
  requestMode: "single" | "multi_slot";
  slotCount: number;
  budgetTotal: number | null;
  preferSingleProvider: boolean;
  totalDurationMinutes: number | null;
  slots: MultiSlot[];
  coverage: {
    count: number;
    total: number;
    fullCoverage: boolean;
    label: string;
  } | null;
  service: {
    name?: string | null;
    slug?: string;
  } | null;
  match: {
    score: number;
    reasons: string[];
    locationMatch?: boolean;
    availabilityMatch?: boolean;
    budgetMatch?: boolean | null;
  } | null;
  myOffer: {
    id: string;
    amount: number;
    message: string | null;
    status: string;
  } | null;
};

type ProviderJobsResponse = {
  requests?: MarketRequest[];
  count?: number;
  multiSlotAware?: boolean;
  fullCoverageOnly?: boolean;
  automaticExecutionAllowed?: boolean;
  confirmedMissions?: ProviderMissionCard[];
};

type Translator = (key: KlyxProviderJobsMessageKey) => string;
type MoneyFormatter = (value: number | null, currency: string) => string;

async function token(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Provider jobs session unavailable");
  }

  return session.access_token;
}

function timeLabel(value: string | null): string {
  return value ? value.slice(0, 5) : "--:--";
}

export default function ProviderJobsPage() {
  const { locale } = useKlyxLocale();
  const t = useCallback<Translator>(
    (key) => translateKlyxProviderJobs(locale, key),
    [locale]
  );
  const missionT = (key: KlyxProviderMissionsMessageKey) =>
    translateKlyxProviderMissions(locale, key);

  const [requests, setRequests] = useState<MarketRequest[]>([]);
  const [confirmedMissions, setConfirmedMissions] = useState<ProviderMissionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const money = useCallback<MoneyFormatter>(
    (value, currency) => formatKlyxProviderJobsMoney(locale, value, currency),
    [locale]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/jobs", {
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      });

      if (!response.ok) {
        throw new Error("Provider missions unavailable");
      }

      const body = (await response.json()) as ProviderJobsResponse;
      const rows = body.requests ?? [];
      const booked = (body.confirmedMissions ?? [])
        .filter((card) => card.role === "provider")
        .sort((left, right) => {
          const priority = providerMissionPriority(left) - providerMissionPriority(right);
          if (priority !== 0) return priority;
          return left.dateFrom.localeCompare(right.dateFrom);
        });

      setRequests(rows);
      setConfirmedMissions(booked);

      const nextAmounts: Record<string, string> = {};
      const nextMessages: Record<string, string> = {};

      for (const row of rows) {
        if (row.myOffer) {
          nextAmounts[row.id] = String(row.myOffer.amount);
          nextMessages[row.id] = row.myOffer.message ?? "";
        }
      }

      setAmounts(nextAmounts);
      setMessages(nextMessages);
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const prioritizedRequests = useMemo(() => {
    const unhandled = requests
      .filter((request) => !request.myOffer)
      .sort(
        (left, right) =>
          Number(right.match?.score ?? 0) - Number(left.match?.score ?? 0)
      );

    const handled = requests
      .filter((request) => Boolean(request.myOffer))
      .sort(
        (left, right) =>
          Number(right.match?.score ?? 0) - Number(left.match?.score ?? 0)
      );

    return [...unhandled, ...handled];
  }, [requests]);

  const actionMission =
    confirmedMissions.find((mission) => mission.actionRequired) ?? null;
  const upcomingMission =
    confirmedMissions.find((mission) => !mission.history) ?? null;
  const unhandledRequest =
    prioritizedRequests.find((request) => !request.myOffer) ?? null;
  const recommendedRequest = unhandledRequest ?? prioritizedRequests[0] ?? null;
  const priorityMission = actionMission ?? (!unhandledRequest ? upcomingMission : null);
  const priorityRequest = priorityMission ? null : unhandledRequest;
  const priorityRequestId = priorityRequest?.id ?? null;

  const otherRequests = prioritizedRequests.filter(
    (request) => request.id !== priorityRequestId
  );

  async function submitOffer(
    event: FormEvent<HTMLFormElement>,
    request: MarketRequest
  ) {
    event.preventDefault();
    setBusy(request.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();

      if (
        request.requestMode === "multi_slot" &&
        !request.coverage?.fullCoverage
      ) {
        setErrorMessage(t("coverageError"));
        return;
      }

      const amount = Number(amounts[request.id]);
      if (!Number.isFinite(amount) || amount <= 0) {
        setErrorMessage(t("amountError"));
        return;
      }

      const response = await fetch(
        "/api/market/requests/" + request.id + "/offers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
          },
          body: JSON.stringify({
            amount,
            message: messages[request.id] ?? "",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Provider offer unavailable");
      }

      await response.json();
      setSuccessMessage(
        request.requestMode === "multi_slot"
          ? t("multiOfferSent")
          : t("offerSent")
      );
      setOpenOfferId(null);
      await load();
    } catch {
      setErrorMessage(t("offerError"));
    } finally {
      setBusy("");
    }
  }

  function toggleOffer(requestId: string) {
    setErrorMessage("");
    setSuccessMessage("");
    setOpenOfferId((current) => (current === requestId ? null : requestId));
  }

  function renderMissionCard(item: MarketRequest, featured = false, divided = false) {
    return (
      <MissionCard
        key={item.id}
        item={item}
        locale={locale}
        t={t}
        money={money}
        featured={featured}
        divided={divided}
        offerOpen={openOfferId === item.id}
        busy={busy === item.id}
        amount={amounts[item.id] ?? ""}
        message={messages[item.id] ?? ""}
        onToggleOffer={() => toggleOffer(item.id)}
        onAmountChange={(value) =>
          setAmounts((current) => ({ ...current, [item.id]: value }))
        }
        onMessageChange={(value) =>
          setMessages((current) => ({ ...current, [item.id]: value }))
        }
        onSubmit={(event) => void submitOffer(event, item)}
      />
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <header className="max-w-2xl">
          <p className="klyx-eyebrow uppercase">{t("eyebrow")}</p>
          <h1 className="klyx-title mt-2 text-3xl sm:text-5xl">
            {t("missions")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {missionT("description")}
          </p>
        </header>

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-[#2563EB]/20 bg-[#2563EB]/[0.05] p-4 text-sm font-medium text-foreground">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-foreground">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-72 place-items-center" aria-label={t("missions")}>
            <LoaderCircle className="animate-spin text-[#2563EB]" size={30} />
          </div>
        ) : (
          <>
            {(priorityMission || priorityRequest) && (
              <section className="mt-8" aria-label={t("priority")}>
                <p className="klyx-eyebrow uppercase">{t("nextAction")}</p>
                <p className="mt-2 text-sm font-semibold text-[#2563EB]">
                  {priorityMission?.actionRequired
                    ? missionT("actionRequired")
                    : priorityRequest
                      ? t("bestMatch")
                      : missionT("missionUpcoming")}
                </p>
                <div className="mt-3">
                  {priorityMission ? (
                    <ProviderConfirmedMissionCard
                      mission={priorityMission}
                      featured
                    />
                  ) : priorityRequest ? (
                    renderMissionCard(priorityRequest, true)
                  ) : null}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {missionT("lifecycleNote")}
                </p>
              </section>
            )}

            <ProviderConfirmedMissionsSection
              missions={confirmedMissions}
              priorityMissionId={priorityMission?.id ?? null}
            />

            {otherRequests.length > 0 && (
              <section className="mt-10" aria-label={missionT("opportunities")}>
                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                  {missionT("opportunities")}
                </h2>
                <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-border bg-card">
                  {otherRequests.map((item, index) =>
                    renderMissionCard(item, false, index > 0)
                  )}
                </div>
              </section>
            )}

            {!priorityMission && !priorityRequest && confirmedMissions.length === 0 && requests.length === 0 && (
              <section className="mt-10 max-w-xl py-8">
                <h2 className="text-xl font-semibold">{t("noCompatible")}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {missionT("noOpportunities")}
                </p>
              </section>
            )}

            {recommendedRequest && !priorityRequest && otherRequests.length === 0 && (
              <section className="mt-10" aria-label={missionT("opportunities")}>
                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                  {missionT("opportunities")}
                </h2>
                <div className="mt-3">
                  {renderMissionCard(recommendedRequest, false)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function MissionCard({
  item,
  locale,
  t,
  money,
  featured = false,
  divided = false,
  offerOpen,
  busy,
  amount,
  message,
  onToggleOffer,
  onAmountChange,
  onMessageChange,
  onSubmit,
}: {
  item: MarketRequest;
  locale: string;
  t: Translator;
  money: MoneyFormatter;
  featured?: boolean;
  divided?: boolean;
  offerOpen: boolean;
  busy: boolean;
  amount: string;
  message: string;
  onToggleOffer: () => void;
  onAmountChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const budget =
    item.requestMode === "multi_slot" ? item.budgetTotal : item.budget_max;
  const offerStatus = item.myOffer?.status ?? null;

  return (
    <article
      className={
        featured
          ? "rounded-[1.5rem] border border-border bg-card p-5 sm:p-6"
          : `p-5 sm:p-6 ${divided ? "border-t border-border" : ""}`
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-muted-foreground">
            <span className="font-semibold text-[#2563EB]">
              {item.service?.name ?? t("fallbackService")}
            </span>

            {item.requestMode === "multi_slot" && (
              <span className="inline-flex items-center gap-1.5">
                <Layers3 size={13} />
                {item.slotCount} {t("slot")}
              </span>
            )}

            {item.requestMode === "multi_slot" && item.coverage && (
              <span>{item.coverage.label}</span>
            )}

            {item.match && (
              <span>
                {item.match.score}% · {translateKlyxProviderJobsMatch(locale, item.match.score)}
              </span>
            )}
          </div>

          <h2 className={`mt-2 font-semibold tracking-[-0.025em] ${featured ? "text-2xl" : "text-lg"}`}>
            {item.title}
          </h2>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <MapPin size={15} />
              {item.city}
            </span>

            {item.requestMode === "single" && item.requested_date && (
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={15} />
                {formatKlyxProviderJobsDate(locale, item.requested_date)}
              </span>
            )}

            {item.requestMode === "single" && item.requested_time && (
              <span className="inline-flex items-center gap-2">
                <Clock3 size={15} />
                {timeLabel(item.requested_time)}
              </span>
            )}
          </div>

          {featured && (
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              {item.description}
            </p>
          )}

          {offerStatus && (
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {translateKlyxProviderJobOfferStatus(locale, offerStatus)}
              </span>
              {" · "}
              {t("currentOffer")}: {money(Number(item.myOffer?.amount ?? 0), item.currency)}
            </p>
          )}
        </div>

        <div className="shrink-0 sm:text-right">
          <p className="text-xs font-medium text-muted-foreground">
            {item.requestMode === "multi_slot" ? t("budgetTotal") : t("clientBudget")}
          </p>
          <p className="mt-1 text-lg font-semibold">{money(budget, item.currency)}</p>

          <button
            type="button"
            onClick={onToggleOffer}
            aria-expanded={offerOpen}
            className={
              featured
                ? "klyx-button mt-4 inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold"
                : "mt-4 inline-flex min-h-10 items-center justify-center gap-2 text-sm font-semibold text-[#2563EB] transition hover:opacity-80"
            }
          >
            {item.myOffer ? t("updateOffer") : t("sendOffer")}
            <ArrowRight size={15} className={offerOpen ? "rotate-90 transition" : "transition"} />
          </button>
        </div>
      </div>

      {!featured && !offerOpen && (
        <details className="group mt-4 border-t border-border pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-muted-foreground transition hover:text-foreground marker:hidden">
            <span>{t("decisionAid")}</span>
            <ChevronDown size={16} className="shrink-0 transition group-open:rotate-180" />
          </summary>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {item.description}
          </p>
        </details>
      )}

      {featured && item.match && item.match.reasons.length > 0 && !offerOpen && (
        <details className="group mt-5 border-t border-border pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-muted-foreground transition hover:text-foreground marker:hidden">
            <span>{t("decisionAid")}</span>
            <ChevronDown size={16} className="transition group-open:rotate-180" />
          </summary>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {item.match.reasons.slice(0, 4).map((reason) => (
              <span key={reason}>• {reason}</span>
            ))}
          </div>
        </details>
      )}

      {offerOpen && (
        <section className="mt-6 border-t border-border pt-6">
          {item.requestMode === "multi_slot" && (
            <details className="group mb-6 rounded-2xl border border-border bg-background p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold marker:hidden">
                <span>
                  {t("fullMissionCoverage")} · {item.slotCount} {t("slot")}
                </span>
                <ChevronDown size={16} className="transition group-open:rotate-180" />
              </summary>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("fullMissionCoverageDetail")}
              </p>

              <div className="mt-4 divide-y divide-border border-y border-border">
                {item.slots.map((slot) => (
                  <div
                    key={slot.id}
                    className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {t("slot")} {slot.position} · {formatKlyxProviderJobsDate(locale, slot.date)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {timeLabel(slot.startTime)} - {timeLabel(slot.endTime)}
                        {slot.durationMinutes !== null
                          ? ` · ${formatKlyxProviderJobsDuration(locale, slot.durationMinutes)}`
                          : ""}
                      </p>
                    </div>

                    {slot.budgetMax !== null && (
                      <p className="text-sm font-medium text-muted-foreground">
                        {money(slot.budgetMax, item.currency)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#2563EB]" />
                <p className="font-semibold">{t("needHelp")}</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("assistantControlNote")}
              </p>
            </div>

            <a
              href={
                "/provider/assistant?prompt=" +
                encodeURIComponent(
                  buildKlyxProviderAssistantMissionPrompt(locale, {
                    title: item.title,
                    service: item.service?.name ?? t("fallbackService"),
                    city: item.city,
                    budget: money(budget, item.currency),
                    description: item.description,
                    matchScore: item.match?.score ?? 0,
                  })
                )
              }
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 text-sm font-semibold text-[#2563EB] transition hover:opacity-80"
            >
              <Sparkles size={15} />
              {t("prepareWithKlyx")}
            </a>
          </div>

          <form
            onSubmit={onSubmit}
            className="mt-5 grid gap-4 sm:grid-cols-[180px_1fr_auto]"
          >
            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Banknote size={16} />
                {item.requestMode === "multi_slot" ? t("totalPrice") : t("yourPrice")}
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="klyx-input w-full px-3"
                value={amount}
                onChange={(event) => onAmountChange(event.target.value)}
                required
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold">
                {t("clientMessage")}
              </span>
              <input
                className="klyx-input w-full px-3"
                maxLength={1500}
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                placeholder={
                  item.requestMode === "multi_slot"
                    ? t("multiMessagePlaceholder")
                    : t("singleMessagePlaceholder")
                }
              />
            </label>

            <button
              type="submit"
              disabled={
                busy ||
                (item.requestMode === "multi_slot" && !item.coverage?.fullCoverage)
              }
              className="klyx-button inline-flex min-h-12 items-center justify-center gap-2 self-end px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Send size={17} />
              )}
              {item.myOffer
                ? t("updateOffer")
                : item.requestMode === "multi_slot"
                  ? t("proposeAll")
                  : t("sendOffer")}
            </button>
          </form>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {t("offerNotBookingPayment")}
          </p>
        </section>
      )}
    </article>
  );
}
