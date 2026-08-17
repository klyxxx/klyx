"use client";

import BrainReadinessCard, { type BrainReadinessViewModel } from "@/app/components/BrainReadinessCard";

import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  Baby,
  Brain,
  CheckCircle2,
  Clock3,
  Hammer,
  Home,
  LoaderCircle,
  MapPin,
  PackageOpen,
  Search,
  Send,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SmartRecommendation from "./SmartRecommendation";
import MemoryQuickStart from "./MemoryQuickStart";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "openai" | "fallback" | "structured";
};

type BrainSlot = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  budget: number | null;
};

type BrainMultiSlotSchedule = {
  multiSlot: true;
  slots: BrainSlot[];
  needsExactTimes: boolean;
  readyForMatching: boolean;
};

type BrainPayload = {
  serviceSlug: string | null;
  city: string | null;
  date: string | null;
  time: string | null;
  budget: number | null;
  memoryUsed: boolean;
  ready: boolean;
  readiness?: BrainReadinessViewModel;
  schedule?: BrainMultiSlotSchedule | null;
};

type StructuredBrainResponse = {
  conversationId?: string;
  reply?: string;
  payload?: BrainPayload;
  error?: string;
};

type AiResponse = {
  reply?: string;
  mode?: "openai" | "fallback";
  error?: string;
};

type Suggestion = {
  label: string;
  message: string;
  icon: typeof Baby;
};

const suggestions: Suggestion[] = [
  {
    label: "Trouver une baby-sitter",
    message:
      "J’ai besoin d’une baby-sitter demain à Bruxelles à 18h.",
    icon: Baby,
  },
  {
    label: "Faire nettoyer mon logement",
    message:
      "Je cherche une personne pour nettoyer mon appartement vendredi à Bruxelles.",
    icon: Home,
  },
  {
    label: "Organiser un déménagement",
    message:
      "J’ai besoin d’aide pour un déménagement ce week-end à Bruxelles.",
    icon: PackageOpen,
  },
  {
    label: "Trouver un bricoleur",
    message:
      "Je cherche un bricoleur pour monter des meubles demain à Bruxelles.",
    icon: Hammer,
  },
];

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function detectTimeLocally(message: string): string | null {
  const match = message.match(
    /\b(?:vers\s+|à\s+|a\s+)?([01]?\d|2[0-3])\s*(?:h|heure|heures|:)\s*([0-5]?\d)?\b/i
  );

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

// KLYX_ZERO_COST_READINESS_SYNC_12B_7B
function mergeLocalUnderstanding(
  payload: BrainPayload | undefined,
  message: string
): BrainPayload | null {
  if (!payload) {
    return null;
  }

  if (
    payload.schedule?.multiSlot
  ) {
    return payload;
  }

  const detectedTime =
    payload.time ??
    detectTimeLocally(message);

  const missing: string[] =
    [];

  if (!payload.serviceSlug) {
    missing.push(
      "service"
    );
  }

  if (!payload.city) {
    missing.push(
      "ville"
    );
  }

  if (!payload.date) {
    missing.push(
      "date"
    );
  }

  if (!detectedTime) {
    missing.push(
      "heure"
    );
  }

  const remainingCount =
    missing.length;

  const score =
    Math.round(
      (
        (
          4 -
          remainingCount
        ) /
        4
      ) *
        100
    );

  const isComplete =
    remainingCount === 0;

  const label =
    score === 100
      ? "Demande complète"
      : score >= 75
        ? "Presque prête"
        : score >= 50
          ? "Demande en cours"
          : "Je précise ton besoin";

  const readiness =
    payload.readiness
      ? {
          ...payload.readiness,

          score,
          label,
          isComplete,
          remainingCount,
          missing:
            [...missing],
          nextMissing:
            missing[0] ??
            null,

          requiresConfirmation:
            isComplete,

          confirmationState:
            isComplete
              ? "awaiting_user_confirmation" as const
              : "not_ready" as const,

          confirmationOptions:
            isComplete
              ? [
                  {
                    id:
                      "confirm",
                    action:
                      "confirm_request",
                    label:
                      "Confirmer",
                  },
                  {
                    id:
                      "edit",
                    action:
                      "edit_request",
                    label:
                      "Modifier",
                  },
                ]
              : [],

          summary:
            isComplete &&
            payload.serviceSlug &&
            payload.city &&
            payload.date &&
            detectedTime
              ? {
                  service:
                    payload.serviceSlug,
                  city:
                    payload.city,
                  date:
                    payload.date,
                  time:
                    detectedTime,
                }
              : null,

          automaticExecutionAllowed:
            false,
        }
      : undefined;

  return {
    ...payload,

    time:
      detectedTime,

    ready:
      isComplete,

    readiness,
  };
}
function serviceLabel(slug: string | null) {
  const labels: Record<string, string> = {
    babysitting: "baby-sitting",
    cleaning: "ménage",
    moving: "déménagement",
    handyman: "bricolage",
  };

  return slug ? labels[slug] ?? slug : "service";
}

function buildNaturalConfirmation(payload: BrainPayload): string {
  const budget =
    payload.budget != null
      ? ` avec un budget maximum de ${payload.budget} €`
      : "";

  return `Parfait. J’ai compris que tu recherches un service de ${serviceLabel(
    payload.serviceSlug
  )} à ${payload.city}, le ${payload.date} à ${payload.time}${budget}. Je peux maintenant chercher les meilleurs prestataires disponibles.`;
}

export default function BrainPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Bonjour. Décris simplement ce que tu veux organiser, je m’occupe du reste étape par étape.",
      mode: "structured",
    },
  ]);
  const [input, setInput] = useState("");
  const [payload, setPayload] = useState<BrainPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    async function loadAiStatus() {
      try {
        const response = await fetch("/api/ai/respond", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const result = (await response.json()) as {
          enabled?: boolean;
        };

        setAiEnabled(Boolean(result.enabled));
      } catch {
        setAiEnabled(false);
      }
    }

    void loadAiStatus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, messages]);

  async function sendMessage(
    event?: FormEvent<HTMLFormElement>,
    forcedMessage?: string
  ) {
    event?.preventDefault();

    const message = (forcedMessage ?? input).trim();

    if (!message || loading) return;

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: "user",
        content: message,
      },
    ]);

    setInput("");
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const structuredResponse = await fetch("/api/brain/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      const structuredResult =
        (await structuredResponse.json()) as StructuredBrainResponse;

      if (!structuredResponse.ok || !structuredResult.reply) {
        throw new Error(
          structuredResult.error ||
            "KLYX ne peut pas répondre maintenant."
        );
      }

      const understoodPayload = mergeLocalUnderstanding(
        structuredResult.payload,
        message
      );

      setConversationId(structuredResult.conversationId ?? null);
      setPayload(understoodPayload);

      let finalReply =
        understoodPayload?.schedule?.multiSlot
          ? structuredResult.reply
          : understoodPayload?.ready
            ? buildNaturalConfirmation(understoodPayload)
            : structuredResult.reply;

      let finalMode: Message["mode"] = "structured";

      if (aiEnabled) {
        try {
          const aiResponse = await fetch("/api/ai/respond", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: [
                message,
                "",
                "Contexte compris par KLYX :",
                JSON.stringify(understoodPayload ?? {}),
                "",
                `Réponse préparée : ${finalReply}`,
                "",
                "Réponds naturellement et brièvement. Ne change aucun fait.",
              ].join("\n"),
            }),
          });

          const aiResult = (await aiResponse.json()) as AiResponse;

          if (
            aiResponse.ok &&
            aiResult.reply &&
            aiResult.mode === "openai"
          ) {
            finalReply =
              aiResult.reply;

            finalMode =
              "openai";
          }
        } catch {
          finalMode = "structured";
        }
      }

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: finalReply,
          mode: finalMode,
        },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyboard(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

    // KLYX_ASSISTANT_READINESS_UI_12_62
  function editCurrentRequest() {
    setInput("");
    setErrorMessage("");

    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    });
  }
// KLYX_EXPLICIT_CONFIRMATION_12_63
  // KLYX_CONFIRMATION_PROOF_12_64
async function confirmCurrentRequest() {
  if (
    !payload?.ready ||
    !payload.readiness?.isComplete
  ) {
    setErrorMessage(
      "La demande doit être complète avant confirmation."
    );
    return;
  }

  if (!conversationId) {
    setErrorMessage(
      "Conversation KLYX introuvable."
    );
    return;
  }

  setLoading(true);
  setErrorMessage("");

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.replace("/login");
      return;
    }

    const response = await fetch(
      "/api/brain/confirm-request",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Bearer " + session.access_token,
        },
        body: JSON.stringify({
          conversationId,
          request: {
            serviceSlug: payload.serviceSlug,
            city: payload.city,
            date: payload.date,
            time: payload.time,
            budget: payload.budget,
            schedule: payload.schedule ?? null,
          },
        }),
      }
    );

    const result =
      (await response.json()) as {
        confirmed?: boolean;
        error?: string;
      };

    if (!response.ok || !result.confirmed) {
      throw new Error(
        result.error ||
          "KLYX n'a pas pu confirmer la demande."
      );
    }

    const confirmationId =
      (result as { confirmationId?: string })
        .confirmationId;

    if (!confirmationId) {
      throw new Error(
        "Preuve de confirmation KLYX manquante."
      );
    }

    openResults(confirmationId);
  } catch (error) {
    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Confirmation impossible."
    );
  } finally {
    setLoading(false);
  }
}
  // KLYX_OPEN_RESULTS_HANDLER_REPAIR_12_64C
function openResults(confirmationId?: string) {
    if (!payload?.ready) return;

    const params = new URLSearchParams();

    // KLYX_MULTI_SLOT_OPEN_RESULTS_12_83
    if (payload.schedule?.multiSlot) {
      if (payload.serviceSlug) {
        params.set("service", payload.serviceSlug);
      }

      if (payload.city) {
        params.set("city", payload.city);
      }

      params.set(
        "schedule",
        JSON.stringify(payload.schedule)
      );

      if (conversationId) {
        params.set("conversationId", conversationId);
      }

      if (confirmationId) {
        params.set("confirmationId", confirmationId);
      }

      router.push(
        "/request/confirm-multi?" +
          params.toString()
      );
      return;
    }

    if (payload.serviceSlug) {
      params.set("service", payload.serviceSlug);
    }
    if (payload.city) params.set("city", payload.city);
    if (payload.date) params.set("date", payload.date);
    if (payload.time) params.set("time", payload.time);
    if (payload.budget != null) {
      params.set("budget", String(payload.budget));
    }

        if (conversationId) {
      params.set("conversationId", conversationId);
    }

    if (confirmationId) {
      params.set("confirmationId", confirmationId);
    }
router.push(`/request/confirm?${params.toString()}`);
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-bold text-muted-foreground transition hover:text-foreground"
          >
            Retour au tableau de bord
          </Link>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                aiEnabled
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300"
              }`}
            >
              {aiEnabled
                ? "IA intelligente active"
                : "Mode gratuit actif"}
            </span>

            <Link
              href="/memory"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold transition hover:bg-muted"
            >
              <Brain size={17} />
              Mémoire
            </Link>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_24px_80px_rgba(30,20,60,0.12)]">
          <header className="relative overflow-hidden border-b border-border bg-[linear-gradient(135deg,#17131f_0%,#2b1452_55%,#111827_100%)] p-6 text-white sm:p-8">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />

            <div className="relative flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/10">
                <Sparkles size={27} />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                  Assistant personnel
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
                  Que veux-tu organiser ?
                </h1>
              </div>
            </div>
          </header>

          <div className="grid lg:grid-cols-[1fr_300px]">
            <div className="flex min-h-[600px] flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-[1.6rem] px-5 py-4 text-sm leading-7 sm:max-w-[78%] ${
                        message.role === "user"
                          ? "rounded-br-md bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_12px_30px_rgba(124,58,237,0.25)]"
                          : "rounded-bl-md border border-border bg-background text-foreground shadow-sm"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {payload?.readiness && (
                  <BrainReadinessCard
                    readiness={payload.readiness}
                    onConfirm={() => void confirmCurrentRequest()}
                    onEdit={editCurrentRequest}
                  />
                )}
                {messages.length === 1 && (
                  <>
                    <MemoryQuickStart
                      disabled={loading}
                      onUseRequest={(message) =>
                        void sendMessage(undefined, message)
                      }
                    />

                    <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    {suggestions.map((suggestion) => {
                      const Icon = suggestion.icon;

                      return (
                        <button
                          key={suggestion.label}
                          type="button"
                          onClick={() =>
                            void sendMessage(
                              undefined,
                              suggestion.message
                            )
                          }
                          className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-lg"
                        >
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white dark:text-violet-400">
                            <Icon size={20} />
                          </span>
                          <span className="text-sm font-bold">
                            {suggestion.label}
                          </span>
                        </button>
                      );
                    })}
                    </div>
                  </>
                )}

                {loading && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <LoaderCircle
                      size={18}
                      className="animate-spin text-violet-600"
                    />
                    KLYX analyse ta demande...
                  </div>
                )}

                {errorMessage && (
                  <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                    {errorMessage}
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {payload?.ready && (
                <>
                  <SmartRecommendation payload={payload} />

                  <div className="border-t border-border bg-violet-500/[0.04] p-5 pt-0">
                    <button
                      type="button"
                      onClick={() => openResults()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/25 bg-background px-6 py-3.5 text-sm font-bold text-violet-700 transition hover:bg-violet-500/10 dark:text-violet-300"
                    >
                      Comparer tous les prestataires
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}

              <form
                onSubmit={(event) => void sendMessage(event)}
                className="border-t border-border p-4 sm:p-5"
              >
                <div className="flex items-end gap-3 rounded-[1.75rem] border border-border bg-background p-2 shadow-[0_8px_30px_rgba(20,10,40,0.08)] transition focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-500/10">
                  <textarea
                    value={input}
                    onChange={(event) =>
                      setInput(event.target.value)
                    }
                    onKeyDown={handleKeyboard}
                    placeholder="Décris ton besoin en une phrase..."
                    rows={1}
                    maxLength={4000}
                    className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                  />

                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="group relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg transition duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                    aria-label="Envoyer"
                  >
                    <span className="absolute inset-0 bg-white/0 transition group-hover:bg-white/10" />
                    <Send size={18} className="relative" />
                  </button>
                </div>

                <p className="mt-2 px-2 text-xs text-muted-foreground">
                  Entrée pour envoyer · Maj + Entrée pour revenir à la ligne
                </p>
              </form>
            </div>

            <aside className="border-t border-border bg-muted/25 p-5 lg:border-l lg:border-t-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                Demande comprise
              </p>

              <div className="mt-5 space-y-3">
                <ContextItem
                  icon={<Search size={17} />}
                  label="Service"
                  value={
                    payload?.serviceSlug
                      ? serviceLabel(payload.serviceSlug)
                      : null
                  }
                  complete={Boolean(payload?.serviceSlug)}
                />
                <ContextItem
                  icon={<MapPin size={17} />}
                  label="Ville"
                  value={payload?.city}
                  complete={Boolean(payload?.city)}
                />
                <ContextItem
                  icon={<Clock3 size={17} />}
                  label="Date"
                  value={payload?.date}
                  complete={Boolean(payload?.date)}
                />
                <ContextItem
                  icon={<Clock3 size={17} />}
                  label="Heure"
                  value={payload?.time}
                  complete={Boolean(payload?.time)}
                />
                <ContextItem
                  icon={<WalletCards size={17} />}
                  label="Budget"
                  value={
                    payload?.budget != null
                      ? `${payload.budget} €`
                      : null
                  }
                  complete={payload?.budget != null}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-background p-4 text-xs leading-6 text-muted-foreground">
                KLYX ne confirme jamais une réservation ou un paiement sans validation réelle du système.
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function ContextItem({
  icon,
  label,
  value,
  complete,
}: {
  icon: ReactNode;
  label: string;
  value?: string | null;
  complete: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition duration-300 ${
        complete
          ? "border-emerald-500/20 bg-emerald-500/[0.06]"
          : "border-border bg-background"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-bold uppercase tracking-[0.12em]">
            {label}
          </span>
        </div>

        {complete && (
          <CheckCircle2
            size={16}
            className="text-emerald-500"
          />
        )}
      </div>

      <p className="mt-2 text-sm font-black">
        {value || "À préciser"}
      </p>
    </div>
  );
}


