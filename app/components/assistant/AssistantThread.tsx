"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  KLYX_ACTIVE_PROFILE_CHANGED,
  getActiveProfileAccount,
  type ActiveProfileChangedDetail,
} from "@/lib/account-switcher";
import {
  translateKlyxAssistantCommand,
  type KlyxAssistantCommandMessageKey,
} from "@/lib/klyx-assistant-command-i18n";
import { translateKlyxAssistantHome } from "@/lib/klyx-assistant-home-i18n";
import { KLYX_ASSISTANT_MESSAGE_MAX_LENGTH } from "@/lib/klyx-assistant-message-limits";
import { supabase } from "@/lib/supabase";

import AssistantComposer from "./AssistantComposer";
import ReadyForSearchSummary from "./ReadyForSearchSummary";
import SuggestionGroup, { type AssistantSuggestion } from "./SuggestionGroup";
import {
  ClarificationTurn,
  KlyxTurn,
  UserTurn,
  type AssistantAction,
  type AssistantTurnModel,
} from "./AssistantTurns";

type CommandResponse = {
  mode?: "existing_action" | "new_request" | "no_action";
  action?: {
    title?: string;
    description?: string;
    href?: string;
    label?: string;
  };
};

type BrainSummary = {
  service: string;
  city: string;
  date: string;
  time: string;
};

type BrainPayload = {
  serviceSlug?: string | null;
  city?: string | null;
  date?: string | null;
  time?: string | null;
  budget?: number | null;
  missing?: string[];
  ready?: boolean;
  readiness?: {
    nextMissing?: string | null;
    summary?: BrainSummary | null;
  };
};

type BrainResponse = {
  conversationId?: string;
  reply?: string;
  payload?: BrainPayload;
  aiMode?: "openai" | "fallback";
};

type SubmitOptions = {
  forceFocus?: boolean;
};

type PhaseState =
  | "empty"
  | "typing"
  | "submitting"
  | "user_submitted"
  | "assistant_thinking"
  | "assistant_replied"
  | "clarification_needed"
  | "user_response"
  | "assistant_processing"
  | "ready_for_search";

const NEAR_BOTTOM_THRESHOLD_PX = 120;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_CONFIRMATION_BOUNDARY =
  "Vérifie le résumé puis confirme avant toute publication, réservation ou paiement.";

function initialConversationFromLocation() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("conversation")?.trim();
  return value && UUID_PATTERN.test(value) ? value : null;
}

function initialPromptFromLocation() {
  if (typeof window === "undefined") return "";
  return (
    new URLSearchParams(window.location.search)
      .get("prompt")
      ?.trim()
      .slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH) ?? ""
  );
}

function presentationReply(
  rawReply: string,
  payload: BrainPayload | null,
  fallbackQuestion: string
) {
  if (payload?.ready === true) return "";

  const value = rawReply
    .trim()
    .replace(
      /^(?:Demande complète|Presque prête|Demande en cours|Je précise ton besoin)\s*(?:\(\s*\d{1,3}\s*%\s*\))?\s*(?:-\s*\d+\s+informations?\s+restantes?)?\s*/i,
      ""
    )
    .replace(/\(\s*\d{1,3}\s*%\s*\)/g, "")
    .replace(/\b\d+\s+informations?\s+restantes?\b[\s:;,.!-]*/gi, "")
    .replace(LEGACY_CONFIRMATION_BOUNDARY, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return value || fallbackQuestion;
}

function fallbackQuestion(locale: string, nextMissing: string | null) {
  const fr: Record<string, string> = {
    service: "De quel service avez-vous besoin ?",
    ville: "Dans quelle ville ou commune ?",
    date: "Quel jour souhaitez-vous la prestation ?",
    heure: "À quel moment souhaitez-vous la prestation ?",
  };
  const en: Record<string, string> = {
    service: "What service do you need?",
    ville: "Which city or municipality?",
    date: "Which day do you need the service?",
    heure: "What time would you like the service?",
  };
  const nl: Record<string, string> = {
    service: "Welke dienst heb je nodig?",
    ville: "In welke stad of gemeente?",
    date: "Op welke dag wil je de dienst?",
    heure: "Op welk moment wil je de dienst?",
  };
  const de: Record<string, string> = {
    service: "Welche Dienstleistung brauchst du?",
    ville: "In welcher Stadt oder Gemeinde?",
    date: "An welchem Tag brauchst du die Dienstleistung?",
    heure: "Zu welcher Zeit möchtest du die Dienstleistung?",
  };
  const table = locale === "en" ? en : locale === "nl" ? nl : locale === "de" ? de : fr;

  return (
    (nextMissing && table[nextMissing]) ||
    (locale === "en"
      ? "Could you clarify your request?"
      : "Pouvez-vous préciser votre demande ?")
  );
}

function starterSuggestions(locale: string): readonly AssistantSuggestion[] {
  if (locale === "en") {
    return [
      { id: "tomorrow", label: "Find someone for tomorrow", value: "Find someone for tomorrow" },
      { id: "move", label: "Organize a move", value: "I need to organize a move" },
      { id: "photo", label: "Analyze a photo", value: "I need help analyzing a photo" },
    ];
  }

  if (locale === "nl") {
    return [
      { id: "tomorrow", label: "Iemand vinden voor morgen", value: "Ik zoek iemand voor morgen" },
      { id: "move", label: "Een verhuizing organiseren", value: "Ik wil een verhuizing organiseren" },
      { id: "photo", label: "Een foto analyseren", value: "Ik wil een foto analyseren" },
    ];
  }

  if (locale === "de") {
    return [
      { id: "tomorrow", label: "Jemanden für morgen finden", value: "Ich suche jemanden für morgen" },
      { id: "move", label: "Einen Umzug organisieren", value: "Ich möchte einen Umzug organisieren" },
      { id: "photo", label: "Ein Foto analysieren", value: "Ich möchte ein Foto analysieren" },
    ];
  }

  return [
    { id: "tomorrow", label: "Trouver quelqu’un pour demain", value: "Trouver quelqu’un pour demain" },
    { id: "move", label: "Organiser un déménagement", value: "Je dois organiser un déménagement" },
    { id: "photo", label: "Analyser une photo", value: "J’ai besoin d’aide pour analyser une photo" },
  ];
}

function clarificationSuggestions(
  locale: string,
  nextMissing: string | null
): readonly AssistantSuggestion[] {
  // The current deterministic Brain parser understands these French date/time
  // answers. Other locales stay text-first rather than offering unreliable chips.
  if (locale !== "fr") return [];

  if (nextMissing === "heure") {
    return [
      { id: "morning", label: "Le matin", value: "Le matin" },
      { id: "afternoon", label: "L’après-midi", value: "L’après-midi" },
      { id: "evening", label: "Le soir", value: "Le soir" },
    ];
  }

  if (nextMissing === "date") {
    return [
      { id: "tomorrow", label: "Demain", value: "Demain" },
      { id: "saturday", label: "Samedi", value: "Samedi" },
      { id: "monday", label: "Lundi prochain", value: "Lundi prochain" },
    ];
  }

  return [];
}

async function responseBody<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export default function AssistantThread() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = useCallback(
    (key: KlyxAssistantCommandMessageKey) =>
      translateKlyxAssistantCommand(locale, key),
    [locale]
  );

  const [value, setValue] = useState(() => initialPromptFromLocation());
  const [turns, setTurns] = useState<AssistantTurnModel[]>([]);
  const [payload, setPayload] = useState<BrainPayload | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [phaseState, setPhaseState] = useState<PhaseState>("empty");

  const conversationIdRef = useRef<string | null>(null);
  const activeProfileIdRef = useRef<string | null>(null);
  const requestGenerationRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const turnSequenceRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerFormRef = useRef<HTMLFormElement | null>(null);
  const busyRef = useRef(false);
  const focusMovedDuringRequestRef = useRef(false);
  const shouldRestoreFocusRef = useRef(false);

  const nextMissing = payload?.readiness?.nextMissing ?? payload?.missing?.[0] ?? null;
  const ready = payload?.ready === true;
  const empty = turns.length === 0 && !busy;

  const starters = useMemo(() => starterSuggestions(locale), [locale]);
  const quickReplies = useMemo(
    () => clarificationSuggestions(locale, nextMissing),
    [locale, nextMissing]
  );

  const nextTurnId = useCallback((prefix: string) => {
    turnSequenceRef.current += 1;
    return `${prefix}-${turnSequenceRef.current}`;
  }, []);

  const invalidatePending = useCallback(() => {
    requestGenerationRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  }, []);

  const isNearBottom = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return true;
    return (
      node.scrollHeight - node.scrollTop - node.clientHeight <=
      NEAR_BOTTOM_THRESHOLD_PX
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const anchoredConversation = initialConversationFromLocation();
    conversationIdRef.current = anchoredConversation;
    setConversationId(anchoredConversation);

    void getActiveProfileAccount()
      .then((profile) => {
        if (mountedRef.current) activeProfileIdRef.current = profile.id;
      })
      .catch(() => {
        // The server assistant layout owns access. This lookup only protects async
        // responses from being applied after a profile switch.
      });

    function resetVisibleThread(nextConversation: string | null) {
      conversationIdRef.current = nextConversation;
      setConversationId(nextConversation);
      setTurns([]);
      setPayload(null);
      setValue("");
      setBusy(false);
      busyRef.current = false;
      setErrorMessage("");
      setLiveAnnouncement("");
      setPhaseState("empty");
    }

    function onProfileChanged(event: Event) {
      const detail = (event as CustomEvent<ActiveProfileChangedDetail>).detail;
      if (!detail?.profileId) return;

      activeProfileIdRef.current = detail.profileId;
      invalidatePending();
      resetVisibleThread(null);
    }

    function onHistoryNavigation() {
      const nextConversation = initialConversationFromLocation();
      if (nextConversation === conversationIdRef.current) return;

      invalidatePending();
      resetVisibleThread(nextConversation);
    }

    window.addEventListener(KLYX_ACTIVE_PROFILE_CHANGED, onProfileChanged);
    window.addEventListener("popstate", onHistoryNavigation);

    return () => {
      mountedRef.current = false;
      invalidatePending();
      window.removeEventListener(KLYX_ACTIVE_PROFILE_CHANGED, onProfileChanged);
      window.removeEventListener("popstate", onHistoryNavigation);
    };
  }, [invalidatePending]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      if (!busyRef.current) return;
      const form = composerFormRef.current;
      const target = event.target;

      if (form && target instanceof Node && !form.contains(target)) {
        focusMovedDuringRequestRef.current = true;
      }
    }

    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  useEffect(() => {
    if (!nearBottomRef.current) return;
    bottomRef.current?.scrollIntoView({
      behavior: busy ? "auto" : "smooth",
      block: "end",
    });
  }, [busy, turns.length]);

  const apiErrorMessage = useCallback(
    (status: number) => {
      if (status === 429) return t("rateLimitedError");
      if (status === 413) return t("payloadTooLargeError");
      if (status === 400) return t("invalidMessageError");
      return t("genericError");
    },
    [t]
  );

  const finishFocus = useCallback(() => {
    if (
      shouldRestoreFocusRef.current &&
      !focusMovedDuringRequestRef.current
    ) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }

    shouldRestoreFocusRef.current = false;
    focusMovedDuringRequestRef.current = false;
  }, []);

  const applyConversationAnchor = useCallback(
    (nextConversationId: string) => {
      conversationIdRef.current = nextConversationId;
      setConversationId(nextConversationId);

      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      url.searchParams.set("conversation", nextConversationId);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`, {
        scroll: false,
      });
    },
    [router]
  );

  const submitMessage = useCallback(
    async (rawMessage: string, options: SubmitOptions = {}) => {
      const message = rawMessage.trim();
      if (!message || busyRef.current) return;

      if (message.length > KLYX_ASSISTANT_MESSAGE_MAX_LENGTH) {
        setErrorMessage(t("invalidMessageError"));
        return;
      }

      const expectedConversationId = conversationIdRef.current;
      let requestConversationId = expectedConversationId;
      const expectedProfileId = activeProfileIdRef.current;
      const generation = requestGenerationRef.current + 1;
      requestGenerationRef.current = generation;

      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;

      const activeElement =
        typeof document === "undefined" ? null : document.activeElement;
      shouldRestoreFocusRef.current =
        options.forceFocus === true ||
        Boolean(
          activeElement && composerFormRef.current?.contains(activeElement)
        );
      focusMovedDuringRequestRef.current = false;
      nearBottomRef.current = isNearBottom();

      setErrorMessage("");
      setLiveAnnouncement(t("thinking"));
      setTurns((current) => [
        ...current,
        { id: nextTurnId("user"), role: "user", content: message },
      ]);
      setValue("");
      setBusy(true);
      busyRef.current = true;
      setPhaseState(
        expectedConversationId
          ? nextMissing
            ? "user_response"
            : "user_submitted"
          : "submitting"
      );

      const isCurrentRequest = () => {
        if (
          !mountedRef.current ||
          requestGenerationRef.current !== generation ||
          controller.signal.aborted
        ) {
          return false;
        }

        if (conversationIdRef.current !== requestConversationId) return false;

        if (
          expectedProfileId &&
          activeProfileIdRef.current &&
          expectedProfileId !== activeProfileIdRef.current
        ) {
          return false;
        }

        return true;
      };

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isCurrentRequest()) return;
        if (!session?.access_token) {
          router.push("/login");
          return;
        }

        if (!expectedConversationId) {
          const commandResponse = await fetch("/api/brain/command", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ message }),
            signal: controller.signal,
          });
          const command = await responseBody<CommandResponse>(commandResponse);

          if (!isCurrentRequest()) return;
          if (!commandResponse.ok) {
            throw Object.assign(new Error("command_failed"), {
              status: commandResponse.status,
            });
          }

          if (command.mode === "existing_action") {
            const title = command.action?.title?.trim();
            const description = command.action?.description?.trim();
            if (!title || !description) {
              throw new Error("grounded_action_unavailable");
            }

            const action: AssistantAction | undefined =
              command.action?.href && command.action?.label
                ? {
                    href: command.action.href,
                    label: command.action.label,
                  }
                : undefined;
            const content = `${title}. ${description}`;

            setTurns((current) => [
              ...current,
              {
                id: nextTurnId("assistant"),
                role: "assistant",
                content,
                variant: "groundedAction",
                action,
              },
            ]);
            setLiveAnnouncement(content);
            setPhaseState("assistant_replied");
            return;
          }

          if (command.mode === "no_action") {
            const content = t("noPendingAction");
            setTurns((current) => [
              ...current,
              {
                id: nextTurnId("assistant"),
                role: "assistant",
                content,
              },
            ]);
            setLiveAnnouncement(content);
            setPhaseState("assistant_replied");
            return;
          }

          if (command.mode !== "new_request") {
            throw new Error("unsupported_command_mode");
          }

          setPhaseState("user_submitted");
        }

        setPhaseState(
          expectedConversationId
            ? "assistant_processing"
            : "assistant_thinking"
        );

        // #656 accepts an omitted conversationId for a new conversation and a
        // valid UUID for a continuation. Never serialize `conversationId: null`.
        const brainRequest = requestConversationId
          ? { conversationId: requestConversationId, message }
          : { message };

        const brainResponse = await fetch("/api/brain/converse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(brainRequest),
          signal: controller.signal,
        });
        const brain = await responseBody<BrainResponse>(brainResponse);

        if (!isCurrentRequest()) return;
        if (!brainResponse.ok) {
          throw Object.assign(new Error("brain_failed"), {
            status: brainResponse.status,
          });
        }
        if (typeof brain.reply !== "string" || !brain.reply.trim()) {
          throw new Error("assistant_unavailable");
        }

        const nextPayload = brain.payload ?? null;
        const returnedConversationId = brain.conversationId?.trim();

        if (returnedConversationId && UUID_PATTERN.test(returnedConversationId)) {
          requestConversationId = returnedConversationId;
          applyConversationAnchor(returnedConversationId);
        } else if (!requestConversationId) {
          throw new Error("conversation_unavailable");
        }

        setPayload(nextPayload);

        const missingField =
          nextPayload?.readiness?.nextMissing ??
          nextPayload?.missing?.[0] ??
          null;
        const visibleReply = presentationReply(
          brain.reply,
          nextPayload,
          fallbackQuestion(locale, missingField)
        );
        const additions: AssistantTurnModel[] = [];

        if (visibleReply) {
          const groundedAction: AssistantAction | undefined =
            nextPayload?.action?.href && nextPayload.action.label
              ? {
                  href: nextPayload.action.href,
                  label: nextPayload.action.label,
                }
              : undefined;

          additions.push({
            id: nextTurnId("assistant"),
            role: "assistant",
            content: visibleReply,
            variant: groundedAction ? "groundedAction" : undefined,
            action: groundedAction,
          });
        }

        const summary = nextPayload?.readiness?.summary;
        if (nextPayload?.ready === true && summary) {
          additions.push({
            id: nextTurnId("ready"),
            role: "ready",
            summary,
            budget:
              typeof nextPayload.budget === "number"
                ? nextPayload.budget
                : null,
          });
        }

        if (additions.length > 0) {
          setTurns((current) => [...current, ...additions]);
        }

        if (nextPayload?.ready === true && summary) {
          setPhaseState("ready_for_search");
          setLiveAnnouncement(t("readyAnnouncement"));
        } else if (missingField) {
          setPhaseState("clarification_needed");
          setLiveAnnouncement(
            visibleReply || fallbackQuestion(locale, missingField)
          );
        } else {
          setPhaseState("assistant_replied");
          setLiveAnnouncement(visibleReply);
        }
      } catch (error) {
        if (controller.signal.aborted || !isCurrentRequest()) return;

        const status =
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          typeof (error as { status?: unknown }).status === "number"
            ? (error as { status: number }).status
            : 0;
        const message = apiErrorMessage(status);

        setErrorMessage(message);
        setLiveAnnouncement("");
        setPhaseState(
          expectedConversationId
            ? nextMissing
              ? "clarification_needed"
              : "assistant_replied"
            : "assistant_replied"
        );
      } finally {
        if (isCurrentRequest()) {
          setBusy(false);
          busyRef.current = false;
          requestControllerRef.current = null;
          finishFocus();
        }
      }
    },
    [
      apiErrorMessage,
      applyConversationAnchor,
      finishFocus,
      isNearBottom,
      locale,
      nextMissing,
      nextTurnId,
      router,
      t,
    ]
  );

  const placeholder =
    conversationId || turns.length > 0
      ? t("followUpPlaceholder")
      : t("placeholder");

  function onComposerChange(nextValue: string) {
    setValue(nextValue);
    setErrorMessage("");

    if (turns.length === 0 && !busy) {
      setPhaseState(nextValue.trim() ? "typing" : "empty");
    }
  }

  return (
    <section
      data-testid="assistant-thread"
      data-state={phaseState}
      data-continuity={
        conversationId ? "conversation-id" : "new-conversation"
      }
      className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-col px-4 sm:px-6 lg:h-dvh lg:px-8"
    >
      <div
        ref={scrollRef}
        onScroll={() => {
          nearBottomRef.current = isNearBottom();
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 pt-6 sm:pt-10 lg:pt-12"
      >
        {empty ? (
          <div className="flex min-h-full flex-col justify-center pb-8 sm:pb-12">
            <h1 className="text-balance text-center text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {translateKlyxAssistantHome(locale, "organizeTitle")}
            </h1>

            <div className="mx-auto mt-7 w-full max-w-2xl">
              <AssistantComposer
                locale={locale}
                value={value}
                onChange={onComposerChange}
                onSubmit={(message) => void submitMessage(message)}
                onPhoto={() => router.push("/request/photo")}
                onError={setErrorMessage}
                busy={busy}
                placeholder={placeholder}
                textareaRef={textareaRef}
                formRef={composerFormRef}
              />

              <div className="mt-4 flex justify-center">
                <SuggestionGroup
                  suggestions={starters}
                  ariaLabel={t("starterSuggestionsLabel")}
                  onSelect={(suggestion) => {
                    setValue(suggestion.value);
                    setPhaseState("typing");
                    setErrorMessage("");
                    requestAnimationFrame(() =>
                      textareaRef.current?.focus()
                    );
                  }}
                />
              </div>

              {errorMessage && (
                <p
                  role="alert"
                  className="mt-3 text-center text-sm font-medium text-rose-600 dark:text-rose-300"
                >
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <h1 className="sr-only">KLYX Assistant</h1>
            <ol
              aria-label={t("conversationLabel")}
              className="space-y-6"
            >
              {turns.map((turn) => (
                <li key={turn.id}>
                  {turn.role === "user" ? (
                    <UserTurn content={turn.content} />
                  ) : turn.role === "ready" ? (
                    <ReadyForSearchSummary
                      locale={locale}
                      summary={turn.summary}
                      budget={turn.budget}
                    />
                  ) : nextMissing && turn.id === turns.at(-1)?.id ? (
                    <ClarificationTurn content={turn.content} />
                  ) : (
                    <KlyxTurn
                      content={turn.content}
                      variant={turn.variant}
                      action={turn.action}
                    />
                  )}
                </li>
              ))}

              {busy && (
                <li>
                  <KlyxTurn
                    content={t("thinking")}
                    variant="thinking"
                  />
                </li>
              )}
            </ol>

            {quickReplies.length > 0 && !busy && !ready && (
              <div className="mt-5">
                <SuggestionGroup
                  suggestions={quickReplies}
                  ariaLabel={t("quickRepliesLabel")}
                  onSelect={(suggestion) => {
                    void submitMessage(suggestion.value, {
                      forceFocus: true,
                    });
                  }}
                />
              </div>
            )}

            {errorMessage && (
              <p
                role="alert"
                className="mt-4 text-sm font-medium text-rose-600 dark:text-rose-300"
              >
                {errorMessage}
              </p>
            )}
            <div ref={bottomRef} aria-hidden="true" />
          </>
        )}
      </div>

      {!empty && (
        <div className="shrink-0 border-t border-border/70 bg-background/96 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/8">
          <AssistantComposer
            locale={locale}
            value={value}
            onChange={onComposerChange}
            onSubmit={(message) => void submitMessage(message)}
            onPhoto={() => router.push("/request/photo")}
            onError={setErrorMessage}
            busy={busy}
            placeholder={placeholder}
            textareaRef={textareaRef}
            formRef={composerFormRef}
          />
        </div>
      )}

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveAnnouncement}
      </div>

      {/*
        Phase B continuity contract: `conversationId` is the only durable UX
        anchor. The current backend has no transcript hydration endpoint that
        can faithfully restore the previously visible AI wording after refresh,
        so this component intentionally does not persist transcript/payload data
        in localStorage and does not invent a GET API.
      */}
    </section>
  );
}
