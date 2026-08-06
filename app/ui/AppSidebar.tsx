"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  Banknote,
  Bell,
  Brain,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Heart,
  LayoutDashboard,
  ListPlus,
  LogOut,
  Menu,
  MessageCircle,
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
];

const clientMenu: MenuItem[] = [
  { title: "Vue d’ensemble", href: "/dashboard", icon: LayoutDashboard },
  { title: "Assistant KLYX", href: "/brain", icon: Sparkles },
  { title: "Ma mémoire KLYX", href: "/memory", icon: Brain },
  { title: "Trouver un service", href: "/search", icon: Search },
  { title: "Mes réservations", href: "/bookings", icon: CalendarDays },
  { title: "Messages", href: "/messages", icon: MessageCircle },
  { title: "Favoris", href: "/favorites", icon: Heart },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Centre de confiance", href: "/trust", icon: ShieldCheck },
  { title: "Mon profil", href: "/profile", icon: UserRound },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

const providerMenu: MenuItem[] = [
  { title: "Tableau professionnel", href: "/dashboard", icon: LayoutDashboard },
  { title: "Mon activité", href: "/provider", icon: BriefcaseBusiness },
  { title: "Demandes reçues", href: "/bookings", icon: CalendarDays },
  { title: "Missions", href: "/bookings", icon: CalendarClock },
  { title: "Messagerie clients", href: "/messages", icon: MessageCircle },
  { title: "Ajouter un métier", href: "/provider/services/new", icon: ListPlus },
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
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountType, setAccountType] =
    useState<AccountType | null>(null);

  const hideSidebar = routesWithoutSidebar.some((route) =>
    matchesRoute(pathname, route)
  );

  useEffect(() => {
    if (hideSidebar) return;

    let cancelled = false;

    async function loadActiveProfile() {
      try {
        const response = await fetch("/api/profiles/active", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as ProfilesResponse;

        const activeProfile =
          data.profiles?.find(
            (profile) => profile.id === data.activeProfileId
          ) ?? data.profiles?.[0];

        if (!cancelled && activeProfile) {
          setAccountType(activeProfile.accountType);
        }
      } catch {
        // Aucun menu de rôle n’est affiché sans profil actif fiable.
      }
    }

    void loadActiveProfile();

    return () => {
      cancelled = true;
    };
  }, [hideSidebar, pathname]);

  const menu = useMemo<MenuItem[]>(() => {
    if (accountType === "provider") return providerMenu;
    if (accountType === "client") return clientMenu;
    return [];
  }, [accountType]);

  if (hideSidebar) return null;

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({
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

  const navigation = (
    <>
      <div className="px-5 pb-5 pt-6">
        <KlyxLogo href="/dashboard" />

        <p className="mt-4 max-w-[13rem] text-xs leading-5 text-white/45">
          {accountType === "provider"
            ? "Ton activité professionnelle KLYX."
            : accountType === "client"
              ? "Tous tes services du quotidien."
              : "Chargement du profil..."}
        </p>

        <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white/60">
          {accountType === "provider"
            ? "Compte prestataire"
            : accountType === "client"
              ? "Compte client"
              : "KLYX"}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {menu.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : matchesRoute(pathname, item.href);

          return (
            <Link
              key={`${item.title}-${item.href}`}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition ${
                active
                  ? accountType === "provider"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)]"
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_10px_24px_rgba(109,40,217,0.28)]"
                  : "text-white/62 hover:bg-white/7 hover:text-white"
              }`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-xl ${
                  active
                    ? "bg-white/14"
                    : "bg-white/[0.045] group-hover:bg-white/8"
                }`}
              >
                <Icon size={17} />
              </span>

              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-2">
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60"
          >
            <LogOut size={18} />
            {loggingOut ? "Déconnexion..." : "Se déconnecter"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black/5 bg-zinc-950/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <KlyxLogo href="/dashboard" />

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white"
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>
      </header>

      <aside className="hidden h-screen w-[18rem] shrink-0 flex-col border-r border-white/8 bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] lg:sticky lg:top-0 lg:flex">
        {navigation}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <aside className="relative flex h-full w-[min(88vw,330px)] flex-col bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-white/7 text-white"
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


