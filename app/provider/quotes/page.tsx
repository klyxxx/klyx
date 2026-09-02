"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  LoaderCircle,
  Send,
  Sparkles,
} from "lucide-react";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxProviderQuoteDate,
  formatKlyxProviderQuoteMoney,
  translateKlyxProviderQuotes,
  translateKlyxProviderQuoteStatus,
  type KlyxProviderQuotesMessageKey,
} from "@/lib/klyx-provider-quotes-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_PROVIDER_QUOTES_DESTINATION_2026_09_02

type QuoteProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type Quote = {
  id: string;
  title: string;
  description: string;
  requested_date: string | null;
  requested_time: string | null;
  duration_hours: number | null;
  pricing_type: "hourly" | "fixed";
  estimated_total: number | null;
  provider_price: number | null;
  provider_message: string | null;
  status: string;
  created_at: string;
  client: QuoteProfile | null;
};

type SmartQuoteDraft = {
  providerPrice: number | null;
  providerMessage: string;
  explanation: string;
  assumptions: string[];
  warnings: string[];
  confidence: "high" | "medium" | "low";
  riskLevel: "review_required";
  requiresConfirmation: true;
  source: "quote_snapshot";
};

type Translator = (key: KlyxProviderQuotesMessageKey) => string;

export default function ProviderQuotesPage() {
  const { locale } = useKlyxLocale();
  const t: Translator = (key) => translateKlyxProviderQuotes(locale, key);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [draftBusyId, setDraftBusyId] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [smartDrafts, setSmartDrafts] = useState<
    Record<string, SmartQuoteDraft>
  >({});
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function clientName(profile: QuoteProfile | null): string {
    if (!profile) return t("clientFallback");
    return (
      `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
      t("clientFallback")
    );
  }

  function confidenceLabel(confidence: SmartQuoteDraft["confidence"]): string {
    if (confidence === "high") return t("confidenceHigh");
    if (confidence === "medium") return t("confidenceMedium");
    return t("confidenceLow");
  }

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("provider-quotes-session-unavailable");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/quotes", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json()) as {
        quotes?: Quote[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error("provider-quotes-load-failed");
      }

      const nextQuotes = body.quotes ?? [];
      setQuotes(nextQuotes);
      setPrices((current) => {
        const next = { ...current };

        for (const quote of nextQuotes) {
          if (next[quote.id] == null && quote.estimated_total != null) {
            next[quote.id] = String(quote.estimated_total);
          }
        }

        return next;
      });
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const prioritizedQuotes = useMemo(
    () =>
      [...quotes].sort((left, right) => {
        const leftNeedsAction = left.status === "requested" ? 1 : 0;
        const rightNeedsAction = right.status === "requested" ? 1 : 0;

        if (leftNeedsAction !== rightNeedsAction) {
          return rightNeedsAction - leftNeedsAction;
        }

        return (
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime()
        );
      }),
    [quotes]
  );

  const priorityQuote = prioritizedQuotes[0] ?? null;
  const otherQuotes = priorityQuote
    ? prioritizedQuotes.filter((quote) => quote.id !== priorityQuote.id)
    : [];
  const requestedCount = prioritizedQuotes.filter(
    (quote) => quote.status === "requested"
  ).length;

  async function prepareSmartDraft(quoteId: string) {
    if (draftBusyId || busyId) return;

    setDraftBusyId(quoteId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/quotes/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ quoteId }),
      });
      const body = (await response.json()) as {
        draft?: SmartQuoteDraft;
        message?: string;
        error?: string;
      };

      if (!response.ok || !body.draft) {
        throw new Error("provider-quotes-draft-failed");
      }

      const draft = body.draft;
      setSmartDrafts((current) => ({ ...current, [quoteId]: draft }));

      if (draft.providerPrice !== null) {
        setPrices((current) => ({
          ...current,
          [quoteId]: String(draft.providerPrice),
        }));
      }

      setMessages((current) => ({
        ...current,
        [quoteId]: draft.providerMessage,
      }));
      setSuccessMessage(t("draftReady"));
    } catch {
      setErrorMessage(t("draftError"));
    } finally {
      setDraftBusyId("");
    }
  }

  async function sendQuote(event: FormEvent, quoteId: string) {
    event.preventDefault();

    const providerPrice = Number(prices[quoteId]);
    if (!Number.isFinite(providerPrice) || providerPrice < 0) {
      setErrorMessage(t("invalidAmount"));
      return;
    }

    setBusyId(quoteId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/quotes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          quoteId,
          action: "send",
          providerPrice,
          providerMessage: messages[quoteId] ?? "",
        }),
      });

      if (!response.ok) {
        throw new Error("provider-quotes-send-failed");
      }

      setSuccessMessage(t("sent"));
      await load();
    } catch {
      setErrorMessage(t("sendError"));
    } finally {
      setBusyId("");
    }
  }

  function quoteView(quote: Quote, featured = false) {
    const smartDraft = smartDrafts[quote.id];

    return (
      <article
        key={quote.id}
        data-quote-priority={featured ? "true" : "false"}
        className={featured ? "border-t border-border pt-6" : "py-6"}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                {translateKlyxProviderQuoteStatus(locale, quote.status)}
              </p>
              <span className="text-xs text-muted-foreground">
                {clientName(quote.client)}
              </span>
            </div>
            <h2
              className={`${featured ? "text-2xl sm:text-3xl" : "text-xl"} mt-2 font-semibold tracking-[-0.03em]`}
            >
              {quote.title}
            </h2>
          </div>

          <div className="shrink-0 sm:text-right">
            <p className="text-xs text-muted-foreground">{t("estimate")}</p>
            <p className="mt-1 text-base font-semibold">
              {quote.estimated_total == null
                ? t("toConfirm")
                : formatKlyxProviderQuoteMoney(
                    locale,
                    Number(quote.estimated_total)
                  )}
            </p>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
          {quote.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {quote.requested_date && (
            <span>
              {t("date")} :{" "}
              {formatKlyxProviderQuoteDate(locale, quote.requested_date)}
            </span>
          )}
          {quote.requested_time && (
            <span>
              {t("time")} : {quote.requested_time.slice(0, 5)}
            </span>
          )}
          {quote.duration_hours && (
            <span>
              {t("duration")} : {quote.duration_hours} h
            </span>
          )}
        </div>

        {quote.status === "requested" && (
          <form
            onSubmit={(event) => void sendQuote(event, quote.id)}
            className="mt-6 border-t border-border pt-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{t("prepare")}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("editableNotice")}
                </p>
              </div>

              <button
                type="button"
                disabled={draftBusyId === quote.id || busyId === quote.id}
                onClick={() => void prepareSmartDraft(quote.id)}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-blue-600 transition hover:bg-muted disabled:opacity-50 dark:text-blue-400"
              >
                {draftBusyId === quote.id ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <Sparkles size={17} />
                )}
                {t("prepare")}
              </button>
            </div>

            {smartDraft && (
              <div className="mt-5 border-l-2 border-blue-600 pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{t("smartDraft")}</p>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {confidenceLabel(smartDraft.confidence)}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-6 text-muted-foreground">
                  {smartDraft.explanation}
                </p>

                {smartDraft.assumptions.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {smartDraft.assumptions.map((assumption) => (
                      <p key={assumption}>• {assumption}</p>
                    ))}
                  </div>
                )}

                {smartDraft.warnings.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {smartDraft.warnings.map((warning) => (
                      <p
                        key={warning}
                        className="flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300"
                      >
                        <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  {t("approvalRequired")}
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-[190px_1fr]">
              <label>
                <span className="mb-2 block text-sm font-semibold">
                  {t("priceLabel")}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={prices[quote.id] ?? ""}
                  onChange={(event) =>
                    setPrices((current) => ({
                      ...current,
                      [quote.id]: event.target.value,
                    }))
                  }
                  className="klyx-input"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">
                  {t("messageLabel")}
                </span>
                <textarea
                  rows={3}
                  maxLength={1500}
                  value={messages[quote.id] ?? ""}
                  onChange={(event) =>
                    setMessages((current) => ({
                      ...current,
                      [quote.id]: event.target.value,
                    }))
                  }
                  className="klyx-input resize-none"
                  placeholder={t("messagePlaceholder")}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={busyId === quote.id || draftBusyId === quote.id}
              className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {busyId === quote.id ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Send size={18} />
              )}
              {t("send")}
            </button>
          </form>
        )}

        {quote.status !== "requested" && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm font-semibold">
              {t("sentPrice")} :{" "}
              {quote.provider_price == null
                ? "—"
                : formatKlyxProviderQuoteMoney(
                    locale,
                    Number(quote.provider_price)
                  )}
            </p>
            {quote.provider_message && (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {quote.provider_message}
              </p>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {t("providerOnly")}
          </p>
          <h1 className="klyx-title mt-2 text-3xl sm:text-5xl">{t("title")}</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            {t("intro")}
          </p>
        </header>

        {errorMessage && (
          <div className="mt-6 border-l-2 border-red-500 py-1 pl-4 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 border-l-2 border-blue-600 py-1 pl-4 text-sm text-foreground">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-32 items-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin text-blue-600" size={20} />
            <span>{t("title")}</span>
          </div>
        ) : !priorityQuote ? (
          <section className="mt-8 border-t border-border py-10">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 text-blue-600" size={20} />
              <div>
                <h2 className="text-lg font-semibold">{t("empty")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("intro")}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-9" aria-label={t("title")}>
              {requestedCount > 0 && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {requestedCount} · {translateKlyxProviderQuoteStatus(locale, "requested")}
                </p>
              )}
              {quoteView(priorityQuote, true)}
            </section>

            {otherQuotes.length > 0 && (
              <details className="group mt-8 border-t border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold">
                  <span>
                    {t("title")} · {otherQuotes.length}
                  </span>
                  <ChevronDown
                    size={18}
                    className="text-muted-foreground transition group-open:rotate-180"
                  />
                </summary>
                <div className="divide-y divide-border border-t border-border">
                  {otherQuotes.map((quote) => quoteView(quote))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </main>
  );
}
