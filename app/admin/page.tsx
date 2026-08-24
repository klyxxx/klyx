"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  Crown,
  FileCheck2,
  Gavel,
  LoaderCircle,
  Search,
  Rocket,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  getKlyxAdminHomeAreaCopy,
  translateKlyxAdminHome,
  type KlyxAdminHomeAreaId,
  type KlyxAdminHomeMessageKey,
} from "@/lib/klyx-admin-home-i18n";
import { createClient } from "@/lib/supabase/client";

// KLYX_ADMIN_HOME_I18N

const AREAS: Array<{
  id: KlyxAdminHomeAreaId;
  href: string;
  icon: typeof Crown;
}> = [
  { id: "founderConsole", href: "/founder", icon: Crown },
  { id: "founderTests", href: "/founder/test", icon: ShieldCheck },
  { id: "accountAudit", href: "/founder/cleanup", icon: UsersRound },
  { id: "launchCenter", href: "/admin/launch", icon: Rocket },
  { id: "providerSkills", href: "/admin/skills", icon: BriefcaseBusiness },
  { id: "providerVerifications", href: "/admin/verifications", icon: BadgeCheck },
  { id: "disputes", href: "/admin/disputes", icon: Gavel },
  { id: "services", href: "/admin/services", icon: FileCheck2 },
  { id: "finance", href: "/admin/finance", icon: Banknote },
];

export default function AdminHomePage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAdminHomeMessageKey) => translateKlyxAdminHome(locale, key);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [errorKey, setErrorKey] = useState<KlyxAdminHomeMessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) setErrorKey("sessionMissing");
          return;
        }

        const response = await fetch("/api/admin/access", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const body = (await response.json().catch(() => ({}))) as {
          isAdmin?: boolean;
        };

        if (!response.ok || !body.isAdmin) {
          if (!cancelled) setErrorKey("accessDenied");
          return;
        }

        if (!cancelled) setAllowed(true);
      } catch {
        if (!cancelled) setErrorKey("accessError");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin" size={38} />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-3xl">
          <section className="klyx-card p-8">
            <ShieldCheck size={34} className="text-rose-500" />
            <h1 className="mt-5 text-2xl font-black">{t("deniedTitle")}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {t(errorKey ?? "accessDenied")}
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
              <ShieldCheck size={15} />
              {t("adminAccess")}
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
              <Crown size={15} />
              {t("founder")}
            </div>
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">{t("title")}</h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            {t("description")}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/founder"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-zinc-950"
            >
              <Crown size={16} />
              {t("founderConsoleButton")}
            </Link>

            <Link
              href="/founder/test"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black text-white"
            >
              <ShieldCheck size={16} />
              {t("founderTestsButton")}
            </Link>

            <Link
              href="/founder/cleanup"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black text-white"
            >
              <UsersRound size={16} />
              {t("accountAuditButton")}
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
          <div className="flex gap-3">
            <Search size={21} className="shrink-0 text-blue-600" />
            <div>
              <p className="font-black">{t("searchTitle")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("searchText")}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {AREAS.map((area) => {
            const Icon = area.icon;
            const copy = getKlyxAdminHomeAreaCopy(locale, area.id);

            return (
              <Link
                key={area.href}
                href={area.href}
                className="klyx-card group p-6 transition hover:-translate-y-0.5"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
                  <Icon size={22} />
                </span>

                <h2 className="mt-5 text-xl font-black">{copy.title}</h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {copy.description}
                </p>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
