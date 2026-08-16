"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
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

const EXAMPLES = [
  "Je suis libre jeudi de 9 h à 14 h.",
  "Prépare un devis pour 3 heures.",
  "Réponds au client que je suis disponible.",
  "Prépare un message pour prévenir d’un retard.",
];

function iconFor(type: Intent) {
  if (type === "availability") return CalendarClock;
  if (type === "quote") return FileText;
  return MessageCircle;
}

export default function ProviderAssistantPage() {
  const [message, setMessage] = useState("");
  const [result, setResult] =
    useState<AssistantResponse | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDrafts, setLoadingDrafts] =
    useState(true);
  const [busyId, setBusyId] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  async function loadDrafts() {
    setLoadingDrafts(true);

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/provider/assistant",
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const body = (await response.json()) as {
        drafts?: Draft[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Chargement impossible."
        );
      }

      setDrafts(body.drafts ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les brouillons."
      );
    } finally {
      setLoadingDrafts(false);
    }
  }

  useEffect(() => {
    void loadDrafts();
  }, []);

  // KLYX_PROVIDER_ASSISTANT_CONTEXT_13_78
  useEffect(() => {
    const query =
      new URLSearchParams(
        window.location.search
      );

    const missionPrompt =
      query
        .get("prompt")
        ?.trim()
        .slice(0, 1000) ??
      "";

    if (missionPrompt.length > 0) {
      setMessage(missionPrompt);
    }
  }, []);
  async function submit(
    event?: FormEvent,
    forcedMessage?: string
  ) {
    event?.preventDefault();

    const request = (forcedMessage ?? message).trim();

    if (!request || loading) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setResult(null);

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/provider/assistant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message: request }),
        }
      );

      const body =
        (await response.json()) as AssistantResponse;

      if (!response.ok) {
        throw new Error(
          body.error || "Analyse impossible."
        );
      }

      setResult(body);
      setMessage("");
      await loadDrafts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Analyse impossible."
      );
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
      const response = await fetch(
        "/api/provider/assistant",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            draftId,
            action,
          }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Action impossible."
        );
      }

      setSuccessMessage(
        body.message || "Action enregistrée."
      );
      await loadDrafts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Action impossible."
      );
    } finally {
      setBusyId("");
    }
  }

  async function copyText(value: unknown) {
    if (typeof value !== "string") return;

    await navigator.clipboard.writeText(value);
    setSuccessMessage("Texte copié.");
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827,#1d3a62_52%,#172033)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Bot size={15} />
            Assistant prestataire uniquement
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Organise ton activité avec KLYX
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Prépare tes disponibilités, devis et réponses
            professionnelles. KLYX ne confirme aucune mission et
            n’envoie aucun message sans ton action.
          </p>
        </section>

        <section className="klyx-card mt-8 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Sparkles className="text-blue-600" />
            <h2 className="text-2xl font-black">
              Que veux-tu préparer ?
            </h2>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={loading}
                onClick={() =>
                  void submit(undefined, example)
                }
                className="rounded-2xl border border-border bg-background p-4 text-left text-sm font-black transition hover:border-blue-500 hover:bg-blue-500/[0.05] disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>

                    {message.includes("Mission :") && (
            <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-start gap-3">
                <Sparkles
                  size={18}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div>
                  <p className="font-black">
                    Contexte de mission chargé
                  </p>

                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Les informations de la mission sont préremplies.
                    Vérifie ou modifie le texte puis utilise
                    « Préparer » uniquement lorsque tu le décides.
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
              onChange={(event) =>
                setMessage(event.target.value)
              }
              className="klyx-input resize-none"
              placeholder="Ex. Je suis libre vendredi de 10 h à 16 h."
            />

            <button
              type="submit"
              disabled={
                loading || message.trim().length < 3
              }
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-40"
            >
              {loading ? (
                <LoaderCircle
                  className="animate-spin"
                  size={18}
                />
              ) : (
                <Send size={18} />
              )}
              Préparer
            </button>
          </form>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        {result?.reply && (
          <section className="klyx-card mt-6 p-6">
            <h2 className="text-xl font-black">
              {result.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {result.reply}
            </p>

            {result.intent === "client_reply" &&
              typeof result.payload?.message ===
                "string" && (
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      result.payload?.message
                    )
                  }
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-black"
                >
                  <Clipboard size={17} />
                  Copier la réponse
                </button>
              )}
          </section>
        )}

        <section className="mt-8">
          <p className="klyx-eyebrow">
            Historique professionnel
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Mes brouillons
          </h2>

          {loadingDrafts ? (
            <div className="mt-5 grid min-h-40 place-items-center">
              <LoaderCircle
                className="animate-spin text-blue-600"
                size={34}
              />
            </div>
          ) : drafts.length === 0 ? (
            <div className="klyx-card mt-5 p-7 text-center">
              <Bot
                className="mx-auto text-blue-600"
                size={38}
              />
              <p className="mt-4 font-black">
                Aucun brouillon
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {drafts.map((draft) => {
                const Icon = iconFor(draft.draft_type);
                const isDraft = draft.status === "draft";

                return (
                  <article
                    key={draft.id}
                    className="klyx-card p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-600">
                          <Icon size={21} />
                        </div>

                        <div>
                          <h3 className="font-black">
                            {draft.title}
                          </h3>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(
                              draft.created_at
                            ).toLocaleString("fr-BE")}{" "}
                            · {draft.status}
                          </p>

                          <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs">
                            {JSON.stringify(
                              draft.payload,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </div>

                      {isDraft && (
                        <div className="flex shrink-0 gap-2">
                          {draft.draft_type ===
                            "availability" && (
                            <button
                              type="button"
                              disabled={busyId === draft.id}
                              onClick={() =>
                                void processDraft(
                                  draft.id,
                                  "apply"
                                )
                              }
                              className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-50"
                            >
                              <Check size={16} />
                              Appliquer
                            </button>
                          )}

                          {draft.draft_type !==
                            "availability" &&
                            typeof draft.payload.message ===
                              "string" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void copyText(
                                    draft.payload.message
                                  )
                                }
                                className="grid h-10 w-10 place-items-center rounded-xl border border-border"
                              >
                                <Clipboard size={16} />
                              </button>
                            )}

                          <button
                            type="button"
                            disabled={busyId === draft.id}
                            onClick={() =>
                              void processDraft(
                                draft.id,
                                "discard"
                              )
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
            className="text-sm font-black text-blue-600 dark:text-blue-400"
          >
            Retour à mon activité
          </Link>
        </div>
      </div>
    </main>
  );
}
