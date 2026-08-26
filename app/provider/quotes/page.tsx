"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, FileText, LoaderCircle, Send, Sparkles } from "lucide-react";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxProviderQuoteDate,
  formatKlyxProviderQuoteMoney,
  translateKlyxProviderQuotes,
  translateKlyxProviderQuoteStatus,
  type KlyxProviderQuotesMessageKey,
} from "@/lib/klyx-provider-quotes-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_PROVIDER_QUOTE_CURRENCY_UI_15_06
type QuoteProfile = { id: string; first_name: string | null; last_name: string | null };
type Quote = {
  id: string;
  country_code: string;
  currency: string;
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

export default function ProviderQuotesPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderQuotesMessageKey) => translateKlyxProviderQuotes(locale, key);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [draftBusyId, setDraftBusyId] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [smartDrafts, setSmartDrafts] = useState<Record<string, SmartQuoteDraft>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function clientName(profile: QuoteProfile | null): string {
    if (!profile) return t("clientFallback");
    return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || t("clientFallback");
  }

  function confidenceLabel(confidence: SmartQuoteDraft["confidence"]): string {
    if (confidence === "high") return t("confidenceHigh");
    if (confidence === "medium") return t("confidenceMedium");
    return t("confidenceLow");
  }

  async function token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("provider-quotes-session-unavailable");
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
      const body = (await response.json()) as { quotes?: Quote[]; error?: string };
      if (!response.ok) throw new Error("provider-quotes-load-failed");
      const nextQuotes = body.quotes ?? [];
      setQuotes(nextQuotes);
      setPrices((current) => {
        const next = { ...current };
        for (const quote of nextQuotes) {
          if (next[quote.id] == null && quote.estimated_total != null) next[quote.id] = String(quote.estimated_total);
        }
        return next;
      });
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function prepareSmartDraft(quoteId: string) {
    if (draftBusyId || busyId) return;
    setDraftBusyId(quoteId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/quotes/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ quoteId }),
      });
      const body = (await response.json()) as { draft?: SmartQuoteDraft; message?: string; error?: string };
      if (!response.ok || !body.draft) throw new Error("provider-quotes-draft-failed");
      const draft = body.draft;
      setSmartDrafts((current) => ({ ...current, [quoteId]: draft }));
      if (draft.providerPrice !== null) setPrices((current) => ({ ...current, [quoteId]: String(draft.providerPrice) }));
      setMessages((current) => ({ ...current, [quoteId]: draft.providerMessage }));
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          quoteId,
          action: "send",
          providerPrice,
          providerMessage: messages[quoteId] ?? "",
        }),
      });
      if (!response.ok) throw new Error("provider-quotes-send-failed");
      setSuccessMessage(t("sent"));
      await load();
    } catch {
      setErrorMessage(t("sendError"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827,#164e63_52%,#0f172a)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70"><FileText size={15} />{t("providerOnly")}</div>
          <h1 className="mt-5 text-3xl font-black sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">{t("intro")}</p>
        </section>

        {errorMessage && <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">{errorMessage}</div>}
        {successMessage && <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">{successMessage}</div>}

        {loading ? (
          <div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-cyan-600" size={38} /></div>
        ) : quotes.length === 0 ? (
          <section className="klyx-card mt-8 p-8 text-center"><FileText className="mx-auto text-cyan-600" size={42} /><h2 className="mt-4 text-xl font-black">{t("empty")}</h2></section>
        ) : (
          <section className="mt-8 grid gap-5">
            {quotes.map((quote) => {
              const smartDraft = smartDrafts[quote.id];
              return (
                <article key={quote.id} className="klyx-card p-6">
                  <p className="klyx-eyebrow">{translateKlyxProviderQuoteStatus(locale, quote.status)}</p>
                  <h2 className="mt-2 text-2xl font-black">{quote.title}</h2>
                  <p className="mt-2 text-sm font-black text-cyan-700 dark:text-cyan-300">{clientName(quote.client)}</p>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{quote.description}</p>
                  <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {quote.requested_date && <span>{t("date")} : {formatKlyxProviderQuoteDate(locale, quote.requested_date)}</span>}
                    {quote.requested_time && <span>{t("time")} : {quote.requested_time.slice(0, 5)}</span>}
                    {quote.duration_hours && <span>{t("duration")} : {quote.duration_hours} h</span>}
                    <span>{t("estimate")} : {quote.estimated_total == null ? t("toConfirm") : formatKlyxProviderQuoteMoney(locale, Number(quote.estimated_total), quote.currency)}</span>
                  </div>

                  {quote.status === "requested" && (
                    <form onSubmit={(event) => void sendQuote(event, quote.id)} className="mt-6 grid gap-4">
                      <button type="button" disabled={draftBusyId === quote.id || busyId === quote.id} onClick={() => void prepareSmartDraft(quote.id)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 text-sm font-black text-cyan-800 transition hover:bg-cyan-500/15 disabled:opacity-50 dark:text-cyan-200">
                        {draftBusyId === quote.id ? <LoaderCircle className="animate-spin" size={18} /> : <Sparkles size={18} />}{t("prepare")}
                      </button>

                      {smartDraft && (
                        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black">{t("smartDraft")}</p><span className="rounded-full border border-cyan-500/20 bg-background/70 px-3 py-1 text-[10px] font-black uppercase tracking-wide">{confidenceLabel(smartDraft.confidence)}</span></div>
                          <p className="mt-3 text-xs leading-6 text-muted-foreground">{smartDraft.explanation}</p>
                          {smartDraft.assumptions.length > 0 && <div className="mt-3 space-y-1 text-xs text-muted-foreground">{smartDraft.assumptions.map((assumption) => <p key={assumption}>• {assumption}</p>)}</div>}
                          {smartDraft.warnings.length > 0 && <div className="mt-3 space-y-2 border-t border-cyan-500/15 pt-3">{smartDraft.warnings.map((warning) => <p key={warning} className="flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 shrink-0" size={14} />{warning}</p>)}</div>}
                          <p className="mt-3 text-[11px] font-black text-cyan-800 dark:text-cyan-200">{t("approvalRequired")}</p>
                        </div>
                      )}

                      <label><span className="mb-2 block text-sm font-black">{t("priceLabel")} ({quote.currency})</span><input type="number" min="0" step="0.01" value={prices[quote.id] ?? ""} onChange={(event) => setPrices((current) => ({ ...current, [quote.id]: event.target.value }))} className="klyx-input" /></label>
                      <label><span className="mb-2 block text-sm font-black">{t("messageLabel")}</span><textarea rows={4} maxLength={1500} value={messages[quote.id] ?? ""} onChange={(event) => setMessages((current) => ({ ...current, [quote.id]: event.target.value }))} className="klyx-input resize-none" placeholder={t("messagePlaceholder")} /></label>
                      <div className="rounded-2xl border border-border bg-background/60 p-4 text-xs leading-5 text-muted-foreground">{t("editableNotice")}</div>
                      <button type="submit" disabled={busyId === quote.id || draftBusyId === quote.id} className="klyx-button w-full">{busyId === quote.id ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}{t("send")}</button>
                    </form>
                  )}

                  {quote.status !== "requested" && (
                    <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
                      <p className="text-sm font-black">{t("sentPrice")} : {quote.provider_price == null ? "—" : formatKlyxProviderQuoteMoney(locale, Number(quote.provider_price), quote.currency)}</p>
                      {quote.provider_message && <p className="mt-2 text-sm text-muted-foreground">{quote.provider_message}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
