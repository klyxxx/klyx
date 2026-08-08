import Link from "next/link";
import {
  Crown,
  ShieldCheck,
} from "lucide-react";

import NotificationBell from "./NotificationBell";

type HeaderProps = {
  email: string;
  displayName?: string;
  isFounder?: boolean;
  accountType?: "client" | "provider";
};

export default function Header({
  email,
  displayName,
  isFounder = false,
  accountType = "client",
}: HeaderProps) {
  return (
    <header className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-600 dark:text-violet-400">
          KLYX
        </p>

        {isFounder && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-600 dark:text-amber-400">
              <Crown size={13} />
              FOUNDER
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-600 dark:text-violet-400">
              <ShieldCheck size={13} />
              SUPER ADMIN
            </span>
          </>
        )}
      </div>

      <h1 className="mt-2 text-3xl font-bold text-foreground">
        Tableau de bord
      </h1>

      <p className="mt-1 text-muted-foreground">
        Bienvenue{displayName ? `, ${displayName}` : ""}.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
          Mode {accountType === "provider" ? "Prestataire" : "Client"}
        </span>

        {isFounder && (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
            FULL ACCESS
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="max-w-[260px] truncate rounded-full border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          {email || "Utilisateur"}
        </div>

        <NotificationBell />

        {isFounder && (
          <>
            <Link
              href="/founder"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-700"
            >
              <Crown size={16} />
              Console Founder
            </Link>

            <Link
              href="/admin"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-black text-foreground transition hover:bg-muted"
            >
              <ShieldCheck size={16} />
              Admin
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
