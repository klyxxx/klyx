"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AssistantPriorityBadge from "@/app/components/AssistantPriorityBadge";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import KlyxLogo from "@/app/ui/KlyxLogo";
import {
  KLYX_ACTIVE_PROFILE_CHANGED,
} from "@/lib/account-switcher";
import {
  translateKlyxNavigationLabel,
} from "@/lib/klyx-i18n";
import {
  searchKlyxNavigation,
  type KlyxNavItem,
} from "@/lib/klyx-navigation";
import { trapDialogTabKey } from "@/lib/mobile-dialog-focus";
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
  icon: typeof LayoutDashboard;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const routesWithoutSidebar = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/legal",
  "/privacy",
  "/terms",
  "/support",
  "/delete-account",
];

/*
 * KLYX premium navigation contract:
 * - few primary destinations, like the best productivity apps;
 * - specialist pages stay reachable through the umbrella page and Cmd/Ctrl+K;
 * - one AI entry point per role;
 * - no duplicate /brain item (it is only a compatibility redirect).
 */
const clientGroups: MenuGroup[] = [
  {
    label: "Essentiel",
    items: [
      { title: "Assistant KLYX", href: "/assistant", icon: Sparkles },
      { title: "Vue d’ensemble", href: "/dashboard", icon: LayoutDashboard },
      { title: "Trouver un service", href: "/search", icon: Search },
    ],
  },
  {
    label: "Activité",
    items: [
      { title: "Mes réservations", href: "/bookings", icon: CalendarDays },
      { title: "Messages", href: "/messages", icon: MessageCircle },
    ],
  },
  {
    label: "Compte",
    items: [
      { title: "Centre de confiance", href: "/trust", icon: ShieldCheck },
      { title: "Mon profil", href: "/profile", icon: UserRound },
      { title: "Paramètres", href: "/settings", icon: Settings },
    ],
  },
];

const providerGroups: MenuGroup[] = [
  {
    label: "Essentiel",
    items: [
      { title: "Assistant KLYX", href: "/provider/assistant", icon: Bot },
      { title: "Tableau professionnel", href: "/dashboard", icon: LayoutDashboard },
      { title: "Mon activité", href: "/provider", icon: BriefcaseBusiness },
    ],
  },
  {
    label: "Travail",
    items: [
      { title: "Réservations & missions", href: "/bookings", icon: CalendarDays },
      { title: "Messagerie clients", href: "/messages", icon: MessageCircle },
    ],
  },
  {
    label: "Compte",
    items: [
      { title: "Confiance professionnelle", href: "/provider/trust", icon: ShieldCheck },
      { title: "Profil public", href: "/profile", icon: UserRound },
      { title: "Paramètres", href: "/settings", icon: Settings },
    ],
  },
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function activeHrefFor(pathname: string, groups: MenuGroup[]): string | null {
  return groups
    .flatMap((group) => group.items)
    .filter((item) => matchesRoute(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href ?? null;
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLElement>(null);
  const { locale, t } = useKlyxLocale();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");

  const hideSidebar = routesWithoutSidebar.some((route) =>
    matchesRoute(pathname, route)
  );

  useEffect(() => {
    if (hideSidebar) return;

    let cancelled = false;

    async function loadContext() {
      try {
        const [profileResponse, adminResponse] = await Promise.all([
          fetch("/api/profiles/active", {
            method: "GET",
            cache: "no-store",
          }),
          fetch("/api/admin/access", {
            method: "GET",
            cache: "no-store",
          }),
        ]);

        if (profileResponse.ok) {
          const data = (await profileResponse.json()) as ProfilesResponse;
          const activeProfile =
            data.profiles?.find(
              (profile) => profile.id === data.activeProfileId
            ) ?? data.profiles?.[0];

          if (!cancelled && activeProfile) {
            setAccountType(activeProfile.accountType);
          }
        }

        if (!cancelled) {
          setIsAdmin(adminResponse.ok);
        }
      } catch {
        // Keep the shell usable if contextual navigation cannot be loaded.
      }
    }

    function onProfileChanged() {
      void loadContext();
    }

    void loadContext();
    window.addEventListener(KLYX_ACTIVE_PROFILE_CHANGED, onProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(KLYX_ACTIVE_PROFILE_CHANGED, onProfileChanged);
    };
  }, [hideSidebar, pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();

        if (window.innerWidth < 1024) {
          setMobileOpen(true);
          window.setTimeout(() => searchRef.current?.focus(), 100);
        } else {
          searchRef.current?.focus();
        }
      }

      if (
        event.key === "Escape" &&
        !mobileOpen &&
        document.activeElement === searchRef.current
      ) {
        setQuery("");
        searchRef.current?.blur();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    const dialog = mobileDialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      trapDialogTabKey(event, dialog);
    }

    document.addEventListener("keydown", onDialogKeyDown);
    window.requestAnimationFrame(() => {
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable ?? dialog).focus();
    });

    return () => {
      document.removeEventListener("keydown", onDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      mobileMenuTriggerRef.current?.focus();
    };
  }, [mobileOpen]);

  const groups = useMemo<MenuGroup[]>(() => {
    if (accountType === "provider") return providerGroups;
    if (accountType === "client") return clientGroups;
    return [];
  }, [accountType]);

  const activeHref = useMemo(
    () => activeHrefFor(pathname, groups),
    [pathname, groups]
  );

  const searchResults = useMemo<KlyxNavItem[]>(
    () => searchKlyxNavigation(query, accountType, isAdmin, locale),
    [query, accountType, isAdmin, locale]
  );

  if (hideSidebar) return null;

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;

      setMobileOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  function openResult(item: KlyxNavItem) {
    setQuery("");
    setMobileOpen(false);
    router.push(item.href);
  }

  const navigation = (
    <>
      <div className="shrink-0 px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <KlyxLogo href="/dashboard" />
          <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
            {accountType === "provider"
              ? t("sidebar.providerAccount")
              : accountType === "client"
                ? t("sidebar.clientAccount")
                : "KLYX"}
          </span>
        </div>

        <div className="relative mt-4">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("sidebar.searchPlaceholder")}
            className="h-10 w-full rounded-xl border border-border bg-background/70 pl-9 pr-11 text-sm outline-none transition placeholder:text-muted-foreground focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.035]"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md border border-border px-1.5 py-1 text-[9px] font-bold text-muted-foreground dark:border-white/10">
            <Command size={10} /> K
          </span>
        </div>

        {query.trim() && (
          <div className="absolute z-50 mt-2 w-[calc(100%-2rem)] max-w-[292px] overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-2xl dark:border-white/10 dark:bg-[#111016]">
            {searchResults.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                {t("sidebar.noResults")}
              </p>
            ) : (
              searchResults.map((item) => (
                <button
                  key={`${item.role}-${item.href}-${item.title}`}
                  type="button"
                  onClick={() => openResult(item)}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted dark:hover:bg-white/[0.06]"
                >
                  <Search size={14} className="mt-0.5 shrink-0 text-violet-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {translateKlyxNavigationLabel(locale, item.title)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {translateKlyxNavigationLabel(locale, item.group)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <nav className="klyx-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex === 0 ? "" : "mt-5"}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
              {group.label}
            </p>

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeHref === item.href;

                return (
                  <Link
                    key={`${item.title}-${item.href}`}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-violet-500/[0.10] text-foreground ring-1 ring-inset ring-violet-500/20 dark:bg-white/[0.075] dark:text-white dark:ring-white/10"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-white/58 dark:hover:bg-white/[0.05] dark:hover:text-white"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                        active
                          ? "bg-violet-500/15 text-violet-600 dark:text-violet-300"
                          : "bg-muted/70 text-muted-foreground group-hover:text-foreground dark:bg-white/[0.04] dark:text-white/45"
                      }`}
                    >
                      <Icon size={17} />
                    </span>

                    <span className="min-w-0 flex-1 truncate">
                      {translateKlyxNavigationLabel(locale, item.title)}
                    </span>

                    {(item.href === "/assistant" ||
                      item.href === "/provider/assistant") && (
                      <AssistantPriorityBadge />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div className="mt-5 border-t border-border pt-4 dark:border-white/8">
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground dark:text-white/58 dark:hover:bg-white/[0.05] dark:hover:text-white"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10 text-violet-500">
                <ShieldCheck size={17} />
              </span>
              Admin KLYX
            </Link>
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-border p-3 dark:border-white/8">
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-rose-500/8 hover:text-rose-600 disabled:opacity-60 dark:text-white/45 dark:hover:text-rose-300"
        >
          <LogOut size={17} />
          {loggingOut ? t("sidebar.loggingOut") : t("sidebar.logout")}
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-border bg-card/92 backdrop-blur-2xl lg:flex dark:border-white/8 dark:bg-[#0b0a0f]/94">
        {navigation}
      </aside>

      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden dark:border-white/8">
        <KlyxLogo href="/dashboard" />
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card"
          aria-label={t("sidebar.openMenu")}
        >
          <Menu size={19} />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[100] flex bg-black/60 backdrop-blur-sm lg:hidden">
          <aside
            ref={mobileDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("sidebar.openMenu")}
            tabIndex={-1}
            className="relative flex h-full w-[min(88vw,320px)] flex-col bg-card text-foreground shadow-2xl outline-none dark:bg-[#0b0a0f] dark:text-white"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/80 dark:border-white/10 dark:bg-white/[0.05]"
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
            {navigation}
          </aside>

          <button
            type="button"
            className="min-w-0 flex-1"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          />
        </div>
      )}
    </>
  );
}
