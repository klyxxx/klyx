"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { ArrowLeft, LoaderCircle, Send, UserRound } from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { getActiveProfileAccount } from "@/lib/account-switcher";
import type { KlyxLocale } from "@/lib/klyx-i18n";
import {
  getKlyxMessageConversationLocaleTag,
  translateKlyxMessageConversation,
  type KlyxMessageConversationMessageKey,
} from "@/lib/klyx-message-conversation-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_MESSAGE_CONVERSATION_I18N
// KLYX_MESSAGE_CONVERSATION_SAFE_ERRORS
// KLYX_MESSAGE_CONVERSATION_ROLE_AWARE
// KLYX_MESSAGE_CONVERSATION_SINGLE_BLUE
// KLYX_MESSAGE_CONVERSATION_MOBILE_SAFE_VIEWPORT

type BookingRow = {
  id: string;
  parent_id: string;
  babysitter_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type MessageRow = {
  id: string;
  booking_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function ConversationPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const t = (key: KlyxMessageConversationMessageKey) =>
    translateKlyxMessageConversation(locale, key);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [otherUser, setOtherUser] = useState<ProfileRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [errorKey, setErrorKey] =
    useState<KlyxMessageConversationMessageKey | null>(null);

  const bookingId = params.bookingId;
  const errorMessage = errorKey ? t(errorKey) : "";
  const unknownUserName = t("unknownUser");

  const otherUserName = useMemo(() => {
    if (!otherUser) {
      return unknownUserName;
    }

    return (
      otherUser.full_name?.trim() ||
      `${otherUser.first_name ?? ""} ${otherUser.last_name ?? ""}`.trim() ||
      unknownUserName
    );
  }, [otherUser, unknownUserName]);

  const markMessagesAsRead = useCallback(
    async (userId: string) => {
      if (!bookingId) {
        return;
      }

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("booking_id", bookingId)
        .eq("receiver_id", userId)
        .eq("is_read", false);
    },
    [bookingId]
  );

  const loadConversation = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      if (!bookingId) {
        setErrorKey("conversationNotFound");
        return;
      }

      const activeProfile = await getActiveProfileAccount();
      const activeProfileId = activeProfile.id;

      setCurrentUserId(activeProfileId);

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          "id, parent_id, babysitter_id, booking_date, start_time, end_time, status"
        )
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingError) {
        throw new Error("booking_read_failed");
      }

      if (!bookingData) {
        setErrorKey("bookingNotFound");
        return;
      }

      const typedBooking = bookingData as BookingRow;
      const isParticipant =
        typedBooking.parent_id === activeProfileId ||
        typedBooking.babysitter_id === activeProfileId;

      if (!isParticipant) {
        setErrorKey("accessDenied");
        return;
      }

      setBooking(typedBooking);

      const otherUserId =
        typedBooking.parent_id === activeProfileId
          ? typedBooking.babysitter_id
          : typedBooking.parent_id;

      const [
        { data: profileData, error: profileError },
        { data: messageData, error: messageError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name, avatar_url")
          .eq("id", otherUserId)
          .maybeSingle(),
        supabase
          .from("messages")
          .select(
            "id, booking_id, sender_id, receiver_id, message, is_read, created_at"
          )
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: true }),
      ]);

      if (profileError || messageError) {
        throw new Error("conversation_read_failed");
      }

      setOtherUser((profileData as ProfileRow | null) ?? null);
      setMessages((messageData ?? []) as MessageRow[]);

      await markMessagesAsRead(activeProfileId);
    } catch {
      setErrorKey("loadError");
    } finally {
      setLoading(false);
    }
  }, [bookingId, markMessagesAsRead, router]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!bookingId || !currentUserId) {
      return;
    }

    const channel = supabase
      .channel(`booking-messages-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `booking_id=eq.${bookingId}`,
        },
        async (
          payload: RealtimePostgresChangesPayload<MessageRow>
        ) => {
          const newMessage = payload.new as MessageRow;

          setMessages((currentMessages) => {
            const exists = currentMessages.some(
              (message) => message.id === newMessage.id
            );

            return exists
              ? currentMessages
              : [...currentMessages, newMessage];
          });

          if (newMessage.receiver_id === currentUserId) {
            await supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();

    if (!content || !booking || !currentUserId) {
      return;
    }

    const receiverId =
      booking.parent_id === currentUserId
        ? booking.babysitter_id
        : booking.parent_id;

    setSending(true);
    setErrorKey(null);

    try {
      const { error } = await supabase.from("messages").insert({
        booking_id: booking.id,
        sender_id: currentUserId,
        receiver_id: receiverId,
        message: content,
        is_read: false,
      });

      if (error) {
        setErrorKey(
          error.message.includes("KLYX_MESSAGE_RATE_LIMITED")
            ? "rateLimited"
            : "sendError"
        );
        return;
      }

      setDraft("");
    } catch {
      setErrorKey("sendError");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <LoaderCircle className="animate-spin text-blue-600" size={20} />
          {t("loading")}
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold tracking-[-0.03em]">
            {t("unavailableTitle")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-red-600 dark:text-red-300">
            {errorMessage}
          </p>
          <Link
            href="/messages"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <ArrowLeft size={17} />
            {t("backMessagesFull")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background px-3 py-4 text-foreground sm:px-6 lg:min-h-screen lg:py-8">
      <div className="mx-auto flex h-[calc(100dvh_-_10rem_-_env(safe-area-inset-bottom))] min-h-0 max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:h-[calc(100vh-4rem)]">
        <header className="flex items-center gap-3 border-b border-border p-4 sm:gap-4 sm:p-5">
          <Link
            href="/messages"
            aria-label={t("back")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-muted sm:h-12 sm:w-12">
            {otherUser?.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt={otherUserName}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound size={20} className="text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {otherUserName}
            </h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {formatDate(booking.booking_date, locale)} ·{" "}
              {formatTime(booking.start_time)}–{formatTime(booking.end_time)}
            </p>
          </div>

          <span className="hidden rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
            {booking.status}
          </span>
        </header>

        {errorMessage && (
          <div className="mx-4 mt-4 rounded-xl border border-red-500/25 bg-red-500/8 p-3 text-sm text-red-700 dark:text-red-300 sm:mx-5">
            {errorMessage}
          </div>
        )}

        <section className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 && (
            <div className="grid min-h-48 place-items-center text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          )}

          {messages.map((message) => {
            const isMine = message.sender_id === currentUserId;

            return (
              <div
                key={message.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${
                    isMine
                      ? "rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">
                    {message.message}
                  </p>

                  <div
                    className={`mt-1.5 flex items-center justify-end gap-2 text-[11px] ${
                      isMine ? "text-blue-100" : "text-muted-foreground"
                    }`}
                  >
                    <span>{formatMessageTime(message.created_at, locale)}</span>
                    {isMine && (
                      <span>{message.is_read ? t("read") : t("sent")}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </section>

        <form
          onSubmit={sendMessage}
          className="flex shrink-0 items-end gap-2 border-t border-border bg-card p-3 sm:gap-3 sm:p-4"
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={t("placeholder")}
            className="min-h-12 max-h-36 flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-blue-600/45 focus:ring-4 focus:ring-blue-600/8"
          />

          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
          >
            {sending ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <Send size={17} />
            )}
            <span className="hidden sm:inline">
              {sending ? t("sending") : t("send")}
            </span>
          </button>
        </form>
      </div>
    </main>
  );
}

function formatDate(value: string, locale: KlyxLocale) {
  const date = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat(
    getKlyxMessageConversationLocaleTag(locale),
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatMessageTime(value: string, locale: KlyxLocale) {
  const date = new Date(value);

  return new Intl.DateTimeFormat(
    getKlyxMessageConversationLocaleTag(locale),
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}
