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

  const [notifications, setNotifications] =
    useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] =
    useState<string | null>(null);
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

      const profileResponse = await fetch(
        "/api/profiles/active",
        {
          method: "GET",
          cache: "no-store",
        }
      );

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
          (profile) =>
            profile.id ===
            profileBody.activeProfileId
        ) ?? profileBody.profiles?.[0];

      if (!activeProfile) {
        throw new Error("active_profile_not_found");
      }

      const { data, error } = await supabase
        .from("user_notifications")
        .select(
          "id, type, title, message, href, read_at, created_at"
        )
        .eq("user_id", activeProfile.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw new Error("notifications_read_failed");
      }

      setNotifications(
        (data ?? []) as NotificationRow[]
      );
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
      notifications.filter(
        (notification) =>
          notification.read_at === null
      ).length,
    [notifications]
  );

  async function markRead(
    notificationId: string
  ) {
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

      const response = await fetch(
        "/api/notifications/read",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            notificationId,
          }),
        }
      );

      await response.json();

      if (!response.ok) {
        throw new Error("notification_mark_read_failed");
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                read_at:
                  new Date().toISOString(),
              }
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

      const response = await fetch(
        "/api/notifications/read",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            markAll: true,
          }),
        }
      );

      await response.json();

      if (!response.ok) {
        throw new Error("notifications_mark_all_read_failed");
      }

      const now = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at:
            notification.read_at ?? now,
        }))
      );
    } catch {
      setErrorKey("actionError");
    } finally {
      setActiveAction(null);
    }
  }

  async function openNotification(
    notification: NotificationRow
  ) {
    if (!notification.read_at) {
      await markRead(notification.id);
    }

    if (notification.href) {
      router.push(notification.href);
    }
  }

  const errorMessage = errorKey ? t(errorKey) : "";

  return (
    <main className="min-h-screen bg-background dark:bg-zinc-950 px-5 py-10 text-foreground dark:text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:text-white"
            >
              {t("backDashboard")}
            </Link>

            <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
              {t("title")}
            </h1>

            <p className="mt-3 text-muted-foreground dark:text-zinc-400">
              {formatKlyxNotificationsUnreadSummary(locale, unreadCount)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void loadNotifications()
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border dark:border-zinc-700 px-4 py-3 font-semibold hover:bg-card dark:bg-zinc-900 disabled:opacity-50"
            >
              <RefreshCw
                size={18}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              {t("refresh")}
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  void markAllRead()
                }
                disabled={
                  activeAction === "all"
                }
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-semibold hover:bg-violet-700 disabled:opacity-50"
              >
                <CheckCheck size={18} />
                {t("markAllRead")}
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="mt-10 rounded-2xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 p-8 text-center text-muted-foreground dark:text-zinc-400">
            {t("loading")}
          </div>
        ) : notifications.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 p-8 text-center">
            <Bell
              size={36}
              className="mx-auto text-zinc-600"
            />

            <h2 className="mt-4 text-xl font-bold">
              {t("emptyTitle")}
            </h2>

            <p className="mt-2 text-muted-foreground dark:text-zinc-400">
              {t("emptyBody")}
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {notifications.map(
              (notification) => {
                const unread =
                  notification.read_at === null;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() =>
                      void openNotification(
                        notification
                      )
                    }
                    disabled={
                      activeAction ===
                      notification.id
                    }
                    className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition disabled:opacity-60 ${
                      unread
                        ? "border-violet-500/30 bg-violet-500/10"
                        : "border-border dark:border-zinc-800 bg-card dark:bg-zinc-900"
                    }`}
                  >
                    <div
                      className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        unread
                          ? "bg-violet-600 text-white"
                          : "bg-muted dark:bg-zinc-800 text-muted-foreground dark:text-zinc-500"
                      }`}
                    >
                      {unread ? (
                        <Bell size={18} />
                      ) : (
                        <Circle size={16} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h2 className="font-bold">
                          {notification.title}
                        </h2>

                        <span className="text-xs text-muted-foreground dark:text-zinc-500">
                          {new Date(
                            notification.created_at
                          ).toLocaleString(
                            getKlyxNotificationsLocaleTag(locale)
                          )}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-foreground/80 dark:text-zinc-300">
                        {notification.message}
                      </p>
                    </div>

                    {notification.href && (
                      <ChevronRight
                        size={20}
                        className="mt-2 shrink-0 text-muted-foreground dark:text-zinc-500"
                      />
                    )}
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>
    </main>
  );
}
