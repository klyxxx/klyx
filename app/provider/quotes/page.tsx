"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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

const PROVIDER_QUOTE_REVIEW_CONTRACT = {
  requiresConfirmation: true,
} as const;

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

      if (
        !response.ok ||
        !body.draft ||
        body.draft.requiresConfirmation !==
          PROVIDER_QUOTE_REVIEW_CONTRACT.requiresConfirmation
      ) {
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

  function quoteView(quote: Quote, priority = false) {
    const smartDraft = smartDrafts[quote.id];
    const requested = quote.status === "requested";

    return (
      <article
        key={quote.id}
        data-quote-priority={priority ? "true" : "false"}
        className={`py-5 ${priority ? "bg-muted/20 px-3 sm:px-4" : "px-0 sm:px-1"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-6 tracking-[-0.015em] sm:text-lg">
              {quote.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {clientName(quote.client)}
            </p>
          </div>

          <span
            className={`shrink-0 text-xs font-medium ${
              requested ? "text-[#2563EB]" : "text-muted-foreground"
            }`}
          >
            {translateKlyxProviderQuoteStatus(locale, quote.status)}
          </span>
        </div>

        {quote.description && (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {quote.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
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
          <span>
            {t("estimate")} :{" "}
            <strong className="font-medium text-foreground">
              {quote.estimated_total == null
                ? t("toConfirm")
                : formatKlyxProviderQuoteMoney(
                    locale,
                    Number(quote.estimated_total)
                  )}
            </strong>
          </span>
        </div>

        {requested && (
          <form
            onSubmit={(event) => void sendQuote(event, quote.id)}
            className="mt-4 border-t border-border pt-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold">{t("prepare")}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("editableNotice")}
                </p>
              </div>

              <button
                type="button"
                disabled={draftBusyId === quote.id || busyId === quote.id}
                onClick={() => void prepareSmartDraft(quote.id)}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3.5 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                {draftBusyId === quote.id ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                {t("prepare")}
              </button>
            </div>

            {smartDraft && (
              <section
                className="mt-4 rounded-xl border border-border bg-muted/20 p-4"
                aria-label={t("smartDraft")}
              >
                <p className="text-xs font-semibold text-foreground">
                  {t("smartDraft")}
                </p>

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {smartDraft.explanation}
                </p>

                {smartDraft.assumptions.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
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

                <p className="mt-3 flex items-start gap-2 text-xs font-semibold leading-5 text-foreground">
                  <AlertTriangle
                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300"
                    size={14}
                  />
                  {t("approvalRequired")}
                </p>
              </section>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-[170px_1fr]">
              <label>
                <span className="mb-1.5 block text-sm font-semibold">
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
                <span className="mb-1.5 block text-sm font-semibold">
                  {t("messageLabel")}
                </span>
                <textarea
                  rows={2}
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
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busyId === quote.id ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Send size={17} />
              )}
              {t("send")}
            </button>
          </form>
        )}

        {!requested && (
          <div className="mt-4 border-t border-border pt-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {translateKlyxProviderQuoteStatus(locale, quote.status)}
              </span>
              <span className="font-semibold">
                {t("sentPrice")} :{" "}
                {quote.provider_price == null
                  ? "—"
                  : formatKlyxProviderQuoteMoney(
                      locale,
                      Number(quote.provider_price)
                    )}
              </span>
            </div>
            {quote.provider_message && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
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
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("providerOnly")}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("intro")}
          </p>
        </header>

        {errorMessage && (
          <div className="mt-5 border-l-2 border-red-500 py-1 pl-3 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-5 border-l-2 border-[#2563EB] py-1 pl-3 text-sm text-foreground">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-28 items-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin text-[#2563EB]" size={18} />
            <span>{t("title")}</span>
          </div>
        ) : prioritizedQuotes.length === 0 ? (
          <section className="mt-7 border-t border-border py-8">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 text-muted-foreground" size={18} />
              <div>
                <h2 className="text-base font-semibold">{t("empty")}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t("intro")}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-7" aria-label={t("title")}>
            {requestedCount > 0 && (
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {requestedCount} ·{" "}
                {translateKlyxProviderQuoteStatus(locale, "requested")}
              </p>
            )}
            <div className="divide-y divide-border border-y border-border">
              {prioritizedQuotes.map((quote, index) =>
                quoteView(quote, index === 0 && quote.status === "requested")
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
