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
  Sparkles,
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

const EXAMPLES = [
  "J’ai besoin de quelqu’un pour nettoyer mon appartement à Bruxelles samedi matin.",
  "Je cherche un babysitter demain soir à Bruxelles pour deux enfants.",
  "J’ai besoin d’aide pour monter une armoire cette semaine, budget 60 €.",
  "Je déménage samedi à Bruxelles et j’ai besoin de deux personnes.",
];

function getKlyxPublishProof() {
  if (typeof window === "undefined") {
    return {
      conversationId: null,
      confirmationId: null,
    };
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  return {
    conversationId:
      params.get("conversationId"),

    confirmationId:
      params.get("confirmationId"),
  };
}

async function accessToken():
Promise<string> {
  const {
    data: { session },
  } =
    await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error(
      "Session manquante."
    );
  }

  return session.access_token;
}

function missingLabel(
  value: string
): string {
  const normalized =
    value
      .trim()
      .toLowerCase();

  const labels:
    Record<string, string> =
    {
      service:
        "le service",

      serviceslug:
        "le service",

      service_slug:
        "le service",

      city:
        "la ville",

      ville:
        "la ville",

      date:
        "la date",

      time:
        "l’heure",

      heure:
        "l’heure",

      budget:
        "le budget",
    };

  return (
    labels[normalized] ??
    value
  );
}

export default function MarketAssistantPage() {
  const router =
    useRouter();

  const autoStartRef =
    useRef(false);

  const [conversationId, setConversationId] =
    useState<string | null>(
      null
    );

  const [messages, setMessages] =
    useState<Message[]>([
      {
        role:
          "assistant",

        content:
          "Explique-moi simplement ce qu’il te faut. Je vais comprendre ton besoin, compléter les informations utiles avec toi puis te montrer exactement ce qui sera publié. Rien ne part sans ta confirmation.",
      },
    ]);

  const [input, setInput] =
    useState("");

  const [payload, setPayload] =
    useState<BrainPayload | null>(
      null
    );

  const [title, setTitle] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    publishing,
    setPublishing,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const missing =
    payload?.missing ??
    [];

  const understoodItems =
    useMemo(
      () => [
        {
          label:
            "Service",
          value:
            payload?.serviceSlug ??
            null,
          icon:
            WandSparkles,
        },

        {
          label:
            "Lieu",
          value:
            payload?.city ??
            null,
          icon:
            MapPin,
        },

        {
          label:
            "Date",
          value:
            payload?.date ??
            null,
          icon:
            CircleDashed,
        },

        {
          label:
            "Heure",
          value:
            payload?.time ??
            null,
          icon:
            CircleDashed,
        },

        {
          label:
            "Budget",
          value:
            payload?.budget == null
              ? null
              : `${payload.budget.toFixed(
                  2
                )} €`,
          icon:
            Euro,
        },
      ],
      [payload]
    );

  useEffect(() => {
    const searchParams =
      new URLSearchParams(
        window.location.search
      );

    const initialRequest =
      searchParams
        .get("request")
        ?.trim() ??
      "";

    if (
      !initialRequest ||
      autoStartRef.current
    ) {
      return;
    }

    autoStartRef.current =
      true;

    setInput((current) =>
      current.trim()
        ? current
        : initialRequest
    );
  }, []);

  async function sendMessage(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const message =
      input.trim();

    if (
      !message ||
      loading
    ) {
      return;
    }

    setMessages(
      (current) => [
        ...current,
        {
          role:
            "user",
          content:
            message,
        },
      ]
    );

    setInput("");
    setLoading(true);
    setErrorMessage("");

    try {
      const token =
        await accessToken();

      const response =
        await fetch(
          "/api/brain/respond",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                conversationId,
                message,
              }),
          }
        );

      const body =
        (await response.json()) as {
          conversationId?: string;
          reply?: string;
          payload?: BrainPayload;
          error?: string;
        };

      if (
        !response.ok ||
        !body.reply
      ) {
        throw new Error(
          body.error ||
            "KLYX n’a pas pu analyser la demande."
        );
      }

      setConversationId(
        body.conversationId ??
          null
      );

      setPayload(
        body.payload ??
          null
      );

      setMessages(
        (current) => [
          ...current,
          {
            role:
              "assistant",

            content:
              body.reply as string,
          },
        ]
      );

      if (
        body.payload?.ready
      ) {
        const service =
          body.payload
            .serviceSlug ??
          "service";

        setTitle(
          (current) =>
            current.trim()
              ? current
              : `Besoin de ${service}`
        );

        setDescription(
          (current) =>
            current.trim()
              ? current
              : message
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "Session manquante."
      ) {
        router.replace(
          "/login"
        );

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

    const timer =
      window.setTimeout(
        () => {
          const form =
            document.querySelector<HTMLFormElement>(
              'form[data-klyx-market-form="true"]'
            );

          form?.requestSubmit();
        },
        120
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    input,
    loading,
    conversationId,
  ]);

  async function publishRequest() {
    if (
      !payload?.ready ||
      publishing
    ) {
      return;
    }

    if (
      !payload.serviceSlug ||
      !payload.city
    ) {
      setErrorMessage(
        "Le service et la ville sont indispensables."
      );

      return;
    }

    if (
      title.trim().length <
      3
    ) {
      setErrorMessage(
        "Ajoute un titre plus précis."
      );

      return;
    }

    if (
      description.trim()
        .length <
      10
    ) {
      setErrorMessage(
        "Décris le besoin en au moins 10 caractères."
      );

      return;
    }

    setPublishing(true);
    setErrorMessage("");

    try {
      const token =
        await accessToken();

      const proof =
        getKlyxPublishProof();

      const response =
        await fetch(
          "/api/brain/market-publish",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                conversationId,

                serviceSlug:
                  payload.serviceSlug,

                title:
                  title.trim(),

                description:
                  description.trim(),

                city:
                  payload.city,

                requestedDate:
                  payload.date,

                requestedTime:
                  payload.time,

                budgetMax:
                  payload.budget,

                confirmed:
                  true,

                confirmationId:
                  proof.confirmationId,
              }),
          }
        );

      const body =
        (await response.json()) as {
          requestId?: string;
          href?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !body.requestId
      ) {
        throw new Error(
          body.error ||
            "Impossible de publier la demande."
        );
      }

      router.push(
        body.href ||
          "/requests"
      );
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
          className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />

          Retour à KLYX
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Sparkles size={14} />

            Organiser un service
          </div>

          <div className="mt-5 grid gap-7 lg:grid-cols-[1fr_300px] lg:items-center">
            <div>
              <h1 className="max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
                Dis-moi ce qu’il faut faire.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                Pas besoin de chercher une catégorie ou de remplir un long formulaire. Décris ton problème normalement et KLYX construit la demande avec toi.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-black uppercase tracking-[0.17em] text-white/45">
                Toujours sous ton contrôle
              </p>

              <div className="mt-4 space-y-3">
                <SafetyItem text="KLYX prépare." />
                <SafetyItem text="Tu vérifies." />
                <SafetyItem text="Tu confirmes." />
                <SafetyItem text="Ensuite seulement, KLYX publie." />
              </div>
            </div>
          </div>
        </section>

        {!conversationId && (
          <section className="mt-6">
            <div className="flex items-center gap-2">
              <Lightbulb
                size={17}
                className="text-violet-600"
              />

              <p className="text-sm font-black">
                Tu peux parler naturellement
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map(
                (example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() =>
                      setInput(
                        example
                      )
                    }
                    className="rounded-full border border-border bg-card px-4 py-2 text-left text-xs font-semibold text-muted-foreground transition hover:border-violet-500/40 hover:text-foreground"
                  >
                    {example}
                  </button>
                )
              )}
            </div>
          </section>
        )}

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
                  {/* KLYX_ASSISTED_NEED_JOURNEY_13_94 */}
        <section className="mb-5 overflow-hidden rounded-3xl border border-border bg-card">
          <div className="border-b border-border p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                  Ton parcours KLYX
                </p>

                <h2 className="mt-2 text-xl font-black sm:text-2xl">
                  Du besoin à la comparaison, sans action cachée.
                </h2>
              </div>

              <Link
                href="/search"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-black transition hover:bg-muted"
              >
                Comparer moi-même
              </Link>
            </div>
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <AssistantJourneyStep
              number="1"
              title="Décris"
              text="Explique ton besoin avec tes propres mots."
              active={!payload?.ready}
            />

            <AssistantJourneyStep
              number="2"
              title="Vérifie"
              text="KLYX structure le service, la ville, la date et le budget."
              active={Boolean(payload?.ready)}
            />

            <AssistantJourneyStep
              number="3"
              title="Confirme"
              text="La publication attend toujours ton action explicite."
              active={Boolean(payload?.ready)}
            />

            <AssistantJourneyStep
              number="4"
              title="Compare"
              text="Après publication, examine les solutions et prestataires."
              active={false}
            />
          </div>
        </section>

        {/* KLYX_ASSISTANT_CONTROL_STATE_13_94 */}
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-4">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          />

          <p className="text-sm leading-6 text-muted-foreground">
            {payload?.ready
              ? "KLYX a suffisamment compris ton besoin. Vérifie maintenant les informations avant de décider de publier."
              : "Rien n’est publié pendant la conversation. Continue à préciser ton besoin jusqu’à ce que KLYX soit prêt."}
          </p>
        </div>
<section className="klyx-card flex min-h-[570px] flex-col p-5 sm:p-7">
            <div className="flex-1 space-y-3">
              {messages.map(
                (
                  message,
                  index
                ) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${
                      message.role ===
                      "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[82%] ${
                        message.role ===
                        "user"
                          ? "bg-violet-600 text-white"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      {message.role ===
                        "assistant" && (
                        <div className="mb-2 flex items-center gap-2 text-xs font-black text-violet-600">
                          <Bot
                            size={
                              14
                            }
                          />

                          KLYX
                        </div>
                      )}

                      {message.content}
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    <LoaderCircle
                      className="animate-spin text-violet-600"
                      size={16}
                    />

                    KLYX analyse ton besoin...
                  </div>
                </div>
              )}
            </div>

            <form
              data-klyx-market-form="true"
              onSubmit={
                sendMessage
              }
              className="mt-6 border-t border-border pt-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <textarea
                  value={input}
                  onChange={(
                    event
                  ) =>
                    setInput(
                      event.target
                        .value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();

                      event.currentTarget
                        .form
                        ?.requestSubmit();
                    }
                  }}
                  rows={2}
                  className="klyx-input min-h-[58px] flex-1 resize-none p-4"
                  placeholder="Ex. Demain matin j’ai besoin de quelqu’un pour nettoyer mon appartement à Bruxelles..."
                />

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !input.trim()
                  }
                  className="klyx-button min-h-[58px] sm:self-end"
                >
                  {loading ? (
                    <LoaderCircle
                      className="animate-spin"
                      size={18}
                    />
                  ) : (
                    <Send
                      size={18}
                    />
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
                  <p className="klyx-eyebrow">
                    Compréhension KLYX
                  </p>

                  <h2 className="mt-1 text-lg font-black">
                    Ce que j’ai compris
                  </h2>
                </div>

                {payload?.ready ? (
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2
                      size={20}
                    />
                  </div>
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
                    <Bot
                      size={20}
                    />
                  </div>
                )}
              </div>

              {!payload ? (
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  Commence par décrire ton besoin. KLYX affichera ici les informations comprises.
                </p>
              ) : (
                <div className="mt-5 space-y-2">
                  {understoodItems.map(
                    (item) => {
                      const Icon =
                        item.icon;

                      return (
                        <div
                          key={
                            item.label
                          }
                          className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3"
                        >
                          <div
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                              item.value
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {item.value ? (
                              <Check
                                size={17}
                              />
                            ) : (
                              <Icon
                                size={17}
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-muted-foreground">
                              {
                                item.label
                              }
                            </p>

                            <p className="truncate text-sm font-black">
                              {item.value ??
                                "À préciser"}
                            </p>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>

            {payload &&
              !payload.ready &&
              missing.length >
                0 && (
                <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    Encore nécessaire
                  </p>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Réponds naturellement. KLYX a encore besoin de :
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {missing.map(
                      (
                        item
                      ) => (
                        <span
                          key={
                            item
                          }
                          className="rounded-full border border-amber-500/25 bg-background px-3 py-1.5 text-xs font-black"
                        >
                          {missingLabel(
                            item
                          )}
                        </span>
                      )
                    )}
                  </div>
                </section>
              )}

            {payload?.memoryUsed && (
              <section className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">
                  Mémoire KLYX
                </p>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Certaines informations utiles de ton profil ou de ton contexte ont aidé KLYX à préparer cette demande.
                </p>
              </section>
            )}
          </aside>
        </div>

        {payload?.ready && (
          <section className="klyx-card mt-6 overflow-hidden p-0">
            <div className="border-b border-border bg-emerald-500/5 p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2
                    size={23}
                  />
                </div>

                <div>
                  <p className="klyx-eyebrow">
                    Demande prête
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    Vérifie avant de continuer
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    KLYX a préparé la demande. Tu peux encore modifier le titre ou la description avant de la rendre visible aux prestataires.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Info
                  label="Service"
                  value={
                    payload.serviceSlug ??
                    "—"
                  }
                />

                <Info
                  label="Ville"
                  value={
                    payload.city ??
                    "—"
                  }
                />

                <Info
                  label="Date"
                  value={
                    payload.date ??
                    "—"
                  }
                />

                <Info
                  label="Heure"
                  value={
                    payload.time ??
                    "—"
                  }
                />

                <Info
                  label="Budget"
                  value={
                    payload.budget ==
                    null
                      ? "Non défini"
                      : `${payload.budget.toFixed(
                          2
                        )} €`
                  }
                />
              </div>

              <div className="mt-7 grid gap-5">
                <label>
                  <span className="mb-2 block text-sm font-black">
                    Titre visible par les prestataires
                  </span>

                  <input
                    value={title}
                    onChange={(
                      event
                    ) =>
                      setTitle(
                        event.target
                          .value
                      )
                    }
                    className="klyx-input"
                    maxLength={
                      120
                    }
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-black">
                    Description de la mission
                  </span>

                  <textarea
                    value={
                      description
                    }
                    onChange={(
                      event
                    ) =>
                      setDescription(
                        event.target
                          .value
                      )
                    }
                    className="klyx-input min-h-36 resize-y p-4"
                    maxLength={
                      2000
                    }
                  />
                </label>
              </div>

              <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
                    <Check
                      size={17}
                    />
                  </div>

                  <div>
                    <p className="font-black">
                      Rien n’a encore été publié.
                    </p>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      En appuyant sur le bouton ci-dessous, tu confirmes explicitement que cette demande peut être publiée auprès des prestataires KLYX.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={
                  publishing
                }
                onClick={() =>
                  void publishRequest()
                }
                className="klyx-button mt-5 w-full"
              >
                {publishing ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={18}
                  />
                ) : (
                  <Sparkles
                    size={18}
                  />
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

function SafetyItem({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm text-white/75">
      <CheckCircle2
        size={16}
        className="mt-0.5 shrink-0 text-emerald-300"
      />

      <span>
        {text}
      </span>
    </div>
  );
}

function AssistantJourneyStep({
  number,
  title,
  text,
  active,
}: {
  number: string;
  title: string;
  text: string;
  active: boolean;
}) {
  return (
    <div className="bg-card p-5">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${
            active
              ? "bg-violet-600 text-white"
              : "border border-border bg-background text-muted-foreground"
          }`}
        >
          {number}
        </span>

        <p className="font-black">
          {title}
        </p>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {text}
      </p>
    </div>
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
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 break-words font-black">
        {value}
      </p>
    </div>
  );
}