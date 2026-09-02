"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
// KLYX_MESSAGES_DESTINATION_2026_09_02

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

function ConversationAvatar({
  conversation,
  name,
  large = false,
}: {
  conversation: ConversationItem;
  name: string;
  large?: boolean;
}) {
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted ${
        large ? "h-14 w-14" : "h-11 w-11"
      }`}
    >
      {conversation.otherProfile?.avatar_url ? (
        <img
          src={conversation.otherProfile.avatar_url}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserRound size={large ? 22 : 19} />
      )}
    </div>
  );
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

  const primaryConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.unreadCount > 0) ??
      conversations[0] ??
      null,
    [conversations]
  );

  const remainingConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation.booking.id !== primaryConversation?.booking.id
      ),
    [conversations, primaryConversation]
  );

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-5">
          <div className="max-w-2xl">
            <h1 className="klyx-title text-3xl sm:text-5xl">{t("title")}</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              {t("description")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadConversations()}
            disabled={loading}
            aria-label={t("retry")}
            title={t("retry")}
            className="mt-1 inline-grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {loading ? (
          <div className="mt-10 grid min-h-48 place-items-center">
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
              <LoaderCircle className="animate-spin text-blue-600" size={20} />
              {t("loading")}
            </div>
          </div>
        ) : errorMessage ? (
          <section className="mt-8 border-y border-border py-6">
            <p className="font-semibold">{t("errorTitle")}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="klyx-button mt-5 inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
            >
              <RefreshCw size={16} />
              {t("retry")}
            </button>
          </section>
        ) : conversations.length === 0 ? (
          <section className="mt-10 border-y border-border py-10 text-center">
            <MessageCircle size={24} className="mx-auto text-blue-600" />
            <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </section>
        ) : (
          <>
            {primaryConversation && (
              <section className="mt-8 border-y border-border py-5 sm:py-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <ConversationAvatar
                      conversation={primaryConversation}
                      name={profileName(
                        primaryConversation.otherProfile,
                        t("unknownUser")
                      )}
                      large
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold tracking-[-0.02em]">
                          {profileName(
                            primaryConversation.otherProfile,
                            t("unknownUser")
                          )}
                        </h2>
                        {primaryConversation.unreadCount > 0 && (
                          <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                            {primaryConversation.unreadCount}{" "}
                            {primaryConversation.unreadCount === 1
                              ? t("unreadSingle")
                              : t("unreadPlural")}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 size={12} />
                        {formatBookingDate(
                          primaryConversation.booking.booking_date,
                          locale
                        )}{" "}
                        · {formatTime(primaryConversation.booking.start_time)}–
                        {formatTime(primaryConversation.booking.end_time)}
                      </p>

                      <p className="mt-3 line-clamp-2 max-w-2xl break-words text-sm leading-6 text-muted-foreground">
                        {primaryConversation.latestIsMine
                          ? `${t("youPrefix")} `
                          : ""}
                        {primaryConversation.latestMessage.message}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={"/messages/" + primaryConversation.booking.id}
                    className="klyx-button inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm font-semibold"
                  >
                    {t("openConversation")}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </section>
            )}

            {remainingConversations.length > 0 && (
              <section
                className="mt-6 border-b border-border"
                aria-label={t("title")}
              >
                {remainingConversations.map((conversation) => {
                  const name = profileName(
                    conversation.otherProfile,
                    t("unknownUser")
                  );

                  return (
                    <Link
                      key={conversation.booking.id}
                      href={"/messages/" + conversation.booking.id}
                      className="group flex items-center gap-4 border-t border-border py-4 transition hover:bg-muted/30 sm:px-1 sm:py-5"
                    >
                      <ConversationAvatar
                        conversation={conversation}
                        name={name}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-sm font-semibold sm:text-base">
                            {name}
                          </h2>
                          {conversation.unreadCount > 0 && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
                              aria-label={`${conversation.unreadCount} ${
                                conversation.unreadCount === 1
                                  ? t("unreadSingle")
                                  : t("unreadPlural")
                              }`}
                            />
                          )}
                        </div>

                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {conversation.latestIsMine ? `${t("youPrefix")} ` : ""}
                          {conversation.latestMessage.message}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatMessageTime(
                            conversation.latestMessage.created_at,
                            locale
                          )}
                        </p>
                      </div>

                      <ArrowRight
                        size={17}
                        className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-blue-600"
                      />
                    </Link>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
