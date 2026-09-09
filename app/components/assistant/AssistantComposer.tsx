"use client";

import {
  ArrowUp,
  Camera,
  Mic,
  Square,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";

import { KLYX_ASSISTANT_MESSAGE_MAX_LENGTH } from "@/lib/klyx-assistant-message-limits";

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

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function voiceCopy(locale: string) {
  if (locale === "en") {
    return {
      voice: "Voice",
      stop: "Stop voice input",
      unavailable: "Voice input is not supported by this browser.",
      failed: "Voice input is unavailable right now.",
      speechLocale: "en-GB",
    };
  }

  if (locale === "nl") {
    return {
      voice: "Spraak",
      stop: "Spraakinvoer stoppen",
      unavailable: "Spraakinvoer wordt niet ondersteund door deze browser.",
      failed: "Spraakinvoer is momenteel niet beschikbaar.",
      speechLocale: "nl-BE",
    };
  }

  if (locale === "de") {
    return {
      voice: "Sprache",
      stop: "Spracheingabe stoppen",
      unavailable: "Spracheingabe wird von diesem Browser nicht unterstützt.",
      failed: "Spracheingabe ist derzeit nicht verfügbar.",
      speechLocale: "de-DE",
    };
  }

  return {
    voice: "Voix",
    stop: "Arrêter la saisie vocale",
    unavailable: "La saisie vocale n’est pas prise en charge par ce navigateur.",
    failed: "Impossible d’utiliser la saisie vocale pour le moment.",
    speechLocale: "fr-BE",
  };
}

export default function AssistantComposer({
  locale,
  value,
  onChange,
  onSubmit,
  onPhoto,
  onError,
  busy,
  placeholder,
  textareaRef,
  formRef,
}: {
  locale: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  onPhoto: () => void;
  onError: (message: string) => void;
  busy: boolean;
  placeholder: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  formRef: RefObject<HTMLFormElement | null>;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const voice = voiceCopy(locale);

  useEffect(() => {
    setVoiceSupported(Boolean(speechRecognitionConstructor()));

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [textareaRef, value]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = value.trim();
    if (!message || busy) return;
    onSubmit(message);
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      setVoiceSupported(false);
      onError(voice.unavailable);
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = voice.speechLocale;
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (!transcript) return;

        const currentValue = valueRef.current;
        const nextValue = currentValue.trim()
          ? `${currentValue.trim()} ${transcript}`
          : transcript;

        onChange(nextValue.slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH));
        onError("");
      };
      recognition.onerror = () => onError(voice.failed);
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setListening(true);
      onError("");
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      onError(voice.failed);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      aria-busy={busy}
      data-testid="assistant-composer"
      className="flex min-h-[62px] w-full items-end gap-2 rounded-[1.35rem] border border-border bg-background p-2 shadow-sm transition focus-within:border-[#2563EB]/40 focus-within:ring-4 focus-within:ring-[#2563EB]/10 dark:border-white/10"
    >
      <button
        type="button"
        onClick={onPhoto}
        aria-label="Photo"
        title="Photo"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
      >
        <Camera size={19} aria-hidden="true" />
      </button>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (value.trim() && !busy) event.currentTarget.form?.requestSubmit();
          }
        }}
        rows={1}
        maxLength={KLYX_ASSISTANT_MESSAGE_MAX_LENGTH}
        placeholder={placeholder}
        className="min-h-10 max-h-32 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
      />

      <button
        type="button"
        onClick={toggleVoice}
        aria-label={listening ? voice.stop : voice.voice}
        aria-pressed={listening}
        title={!voiceSupported && !listening ? voice.unavailable : undefined}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
          listening
            ? "bg-[#2563EB]/10 text-[#2563EB]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {listening ? <Square size={15} aria-hidden="true" /> : <Mic size={19} aria-hidden="true" />}
      </button>

      <button
        type="submit"
        disabled={!value.trim() || busy}
        aria-label={locale === "en" ? "Send" : locale === "nl" ? "Versturen" : locale === "de" ? "Senden" : "Envoyer"}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2563EB] text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <ArrowUp size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
