"use client";

import ClientRouteGuard from "@/app/components/ClientRouteGuard";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  CircleDashed,
  Euro,
  Lightbulb,
  LoaderCircle,
  MapPin,
  Send,
  WandSparkles,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type BrainPayload = {
  serviceSlug: string | null;
  city: string | null;
  date: string | null;
  time: string | null;
  budget: number | null;
  memoryUsed?: boolean;
  missing?: string[];
  ready: boolean;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ConfirmationResponse = {
  confirmationId?: string;
  error?: string;
};

type PublishResponse = {
  requestId?: string;
  href?: string;
  error?: string;
};

const EXAMPLES = [
  "J’ai besoin de quelqu’un pour nettoyer mon appartement à Bruxelles samedi matin.",
  "Je cherche un babysitter demain soir à Bruxelles pour deux enfants.",
  "J’ai besoin d’aide pour monter une armoire cette semaine, budget 60 €.",
  "Je déménage samedi à Bruxelles et j’ai besoin de deux personnes.",
];

async function accessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

function missingLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    service: "le service",
    serviceslug: "le service",
    service_slug: "le service",
    city: "la ville",
    ville: "la ville",
    date: "la date",
    time: "l’heure",
    heure: "l’heure",
    budget: "le budget",
  };

  return labels[normalized] ?? value;
}

export default function MarketAssistantPage() {
  const router = useRouter();
  const autoStartRef = useRef(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Dis-moi ce qu’il te faut. Je m’occupe du reste avec toi.",
    },
  ]);
  const [input, setInput] = useState("");
  const [payload, setPayload] = useState<BrainPayload | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const missing = payload?.missing ?? [];
  const understoodItems = useMemo(
    () => [
      {
        label: "Service",
        value: payload?.serviceSlug ?? null,
        icon: WandSparkles,
      },
      {
        label: "Lieu",
        value: payload?.city ?? null,
        icon: MapPin,
      },
      {
        label: "Date",
        value: payload?.date ?? null,
        icon: CircleDashed,
      },
      {
        label: "Heure",
        value: payload?.time ?? null,
        icon: CircleDashed,
      },
      {
        label: "Budget",
        value:
          payload?.budget == null
            ? null
            : `${payload.budget.toFixed(2)} €`,
        icon: Euro,
      },
    ],
    [payload]
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const initialRequest = searchParams.get("request")?.trim() ?? "";

    if (!initialRequest || autoStartRef.current) {
      return;
    }

    autoStartRef.current = true;
    setInput((current) => (current.trim() ? current : initialRequest));
  }, []);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();
    if (!message || loading) {
      return;
    }

    setMessages((current) => [
      ...current,
      { role: "user", content: message },
    ]);
    setInput("");
    setLoading(true);
    setErrorMessage("");

    try {
      const token = await accessToken();
      const response = await fetch("/api/brain/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId, message }),
      });

      const body = (await response.json()) as {
        conversationId?: string;
        reply?: string;
        payload?: BrainPayload;
        error?: string;
      };

      if (!response.ok || !body.reply) {
        throw new Error(
          body.error || "KLYX n’a pas pu analyser la demande."
        );
      }

      setConversationId(body.conversationId ?? null);
      setPayload(body.payload ?? null);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: body.reply as string },
      ]);

      if (body.payload?.ready) {
        const service = body.payload.serviceSlug ?? "service";
        setTitle((current) =>
          current.trim() ? current : `Besoin de ${service}`
        );
        setDescription((current) =>
          current.trim() ? current : message
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Session manquante."
      ) {
        router.replace("/login");
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’analyser la demande."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      !autoStartRef.current ||
      !input.trim() ||
      loading ||
      conversationId
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const form = document.querySelector<HTMLFormElement>(
        'form[data-klyx-market-form="true"]'
      );
      form?.requestSubmit();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [input, loading, conversationId]);

  async function publishRequest() {
    if (!payload?.ready || publishing) {
      return;
    }

    if (
      !conversationId ||
      !payload.serviceSlug ||
      !payload.city ||
      !payload.date ||
      !payload.time
    ) {
      setErrorMessage(
        "KLYX doit connaître le service, le lieu, la date et l’heure avant confirmation."
      );
      return;
    }

    if (title.trim().length < 3) {
      setErrorMessage("Ajoute un titre plus précis.");
      return;
    }

    if (description.trim().length < 10) {
      setErrorMessage("Décris le besoin en au moins 10 caractères.");
      return;
    }

    setPublishing(true);
    setErrorMessage("");

    try {
      const token = await accessToken();
      const requestSnapshot = {
        serviceSlug: payload.serviceSlug,
        city: payload.city,
        date: payload.date,
        time: payload.time,
        budget: payload.budget,
      };

      const confirmationResponse = await fetch(
        "/api/brain/confirm-request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversationId,
            request: requestSnapshot,
          }),
        }
      );

      const confirmationBody =
        (await confirmationResponse.json()) as ConfirmationResponse;

      if (
        !confirmationResponse.ok ||
        !confirmationBody.confirmationId
      ) {
        throw new Error(
          confirmationBody.error ||
            "Impossible de confirmer explicitement la demande."
        );
      }

      const response = await fetch("/api/brain/market-publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          serviceSlug: requestSnapshot.serviceSlug,
          city: requestSnapshot.city,
          date: requestSnapshot.date,
          time: requestSnapshot.time,
          budget: requestSnapshot.budget,
          requestedDate: requestSnapshot.date,
          requestedTime: requestSnapshot.time,
          budgetMax: requestSnapshot.budget,
          title: title.trim(),
          description: description.trim(),
          confirmed: true,
          confirmationId: confirmationBody.confirmationId,
        }),
      });

      const body = (await response.json()) as PublishResponse;
      if (!response.ok || !body.requestId) {
        throw new Error(
          body.error || "Impossible de publier la demande."
        );
      }

      router.push(body.href || "/requests");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de publier la demande."
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ClientRouteGuard>
      <main className="klyx-page">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/assistant"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft size={17} />
            Retour à KLYX
          </Link>

          <section className="mt-8 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              KLYX · Besoin
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-5xl">
              Précisons votre besoin.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              KLYX demande uniquement ce qui manque, puis vous laisse vérifier le résumé avant toute publication.
            </p>
          </section>

          {!conversationId && (
            <section className="mt-7">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb size={17} className="text-blue-600" />
                Parlez naturellement
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setInput(example)}
                    className="rounded-full border border-border bg-card px-4 py-2 text-left text-xs font-medium text-muted-foreground transition hover:border-blue-500/50 hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
            {/* KLYX_AI_FIRST_ASSISTANT_15_02 */}
            {/* KLYX_ASSISTANT_CONTROL_STATE_13_94 */}
            <section className="klyx-card flex min-h-[570px] flex-col p-5 sm:p-7">
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-4">
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-blue-600"
                />
                <p className="text-sm leading-6 text-muted-foreground">
                  {payload?.ready
                    ? "Besoin compris. Vérifiez le résumé avant de confirmer."
                    : "Continuez à préciser votre besoin."}
                </p>
              </div>

              <div className="flex-1 space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[82%] ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-600">
                          <Bot size={14} />
                          KLYX
                        </div>
                      )}
                      {message.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                      <LoaderCircle
                        className="animate-spin text-blue-600"
                        size={16}
                      />
                      KLYX analyse votre besoin...
                    </div>
                  </div>
                )}
              </div>

              <form
                data-klyx-market-form="true"
                onSubmit={sendMessage}
                className="mt-6 border-t border-border pt-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={2}
                    className="klyx-input min-h-[58px] flex-1 resize-none p-4"
                    placeholder="Ex. Demain matin j’ai besoin de quelqu’un pour nettoyer mon appartement à Bruxelles..."
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="klyx-button min-h-[58px] sm:self-end"
                  >
                    {loading ? (
                      <LoaderCircle className="animate-spin" size={18} />
                    ) : (
                      <Send size={18} />
                    )}
                    Envoyer
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Entrée pour envoyer · Maj + Entrée pour aller à la ligne
                </p>
              </form>
            </section>

            <aside className="space-y-4">
              <section className="klyx-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="klyx-eyebrow">Compréhension KLYX</p>
                    <h2 className="mt-1 text-lg font-bold">
                      Ce que KLYX a compris
                    </h2>
                  </div>
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-2xl ${
                      payload?.ready
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-blue-500/10 text-blue-600"
                    }`}
                  >
                    {payload?.ready ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Bot size={20} />
                    )}
                  </div>
                </div>

                {!payload ? (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    Décrivez votre besoin. Les informations comprises apparaîtront ici.
                  </p>
                ) : (
                  <div className="mt-5 space-y-2">
                    {understoodItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3"
                        >
                          <div
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                              item.value
                                ? "bg-blue-500/10 text-blue-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {item.value ? (
                              <Check size={17} />
                            ) : (
                              <Icon size={17} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {item.label}
                            </p>
                            <p className="truncate text-sm font-bold">
                              {item.value ?? "À préciser"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {payload && !payload.ready && missing.length > 0 && (
                <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    Encore nécessaire
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Répondez naturellement. KLYX a encore besoin de :
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {missing.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-amber-500/25 bg-background px-3 py-1.5 text-xs font-bold"
                      >
                        {missingLabel(item)}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {payload?.memoryUsed && (
                <section className="rounded-3xl border border-blue-500/15 bg-blue-500/[0.04] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                    Mémoire KLYX
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Certaines informations utiles de votre profil ou de votre contexte ont aidé KLYX à préparer cette demande.
                  </p>
                </section>
              )}
            </aside>
          </div>

          {payload?.ready && (
            <section className="klyx-card mt-6 overflow-hidden p-0">
              <div className="border-b border-border bg-blue-500/[0.035] p-6 sm:p-8">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-600">
                    <CheckCircle2 size={23} />
                  </div>
                  <div>
                    <p className="klyx-eyebrow">Résumé modifiable</p>
                    <h2 className="mt-1 text-2xl font-bold">
                      Vérifiez avant de confirmer
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Rien n’est encore publié. Vous pouvez encore modifier le titre ou la description.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Info label="Service" value={payload.serviceSlug ?? "—"} />
                  <Info label="Ville" value={payload.city ?? "—"} />
                  <Info label="Date" value={payload.date ?? "—"} />
                  <Info label="Heure" value={payload.time ?? "—"} />
                  <Info
                    label="Budget"
                    value={
                      payload.budget == null
                        ? "Non défini"
                        : `${payload.budget.toFixed(2)} €`
                    }
                  />
                </div>

                <div className="mt-7 grid gap-5">
                  <label>
                    <span className="mb-2 block text-sm font-bold">
                      Titre visible par les prestataires
                    </span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="klyx-input"
                      maxLength={120}
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-bold">
                      Description de la mission
                    </span>
                    <textarea
                      value={description}
                      onChange={(event) =>
                        setDescription(event.target.value)
                      }
                      className="klyx-input min-h-36 resize-y p-4"
                      maxLength={2000}
                    />
                  </label>
                </div>

                <div className="mt-6 rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
                      <Check size={17} />
                    </div>
                    <div>
                      <p className="font-bold">Confirmation explicite</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Le clic ci-dessous crée la preuve de confirmation, puis publie exactement ce résumé. Aucun paiement ni réservation n’est déclenché ici.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => void publishRequest()}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publishing ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  Confirmer et publier la demande
                </button>
              </div>
            </section>
          )}

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}
        </div>
      </main>
    </ClientRouteGuard>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words font-bold">{value}</p>
    </div>
  );
}
