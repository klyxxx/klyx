"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, Mic, Send, Square } from "lucide-react";
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

const VOICE_COPY = {
  fr: {
    voice: "Voix",
    stop: "Arrêter",
    unavailable: "La saisie vocale n’est pas prise en charge par ce navigateur.",
    failed: "Impossible d’utiliser la saisie vocale pour le moment.",
  },
  en: {
    voice: "Voice",
    stop: "Stop",
    unavailable: "Voice input is not supported by this browser.",
    failed: "Voice input is unavailable right now.",
  },
  nl: {
    voice: "Spraak",
    stop: "Stoppen",
    unavailable: "Spraakinvoer wordt niet ondersteund door deze browser.",
    failed: "Spraakinvoer is momenteel niet beschikbaar.",
  },
  de: {
    voice: "Sprache",
    stop: "Stoppen",
    unavailable: "Spracheingabe wird von diesem Browser nicht unterstützt.",
    failed: "Spracheingabe ist derzeit nicht verfügbar.",
  },
} as const;

const SPEECH_LOCALES = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-DE",
} as const;

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
  const voiceCopy = VOICE_COPY[locale] ?? VOICE_COPY.fr;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
    if (!message || busy) return;

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

      if (result.href) {
        router.push(result.href);
        return;
      }

      router.push("/assistant/actions");
    } catch {
      setErrorMessage(t("genericError"));
      setBusy(false);
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
      setErrorMessage(voiceCopy.unavailable);
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = SPEECH_LOCALES[locale] ?? SPEECH_LOCALES.fr;
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
        setErrorMessage(voiceCopy.failed);
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
      setErrorMessage(voiceCopy.failed);
    }
  }

  return (
    <section className="w-full">
      <form
        onSubmit={submit}
        className="rounded-[28px] border border-border bg-card/94 p-2.5 shadow-[0_24px_80px_rgba(0,0,0,0.10)] transition focus-within:border-blue-600/35 focus-within:ring-4 focus-within:ring-blue-600/8 dark:border-white/10 dark:bg-[#121316]/96"
      >
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (value.trim() && !busy) {
                event.currentTarget.form?.requestSubmit();
              }
            }
          }}
          rows={4}
          maxLength={700}
          placeholder="Décrivez ce que vous voulez organiser…"
          className="min-h-[132px] w-full resize-none bg-transparent px-4 py-4 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground sm:text-lg"
        />

        <div className="flex items-center justify-between gap-3 px-1 pb-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/request/photo")}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background/60 px-4 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground dark:border-white/10"
            >
              <Camera size={17} />
              {t("photo")}
            </button>

            <button
              type="button"
              onClick={toggleVoice}
              disabled={!voiceSupported && !listening}
              aria-pressed={listening}
              title={!voiceSupported ? voiceCopy.unavailable : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                listening
                  ? "border-blue-600/25 bg-blue-600/10 text-blue-700 dark:text-blue-300"
                  : "border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/10"
              }`}
            >
              {listening ? <Square size={15} /> : <Mic size={17} />}
              {listening ? voiceCopy.stop : voiceCopy.voice}
            </button>
          </div>

          <button
            type="submit"
            disabled={!value.trim() || busy}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={t("continue")}
          >
            {busy ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
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
