"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Baby,
  Camera,
  CheckCircle2,
  LoaderCircle,
  Mic,
  Pencil,
  Sparkles,
  Square,
  Truck,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxAssistantCommand,
  type KlyxAssistantCommandMessageKey,
} from "@/lib/klyx-assistant-command-i18n";
import { supabase } from "@/lib/supabase";

type Props = {
  actions?: readonly unknown[];
};

type CommandResponse = {
  mode?: "existing_action" | "new_request" | "no_action";
  href?: string;
  action?: {
    href?: string;
  };
};

type BrainPayload = {
  serviceSlug: string | null;
  city: string | null;
  date: string | null;
  time: string | null;
  budget: number | null;
  missing?: string[];
  ready: boolean;
};

type BrainResponse = {
  conversationId?: string;
  reply?: string;
  payload?: BrainPayload;
  aiMode?: "openai" | "fallback";
};

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type ConfirmationResponse = {
  confirmationId?: string;
};

type PublishResponse = {
  requestId?: string;
  href?: string;
};

type SpeechRecognitionEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript?: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoiceSettings = {
  voice: string;
  stop: string;
  unavailable: string;
  failed: string;
  speechLocale: string;
};

type FlowCopy = {
  thinking: string;
  ready: string;
  confirm: string;
  edit: string;
  followUpPlaceholder: string;
};

function getVoiceSettings(locale: string): VoiceSettings {
  if (locale === "en") {
    return {
      voice: "Voice",
      stop: "Stop",
      unavailable: "Voice input is not supported by this browser.",
      failed: "Voice input is unavailable right now.",
      speechLocale: "en-GB",
    };
  }

  if (locale === "nl") {
    return {
      voice: "Spraak",
      stop: "Stoppen",
      unavailable: "Spraakinvoer wordt niet ondersteund door deze browser.",
      failed: "Spraakinvoer is momenteel niet beschikbaar.",
      speechLocale: "nl-BE",
    };
  }

  if (locale === "de") {
    return {
      voice: "Sprache",
      stop: "Stoppen",
      unavailable: "Spracheingabe wird von diesem Browser nicht unterstützt.",
      failed: "Spracheingabe ist derzeit nicht verfügbar.",
      speechLocale: "de-DE",
    };
  }

  return {
    voice: "Voix",
    stop: "Arrêter",
    unavailable: "La saisie vocale n’est pas prise en charge par ce navigateur.",
    failed: "Impossible d’utiliser la saisie vocale pour le moment.",
    speechLocale: "fr-BE",
  };
}

function getFlowCopy(locale: string): FlowCopy {
  if (locale === "en") {
    return {
      thinking: "KLYX is thinking…",
      ready: "I have everything I need.",
      confirm: "Confirm",
      edit: "Edit",
      followUpPlaceholder: "Reply naturally to KLYX…",
    };
  }

  if (locale === "nl") {
    return {
      thinking: "KLYX denkt na…",
      ready: "Ik heb alles wat nodig is.",
      confirm: "Bevestigen",
      edit: "Wijzigen",
      followUpPlaceholder: "Antwoord gewoon aan KLYX…",
    };
  }

  if (locale === "de") {
    return {
      thinking: "KLYX denkt nach…",
      ready: "Ich habe alles, was nötig ist.",
      confirm: "Bestätigen",
      edit: "Ändern",
      followUpPlaceholder: "Antworte KLYX einfach…",
    };
  }

  return {
    thinking: "KLYX réfléchit…",
    ready: "J’ai tout ce qu’il faut.",
    confirm: "Confirmer",
    edit: "Modifier",
    followUpPlaceholder: "Répondez simplement à KLYX…",
  };
}

function getOrganizeLabel(locale: string) {
  if (locale === "en") return "Organize";
  if (locale === "nl") return "Organiseren";
  if (locale === "de") return "Organisieren";
  return "Organiser";
}

function getQuickServices(locale: string) {
  if (locale === "en") {
    return [
      { label: "Baby-sitting", prompt: "I need a babysitter", icon: Baby },
      { label: "Cleaning", prompt: "I need a cleaning service", icon: Sparkles },
      { label: "Moving", prompt: "I need help organizing a move", icon: Truck },
      { label: "Handyman", prompt: "I need help with a handyman job", icon: Wrench },
    ];
  }

  if (locale === "nl") {
    return [
      { label: "Babysitting", prompt: "Ik heb een babysitter nodig", icon: Baby },
      { label: "Schoonmaak", prompt: "Ik heb een schoonmaakdienst nodig", icon: Sparkles },
      { label: "Verhuizing", prompt: "Ik wil een verhuizing organiseren", icon: Truck },
      { label: "Kluswerk", prompt: "Ik heb hulp nodig met een klus", icon: Wrench },
    ];
  }

  if (locale === "de") {
    return [
      { label: "Babysitting", prompt: "Ich brauche einen Babysitter", icon: Baby },
      { label: "Reinigung", prompt: "Ich brauche einen Reinigungsservice", icon: Sparkles },
      { label: "Umzug", prompt: "Ich möchte einen Umzug organisieren", icon: Truck },
      { label: "Handwerk", prompt: "Ich brauche Hilfe bei einer Handwerksarbeit", icon: Wrench },
    ];
  }

  return [
    { label: "Baby-sitting", prompt: "J’ai besoin d’un baby-sitter", icon: Baby },
    { label: "Ménage", prompt: "J’ai besoin d’un service de ménage", icon: Sparkles },
    { label: "Déménagement", prompt: "Je dois organiser un déménagement", icon: Truck },
    { label: "Bricolage", prompt: "J’ai besoin d’aide pour du bricolage", icon: Wrench },
  ];
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

export default function AssistantCommandBar(_props: Props) {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAssistantCommandMessageKey) =>
    translateKlyxAssistantCommand(locale, key);
  const voiceSettings = getVoiceSettings(locale);
  const flowCopy = getFlowCopy(locale);
  const quickServices = getQuickServices(locale);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [payload, setPayload] = useState<BrainPayload | null>(null);

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognitionConstructor()));

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();

    const message = value.trim();
    if (!message || busy || publishing) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      if (!conversationId) {
        const response = await fetch("/api/brain/command", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ message }),
        });

        const result = (await response.json()) as CommandResponse;
        if (!response.ok) throw new Error("Command unavailable");

        if (result.mode === "existing_action" && result.action?.href) {
          router.push(result.action.href);
          return;
        }

        if (result.mode !== "new_request") {
          if (result.href) {
            router.push(result.href);
            return;
          }

          router.push("/assistant/actions");
          return;
        }
      }

      setMessages((current) => [
        ...current,
        { role: "user", content: message },
      ]);
      setValue("");

      const brainResponse = await fetch("/api/brain/converse", {
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

      const brain = (await brainResponse.json()) as BrainResponse;
      if (!brainResponse.ok || !brain.reply) {
        throw new Error("Assistant unavailable");
      }

      setConversationId(brain.conversationId ?? conversationId);
      setPayload(brain.payload ?? null);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: brain.reply as string },
      ]);
    } catch {
      setErrorMessage(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRequest() {
    if (!payload?.ready || !conversationId || publishing) return;

    if (
      !payload.serviceSlug ||
      !payload.city ||
      !payload.date ||
      !payload.time
    ) {
      setErrorMessage(t("genericError"));
      return;
    }

    setPublishing(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

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
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            conversationId,
            request: requestSnapshot,
          }),
        }
      );
      const confirmation =
        (await confirmationResponse.json()) as ConfirmationResponse;

      if (!confirmationResponse.ok || !confirmation.confirmationId) {
        throw new Error("Confirmation unavailable");
      }

      const userDescription = messages
        .filter((message) => message.role === "user")
        .map((message) => message.content.trim())
        .filter(Boolean)
        .join(" ")
        .slice(0, 2000);
      const title = `Besoin de ${payload.serviceSlug}`.slice(0, 120);
      const description =
        userDescription.length >= 10
          ? userDescription
          : `Demande KLYX pour ${payload.serviceSlug} à ${payload.city}.`;

      const publishResponse = await fetch("/api/brain/market-publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
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
          title,
          description,
          confirmed: true,
          confirmationId: confirmation.confirmationId,
        }),
      });
      const published = (await publishResponse.json()) as PublishResponse;

      if (!publishResponse.ok || !published.requestId) {
        throw new Error("Publication unavailable");
      }

      router.push(published.href || "/bookings");
    } catch {
      setErrorMessage(t("genericError"));
    } finally {
      setPublishing(false);
    }
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setVoiceSupported(false);
      setErrorMessage(voiceSettings.unavailable);
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = voiceSettings.speechLocale;
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (!transcript) return;

        setValue((current) =>
          current.trim() ? `${current.trim()} ${transcript}` : transcript
        );
        setErrorMessage("");
      };

      recognition.onerror = () => {
        setErrorMessage(voiceSettings.failed);
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setErrorMessage("");
      setListening(true);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setErrorMessage(voiceSettings.failed);
    }
  }

  return (
    <section className="w-full">
      {messages.length > 0 && (
        <div className="mb-5 space-y-3" aria-live="polite">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[76%] ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-border bg-background text-foreground dark:border-white/10 dark:bg-zinc-950"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground dark:border-white/10">
                <LoaderCircle size={16} className="animate-spin" />
                {flowCopy.thinking}
              </div>
            </div>
          )}
        </div>
      )}

      {payload?.ready && (
        <div className="mb-5 rounded-2xl border border-blue-600/20 bg-blue-600/[0.04] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-blue-600" size={19} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{flowCopy.ready}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {payload.serviceSlug} · {payload.city} · {payload.date} · {payload.time}
                {payload.budget == null ? "" : ` · ${payload.budget.toFixed(2)} €`}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmRequest}
              disabled={publishing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <CheckCircle2 size={17} />
              )}
              {flowCopy.confirm}
            </button>
            <button
              type="button"
              onClick={() => textareaRef.current?.focus()}
              disabled={publishing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50 dark:border-white/10"
            >
              <Pencil size={16} />
              {flowCopy.edit}
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={submit}
        className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition focus-within:border-blue-600/35 focus-within:ring-4 focus-within:ring-blue-600/8 dark:border-white/10 dark:bg-zinc-950"
      >
        <div className="p-3 sm:p-5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (value.trim() && !busy && !publishing) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
            }}
            rows={conversationId ? 3 : 5}
            maxLength={700}
            disabled={publishing}
            placeholder={
              conversationId ? flowCopy.followUpPlaceholder : "Décrivez votre besoin..."
            }
            className="min-h-[112px] w-full resize-none bg-transparent px-2 py-2 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60 sm:text-lg"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/request/photo")}
                disabled={publishing}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50 dark:border-white/10 dark:bg-zinc-950"
              >
                <Camera size={18} />
                {t("photo")}
              </button>

              <button
                type="button"
                onClick={toggleVoice}
                disabled={publishing || (!voiceSupported && !listening)}
                aria-pressed={listening}
                title={!voiceSupported ? voiceSettings.unavailable : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  listening
                    ? "border-blue-600/25 bg-blue-600/10 text-blue-700 dark:text-blue-300"
                    : "border-border bg-background text-foreground hover:bg-muted dark:border-white/10 dark:bg-zinc-950"
                }`}
              >
                {listening ? <Square size={15} /> : <Mic size={18} />}
                {listening ? voiceSettings.stop : voiceSettings.voice}
              </button>
            </div>

            <button
              type="submit"
              disabled={!value.trim() || busy || publishing}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-35 sm:min-w-36 sm:text-base"
            >
              {busy ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                getOrganizeLabel(locale)
              )}
            </button>
          </div>
        </div>

        {!conversationId && messages.length === 0 && (
          <div className="border-t border-border dark:border-white/10">
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {quickServices.map((service, index) => {
                const Icon = service.icon;

                return (
                  <button
                    key={service.label}
                    type="button"
                    onClick={() => {
                      setValue((current) =>
                        current.trim() ? current : service.prompt
                      );
                      setErrorMessage("");
                    }}
                    className={`flex min-h-14 items-center justify-center gap-2 px-3 text-sm font-medium text-foreground transition hover:bg-muted ${
                      index % 2 === 1 ? "border-l border-border dark:border-white/10" : ""
                    } ${
                      index >= 2 ? "border-t border-border sm:border-t-0 dark:border-white/10" : ""
                    } ${
                      index > 0 ? "sm:border-l sm:border-border sm:dark:border-white/10" : ""
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{service.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </form>

      {errorMessage && (
        <p
          role="alert"
          className="mt-3 text-center text-xs font-semibold text-rose-600 dark:text-rose-300"
        >
          {errorMessage}
        </p>
      )}
    </section>
  );
}
