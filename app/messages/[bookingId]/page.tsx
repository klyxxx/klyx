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
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile } from "@/lib/account-switcher";

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
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [otherUser, setOtherUser] = useState<ProfileRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const bookingId = params.bookingId;

  const otherUserName = useMemo(() => {
    if (!otherUser) {
      return "Utilisateur KLYX";
    }

    return (
      otherUser.full_name?.trim() ||
      `${otherUser.first_name ?? ""} ${otherUser.last_name ?? ""}`.trim() ||
      "Utilisateur KLYX"
    );
  }, [otherUser]);

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
    setErrorMessage("");

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
        throw new Error("Conversation introuvable.");
      }

      const activeProfile = await getActiveClientProfile();
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
        throw new Error(bookingError.message);
      }

      if (!bookingData) {
        throw new Error("Réservation introuvable.");
      }

      const typedBooking = bookingData as BookingRow;
      const isParticipant =
        typedBooking.parent_id === activeProfileId ||
        typedBooking.babysitter_id === activeProfileId;

      if (!isParticipant) {
        throw new Error("Tu n'as pas accès à cette conversation.");
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

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (messageError) {
        throw new Error(messageError.message);
      }

      setOtherUser((profileData as ProfileRow | null) ?? null);
      setMessages((messageData ?? []) as MessageRow[]);

      await markMessagesAsRead(activeProfileId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger la conversation."
      );
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
    setErrorMessage("");

    try {
      const { error } = await supabase.from("messages").insert({
        booking_id: booking.id,
        sender_id: currentUserId,
        receiver_id: receiverId,
        message: content,
        is_read: false,
      });

      if (error) {
        throw new Error(error.message);
      }

      setDraft("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer le message."
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 text-foreground dark:text-white">
        Chargement...
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 px-6 text-center text-foreground dark:text-white">
        <div>
          <h1 className="text-2xl font-bold">Conversation indisponible</h1>
          <p className="mt-3 text-red-400">{errorMessage}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-violet-600 px-6 py-3 font-semibold"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background dark:bg-zinc-950 px-4 py-6 text-foreground dark:text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col overflow-hidden rounded-3xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900">
        <header className="flex items-center gap-4 border-b border-border dark:border-zinc-800 p-4 sm:p-6">
          <Link
            href="/dashboard"
            className="rounded-xl border border-border dark:border-zinc-700 px-3 py-2 text-sm text-foreground/80 dark:text-zinc-300 hover:bg-muted dark:bg-zinc-800"
          >
            Retour
          </Link>

          <img
            src={
              otherUser?.avatar_url ||
              "https://placehold.co/100x100?text=KLYX"
            }
            alt={otherUserName}
            className="h-12 w-12 rounded-full object-cover"
          />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{otherUserName}</h1>
            <p className="truncate text-sm text-muted-foreground dark:text-zinc-400">
              {formatDate(booking.booking_date)} ·{" "}
              {formatTime(booking.start_time)}–{formatTime(booking.end_time)}
            </p>
          </div>

          <span className="rounded-full border border-border dark:border-zinc-700 px-3 py-1 text-xs text-foreground/80 dark:text-zinc-300">
            {booking.status}
          </span>
        </header>

        {errorMessage && (
          <div className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && (
            <div className="py-16 text-center text-muted-foreground dark:text-zinc-500">
              Aucun message. Commence la conversation.
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
                  className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[70%] ${
                    isMine
                      ? "rounded-br-md bg-violet-600 text-white"
                      : "rounded-bl-md bg-muted dark:bg-zinc-800 text-foreground dark:text-zinc-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {message.message}
                  </p>

                  <div
                    className={`mt-2 flex items-center justify-end gap-2 text-xs ${
                      isMine ? "text-violet-200" : "text-muted-foreground dark:text-zinc-500"
                    }`}
                  >
                    <span>{formatMessageTime(message.created_at)}</span>
                    {isMine && (
                      <span>{message.is_read ? "Lu" : "Envoyé"}</span>
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
          className="flex gap-3 border-t border-border dark:border-zinc-800 p-4 sm:p-6"
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
            placeholder="Écris un message..."
            className="min-h-12 flex-1 resize-none rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
          />

          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-xl bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Envoi..." : "Envoyer"}
          </button>
        </form>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
