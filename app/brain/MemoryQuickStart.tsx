"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type MemoryItem = {
  key: string;
  label: string;
  value: string;
};

type QuickRequest = {
  serviceSlug: string;
  label: string;
  message: string;
};

type MemoryContextResponse = {
  enabled?: boolean;
  available?: boolean;
  summary?: MemoryItem[];
  quickRequests?: QuickRequest[];
  privacyNotice?: string;
  error?: string;
};

export default function MemoryQuickStart({
  onUseRequest,
  disabled,
}: {
  onUseRequest: (message: string) => void;
  disabled: boolean;
}) {
  const [context, setContext] =
    useState<MemoryContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;

        const response = await fetch(
          "/api/brain/memory-context",
          {
            cache: "no-store",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

        const body =
          (await response.json()) as MemoryContextResponse;

        if (
          !cancelled &&
          response.ok
        ) {
          setContext(body);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
        <LoaderCircle
          className="animate-spin text-violet-600"
          size={17}
        />
        Chargement de tes habitudes...
      </div>
    );
  }

  if (!context?.enabled) {
    return (
      <div className="rounded-2xl border border-border bg-background p-4">
        <div className="flex items-start gap-3">
          <Brain
            className="mt-0.5 shrink-0 text-muted-foreground"
            size={19}
          />
          <div>
            <p className="text-sm font-black">
              Mémoire désactivée
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              KLYX n’utilise aucune habitude enregistrée.
            </p>
            <Link
              href="/memory"
              className="mt-3 inline-block text-xs font-black text-violet-600 dark:text-violet-400"
            >
              Gérer ma mémoire
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!context.available) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
        <p className="text-sm font-black">
          Personnalise KLYX
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Ajoute une ville, un budget ou un service préféré.
        </p>
        <Link
          href="/memory"
          className="mt-3 inline-block text-xs font-black text-violet-600 dark:text-violet-400"
        >
          Compléter ma mémoire
        </Link>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-500/25 bg-violet-500/[0.05]">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="text-sm font-black">
              Utiliser mes habitudes
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              KLYX peut compléter ta demande.
            </p>
          </div>
        </div>

        {expanded ? (
          <ChevronUp size={18} />
        ) : (
          <ChevronDown size={18} />
        )}
      </button>

      {expanded && (
        <div className="border-t border-violet-500/15 p-4">
          <div className="grid gap-2">
            {context.summary?.map((item) => (
              <div
                key={item.key}
                className="flex items-start gap-2 rounded-xl bg-background/80 p-3"
              >
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-emerald-500"
                  size={15}
                />
                <div>
                  <p className="text-xs font-black">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {(context.quickRequests?.length ?? 0) > 0 && (
            <div className="mt-4 grid gap-2">
              {context.quickRequests?.map((request) => (
                <button
                  key={request.serviceSlug}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onUseRequest(request.message)
                  }
                  className="rounded-xl border border-violet-500/20 bg-background px-4 py-3 text-left text-xs font-black transition hover:bg-violet-500/10 disabled:opacity-50"
                >
                  {request.label} comme d’habitude
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-2 text-[11px] leading-5 text-muted-foreground">
            <LockKeyhole
              className="mt-0.5 shrink-0"
              size={14}
            />
            <p>{context.privacyNotice}</p>
          </div>
        </div>
      )}
    </section>
  );
}
