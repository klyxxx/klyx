"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  XCircle,
} from "lucide-react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { getActiveClientProfile } from "@/lib/account-switcher";
import {
  klyxDashboardDateLocale,
  resolveKlyxDashboardLocale,
  translateKlyxDashboard,
  type KlyxDashboardMessageKey,
  type KlyxDashboardMessageValues,
} from "@/lib/klyx-dashboard-i18n";
import { supabase } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  href: string | null;
  type: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationBell() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const resolvedLocale = resolveKlyxDashboardLocale(locale);
  const t = (
    key: KlyxDashboardMessageKey,
    values?: KlyxDashboardMessageValues
  ) => translateKlyxDashboard(locale, key, values);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.read_at === null).length,
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error("notification-auth-failed");
      }

      if (!user) {
        setUserId("");
        setNotifications([]);
        return;
      }

      const activeProfile = await getActiveClientProfile();
      const activeProfileId = activeProfile.id;
      setUserId(activeProfileId);

      const { data, error } = await supabase
        .from("user_notifications")
        .select("id, user_id, title, message, href, type, read_at, created_at")
        .eq("user_id", activeProfileId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        throw new Error("notification-load-failed");
      }

      setNotifications((data ?? []) as NotificationRow[]);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`dashboard-user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
          if (payload.eventType === "DELETE") {
            const deletedNotification = payload.old as Partial<NotificationRow>;

            if (deletedNotification.id) {
              setNotifications((current) =>
                current.filter((item) => item.id !== deletedNotification.id)
              );
            }

            return;
          }

          const notification = payload.new as NotificationRow;
          if (!notification.id) return;

          setNotifications((current) => {
            const exists = current.some((item) => item.id === notification.id);

            if (exists) {
              return current.map((item) =>
                item.id === notification.id ? notification : item
              );
            }

            return [notification, ...current].slice(0, 30);
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function markAsRead(notificationId: string) {
    if (!userId) return;

    setLoadFailed(false);
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: readAt })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      setLoadFailed(true);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, read_at: readAt } : item
      )
    );
  }

  async function markAllAsRead() {
    if (!userId || unreadCount === 0) return;

    setLoadFailed(false);
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) {
      setLoadFailed(true);
      return;
    }

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        read_at: item.read_at ?? readAt,
      }))
    );
  }

  async function openNotification(notification: NotificationRow) {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }

    setOpen(false);

    if (notification.href) {
      router.push(notification.href);
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        aria-label={t("notificationsLabel")}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={20} aria-hidden="true" />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-border px-4 py-4 dark:border-zinc-800">
            <div>
              <h2 className="font-semibold">{t("notificationsLabel")}</h2>
              <p className="text-xs text-muted-foreground dark:text-zinc-500">
                {t("notificationsUnread", {
                  count: unreadCount,
                  suffix:
                    resolvedLocale === "fr" && unreadCount > 1 ? "s" : "",
                })}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={unreadCount === 0}
              className="text-sm font-medium text-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("notificationsMarkAllRead")}
            </button>
          </div>

          {loadFailed && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {t("notificationsLoadFailed")}
            </div>
          )}

          <div className="max-h-[430px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground dark:text-zinc-500">
                {t("notificationsLoading")}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground dark:text-zinc-500">
                {t("notificationsEmpty")}
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className={`block w-full border-b border-zinc-900 px-4 py-4 text-left transition hover:bg-card dark:hover:bg-zinc-900 ${
                    notification.read_at ? "opacity-60" : "bg-violet-500/5"
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="mt-0.5 text-violet-400" aria-hidden="true">
                      {notificationIcon(notification.type)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-foreground dark:text-zinc-100">
                          {notification.title}
                        </p>

                        {!notification.read_at && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                        )}
                      </div>

                      {notification.message && (
                        <p className="mt-1 text-sm text-muted-foreground dark:text-zinc-400">
                          {notification.message}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-zinc-600">
                        {formatDate(notification.created_at, locale)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function notificationIcon(type: string | null) {
  if (type === "booking_new") return <CalendarDays size={19} />;
  if (type === "booking_accepted") return <CheckCircle2 size={19} />;
  if (type === "booking_rejected" || type === "payment_failed") {
    return <XCircle size={19} />;
  }
  if (type === "message_new") return <MessageCircle size={19} />;
  if (type === "payment_client_success" || type === "payment_provider_success") {
    return <CreditCard size={19} />;
  }

  return <Bell size={19} />;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(klyxDashboardDateLocale(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
