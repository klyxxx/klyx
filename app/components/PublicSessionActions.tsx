"use client";

import Link from "next/link";
import {
  ArrowRight,
  LoaderCircle,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Props = {
  compact?: boolean;
};

export default function PublicSessionActions({
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        setConnected(Boolean(user));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className={`flex items-center ${
          compact
            ? "gap-2"
            : "flex-col gap-3 sm:flex-row"
        }`}
      >
        <div
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white/55 ${
            compact
              ? "h-11 px-4"
              : "min-h-14 px-6"
          }`}
        >
          <LoaderCircle
            size={17}
            className="animate-spin"
          />
          Session...
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div
        className={`flex ${
          compact
            ? "items-center gap-2"
            : "flex-col gap-3 sm:flex-row"
        }`}
      >
        <Link
          href="/dashboard"
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 font-black text-white transition hover:bg-violet-500 ${
            compact
              ? "h-11 px-4 text-sm"
              : "min-h-14 px-6 text-base"
          }`}
        >
          Ouvrir KLYX
          <ArrowRight size={17} />
        </Link>

        <Link
          href="/accounts"
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 font-bold text-white/75 transition hover:bg-white/10 hover:text-white ${
            compact
              ? "hidden h-11 px-4 text-sm sm:inline-flex"
              : "min-h-14 px-6 text-base"
          }`}
        >
          <UsersRound size={17} />
          Mes profils
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`flex ${
        compact
          ? "items-center gap-2"
          : "flex-col gap-3 sm:flex-row"
      }`}
    >
      <Link
        href="/login"
        className={`inline-flex items-center justify-center rounded-xl border border-white/10 font-bold text-white transition hover:bg-white/7 ${
          compact
            ? "h-11 px-4 text-sm"
            : "min-h-14 px-6 text-base"
        }`}
      >
        Se connecter
      </Link>

      <Link
        href="/signup"
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 font-black text-white transition hover:bg-violet-500 ${
          compact
            ? "h-11 px-4 text-sm"
            : "min-h-14 px-6 text-base"
        }`}
      >
        Créer un compte
        {!compact && <ArrowRight size={17} />}
      </Link>
    </div>
  );
}
