"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  user_id: string;
  read_at: string | null;
};

type NotificationButtonProps = {
  userId: string;
};

export default function NotificationButton({
  userId,
}: NotificationButtonProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadUnreadCount() {
      if (!userId) {
        if (mounted) {
          setUnreadCount(0);
          setLoading(false);
        }

        return;
      }

      const { count, error } = await supabase
        .from("notifications")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId)
        .is("read_at", null);

      if (!mounted) {
        return;
      }

      if (error) {
        console.error(
          "Impossible de charger les notifications :",
          error
        );

        setUnreadCount(0);
      } else {
        setUnreadCount(count ?? 0);
      }

      setLoading(false);
    }

    loadUnreadCount();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (
          payload: RealtimePostgresChangesPayload<NotificationRow>
        ) => {
          const newNotification = payload.new as NotificationRow;

          if (newNotification.read_at === null) {
            setUnreadCount((currentCount) => currentCount + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (
          payload: RealtimePostgresChangesPayload<NotificationRow>
        ) => {
          const oldNotification = payload.old as Partial<NotificationRow>;
          const newNotification = payload.new as NotificationRow;

          const oldReadAt = oldNotification.read_at ?? null;
          const newReadAt = newNotification.read_at ?? null;

          if (oldReadAt === null && newReadAt !== null) {
            setUnreadCount((currentCount) =>
              Math.max(0, currentCount - 1)
            );
          }

          if (oldReadAt !== null && newReadAt === null) {
            setUnreadCount((currentCount) => currentCount + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (
          payload: RealtimePostgresChangesPayload<NotificationRow>
        ) => {
          const deletedNotification =
            payload.old as Partial<NotificationRow>;

          if (deletedNotification.read_at === null) {
            setUnreadCount((currentCount) =>
              Math.max(0, currentCount - 1)
            );
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const displayedCount =
    unreadCount > 99 ? "99+" : unreadCount.toString();

  return (
    <Link
      href="/notifications"
      aria-label={
        unreadCount > 0
          ? `${unreadCount} notification${
              unreadCount > 1 ? "s" : ""
            } non lue${unreadCount > 1 ? "s" : ""}`
          : "Notifications"
      }
      className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-card-foreground shadow-sm transition hover:bg-muted"
    >
      <Bell
        size={21}
        className={loading ? "animate-pulse" : ""}
      />

      {!loading && unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white ring-2 ring-background">
          {displayedCount}
        </span>
      )}
    </Link>
  );
}