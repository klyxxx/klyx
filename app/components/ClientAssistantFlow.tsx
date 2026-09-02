"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Camera,
  CheckCircle2,
  LoaderCircle,
  Mic,
  Pencil,
  Send,
  Square,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type BrainPayload = {
  serviceSlug: string | null;
  city: string | null;
  date: string | null;
  time: string | null;
  budget: number | null;
  missing?: string[];
  ready: boolean;
};

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type BrainResponse = {
  conversationId?: string;
  reply?: string;
  payload?: BrainPayload;
  aiMode?: "openai" | "fallback";
  error?: string;
};

type CommandResponse = {
  mode?: "existing_action" | "new_request" | "no_action";
  href?: string;
  action?: {
    href?: string;
  };
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

  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

async function accessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("SESSION_REQUIRED");
  }

  return session.access_token;
}

export default function ClientAssistantFlow() {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [payload, setPayload] = useState<BrainPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setVoiceSupported(Boolean(speechRecognitionConstructor()));

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  async function maybeOpenExistingAction(
    token: string,
    message: string
  ): Promise<boolean> {
    if (conversationId) return false;

    const response = await fetch("/api/brain/command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) return false;

    const body = (await response.json()) as CommandResponse;

    if (body.mode === "existing_action" && body.action?.href) {
      router.push(body.action.href);
      return true;
    }

    if (body.mode === "no_action" && body.href) {
      router.push(body.href);
      return true;
    }

    return false;
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();
    if (!message || busy || publishing) return;

    setBusy(true);
    setErrorMessage("");
    setMessages((current) => [
      ...current,
      { role: "user", content: message },
    ]);
    setInput("");

    try {
      const token = await accessToken();

      if (await maybeOpenExistingAction(token, message)) {
        return;
      }

      const response = await fetch("/api/brain/converse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      const body = (await response.json()) as BrainResponse;

      if (!response.ok || !body.reply) {
        throw new Error(
          body.error || "KLYX n’a pas pu comprendre la demande."
        );
      }

      setConversationId(body.conversationId ?? conversationId);
      setPayload(body.payload ?? null);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: body.reply as string },
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === "SESSION_REQUIRED") {
        router.replace("/login");
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "KLYX est indisponible pour le moment."
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmRequest() {
    if (publishing || !payload?.ready || !conversationId) return;

    if (
      !payload.serviceSlug ||
      !payload.city ||
      !payload.date ||
      !payload.time
    ) {
      setErrorMessage(
        "Il manque encore une information avant de confirmer."
      );
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

      if (!confirmationResponse.ok || !confirmationBody.confirmationId) {
        throw new Error(
          confirmationBody.error ||
            "Impossible de confirmer la demande."
        );
      }

      const publishResponse = await fetch("/api/brain/market-publish", {
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
          title,
          description,
          confirmed: true,
          confirmationId: confirmationBody.confirmationId,
        }),
      });
      const publishBody = (await publishResponse.json()) as PublishResponse;

      if (!publishResponse.ok || !publishBody.requestId) {
        throw new Error(
          publishBody.error || "Impossible de publier la demande."
        );
      }

      router.push(publishBody.href || "/requests");
    } catch (error) {
      if (error instanceof Error && error.message === "SESSION_REQUIRED") {
        router.replace("/login");
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de confirmer la demande."
      );
    } finally {
      setPublishing(false);
    }
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = speechRecognitionConstructor();

    if (!Recognition) {
      setVoiceSupported(false);
      setErrorMessage("La saisie vocale n’est pas disponible sur ce navigateur.");
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = "fr-BE";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (!transcript) return;

        setInput((current) =>
          current.trim() ? `${current.trim()} ${transcript}` : transcript
        );
        setErrorMessage("");
      };
      recognition.onerror = () => {
        setErrorMessage("Impossible d’utiliser la saisie vocale pour le moment.");
      };
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setListening(true);
      setErrorMessage("");
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setErrorMessage("Impossible d’utiliser la saisie vocale pour le moment.");
    }
  }

  return (
    <section className="w-full max-w-3xl">
      {messages.length > 0 && (
        <div className="mb-6 space-y-3" aria-live="polite">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[78%] ${
                  message.role === "user"
                    ? "bg-[#2563EB] text-white"
                    : "border border-border bg-background text-foreground"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">
                <LoaderCircle size={16} className="animate-spin" />
                KLYX réfléchit…
              </div>
            </div>
          )}
        </div>
      )}

      {payload?.ready && (
        <div className="mb-5 rounded-2xl border border-[#2563EB]/20 bg-[#2563EB]/[0.04] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-[#2563EB]" size={19} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">J’ai tout ce qu’il faut.</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {payload.serviceSlug} · {payload.city} · {payload.date} · {payload.time}
                {payload.budget == null ? "" : ` · max ${payload.budget.toFixed(2)} €`}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmRequest}
              disabled={publishing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <CheckCircle2 size={17} />
              )}
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              disabled={publishing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
            >
              <Pencil size={16} />
              Modifier
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={sendMessage}
        className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition focus-within:border-[#2563EB]/35 focus-within:ring-4 focus-within:ring-[#2563EB]/10"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={4}
          maxLength={1000}
          disabled={publishing}
          placeholder={
            conversationId
              ? "Répondez simplement à KLYX…"
              : "Ex. J’ai besoin de quelqu’un demain pour monter une armoire à Liège."
          }
          className="min-h-[126px] w-full resize-none bg-transparent px-5 py-4 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60 sm:min-h-[138px]"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/request/photo")}
              disabled={publishing}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Camera size={18} />
              Photo
            </button>

            <button
              type="button"
              onClick={toggleVoice}
              disabled={publishing || (!voiceSupported && !listening)}
              aria-pressed={listening}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {listening ? <Square size={15} /> : <Mic size={18} />}
              {listening ? "Arrêter" : "Voix"}
            </button>
          </div>

          <button
            type="submit"
            aria-label="Envoyer"
            disabled={!input.trim() || busy || publishing}
            className="grid h-11 w-11 place-items-center rounded-xl bg-[#2563EB] text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-35"
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
        <p role="alert" className="mt-3 text-sm font-medium text-rose-600">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
