"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  BadgeCheck,
  Banknote,
  Bell,
  Brain,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Camera,
  Command,
  Heart,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListPlus,
  LogOut,
  Menu,
  MessageCircle,
  Navigation,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import KlyxLogo from "@/app/ui/KlyxLogo";
import AssistantPriorityBadge from "@/app/components/AssistantPriorityBadge";
import {
  searchKlyxNavigation,
  type KlyxNavItem,
} from "@/lib/klyx-navigation";

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

const clientMenu: MenuItem[] = [
  { title: "Centre KLYX", href: "/assistant", icon: Sparkles },
  { title: "Vue d’ensemble", href: "/dashboard", icon: LayoutDashboard },
  { title: "Assistant KLYX", href: "/brain", icon: Sparkles },
  { title: "KLYX Agent", href: "/agent", icon: Bot },
  { title: "Ma mémoire KLYX", href: "/memory", icon: Brain },
  { title: "Trouver un service", href: "/search", icon: Search },
  { title: "Couverture locale", href: "/coverage", icon: Navigation },
  { title: "Recherche par photo", href: "/request/photo", icon: Camera },
  { title: "Mes réservations", href: "/bookings", icon: CalendarDays },
  { title: "Messages", href: "/messages", icon: MessageCircle },
  { title: "Favoris", href: "/favorites", icon: Heart },
  { title: "Mes demandes", href: "/requests", icon: ListPlus },
  { title: "Mes devis", href: "/quotes", icon: FileText },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Centre de confiance", href: "/trust", icon: ShieldCheck },
  { title: "Mon profil", href: "/profile", icon: UserRound },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

const providerMenu: MenuItem[] = [
  { title: "Centre KLYX", href: "/assistant", icon: Sparkles },
  { title: "Tableau professionnel", href: "/dashboard", icon: LayoutDashboard },
  { title: "Mon activité", href: "/provider", icon: BriefcaseBusiness },
  { title: "Assistant professionnel", href: "/provider/assistant", icon: Bot },
  { title: "Réservations & missions", href: "/bookings", icon: CalendarDays },
  { title: "Missions disponibles", href: "/provider/jobs", icon: BriefcaseBusiness },
  { title: "Demandes de devis", href: "/provider/quotes", icon: FileText },
  { title: "Planning intelligent", href: "/provider/planning", icon: CalendarClock },
  { title: "Zones d'intervention", href: "/provider/zones", icon: Navigation },
  { title: "Messagerie clients", href: "/messages", icon: MessageCircle },
  { title: "Ajouter un métier", href: "/provider/services/new", icon: ListPlus },
  { title: "Mes compétences", href: "/provider/skills", icon: GraduationCap },
  { title: "Paiements", href: "/provider/payments", icon: Banknote },
  { title: "Vérification", href: "/provider/verification", icon: BadgeCheck },
  { title: "Score et avis", href: "/scores", icon: Star },
  { title: "Notifications", href: "/notifications", icon: Bell },
  {
    title: "Confiance professionnelle",
    href: "/provider/trust",
    icon: ShieldCheck,
  },
  { title: "Profil public", href: "/profile", icon: UserRound },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

function matchesRoute(pathname: string, route: string) {
  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [mobileOpen, setMobileOpen] =
    useState(false);
  const [loggingOut, setLoggingOut] =
    useState(false);
  const [accountType, setAccountType] =
    useState<AccountType | null>(null);
  const [isAdmin, setIsAdmin] =
    useState(false);
  const [query, setQuery] = useState("");

  const hideSidebar =
    routesWithoutSidebar.some((route) =>
      matchesRoute(pathname, route)
    );

  useEffect(() => {
    if (hideSidebar) return;

    let cancelled = false;

    async function loadContext() {
      try {
        const [profileResponse, adminResponse] =
          await Promise.all([
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
          const data =
            (await profileResponse.json()) as ProfilesResponse;

          const activeProfile =
            data.profiles?.find(
              (profile) =>
                profile.id ===
                data.activeProfileId
            ) ?? data.profiles?.[0];

          if (!cancelled && activeProfile) {
            setAccountType(
              activeProfile.accountType
            );
          }
        }

        if (!cancelled) {
          setIsAdmin(adminResponse.ok);
        }
      } catch {
        // La navigation reste utilisable sans privilèges admin.
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [hideSidebar, pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        if (window.innerWidth < 1024) {
          setMobileOpen(true);
          window.setTimeout(
            () => searchRef.current?.focus(),
            100
          );
        } else {
          searchRef.current?.focus();
        }
      }

      if (
        event.key === "Escape" &&
        document.activeElement ===
          searchRef.current
      ) {
        setQuery("");
        searchRef.current?.blur();
      }
    }

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
    };
  }, []);

  const menu = useMemo<MenuItem[]>(() => {
    if (accountType === "provider") {
      return providerMenu;
    }

    if (accountType === "client") {
      return clientMenu;
    }

    return [];
  }, [accountType]);

  const searchResults =
    useMemo<KlyxNavItem[]>(
      () =>
        searchKlyxNavigation(
          query,
          accountType,
          isAdmin
        ),
      [query, accountType, isAdmin]
    );

  if (hideSidebar) return null;

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const supabase = createClient();
      const { error } =
        await supabase.auth.signOut({
          scope: "local",
        });

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
      <div className="shrink-0 px-5 pb-4 pt-6">
        <KlyxLogo href="/dashboard" />

        <p className="mt-4 max-w-[13rem] text-xs leading-5 text-muted-foreground dark:text-white/45">
          {accountType === "provider"
            ? "Ton activité professionnelle KLYX."
            : accountType === "client"
              ? "Tous tes services du quotidien."
              : "Chargement du profil..."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1.5 dark:border-white/10 dark:bg-white/5 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground dark:text-white/60">
            {accountType === "provider"
              ? "Compte prestataire"
              : accountType === "client"
                ? "Compte client"
                : "KLYX"}
          </span>

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() =>
                setMobileOpen(false)
              }
              className="inline-flex rounded-full border border-violet-400/20 bg-violet-500/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-violet-200"
            >
              Admin
            </Link>
          )}
        </div>

        <div className="relative mt-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-white/40"
          />

          <input
            ref={searchRef}
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Rechercher dans KLYX"
            className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-400/40 dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:placeholder:text-white/35"
          />

          <span className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md border border-border dark:border-white/10 px-1.5 py-1 text-[9px] font-bold text-muted-foreground dark:text-white/35">
            <Command size={10} /> K
          </span>
        </div>

        {query.trim() && (
          <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl dark:border-white/10 dark:bg-[#0f0e14]">
            {searchResults.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground dark:text-white/40">
                Aucun résultat.
              </p>
            ) : (
              searchResults.map((item) => (
                <button
                  key={`${item.role}-${item.href}-${item.title}`}
                  type="button"
                  onClick={() =>
                    openResult(item)
                  }
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted dark:hover:bg-white/7"
                >
                  <Search
                    size={15}
                    className="mt-0.5 shrink-0 text-violet-300"
                  />
                  <span>
                    <span className="block text-sm font-bold text-foreground dark:text-white">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground dark:text-white/40">
                      {item.group}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <nav className="klyx-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {menu.map((item) => {
          const Icon = item.icon;

          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : matchesRoute(
                  pathname,
                  item.href
                );

          return (
            <Link
              key={`${item.title}-${item.href}`}
              href={item.href}
              onClick={() =>
                setMobileOpen(false)
              }
              aria-current={
                active ? "page" : undefined
              }
              className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition ${
                active
                  ? accountType === "provider"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)]"
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_10px_24px_rgba(109,40,217,0.28)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-white/62 dark:hover:bg-white/7 dark:hover:text-white"
              }`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-xl ${
                  active
                    ? "bg-white/14"
                    : "bg-muted group-hover:bg-muted/80 dark:bg-white/[0.045] dark:group-hover:bg-white/8"
                }`}
              >
                <Icon size={17} />
              </span>

                            <span>{item.title}</span>

              {item.href === "/assistant" && (
                <AssistantPriorityBadge />
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            onClick={() =>
              setMobileOpen(false)
            }
            aria-current={
              matchesRoute(
                pathname,
                "/admin"
              )
                ? "page"
                : undefined
            }
            className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition ${
              matchesRoute(
                pathname,
                "/admin"
              )
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                : "text-violet-700 hover:bg-violet-500/10 dark:text-violet-200"
            }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15">
              <ShieldCheck size={17} />
            </span>
            <span>Centre Admin KLYX</span>
          </Link>
        )}
      </nav>

      <div className="shrink-0 p-3">
        <div className="rounded-2xl border border-border bg-muted/40 p-2 dark:border-white/8 dark:bg-white/[0.035]">
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60"
          >
            <LogOut size={18} />
            {loggingOut
              ? "Déconnexion..."
              : "Se déconnecter"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black/5 bg-background/95 dark:bg-zinc-950/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <KlyxLogo href="/dashboard" />

        <button
          type="button"
          onClick={() =>
            setMobileOpen(true)
          }
          className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white"
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>
      </header>

      <aside className="fixed inset-y-0 left-0 z-50 hidden h-dvh w-[18rem] flex-col overflow-hidden border-r border-border bg-card text-foreground dark:border-white/8 dark:bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] dark:text-white lg:flex">
{/* KLYX_FIXED_APP_SIDEBAR_12_67B */}
        {/* KLYX_REAL_SIDEBAR_PHONE_REPAIR_12_67F */}
        {navigation}
      </aside>
      {/* KLYX_SIDEBAR_SPACER_12_67F */}
      <div
        aria-hidden="true"
        className="hidden w-[18rem] shrink-0 lg:block"
      />

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() =>
              setMobileOpen(false)
            }
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <aside className="relative flex h-full w-[min(88vw,330px)] flex-col bg-card text-foreground shadow-2xl dark:bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] dark:text-white">
            <button
              type="button"
              onClick={() =>
                setMobileOpen(false)
              }
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-muted text-foreground dark:bg-white/7 dark:text-white"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            {navigation}
          </aside>
        </div>
      )}
    </>
  );
}

