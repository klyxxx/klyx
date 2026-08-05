"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Search,
  Send,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "openai" | "fallback" | "structured";
};

type BrainPayload = {
  serviceSlug: string | null;
  city: string | null;
  date: string | null;
  time: string | null;
  budget: number | null;
  memoryUsed: boolean;
  ready: boolean;
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

const suggestions = [
  "J’ai besoin d’une baby-sitter demain à Bruxelles.",
  "Je cherche quelqu’un pour nettoyer mon appartement vendredi.",
  "J’ai besoin d’aide pour un déménagement ce week-end.",
];

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function BrainPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Bonjour. Décris simplement ce que tu veux organiser, je vais t’aider étape par étape.",
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
          structuredResult.error || "KLYX ne peut pas répondre maintenant."
        );
      }

      setConversationId(structuredResult.conversationId ?? null);
      setPayload(structuredResult.payload ?? null);

      let finalReply = structuredResult.reply;
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
                "Contexte déjà compris par KLYX :",
                JSON.stringify(structuredResult.payload ?? {}),
                "",
                `Réponse technique actuelle : ${structuredResult.reply}`,
                "",
                "Réponds naturellement et brièvement. Ne change pas les faits.",
              ].join("\n"),
            }),
          });

          const aiResult = (await aiResponse.json()) as AiResponse;

          if (aiResponse.ok && aiResult.reply) {
            finalReply = aiResult.reply;
            finalMode = aiResult.mode ?? "openai";
          }
        } catch {
          finalReply = structuredResult.reply;
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

  function handleKeyboard(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function openResults() {
    if (!payload?.ready) return;

    if (payload.serviceSlug === "babysitting") {
      const params = new URLSearchParams();

      if (payload.city) params.set("city", payload.city);
      if (payload.date) params.set("date", payload.date);
      if (payload.time) params.set("time", payload.time);
      if (payload.budget != null) {
        params.set("budget", String(payload.budget));
      }

      router.push(`/babysitters?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams();

    if (payload.serviceSlug) {
      params.set("service", payload.serviceSlug);
    }

    if (payload.city) {
      params.set("city", payload.city);
    }

    router.push(`/search?${params.toString()}`);
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
              {aiEnabled ? "IA intelligente active" : "Mode gratuit actif"}
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
              <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
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
                      className={`max-w-[88%] rounded-3xl px-5 py-4 text-sm leading-7 sm:max-w-[78%] ${
                        message.role === "user"
                          ? "rounded-br-lg bg-violet-600 text-white shadow-lg"
                          : "rounded-bl-lg border border-border bg-background text-foreground"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {messages.length === 1 && (
                  <div className="grid gap-3 pt-2 sm:grid-cols-3">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void sendMessage(undefined, suggestion)}
                        className="rounded-2xl border border-border bg-background p-4 text-left text-sm font-semibold leading-6 transition hover:-translate-y-0.5 hover:border-violet-400"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
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
                <div className="border-t border-border bg-violet-500/[0.04] p-5">
                  <button
                    type="button"
                    onClick={openResults}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-500"
                  >
                    Voir les meilleurs prestataires
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}

              <form
                onSubmit={(event) => void sendMessage(event)}
                className="border-t border-border p-4 sm:p-5"
              >
                <div className="flex items-end gap-3 rounded-3xl border border-border bg-background p-2 shadow-sm focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-500/10">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyboard}
                    placeholder="Décris ton besoin en une phrase..."
                    rows={1}
                    maxLength={4000}
                    className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
                  />

                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Envoyer"
                  >
                    <Send size={19} />
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
                  value={payload?.serviceSlug}
                />
                <ContextItem
                  icon={<MapPin size={17} />}
                  label="Ville"
                  value={payload?.city}
                />
                <ContextItem
                  icon={<CheckCircle2 size={17} />}
                  label="Date et heure"
                  value={[
                    payload?.date,
                    payload?.time,
                  ]
                    .filter(Boolean)
                    .join(" à ")}
                />
                <ContextItem
                  icon={<WalletCards size={17} />}
                  label="Budget"
                  value={
                    payload?.budget != null
                      ? `${payload.budget} €`
                      : null
                  }
                />
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-background p-4 text-xs leading-6 text-muted-foreground">
                KLYX ne confirme jamais une réservation ou un paiement sans
                validation réelle du système.
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
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-bold uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>

      <p className="mt-2 text-sm font-black">
        {value || "À préciser"}
      </p>
    </div>
  );
}
