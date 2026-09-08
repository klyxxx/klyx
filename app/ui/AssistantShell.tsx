"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import AppSidebar from "@/app/ui/AppSidebar";
import KlyxLogo from "@/app/ui/KlyxLogo";
import MissionRail from "@/app/ui/MissionRail";
import { getKlyxAccountHome } from "@/lib/account-home";
import { KLYX_ACTIVE_PROFILE_CHANGED } from "@/lib/account-switcher";
import { trapDialogTabKey } from "@/lib/mobile-dialog-focus";

type AccountType = "client" | "provider";

type ActiveProfile = {
  id: string;
  accountType: AccountType;
};

type ProfilesResponse = {
  profiles?: ActiveProfile[];
  activeProfileId?: string | null;
};

const routesWithoutShell = [
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

// These surfaces intentionally retain their existing shell for this mission.
// Founder/Admin and recommendations/providers are explicitly out of scope.
const routesWithLegacyShell = [
  "/founder",
  "/admin",
  "/recommendations",
  "/providers",
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function mobileMenuLabel(locale: string) {
  if (locale === "fr") return "Ouvrir le menu KLYX";
  if (locale === "nl") return "KLYX-menu openen";
  if (locale === "de") return "KLYX-Menü öffnen";
  if (locale === "es") return "Abrir menú KLYX";
  return "Open KLYX menu";
}

function closeMenuLabel(locale: string) {
  if (locale === "fr") return "Fermer le menu KLYX";
  if (locale === "nl") return "KLYX-menu sluiten";
  if (locale === "de") return "KLYX-Menü schließen";
  if (locale === "es") return "Cerrar menú KLYX";
  return "Close KLYX menu";
}

export default function AssistantShell() {
  const pathname = usePathname();
  const { locale } = useKlyxLocale();
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);

  const hideShell = routesWithoutShell.some((route) => matchesRoute(pathname, route));
  const preserveLegacyShell = routesWithLegacyShell.some((route) =>
    matchesRoute(pathname, route)
  );

  useEffect(() => {
    if (hideShell || preserveLegacyShell) return;

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
          setActiveProfileId(activeProfile.id);
        }
      } catch {
        // Keep the current page usable if profile context is temporarily unavailable.
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
  }, [hideShell, pathname, preserveLegacyShell]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const drawer = mobileDrawerRef.current;
    const focusTarget = drawer?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusTarget?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      trapDialogTabKey(event, mobileDrawerRef.current);
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      mobileMenuTriggerRef.current?.focus();
    };
  }, [mobileOpen]);

  if (hideShell) return null;

  if (preserveLegacyShell) {
    return <AppSidebar />;
  }

  const homeHref = accountType ? getKlyxAccountHome(accountType) : "/dashboard";

  return (
    <>
      <MissionRail
        accountType={accountType}
        activeProfileId={activeProfileId}
        homeHref={homeHref}
        locale={locale}
      />

      <header
        data-testid="assistant-shell-mobile-header"
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/94 px-4 backdrop-blur-xl lg:hidden dark:border-white/8"
      >
        <KlyxLogo href={homeHref} compact />
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={mobileMenuLabel(locale)}
          aria-expanded={mobileOpen}
          aria-controls="klyx-mobile-mission-drawer"
          className="grid h-10 w-10 place-items-center rounded-xl text-foreground transition active:bg-muted"
          data-testid="assistant-shell-mobile-menu"
        >
          <Menu size={21} />
        </button>
      </header>
      <div aria-hidden="true" className="h-14 lg:hidden" />

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" data-testid="mobile-mission-drawer-layer">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            aria-label={closeMenuLabel(locale)}
            onClick={() => setMobileOpen(false)}
          />

          <aside
            ref={mobileDrawerRef}
            id="klyx-mobile-mission-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="KLYX"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-[min(88vw,328px)] flex-col border-r border-border bg-background shadow-2xl dark:border-white/10"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={closeMenuLabel(locale)}
              className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-xl bg-background/90 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X size={19} />
            </button>

            <MissionRail
              accountType={accountType}
              activeProfileId={activeProfileId}
              homeHref={homeHref}
              locale={locale}
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
