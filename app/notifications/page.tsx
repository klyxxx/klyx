"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Circle,
  RefreshCw,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { supabase } from "@/lib/supabase";
import {
  formatKlyxNotificationsUnreadSummary,
  getKlyxNotificationsLocaleTag,
  translateKlyxNotifications,
  type KlyxNotificationsMessageKey,
} from "@/lib/klyx-notifications-page-i18n";

// KLYX_NOTIFICATIONS_I18N
// KLYX_NOTIFICATIONS_SAFE_ERRORS

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxNotificationsMessageKey) =>
    translateKlyxNotifications(locale, key);

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [errorKey, setErrorKey] =
    useState<KlyxNotificationsMessageKey | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        router.replace("/login");
        return;
      }

      const profileResponse = await fetch("/api/profiles/active", {
        method: "GET",
        cache: "no-store",
      });

      const profileBody = (await profileResponse.json()) as {
        profiles?: Array<{
          id: string;
          accountType: "client" | "provider";
        }>;
        activeProfileId?: string | null;
      };

      if (!profileResponse.ok) {
        throw new Error("active_profile_request_failed");
      }

      const activeProfile =
        profileBody.profiles?.find(
          (profile) => profile.id === profileBody.activeProfileId
        ) ?? profileBody.profiles?.[0];

      if (!activeProfile) {
        throw new Error("active_profile_not_found");
      }

      const { data, error } = await supabase
        .from("user_notifications")
        .select("id, type, title, message, href, read_at, created_at")
        .eq("user_id", activeProfile.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error("notifications_read_failed");
      }

      setNotifications((data ?? []) as NotificationRow[]);
    } catch {
      setErrorKey("loadError");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () =>
      notifications.filter((notification) => notification.read_at === null)
        .length,
    [notifications]
  );

  async function markRead(notificationId: string) {
    setActiveAction(notificationId);
    setErrorKey(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          notificationId,
        }),
      });

      await response.json();

      if (!response.ok) {
        throw new Error("notification_mark_read_failed");
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read_at: new Date().toISOString() }
            : notification
        )
      );
    } catch {
      setErrorKey("actionError");
    } finally {
      setActiveAction(null);
    }
  }

  async function markAllRead() {
    setActiveAction("all");
    setErrorKey(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          markAll: true,
        }),
      });

      await response.json();

      if (!response.ok) {
        throw new Error("notifications_mark_all_read_failed");
      }

      const now = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? now,
        }))
      );
    } catch {
      setErrorKey("actionError");
    } finally {
      setActiveAction(null);
    }
  }

  async function openNotification(notification: NotificationRow) {
    if (!notification.read_at) {
      await markRead(notification.id);
    }

    if (notification.href) {
      router.push(notification.href);
    }
  }

  const errorMessage = errorKey ? t(errorKey) : "";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              ← KLYX
            </Link>

            <h1 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              {formatKlyxNotificationsUnreadSummary(locale, unreadCount)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadNotifications()}
              disabled={loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
              {t("refresh")}
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={activeAction === "all"}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                <CheckCheck size={17} />
                {t("markAllRead")}
              </button>
            )}
          </div>
        </header>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/8 p-5 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex min-h-36 items-center justify-center rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            {t("loading")}
          </div>
        ) : notifications.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-600/8 text-blue-600">
              <Bell size={22} />
            </span>
            <h2 className="mt-4 text-xl font-semibold">{t("emptyTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("emptyBody")}
            </p>
          </div>
        ) : (
          <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {notifications.map((notification, index) => {
              const unread = notification.read_at === null;

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  disabled={activeAction === notification.id}
                  className={`flex w-full items-start gap-4 p-5 text-left transition hover:bg-muted/60 disabled:opacity-60 ${
                    index > 0 ? "border-t border-border" : ""
                  } ${unread ? "bg-blue-600/[0.035]" : "bg-card"}`}
                >
                  <span
                    className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                      unread
                        ? "bg-blue-600/10 text-blue-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {unread ? <Bell size={18} /> : <Circle size={16} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className={unread ? "font-semibold" : "font-medium"}>
                        {notification.title}
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleString(
                          getKlyxNotificationsLocaleTag(locale)
                        )}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-foreground/75">
                      {notification.message}
                    </p>
                  </div>

                  {notification.href && (
                    <ChevronRight
                      size={19}
                      className="mt-2 shrink-0 text-muted-foreground"
                    />
                  )}
                </button>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
