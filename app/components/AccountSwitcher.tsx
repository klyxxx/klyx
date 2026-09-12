"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronUp,
  CircleHelp,
  LoaderCircle,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";

import KlyxImage from "@/app/components/KlyxImage";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  getProfiles,
  switchAccount,
  type SavedAccount,
} from "@/lib/account-switcher";
import {
  translateKlyxAccountSwitcher,
  type KlyxAccountSwitcherMessageKey,
} from "@/lib/klyx-account-switcher-i18n";
import { createClient } from "@/lib/supabase/client";

type AccountSwitcherProps = {
  currentProfileId: string;
  compact?: boolean;
  onNavigate?: () => void;
};

type AccountMenuCopy = {
  profile: string;
  settings: string;
  help: string;
  logout: string;
  loggingOut: string;
};

const ACCOUNT_MENU_COPY: Record<string, AccountMenuCopy> = {
  fr: {
    profile: "Profil",
    settings: "Paramètres",
    help: "Aide",
    logout: "Déconnexion",
    loggingOut: "Déconnexion…",
  },
  en: {
    profile: "Profile",
    settings: "Settings",
    help: "Help",
    logout: "Log out",
    loggingOut: "Logging out…",
  },
  nl: {
    profile: "Profiel",
    settings: "Instellingen",
    help: "Hulp",
    logout: "Uitloggen",
    loggingOut: "Uitloggen…",
  },
  de: {
    profile: "Profil",
    settings: "Einstellungen",
    help: "Hilfe",
    logout: "Abmelden",
    loggingOut: "Abmeldung…",
  },
  es: {
    profile: "Perfil",
    settings: "Ajustes",
    help: "Ayuda",
    logout: "Cerrar sesión",
    loggingOut: "Cerrando sesión…",
  },
};

function profileName(
  profile: SavedAccount | undefined,
  fallbackLabel: string
) {
  if (!profile) return fallbackLabel;
  return `${profile.firstName} ${profile.lastName}`.trim() || fallbackLabel;
}

function profileFirstName(
  profile: SavedAccount | undefined,
  fallbackLabel: string
) {
  if (!profile) return fallbackLabel;
  return profile.firstName.trim() || profileName(profile, fallbackLabel);
}

function roleLabel(
  profile: SavedAccount | undefined,
  providerLabel: string,
  clientLabel: string,
  loadingLabel: string
) {
  if (!profile) return loadingLabel;
  return profile.accountType === "provider" ? providerLabel : clientLabel;
}

function ProfileAvatar({ profile }: { profile: SavedAccount | undefined }) {
  if (profile?.avatarUrl) {
    return (
      <KlyxImage
        src={profile.avatarUrl}
        alt=""
        width={36}
        height={36}
        sizes="36px"
        className="h-full w-full rounded-full object-cover"
      />
    );
  }

  return profile?.accountType === "provider" ? (
    <BriefcaseBusiness size={17} />
  ) : (
    <UserRound size={17} />
  );
}

export default function AccountSwitcher({
  currentProfileId,
  compact = false,
  onNavigate,
}: AccountSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const switchLockRef = useRef(false);
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAccountSwitcherMessageKey) =>
    translateKlyxAccountSwitcher(locale, key);
  const menuCopy = ACCOUNT_MENU_COPY[locale] ?? ACCOUNT_MENU_COPY.en;
  const [profiles, setProfiles] = useState<SavedAccount[]>([]);
  const [activeProfileId, setActiveProfileId] = useState(currentProfileId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setActiveProfileId(currentProfileId);
  }, [currentProfileId]);

  useEffect(() => {
    let active = true;

    getProfiles()
      .then((result) => {
        if (active) setProfiles(result);
      })
      .catch(() => {
        if (!active) return;
        setError(translateKlyxAccountSwitcher(locale, "loadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    function closeWhenClickingOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeWhenClickingOutside);
    document.addEventListener("keydown", closeWithEscape);

    return () => {
      document.removeEventListener("mousedown", closeWhenClickingOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  async function handleSwitch(profileId: string) {
    if (
      profileId === activeProfileId ||
      switchingId ||
      switchLockRef.current
    ) {
      setOpen(false);
      return;
    }

    const targetProfile = profiles.find((profile) => profile.id === profileId);
    if (!targetProfile) {
      setError(t("missingProfileError"));
      return;
    }

    switchLockRef.current = true;

    try {
      setError("");
      setSwitchingId(profileId);
      await switchAccount(profileId);
      setActiveProfileId(profileId);
      setOpen(false);
      onNavigate?.();
      // ActiveProfileSync owns the full-document role transition.
    } catch {
      setError(t("switchError"));
    } finally {
      switchLockRef.current = false;
      setSwitchingId(null);
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      setOpen(false);
      onNavigate?.();
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  function handleMenuNavigation() {
    setOpen(false);
    onNavigate?.();
  }

  const currentProfile = profiles.find(
    (profile) => profile.id === activeProfileId
  );
  const currentName = profileName(currentProfile, t("profileFallback"));
  const currentFirstName = profileFirstName(currentProfile, t("profileFallback"));
  const providerRoleLabel = t("providerRole");
  const clientRoleLabel = t("clientRole");
  const loadingRoleLabel = t("loadingRole");
  const currentRole = roleLabel(
    currentProfile,
    providerRoleLabel,
    clientRoleLabel,
    loadingRoleLabel
  );

  return (
    <div
      ref={containerRef}
      data-testid="account-switcher"
      className={`relative isolate ${compact ? "w-11" : "w-full"}`}
    >
      <button
        type="button"
        data-testid="account-entry"
        onClick={() => setOpen((value) => !value)}
        disabled={loading || switchingId !== null || loggingOut}
        className={
          compact
            ? "grid h-11 w-11 place-items-center rounded-xl text-left transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
            : "flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={compact ? `${currentFirstName} · ${currentRole}` : undefined}
        title={compact ? `${currentFirstName} · ${currentRole}` : undefined}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#2563EB]/10 text-[#2563EB]">
          {loading || switchingId ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <ProfileAvatar profile={currentProfile} />
          )}
        </span>

        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{currentFirstName}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {currentRole}
              </span>
            </span>

            <ChevronUp
              size={16}
              className={`shrink-0 text-muted-foreground transition ${
                open ? "rotate-180" : ""
              }`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("menuAria")}
          data-testid="account-menu"
          className="absolute bottom-full left-0 z-[80] mb-2 w-[min(15rem,calc(100vw-2rem))] max-h-[min(34rem,calc(100dvh-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2 shadow-xl dark:border-white/10"
        >
          <div
            data-testid="account-identity"
            className="flex items-center gap-3 px-2.5 py-2.5"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#2563EB]/10 text-[#2563EB]">
              <ProfileAvatar profile={currentProfile} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{currentName}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {currentRole}
              </span>
            </span>
          </div>

          <div className="my-1 border-t border-border dark:border-white/8" />

          <div className="space-y-1" data-testid="account-profile-list">
            {profiles.map((profile) => {
              const active = profile.id === activeProfileId;
              const switching = profile.id === switchingId;

              return (
                <button
                  key={profile.id}
                  type="button"
                  role="menuitem"
                  data-testid="account-profile-option"
                  onClick={() => void handleSwitch(profile.id)}
                  disabled={switchingId !== null || loggingOut}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                    active ? "bg-[#2563EB]/10" : "hover:bg-muted"
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                    {switching ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <ProfileAvatar profile={profile} />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-5">
                      {profileFirstName(profile, t("profileFallback"))}
                    </span>
                    <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                      {roleLabel(
                        profile,
                        providerRoleLabel,
                        clientRoleLabel,
                        loadingRoleLabel
                      )}
                    </span>
                  </span>

                  {active && <Check size={16} className="shrink-0 text-[#2563EB]" />}
                </button>
              );
            })}
          </div>

          {error && (
            <p
              role="alert"
              className="mt-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
            >
              {error}
            </p>
          )}

          <div className="mt-2 border-t border-border pt-2 dark:border-white/8">
            <Link
              href="/profile"
              role="menuitem"
              onClick={handleMenuNavigation}
              className="flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <UserRound size={16} className="text-muted-foreground" />
              <span className="truncate">{menuCopy.profile}</span>
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={handleMenuNavigation}
              className="flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <Settings size={16} className="text-muted-foreground" />
              <span className="truncate">{menuCopy.settings}</span>
            </Link>
            <Link
              href="/support"
              role="menuitem"
              onClick={handleMenuNavigation}
              className="flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <CircleHelp size={16} className="text-muted-foreground" />
              <span className="truncate">{menuCopy.help}</span>
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut size={16} className="text-muted-foreground" />
              <span className="truncate">
                {loggingOut ? menuCopy.loggingOut : menuCopy.logout}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
