"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const routesWithoutSidebar = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
];

const menu = [
  {
    title: "Tableau de bord",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Rechercher",
    href: "/babysitters",
    icon: Search,
  },
  {
    title: "Mes favoris",
    href: "/favorites",
    icon: Heart,
  },
  {
    title: "Réservations",
    href: "/bookings",
    icon: CalendarDays,
  },
  {
    title: "Messages",
    href: "/messages",
    icon: MessageCircle,
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    title: "Mon profil",
    href: "/profile",
    icon: UserRound,
  },
  {
    title: "Ma boutique",
    href: "/create-store",
    icon: Store,
  },
  {
    title: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const hideSidebar = routesWithoutSidebar.some((route) =>
    matchesRoute(pathname, route)
  );

  if (hideSidebar) {
    return null;
  }

  async function logout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        throw error;
      }

      setMobileOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return matchesRoute(pathname, href);
  }

  const navigation = (
    <>
      <div className="border-b border-sidebar-border p-6">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
        >
          <h1 className="text-3xl font-bold tracking-tight text-sidebar-foreground">
            KLYX
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Services du quotidien
          </p>
        </Link>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {menu.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                active
                  ? "bg-violet-600 text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon size={20} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={20} />

          <span>
            {loggingOut ? "Déconnexion..." : "Déconnexion"}
          </span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link
          href="/dashboard"
          className="text-2xl font-bold text-sidebar-foreground"
        >
          KLYX
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl border border-sidebar-border p-2 text-sidebar-foreground transition hover:bg-sidebar-accent"
          aria-label="Ouvrir le menu"
          aria-expanded={mobileOpen}
        >
          <Menu size={22} />
        </button>
      </div>

      <aside className="hidden h-screen min-h-screen w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex">
        {navigation}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/70"
          />

          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
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