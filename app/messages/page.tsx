"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  UserRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { getActiveProfileAccount } from "@/lib/account-switcher";
import {
  resolveKlyxMessagesPageLocale,
  translateKlyxMessagesPage,
  type KlyxMessagesPageMessageKey,
} from "@/lib/klyx-messages-page-i18n";
import type { KlyxLocale } from "@/lib/klyx-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_MESSAGES_OVERVIEW_READ_ONLY
// KLYX_MESSAGES_PAGE_I18N

type MessageRow = {
  id: string;
  booking_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

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

type ConversationItem = {
  booking: BookingRow;
  latestMessage: MessageRow;
  otherProfile: ProfileRow | null;
  unreadCount: number;
  latestIsMine: boolean;
};

type ConversationAccumulator = {
  latestMessage: MessageRow;
  unreadCount: number;
};

const LOCALE_TAGS = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-DE",
} as const;

function localeTag(locale: KlyxLocale) {
  return LOCALE_TAGS[resolveKlyxMessagesPageLocale(locale)];
}

function profileName(profile: ProfileRow | null, fallback: string) {
  if (!profile) {
    return fallback;
  }

  return (
    profile.full_name?.trim() ||
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    fallback
  );
}

function formatBookingDate(value: string, locale: KlyxLocale) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatMessageTime(value: string, locale: KlyxLocale) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function MessagesPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxMessagesPageMessageKey) =>
    translateKlyxMessagesPage(locale, key);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  const loadConversations = useCallback(async () => {
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

      const activeProfile = await getActiveProfileAccount();
      const profileId = activeProfile.id;

      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .select(
          "id, booking_id, sender_id, receiver_id, message, is_read, created_at"
        )
        .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (messageError) {
        throw new Error("messages_read_failed");
      }

      const messages = (messageData ?? []) as MessageRow[];

      if (messages.length === 0) {
        setConversations([]);
        return;
      }

      const grouped = new Map<string, ConversationAccumulator>();

      for (const message of messages) {
        const current = grouped.get(message.booking_id);

        if (!current) {
          grouped.set(message.booking_id, {
            latestMessage: message,
            unreadCount:
              message.receiver_id === profileId && !message.is_read ? 1 : 0,
          });
          continue;
        }

        if (message.receiver_id === profileId && !message.is_read) {
          current.unreadCount += 1;
        }
      }

      const bookingIds = Array.from(grouped.keys());
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          "id, parent_id, babysitter_id, booking_date, start_time, end_time, status"
        )
        .in("id", bookingIds);

      if (bookingError) {
        throw new Error("bookings_read_failed");
      }

      const bookings = ((bookingData ?? []) as BookingRow[]).filter(
        (booking) =>
          booking.parent_id === profileId || booking.babysitter_id === profileId
      );

      const otherProfileIds = Array.from(
        new Set(
          bookings.map((booking) =>
            booking.parent_id === profileId
              ? booking.babysitter_id
              : booking.parent_id
          )
        )
      );

      let profiles: ProfileRow[] = [];

      if (otherProfileIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name, avatar_url")
          .in("id", otherProfileIds);

        if (profileError) {
          throw new Error("profiles_read_failed");
        }

        profiles = (profileData ?? []) as ProfileRow[];
      }

      const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
      const nextConversations: ConversationItem[] = [];

      for (const booking of bookings) {
        const aggregate = grouped.get(booking.id);

        if (!aggregate) {
          continue;
        }

        const otherProfileId =
          booking.parent_id === profileId
            ? booking.babysitter_id
            : booking.parent_id;

        nextConversations.push({
          booking,
          latestMessage: aggregate.latestMessage,
          otherProfile: profileById.get(otherProfileId) ?? null,
          unreadCount: aggregate.unreadCount,
          latestIsMine: aggregate.latestMessage.sender_id === profileId,
        });
      }

      nextConversations.sort(
        (left, right) =>
          new Date(right.latestMessage.created_at).getTime() -
          new Date(left.latestMessage.created_at).getTime()
      );

      setConversations(nextConversations);
    } catch {
      setErrorMessage(translateKlyxMessagesPage(locale, "loadError"));
    } finally {
      setLoading(false);
    }
  }, [locale, router]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              {t("description")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadConversations()}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("retry")}
          </button>
        </header>

        {loading ? (
          <section className="mt-8 flex min-h-32 items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6">
            <LoaderCircle className="animate-spin text-blue-600" size={20} />
            <p className="text-sm font-medium text-muted-foreground">
              {t("loading")}
            </p>
          </section>
        ) : errorMessage ? (
          <section className="mt-8 rounded-2xl border border-red-500/25 bg-red-500/8 p-6">
            <p className="font-semibold">{t("errorTitle")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted"
            >
              <RefreshCw size={16} />
              {t("retry")}
            </button>
          </section>
        ) : conversations.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-600/8 text-blue-600">
              <MessageCircle size={22} />
            </span>
            <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {conversations.map((conversation, index) => {
              const name = profileName(conversation.otherProfile, t("unknownUser"));

              return (
                <Link
                  key={conversation.booking.id}
                  href={"/messages/" + conversation.booking.id}
                  className={`group flex items-center gap-4 p-4 transition hover:bg-muted/60 sm:p-5 ${
                    index > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                    {conversation.otherProfile?.avatar_url ? (
                      <img
                        src={conversation.otherProfile.avatar_url}
                        alt={name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound size={21} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold">{name}</h2>
                      {conversation.unreadCount > 0 && (
                        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                          {conversation.unreadCount}{" "}
                          {conversation.unreadCount === 1
                            ? t("unreadSingle")
                            : t("unreadPlural")}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 size={12} />
                      {formatBookingDate(conversation.booking.booking_date, locale)} ·{" "}
                      {formatTime(conversation.booking.start_time)}–
                      {formatTime(conversation.booking.end_time)}
                    </p>

                    <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">
                      {conversation.latestIsMine ? `${t("youPrefix")} ` : ""}
                      {conversation.latestMessage.message}
                    </p>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatMessageTime(conversation.latestMessage.created_at, locale)}
                    </p>
                  </div>

                  <span className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-blue-600 sm:inline-flex">
                    {t("openConversation")}
                    <ArrowRight
                      size={16}
                      className="transition group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
