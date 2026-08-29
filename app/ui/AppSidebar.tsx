"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  LogOut,
  MessageCircle,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import KlyxLogo from "@/app/ui/KlyxLogo";
import { KLYX_ACTIVE_PROFILE_CHANGED } from "@/lib/account-switcher";
import { createClient } from "@/lib/supabase/client";

type AccountType = "client" | "provider";

type ActiveProfile = {
  id: string;
  accountType: AccountType;
};

type ProfilesResponse = {
  profiles?: ActiveProfile[];
  activeProfileId?: string | null;
};

type MenuItem = {
  title: string;
  href: string;
  icon: typeof Sparkles;
};

const routesWithoutNavigation = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/legal",
  "/privacy",
  "/terms",
  "/support",
  "/delete-account",
  "/install",
  "/offline",
];

const clientItems: MenuItem[] = [
  { title: "KLYX", href: "/assistant", icon: Sparkles },
  { title: "Activité", href: "/bookings", icon: CalendarDays },
  { title: "Messages", href: "/messages", icon: MessageCircle },
  { title: "Profil", href: "/profile", icon: UserRound },
];

const providerItems: MenuItem[] = [
  { title: "Missions", href: "/provider/jobs", icon: BriefcaseBusiness },
  { title: "Services", href: "/provider/services", icon: Wrench },
  { title: "Finances", href: "/provider/payments", icon: CircleDollarSign },
  { title: "Profil", href: "/profile", icon: UserRound },
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function activeHrefFor(pathname: string, items: MenuItem[]) {
  return items
    .filter((item) => matchesRoute(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href ?? null;
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const hideNavigation = routesWithoutNavigation.some((route) =>
    matchesRoute(pathname, route)
  );

  useEffect(() => {
    if (hideNavigation) return;

    let cancelled = false;

    async function loadProfileContext() {
      try {
        const response = await fetch("/api/profiles/active", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as ProfilesResponse;
        const activeProfile =
          data.profiles?.find((profile) => profile.id === data.activeProfileId) ??
          data.profiles?.[0];

        if (!cancelled && activeProfile) {
          setAccountType(activeProfile.accountType);
        }
      } catch {
        // The page remains usable while profile context is unavailable.
      }
    }

    function onProfileChanged() {
      void loadProfileContext();
    }

    void loadProfileContext();
    window.addEventListener(KLYX_ACTIVE_PROFILE_CHANGED, onProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(KLYX_ACTIVE_PROFILE_CHANGED, onProfileChanged);
    };
  }, [hideNavigation, pathname]);

  const items = useMemo(() => {
    if (accountType === "provider") return providerItems;
    if (accountType === "client") return clientItems;
    return [];
  }, [accountType]);

  const activeHref = useMemo(
    () => activeHrefFor(pathname, items),
    [items, pathname]
  );

  const homeHref =
    accountType === "provider"
      ? "/provider/jobs"
      : accountType === "client"
        ? "/assistant"
        : "/dashboard";

  if (hideNavigation) return null;

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;

      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-border bg-card/88 backdrop-blur-2xl lg:flex dark:border-white/8 dark:bg-[#0b0b0d]/94">
        <div className="px-5 pb-5 pt-6">
          <KlyxLogo href={homeHref} />
          <p className="mt-3 text-[11px] font-semibold text-muted-foreground">
            {accountType === "provider"
              ? "Espace prestataire"
              : accountType === "client"
                ? "Espace client"
                : "Chargement du profil…"}
          </p>
        </div>

        <nav className="flex-1 px-3" aria-label="Navigation principale KLYX">
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = activeHref === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition ${
                    active
                      ? "bg-blue-600/10 text-blue-700 ring-1 ring-inset ring-blue-600/15 dark:text-blue-300"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon
                    size={19}
                    className={active ? "text-blue-600 dark:text-blue-400" : ""}
                  />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3 dark:border-white/8">
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-50"
          >
            <LogOut size={17} />
            {loggingOut ? "Déconnexion…" : "Déconnexion"}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/88 px-4 backdrop-blur-xl lg:hidden dark:border-white/8">
        <KlyxLogo href={homeHref} />
        <span className="text-[11px] font-semibold text-muted-foreground">
          {accountType === "provider"
            ? "Prestataire"
            : accountType === "client"
              ? "Client"
              : "KLYX"}
        </span>
      </header>

      {items.length > 0 && (
        <nav
          aria-label="Navigation mobile KLYX"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/94 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl lg:hidden dark:border-white/10"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = activeHref === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition ${
                    active
                      ? "bg-blue-600/10 text-blue-700 dark:text-blue-300"
                      : "text-muted-foreground active:bg-muted"
                  }`}
                >
                  <Icon
                    size={20}
                    className={active ? "text-blue-600 dark:text-blue-400" : ""}
                  />
                  <span className="max-w-full truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
