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
import {
  getKlyxLocaleMetadata,
  type KlyxLocale,
} from "@/lib/klyx-i18n";
import { translateKlyxTolgeeRuntimeUi } from "@/lib/klyx-tolgee-runtime";

type SpeechRecognitionEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript?: string;
      };
    };
  };
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type VoicePhase = "idle" | "starting" | "listening" | "stopping";

const KLYX_VOICE_SPEECH_LOCALE_OVERRIDES: Partial<
  Record<KlyxLocale, string>
> = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-DE",
};

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function speechLocaleForKlyxLocale(locale: KlyxLocale) {
  return (
    KLYX_VOICE_SPEECH_LOCALE_OVERRIDES[locale] ??
    getKlyxLocaleMetadata(locale).htmlLang
  );
}

function voiceCopy(locale: KlyxLocale) {
  return {
    voice: translateKlyxTolgeeRuntimeUi(locale, "assistant.voice.label"),
    stop: translateKlyxTolgeeRuntimeUi(locale, "assistant.voice.stop"),
    unavailable: translateKlyxTolgeeRuntimeUi(
      locale,
      "assistant.voice.unavailable"
    ),
    failed: translateKlyxTolgeeRuntimeUi(locale, "assistant.voice.failed"),
    permissionDenied: translateKlyxTolgeeRuntimeUi(
      locale,
      "assistant.voice.permissionDenied"
    ),
    noMicrophone: translateKlyxTolgeeRuntimeUi(
      locale,
      "assistant.voice.noMicrophone"
    ),
    noSpeech: translateKlyxTolgeeRuntimeUi(
      locale,
      "assistant.voice.noSpeech"
    ),
    secureContextRequired: translateKlyxTolgeeRuntimeUi(
      locale,
      "assistant.voice.secureContextRequired"
    ),
    speechLocale: speechLocaleForKlyxLocale(locale),
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
  locale: KlyxLocale;
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
  const voicePhaseRef = useRef<VoicePhase>("idle");
  const voiceStopRequestedRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [listening, setListening] = useState(false);
  const [voiceStarting, setVoiceStarting] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const voice = voiceCopy(locale);

  useEffect(() => {
    setVoiceSupported(Boolean(speechRecognitionConstructor()));

    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      voiceStopRequestedRef.current = true;
      voicePhaseRef.current = "stopping";

      try {
        recognition?.abort();
      } catch {
        // The browser can already have closed the recognition session.
      }
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
    if (
      voicePhaseRef.current === "starting" ||
      voicePhaseRef.current === "stopping"
    ) {
      return;
    }

    if (voicePhaseRef.current === "listening") {
      const recognition = recognitionRef.current;
      if (!recognition) {
        voicePhaseRef.current = "idle";
        voiceStopRequestedRef.current = false;
        setVoiceStarting(false);
        setListening(false);
        return;
      }

      voicePhaseRef.current = "stopping";
      voiceStopRequestedRef.current = true;

      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          // Nothing else to stop.
        }

        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        voicePhaseRef.current = "idle";
        voiceStopRequestedRef.current = false;
        setVoiceStarting(false);
        setListening(false);
        onError(voice.failed);
      }
      return;
    }

    if (typeof window === "undefined" || !window.isSecureContext) {
      onError(voice.secureContextRequired);
      return;
    }

    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      setVoiceSupported(false);
      onError(voice.unavailable);
      return;
    }

    setVoiceSupported(true);

    try {
      const recognition = new Recognition();
      recognition.lang = voice.speechLocale;
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => {
        if (recognitionRef.current !== recognition) return;
        voicePhaseRef.current = "listening";
        setVoiceStarting(false);
        setListening(true);
      };

      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition) return;

        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (!transcript) return;

        const currentValue = valueRef.current;
        const nextValue = currentValue.trim()
          ? `${currentValue.trim()} ${transcript}`
          : transcript;

        onChange(nextValue.slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH));
        onError("");
        requestAnimationFrame(() => textareaRef.current?.focus());
      };

      recognition.onerror = (event) => {
        if (recognitionRef.current !== recognition) return;

        let message = voice.failed;
        switch (event.error) {
          case "not-allowed":
          case "service-not-allowed":
            message = voice.permissionDenied;
            break;
          case "audio-capture":
            message = voice.noMicrophone;
            break;
          case "no-speech":
            message = voice.noSpeech;
            break;
          case "aborted":
            message = voiceStopRequestedRef.current ? "" : voice.failed;
            break;
          default:
            message = voice.failed;
        }

        voicePhaseRef.current = "stopping";
        setVoiceStarting(false);
        setListening(false);
        if (message) onError(message);
      };

      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        voicePhaseRef.current = "idle";
        voiceStopRequestedRef.current = false;
        setVoiceStarting(false);
        setListening(false);
      };

      recognitionRef.current = recognition;
      voicePhaseRef.current = "starting";
      voiceStopRequestedRef.current = false;
      onError("");
      setVoiceStarting(true);
      setListening(false);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      voicePhaseRef.current = "idle";
      voiceStopRequestedRef.current = false;
      setVoiceStarting(false);
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
        disabled={voiceStarting}
        aria-label={listening ? voice.stop : voice.voice}
        aria-pressed={listening}
        aria-busy={voiceStarting}
        title={!voiceSupported && !listening ? voice.unavailable : undefined}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:cursor-not-allowed disabled:opacity-45 ${
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
