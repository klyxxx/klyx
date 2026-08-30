"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { supabase } from "@/lib/supabase";

type ActionItem = {
  id: string;
  title: string;
  description: string;
  href: string;
};

type ActionsResponse = {
  actions?: ActionItem[];
};

function copy(locale: string) {
  if (locale === "en") {
    return { title: "In progress", continue: "Continue" };
  }

  if (locale === "nl") {
    return { title: "Bezig", continue: "Doorgaan" };
  }

  if (locale === "de") {
    return { title: "Läuft", continue: "Fortsetzen" };
  }

  return { title: "En cours", continue: "Continuer" };
}

export default function AssistantHomeResume() {
  const { locale } = useKlyxLocale();
  const labels = copy(locale);
  const [action, setAction] = useState<ActionItem | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;

        const response = await fetch("/api/brain/actions", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) return;

        const body = (await response.json()) as ActionsResponse;
        const firstAction = body.actions?.[0] ?? null;

        if (active) setAction(firstAction);
      } catch {
        // The home remains intentionally quiet if the resume surface is unavailable.
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (!action) return null;

  return (
    <section className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <h2 className="text-lg font-bold tracking-[-0.02em]">{labels.title}</h2>

      <div className="mt-5 flex items-start gap-3">
        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
        <div className="min-w-0">
          <p className="font-medium text-foreground">{action.title}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {action.description}
          </p>
        </div>
      </div>

      <Link
        href={action.href}
        className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-1 text-sm font-semibold text-blue-600 transition hover:text-blue-500"
      >
        {labels.continue}
        <ArrowRight size={17} />
      </Link>
    </section>
  );
}
