"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  CalendarClock,
  Check,
  Clipboard,
  FileText,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  getKlyxProviderAssistantExamples,
  getKlyxProviderAssistantIntlLocale,
  translateKlyxProviderAssistant,
  translateKlyxProviderAssistantStatus,
  type KlyxProviderAssistantMessageKey,
} from "@/lib/klyx-provider-assistant-i18n";
import { supabase } from "@/lib/supabase";

type Intent =
  | "availability"
  | "quote"
  | "client_reply"
  | "unknown";

type AssistantResponse = {
  draftId?: string | null;
  intent?: Intent;
  title?: string;
  reply?: string;
  payload?: Record<string, unknown>;
  aiMode?: "openai" | "fallback";
  error?: string;
};

type Draft = {
  id: string;
  draft_type: Exclude<Intent, "unknown">;
  title: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  title?: string;
  intent?: Intent;
  payload?: Record<string, unknown>;
};

function iconFor(type: Intent) {
  if (type === "availability") return CalendarClock;
  if (type === "quote") return FileText;
  return MessageCircle;
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function draftPreview(draft: Draft): string {
  if (draft.draft_type === "availability") {
    const day = textValue(draft.payload.dayLabel);
    const start = textValue(draft.payload.startTime);
    const end = textValue(draft.payload.endTime);

    return [day, start && end ? `${start} – ${end}` : start ?? end]
      .filter(Boolean)
      .join(" · ");
  }

  if (draft.draft_type === "quote") {
    const hours = textValue(draft.payload.hours);
    const hourlyRate = textValue(draft.payload.hourlyRate);
    const total = textValue(draft.payload.estimatedTotal);

    return [
      hours ? `${hours} h` : null,
      hourlyRate ? `${hourlyRate} €/h` : null,
      total ? `${total} €` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return textValue(draft.payload.message) ?? "Brouillon prêt à vérifier.";
}

export default function ProviderAssistantPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderAssistantMessageKey) =>
    translateKlyxProviderAssistant(locale, key);
  const examples = getKlyxProviderAssistantExamples(locale);
  const intlLocale = getKlyxProviderAssistantIntlLocale(locale);
  const endRef = useRef<HTMLDivElement>(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Provider assistant session unavailable");
    }

    return session.access_token;
  }

  async function loadDrafts(showLoader = true) {
    if (showLoader) setLoadingDrafts(true);

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/assistant", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Provider assistant drafts unavailable");
      }

      const body = (await response.json()) as { drafts?: Draft[] };
      setDrafts(body.drafts ?? []);
      setErrorMessage("");
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      if (showLoader) setLoadingDrafts(false);
    }
  }

  useEffect(() => {
    void loadDrafts();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const missionPrompt = query.get("prompt")?.trim().slice(0, 1000) ?? "";

    if (missionPrompt.length > 0) setMessage(missionPrompt);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  async function submit(event?: FormEvent, forcedMessage?: string) {
    event?.preventDefault();

    const request = (forcedMessage ?? message).trim();
    if (!request || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: request,
    };

    setMessages((current) => [...current, userMessage]);
    setMessage("");
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: request }),
      });

      const body = (await response.json()) as AssistantResponse;

      if (!response.ok || !body.reply) {
        throw new Error(body.error || "Provider assistant analysis unavailable");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: body.reply ?? "",
          title: body.title,
          intent: body.intent,
          payload: body.payload,
        },
      ]);

      await loadDrafts(false);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: t("submitError"),
        },
      ]);
      setErrorMessage(t("submitError"));
    } finally {
      setLoading(false);
    }
  }

  async function processDraft(
    draftId: string,
    action: "apply" | "discard"
  ) {
    setBusyId(draftId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/assistant", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ draftId, action }),
      });

      if (!response.ok) {
        throw new Error("Provider assistant draft action unavailable");
      }

      await response.json();
      setSuccessMessage(
        action === "apply" ? t("availabilityApplied") : t("draftDiscarded")
      );
      await loadDrafts(false);
    } catch {
      setErrorMessage(t("actionError"));
    } finally {
      setBusyId("");
    }
  }

  async function copyText(value: unknown) {
    if (typeof value !== "string") return;
    await navigator.clipboard.writeText(value);
    setSuccessMessage(t("copied"));
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1380px] gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="flex min-h-[calc(100vh-7rem)] min-w-0 flex-col overflow-hidden rounded-[28px] border border-border bg-card/70 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-[#0d0c12]/78">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 dark:border-white/8 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-300">
                <Sparkles size={20} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold sm:text-lg">Assistant KLYX</h1>
                <p className="truncate text-xs text-muted-foreground">Espace prestataire · demande, devis, disponibilité</p>
              </div>
            </div>

            <span className="hidden rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 sm:inline-flex">
              Prêt
            </span>
          </header>

          <div className="klyx-scrollbar flex-1 overflow-y-auto px-4 py-7 sm:px-7">
            <div className="mx-auto max-w-3xl">
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500 text-white">
                  <Sparkles size={16} />
                </span>
                <div className="max-w-[46rem] text-sm leading-7 text-foreground/90">
                  <p>
                    Dis-moi simplement ce que tu veux préparer. Je peux t’aider à répondre à un client,
                    préparer un devis ou organiser ta disponibilité.
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Rien n’est appliqué ni envoyé sans ta confirmation.
                  </p>
                </div>
              </div>

              {messages.length === 0 && (
                <div className="ml-11 mt-6 flex flex-wrap gap-2">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      disabled={loading}
                      onClick={() => void submit(undefined, example)}
                      className="rounded-full border border-border bg-background/70 px-3.5 py-2 text-xs font-semibold text-muted-foreground transition hover:border-violet-500/30 hover:bg-violet-500/[0.06] hover:text-foreground disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-8 space-y-7">
                {messages.map((entry) => (
                  <article
                    key={entry.id}
                    className={entry.role === "user" ? "flex justify-end" : "flex gap-3"}
                  >
                    {entry.role === "assistant" && (
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500 text-white">
                        <Sparkles size={16} />
                      </span>
                    )}

                    <div
                      className={
                        entry.role === "user"
                          ? "max-w-[85%] rounded-[22px] bg-muted px-4 py-3 text-sm leading-6 dark:bg-white/[0.08]"
                          : "min-w-0 max-w-[46rem] text-sm leading-7"
                      }
                    >
                      {entry.role === "assistant" && entry.title && (
                        <p className="mb-1 font-bold text-foreground">{entry.title}</p>
                      )}
                      <p className="whitespace-pre-wrap text-foreground/90">{entry.text}</p>

                      {entry.role === "assistant" &&
                        entry.intent === "client_reply" &&
                        typeof entry.payload?.message === "string" && (
                          <button
                            type="button"
                            onClick={() => void copyText(entry.payload?.message)}
                            className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold transition hover:bg-muted dark:border-white/10"
                          >
                            <Clipboard size={15} />
                            {t("copyReply")}
                          </button>
                        )}
                    </div>
                  </article>
                ))}

                {loading && (
                  <div className="flex gap-3" aria-live="polite">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500 text-white">
                      <Sparkles size={16} />
                    </span>
                    <div className="flex h-8 items-center gap-1.5 text-muted-foreground">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                      <span className="sr-only">KLYX prépare une réponse</span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>
          </div>

          {(errorMessage || successMessage) && (
            <div className="px-4 sm:px-7">
              {errorMessage && (
                <p role="alert" className="mb-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
                  {errorMessage}
                </p>
              )}
              {successMessage && (
                <p role="status" className="mb-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {successMessage}
                </p>
              )}
            </div>
          )}

          <div className="border-t border-border bg-background/40 p-3 dark:border-white/8 dark:bg-black/10 sm:p-4">
            <form
              onSubmit={(event) => void submit(event)}
              className="mx-auto flex max-w-3xl items-end gap-2 rounded-[24px] border border-border bg-background p-2 shadow-[0_12px_40px_rgba(0,0,0,0.08)] focus-within:border-violet-500/35 focus-within:ring-2 focus-within:ring-violet-500/8 dark:border-white/10 dark:bg-[#15131b]"
            >
              <textarea
                rows={1}
                maxLength={1000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (message.trim().length >= 3 && !loading) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                placeholder="Demander à KLYX…"
              />

              <button
                type="submit"
                disabled={loading || message.trim().length < 3}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={t("prepare")}
              >
                {loading ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">
              KLYX prépare. Tu gardes toujours le contrôle avant toute action.
            </p>
          </div>
        </section>

        <aside className="min-w-0 rounded-[28px] border border-border bg-card/70 p-4 backdrop-blur-xl dark:border-white/8 dark:bg-[#0d0c12]/78 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <div>
              <p className="text-sm font-bold">Brouillons</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Préparés dans cette activité</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground dark:bg-white/[0.06]">
              {drafts.filter((draft) => draft.status === "draft").length}
            </span>
          </div>

          {loadingDrafts ? (
            <div className="grid min-h-32 place-items-center" aria-live="polite">
              <LoaderCircle className="animate-spin text-violet-500" size={24} />
            </div>
          ) : drafts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center dark:border-white/10">
              <Bot className="mx-auto text-muted-foreground" size={24} />
              <p className="mt-3 text-xs text-muted-foreground">{t("noDrafts")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft) => {
                const Icon = iconFor(draft.draft_type);
                const isDraft = draft.status === "draft";
                const preview = draftPreview(draft);

                return (
                  <article
                    key={draft.id}
                    className="rounded-2xl border border-border bg-background/55 p-3.5 dark:border-white/8 dark:bg-white/[0.025]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-bold">{draft.title}</h2>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(draft.created_at).toLocaleString(intlLocale)} ·{" "}
                          {translateKlyxProviderAssistantStatus(locale, draft.status)}
                        </p>
                      </div>
                    </div>

                    {preview && (
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                        {preview}
                      </p>
                    )}

                    {isDraft && (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3 dark:border-white/8">
                        {draft.draft_type === "availability" && (
                          <button
                            type="button"
                            disabled={busyId === draft.id}
                            onClick={() => void processDraft(draft.id, "apply")}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[11px] font-bold text-white disabled:opacity-50"
                          >
                            <Check size={14} />
                            {t("apply")}
                          </button>
                        )}

                        {draft.draft_type !== "availability" &&
                          typeof draft.payload.message === "string" && (
                            <button
                              type="button"
                              aria-label={t("copyReply")}
                              onClick={() => void copyText(draft.payload.message)}
                              className="grid h-9 w-9 place-items-center rounded-xl border border-border transition hover:bg-muted dark:border-white/10"
                            >
                              <Clipboard size={14} />
                            </button>
                          )}

                        <button
                          type="button"
                          aria-label={t("discard")}
                          disabled={busyId === draft.id}
                          onClick={() => void processDraft(draft.id, "discard")}
                          className="grid h-9 w-9 place-items-center rounded-xl border border-rose-500/20 text-rose-600 transition hover:bg-rose-500/8 disabled:opacity-50"
                        >
                          {busyId === draft.id ? (
                            <LoaderCircle className="animate-spin" size={14} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
