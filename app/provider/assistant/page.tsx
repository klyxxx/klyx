"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
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

function iconFor(type: Intent) {
  if (type === "availability") return CalendarClock;
  if (type === "quote") return FileText;
  return MessageCircle;
}

function textValue(
  value: unknown
): string | null {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return null;
}

function draftPreview(
  draft: Draft
): string {
  if (
    draft.draft_type ===
    "availability"
  ) {
    const day =
      textValue(
        draft.payload.dayLabel
      );
    const start =
      textValue(
        draft.payload.startTime
      );
    const end =
      textValue(
        draft.payload.endTime
      );

    return [
      day,
      start && end
        ? `${start} – ${end}`
        : start ?? end,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (draft.draft_type === "quote") {
    const hours =
      textValue(
        draft.payload.hours
      );
    const hourlyRate =
      textValue(
        draft.payload.hourlyRate
      );
    const total =
      textValue(
        draft.payload.estimatedTotal
      );

    return [
      hours
        ? `${hours} h`
        : null,
      hourlyRate
        ? `${hourlyRate} €/h`
        : null,
      total
        ? `${total} €`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    textValue(
      draft.payload.message
    ) ??
    "Brouillon prêt à vérifier."
  );
}

export default function ProviderAssistantPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderAssistantMessageKey) =>
    translateKlyxProviderAssistant(locale, key);
  const examples = getKlyxProviderAssistantExamples(locale);
  const intlLocale = getKlyxProviderAssistantIntlLocale(locale);

  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AssistantResponse | null>(null);
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

  async function loadDrafts() {
    setLoadingDrafts(true);

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

      const body = (await response.json()) as {
        drafts?: Draft[];
      };

      setDrafts(body.drafts ?? []);
      setErrorMessage("");
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoadingDrafts(false);
    }
  }

  useEffect(() => {
    void loadDrafts();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const missionPrompt = query.get("prompt")?.trim().slice(0, 1000) ?? "";

    if (missionPrompt.length > 0) {
      setMessage(missionPrompt);
    }
  }, []);

  async function submit(event?: FormEvent, forcedMessage?: string) {
    event?.preventDefault();

    const request = (forcedMessage ?? message).trim();

    if (!request || loading) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setResult(null);

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

      if (!response.ok) {
        throw new Error("Provider assistant analysis unavailable");
      }

      const body = (await response.json()) as AssistantResponse;

      setResult(body);
      setMessage("");
      await loadDrafts();
    } catch {
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
        body: JSON.stringify({
          draftId,
          action,
        }),
      });

      if (!response.ok) {
        throw new Error("Provider assistant draft action unavailable");
      }

      await response.json();
      setSuccessMessage(
        action === "apply" ? t("availabilityApplied") : t("draftDiscarded")
      );
      await loadDrafts();
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
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="klyx-premium-hero overflow-hidden rounded-[2rem] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Bot size={15} />
            {t("badge")}
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            {t("title")}
          </h1>
        </section>

        <section className="klyx-card mt-8 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Sparkles className="text-violet-600" />
            <h2 className="text-2xl font-black">
              {t("prepareQuestion")}
            </h2>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                disabled={loading}
                onClick={() => void submit(undefined, example)}
                className="klyx-premium-interactive rounded-2xl border border-border bg-background p-4 text-left text-sm font-black disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>

          {message.includes("Mission :") && (
            <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
              <div className="flex items-start gap-3">
                <Sparkles
                  size={18}
                  className="mt-0.5 shrink-0 text-violet-600"
                />

                <div>
                  <p className="font-black">
                    {t("missionContextTitle")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("missionContextDescription")}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form
            onSubmit={(event) => void submit(event)}
            className="mt-5"
          >
            <textarea
              rows={4}
              maxLength={1000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="klyx-input resize-none"
              placeholder={t("placeholder")}
            />

            <button
              type="submit"
              disabled={loading || message.trim().length < 3}
              className="klyx-button mt-4 w-full"
            >
              {loading ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Send size={18} />
              )}
              {t("prepare")}
            </button>
          </form>
        </section>

        {errorMessage && (
          <div
            role="alert"
            className="klyx-feedback klyx-feedback-error mt-6"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="klyx-feedback klyx-feedback-success mt-6"
          >
            {successMessage}
          </div>
        )}

        {result?.reply && (
          <section className="klyx-card klyx-premium-interactive mt-6 p-6">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-violet-600">
              <Sparkles size={14} />
              KLYX
            </div>
            <h2 className="mt-3 text-xl font-black">
              {result.title}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {result.reply}
            </p>

            {result.intent === "client_reply" &&
              typeof result.payload?.message === "string" && (
                <button
                  type="button"
                  onClick={() => void copyText(result.payload?.message)}
                  className="klyx-button-secondary mt-5"
                >
                  <Clipboard size={17} />
                  {t("copyReply")}
                </button>
              )}
          </section>
        )}

        <section className="mt-8">
          <p className="klyx-eyebrow">
            {t("historyEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {t("draftsTitle")}
          </h2>

          {loadingDrafts ? (
            <div
              className="mt-5 grid min-h-40 place-items-center"
              aria-live="polite"
            >
              <LoaderCircle
                className="animate-spin text-violet-600"
                size={34}
              />
              <span className="sr-only">
                Chargement des brouillons
              </span>
            </div>
          ) : drafts.length === 0 ? (
            <div className="klyx-card mt-5 p-7 text-center">
              <Bot className="mx-auto text-violet-600" size={38} />
              <p className="mt-4 font-black">
                {t("noDrafts")}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {drafts.map((draft) => {
                const Icon = iconFor(draft.draft_type);
                const isDraft = draft.status === "draft";
                const preview = draftPreview(draft);

                return (
                  <article
                    key={draft.id}
                    className="klyx-card klyx-premium-interactive p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
                          <Icon size={21} />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-black">
                            {draft.title}
                          </h3>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(draft.created_at).toLocaleString(intlLocale)}{" "}
                            · {translateKlyxProviderAssistantStatus(locale, draft.status)}
                          </p>

                          <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {preview}
                          </p>
                        </div>
                      </div>

                      {isDraft && (
                        <div className="flex shrink-0 gap-2">
                          {draft.draft_type === "availability" && (
                            <button
                              type="button"
                              disabled={busyId === draft.id}
                              onClick={() =>
                                void processDraft(draft.id, "apply")
                              }
                              className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-50"
                            >
                              <Check size={16} />
                              {t("apply")}
                            </button>
                          )}

                          {draft.draft_type !== "availability" &&
                            typeof draft.payload.message === "string" && (
                              <button
                                type="button"
                                aria-label={t("copyReply")}
                                onClick={() =>
                                  void copyText(draft.payload.message)
                                }
                                className="grid h-10 w-10 place-items-center rounded-xl border border-border"
                              >
                                <Clipboard size={16} />
                              </button>
                            )}

                          <button
                            type="button"
                            aria-label={t("discard")}
                            disabled={busyId === draft.id}
                            onClick={() =>
                              void processDraft(draft.id, "discard")
                            }
                            className="grid h-10 w-10 place-items-center rounded-xl border border-rose-500/25 text-rose-600 disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-8 flex justify-end">
          <Link
            href="/provider"
            className="text-sm font-black text-violet-600 dark:text-violet-400"
          >
            {t("backToActivity")}
          </Link>
        </div>
      </div>
    </main>
  );
}
