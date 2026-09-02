"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
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

// KLYX_PROVIDER_ASSISTANT_VISUAL_2026_08_31
// KLYX_PROVIDER_ASSISTANT_DESTINATION_2026_09_02

type Intent = "availability" | "quote" | "client_reply" | "unknown";

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

  async function processDraft(draftId: string, action: "apply" | "discard") {
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

  const pendingDrafts = drafts.filter((draft) => draft.status === "draft").length;

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            Assistant KLYX
          </p>
          <h1 className="klyx-title mt-2 text-3xl sm:text-5xl">
            Que dois-je préparer pour ton activité ?
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            Réponse client, devis ou disponibilité. Rien n’est appliqué ni envoyé sans ta confirmation.
          </p>
        </header>

        <section className="mt-10 min-h-[22rem]" aria-label="Conversation avec KLYX">
          <div className="flex gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-white">
              <Sparkles size={16} />
            </span>
            <div className="max-w-[46rem] text-sm leading-7 text-foreground/90">
              Dis-moi simplement ce que tu veux préparer. Je m’occupe de structurer le brouillon avant ta décision.
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
                  className="rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground transition hover:border-blue-600/30 hover:text-foreground disabled:opacity-50"
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
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-white">
                    <Sparkles size={16} />
                  </span>
                )}

                <div
                  className={
                    entry.role === "user"
                      ? "max-w-[85%] rounded-[22px] bg-muted px-4 py-3 text-sm leading-6"
                      : "min-w-0 max-w-[46rem] text-sm leading-7"
                  }
                >
                  {entry.role === "assistant" && entry.title && (
                    <p className="mb-1 font-semibold text-foreground">{entry.title}</p>
                  )}
                  <p className="whitespace-pre-wrap text-foreground/90">{entry.text}</p>

                  {entry.role === "assistant" &&
                    entry.intent === "client_reply" &&
                    typeof entry.payload?.message === "string" && (
                      <button
                        type="button"
                        onClick={() => void copyText(entry.payload?.message)}
                        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold transition hover:bg-muted"
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
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-white">
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
        </section>

        {(errorMessage || successMessage) && (
          <div className="mt-5 border-y border-border py-3 text-sm">
            {errorMessage && (
              <p role="alert" className="font-semibold text-red-600 dark:text-red-300">
                {errorMessage}
              </p>
            )}
            {successMessage && (
              <p
                role="status"
                className="font-semibold text-emerald-600 dark:text-emerald-400"
              >
                {successMessage}
              </p>
            )}
          </div>
        )}

        <details className="group mt-8 border-y border-border py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
            <span>
              Brouillons à vérifier{pendingDrafts > 0 ? ` · ${pendingDrafts}` : ""}
            </span>
            <ChevronDown
              size={17}
              className="text-muted-foreground transition group-open:rotate-180"
            />
          </summary>

          <div className="mt-5">
            {loadingDrafts ? (
              <div className="grid min-h-24 place-items-center" aria-live="polite">
                <LoaderCircle className="animate-spin text-blue-600" size={22} />
              </div>
            ) : drafts.length === 0 ? (
              <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                <Bot size={19} />
                {t("noDrafts")}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {drafts.map((draft) => {
                  const Icon = iconFor(draft.draft_type);
                  const isDraft = draft.status === "draft";
                  const preview = draftPreview(draft);

                  return (
                    <article key={draft.id} className="py-5">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600/8 text-blue-600 dark:text-blue-400">
                          <Icon size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-sm font-semibold">{draft.title}</h2>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(draft.created_at).toLocaleString(intlLocale)} ·{" "}
                            {translateKlyxProviderAssistantStatus(locale, draft.status)}
                          </p>
                          {preview && (
                            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                              {preview}
                            </p>
                          )}
                        </div>
                      </div>

                      {isDraft && (
                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                          {draft.draft_type === "availability" && (
                            <button
                              type="button"
                              disabled={busyId === draft.id}
                              onClick={() => void processDraft(draft.id, "apply")}
                              className="klyx-button inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-50"
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
                                className="grid h-9 w-9 place-items-center rounded-xl border border-border transition hover:bg-muted"
                              >
                                <Clipboard size={14} />
                              </button>
                            )}

                          <button
                            type="button"
                            aria-label={t("discard")}
                            disabled={busyId === draft.id}
                            onClick={() => void processDraft(draft.id, "discard")}
                            className="grid h-9 w-9 place-items-center rounded-xl border border-red-500/25 text-red-600 transition hover:bg-red-500/5 disabled:opacity-50 dark:text-red-300"
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
          </div>
        </details>

        <form
          onSubmit={(event) => void submit(event)}
          className="klyx-card mt-8 flex items-end gap-2 p-2 focus-within:border-blue-600/35"
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
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={t("prepare")}
          >
            {loading ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>

        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          KLYX prépare. Tu confirmes toujours avant toute action.
        </p>
      </div>
    </main>
  );
}
