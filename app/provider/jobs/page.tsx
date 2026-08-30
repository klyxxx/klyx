// KLYX_PROVIDER_JOBS_UI_CURRENCY_PHASE_5C
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Clock3,
  Layers3,
  LoaderCircle,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxProviderJobsDate,
  formatKlyxProviderJobsDuration,
  formatKlyxProviderJobsMoney,
  translateKlyxProviderJobOfferStatus,
  translateKlyxProviderJobs,
  translateKlyxProviderJobsMatch,
  type KlyxProviderJobsMessageKey,
} from "@/lib/klyx-provider-jobs-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_PROVIDER_MULTI_JOBS_UI_12_93

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

function offerStatusClass(status: string): string {
  if (status === "accepted") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "rejected") {
    return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300";
  }

  return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export default function ProviderJobsPage() {
  const { locale } = useKlyxLocale();
  const t: Translator = (key) => translateKlyxProviderJobs(locale, key);

  const [requests, setRequests] = useState<MarketRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
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
        throw new Error("Provider jobs unavailable");
      }

      const body = (await response.json()) as ProviderJobsResponse;
      const rows = body.requests ?? [];
      setRequests(rows);

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
  }, [locale]);

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

  const recommendedRequest = prioritizedRequests[0] ?? null;
  const otherRequests = recommendedRequest
    ? prioritizedRequests.filter((request) => request.id !== recommendedRequest.id)
    : [];

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
      await load();
    } catch {
      setErrorMessage(t("offerError"));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </header>

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-80 place-items-center" aria-label={t("missions")}>
            <LoaderCircle className="animate-spin text-blue-600" size={34} />
          </div>
        ) : !recommendedRequest ? (
          <section className="mt-8 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-600/8 text-blue-600">
              <ShieldCheck size={22} />
            </span>
            <h2 className="mt-4 text-xl font-semibold">{t("noCompatible")}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {t("noCompatibleDetail")}
            </p>
          </section>
        ) : (
          <>
            <section className="mt-8" aria-label={t("priority")}>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                <Sparkles size={17} />
                <span>{t("bestMatch")}</span>
              </div>

              <MissionCard
                item={recommendedRequest}
                locale={locale}
                t={t}
                money={money}
                featured
                busy={busy === recommendedRequest.id}
                amount={amounts[recommendedRequest.id] ?? ""}
                message={messages[recommendedRequest.id] ?? ""}
                onAmountChange={(value) =>
                  setAmounts((current) => ({
                    ...current,
                    [recommendedRequest.id]: value,
                  }))
                }
                onMessageChange={(value) =>
                  setMessages((current) => ({
                    ...current,
                    [recommendedRequest.id]: value,
                  }))
                }
                onSubmit={(event) => void submitOffer(event, recommendedRequest)}
              />
            </section>

            {otherRequests.length > 0 && (
              <section className="mt-10" aria-label={t("missions")}>
                <h2 className="text-xl font-semibold tracking-[-0.02em]">
                  {t("missions")}
                </h2>
                <div className="mt-4 space-y-4">
                  {otherRequests.map((item) => (
                    <MissionCard
                      key={item.id}
                      item={item}
                      locale={locale}
                      t={t}
                      money={money}
                      busy={busy === item.id}
                      amount={amounts[item.id] ?? ""}
                      message={messages[item.id] ?? ""}
                      onAmountChange={(value) =>
                        setAmounts((current) => ({
                          ...current,
                          [item.id]: value,
                        }))
                      }
                      onMessageChange={(value) =>
                        setMessages((current) => ({
                          ...current,
                          [item.id]: value,
                        }))
                      }
                      onSubmit={(event) => void submitOffer(event, item)}
                    />
                  ))}
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
  busy,
  amount,
  message,
  onAmountChange,
  onMessageChange,
  onSubmit,
}: {
  item: MarketRequest;
  locale: string;
  t: Translator;
  money: MoneyFormatter;
  featured?: boolean;
  busy: boolean;
  amount: string;
  message: string;
  onAmountChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const budget =
    item.requestMode === "multi_slot" ? item.budgetTotal : item.budget_max;
  const offerStatus = item.myOffer?.status ?? null;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${
        featured
          ? "border-blue-500/35 ring-1 ring-blue-500/10"
          : "border-border"
      }`}
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                {item.service?.name ?? t("fallbackService")}
              </span>

              {item.requestMode === "multi_slot" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/8 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  <Layers3 size={13} />
                  {item.slotCount} {t("slot")}
                </span>
              )}

              {item.match && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/8 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  <Sparkles size={13} />
                  {item.match.score}% · {translateKlyxProviderJobsMatch(locale, item.match.score)}
                </span>
              )}

              {item.coverage?.fullCoverage && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <BadgeCheck size={13} />
                  {item.coverage.label} {t("available")}
                </span>
              )}
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
              {item.title}
            </h2>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <MapPin size={16} />
                {item.city}
              </span>

              {item.requestMode === "single" && item.requested_date && (
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={16} />
                  {formatKlyxProviderJobsDate(locale, item.requested_date)}
                </span>
              )}

              {item.requestMode === "single" && item.requested_time && (
                <span className="inline-flex items-center gap-2">
                  <Clock3 size={16} />
                  {timeLabel(item.requested_time)}
                </span>
              )}
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              {item.description}
            </p>

            {item.match && item.match.reasons.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.match.reasons.slice(0, 4).map((reason) => (
                  <span
                    key={reason}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium"
                  >
                    <BadgeCheck size={13} />
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-44 rounded-2xl border border-border bg-background p-4 lg:text-right">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {item.requestMode === "multi_slot"
                ? t("budgetTotal")
                : t("clientBudget")}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {money(budget, item.currency)}
            </p>
            {item.requestMode === "multi_slot" &&
              item.totalDurationMinutes !== null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatKlyxProviderJobsDuration(
                    locale,
                    item.totalDurationMinutes
                  )}{" "}
                  {t("totalSuffix")}
                </p>
              )}
          </div>
        </div>

        {item.requestMode === "multi_slot" && (
          <section className="mt-6 rounded-2xl border border-blue-500/15 bg-blue-500/5 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-blue-600" size={19} />
              <div>
                <p className="font-semibold">{t("fullMissionCoverage")}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("fullMissionCoverageDetail")}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {item.slots.map((slot) => (
                <div
                  key={slot.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-600 dark:text-blue-400">
                        {t("slot")} {slot.position}
                      </p>
                      <p className="mt-1 font-semibold">
                        {formatKlyxProviderJobsDate(locale, slot.date)}
                      </p>
                    </div>
                    {slot.budgetMax !== null && (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                        {money(slot.budgetMax, item.currency)}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <MiniInfo
                      icon={<Clock3 size={15} />}
                      label={t("schedule")}
                      value={`${timeLabel(slot.startTime)} - ${timeLabel(slot.endTime)}`}
                    />
                    <MiniInfo
                      icon={<CalendarDays size={15} />}
                      label={t("duration")}
                      value={formatKlyxProviderJobsDuration(
                        locale,
                        slot.durationMinutes
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {offerStatus && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${offerStatusClass(
                offerStatus
              )}`}
            >
              {translateKlyxProviderJobOfferStatus(locale, offerStatus)}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("currentOffer")}: {money(Number(item.myOffer?.amount ?? 0), item.currency)}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles size={17} className="text-blue-600" />
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
                `Prépare une réponse professionnelle pour cette mission KLYX.\nMission : ${item.title}\nService : ${item.service?.name ?? "Service KLYX"}\nVille : ${item.city}\nBudget client : ${money(
                  budget,
                  item.currency
                )}\nDescription : ${item.description}\nCompatibilité KLYX : ${item.match?.score ?? 0}%.\nJe veux relire et modifier le brouillon avant toute action.`
              )
            }
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-blue-600 transition hover:bg-muted"
          >
            <Sparkles size={16} />
            {t("prepareWithKlyx")}
          </a>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-[190px_1fr_auto]"
        >
          <label>
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Banknote size={16} />
              {item.requestMode === "multi_slot"
                ? t("totalPrice")
                : t("yourPrice")}
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="klyx-input"
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
              className="klyx-input"
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
            className="inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45"
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
      </div>
    </article>
  );
}

function MiniInfo({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
