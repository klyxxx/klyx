"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ActionItem = {
  id: string;
  priority: number;
};

type ActionsResponse = {
  actions?: ActionItem[];
  count?: number;
};

async function accessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export default function AssistantPriorityBadge() {
  const [count, setCount] = useState(0);
  const [urgent, setUrgent] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await accessToken();

      if (!token) {
        setCount(0);
        setUrgent(false);
        return;
      }

      const response = await fetch("/api/brain/actions", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as ActionsResponse;
      const actions = Array.isArray(body.actions)
        ? body.actions
        : [];

      setCount(
        typeof body.count === "number"
          ? body.count
          : actions.length
      );

      setUrgent(
        actions.some(
          (action) =>
            Number(action.priority) >= 95
        )
      );
    } catch {
      // Le badge ne doit jamais bloquer la navigation.
    }
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(
      () => {
        void load();
      },
      30000
    );

    const onVisible = () => {
      if (
        document.visibilityState === "visible"
      ) {
        void load();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisible
    );

    return () => {
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        onVisible
      );
    };
  }, [load]);

  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={`${count} action${
        count > 1 ? "s" : ""
      } KLYX`}
      title={`${count} action${
        count > 1 ? "s" : ""
      } KLYX`}
      className={`ml-auto inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
        urgent
          ? "bg-rose-500 text-white"
          : "bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
