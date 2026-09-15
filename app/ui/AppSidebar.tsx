"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  House,
  LogOut,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import KlyxLogo from "@/app/ui/KlyxLogo";
import { type KlyxLocale } from "@/lib/klyx-i18n";
import { translateKlyxTolgeeRuntimeNavigation } from "@/lib/klyx-tolgee-runtime";
import { createClient } from "@/lib/supabase/client";

type MenuItem = {
  title: string;
  translationLabel: string;
  href: string;
  icon: typeof House;
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

const unifiedItems: MenuItem[] = [
  { title: "KLYX", translationLabel: "KLYX", href: "/assistant", icon: House },
  {
    title: "Activité",
    translationLabel: "Mon activité",
    href: "/bookings",
    icon: CalendarDays,
  },
  {
    title: "Messages",
    translationLabel: "Messages",
    href: "/messages",
    icon: MessageCircle,
  },
  {
    title: "Profil",
    translationLabel: "Mon profil",
    href: "/profile",
    icon: UserRound,
  },
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function activeHrefFor(pathname: string, items: MenuItem[]) {
  return items
    .filter((item) => matchesRoute(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href ?? null;
}

function translatedMenuTitle(locale: KlyxLocale, item: MenuItem) {
  if (locale === "fr") return item.title;
  return translateKlyxTolgeeRuntimeNavigation(locale, item.translationLabel);
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, t } = useKlyxLocale();
  const [loggingOut, setLoggingOut] = useState(false);

  const hideNavigation = routesWithoutNavigation.some((route) =>
    matchesRoute(pathname, route)
  );
  const activeHref = useMemo(
    () => activeHrefFor(pathname, unifiedItems),
    [pathname]
  );

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
      <div
        data-testid="desktop-sidebar-space"
        aria-hidden="true"
        className="hidden w-[280px] shrink-0 lg:block"
      />

      <aside
        data-testid="desktop-sidebar"
        className="fixed inset-y-0 left-0 z-40 isolate hidden h-dvh w-[280px] shrink-0 flex-col overflow-visible border-r border-border bg-background lg:flex dark:border-white/8 dark:bg-zinc-950"
      >
        <div className="relative z-30 shrink-0 px-7 pb-5 pt-8">
          <KlyxLogo href="/assistant" />
        </div>

        <nav
          data-testid="desktop-navigation"
          className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2"
          aria-label={t("sidebar.desktopNavigation")}
        >
          <div className="space-y-2">
            {unifiedItems.map((item) => {
              const Icon = item.icon;
              const active = activeHref === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-14 items-center gap-4 rounded-xl px-4 text-[15px] font-medium transition ${
                    active
                      ? "bg-blue-600/8 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon
                    size={22}
                    strokeWidth={1.8}
                    className={active ? "text-blue-600 dark:text-blue-400" : ""}
                  />
                  <span>{translatedMenuTitle(locale, item)}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 px-4 pb-5 pt-2">
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-50"
          >
            <LogOut size={17} />
            {loggingOut ? t("sidebar.loggingOut") : t("sidebar.logout")}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/94 px-4 backdrop-blur-xl lg:hidden dark:border-white/8">
        <KlyxLogo href="/assistant" />
        <span className="text-[11px] font-semibold text-muted-foreground">
          KLYX
        </span>
      </header>

      <nav
        data-testid="mobile-navigation"
        aria-label={t("sidebar.mobileNavigation")}
        className="fixed inset-x-0 bottom-0 z-50 transform-gpu border-t border-border bg-background/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl lg:hidden dark:border-white/10"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {unifiedItems.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition ${
                  active
                    ? "bg-blue-600/8 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                    : "text-muted-foreground active:bg-muted"
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={1.8}
                  className={active ? "text-blue-600 dark:text-blue-400" : ""}
                />
                <span className="max-w-full truncate">
                  {translatedMenuTitle(locale, item)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
