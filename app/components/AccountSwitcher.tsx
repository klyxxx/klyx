"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
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
  mode?: "switcher" | "account-menu";
  compact?: boolean;
  onNavigate?: () => void;
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
  mode = "switcher",
  compact = false,
  onNavigate,
}: AccountSwitcherProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const switchLockRef = useRef(false);
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAccountSwitcherMessageKey) =>
    translateKlyxAccountSwitcher(locale, key);
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
      const { error: logoutError } = await supabase.auth.signOut({ scope: "local" });
      if (logoutError) throw logoutError;

      setOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  function closeForNavigation() {
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

  if (mode === "account-menu") {
    return (
      <div
        ref={containerRef}
        data-testid="account-switcher"
        className={compact ? "relative isolate w-11" : "relative isolate w-full"}
      >
        <button
          type="button"
          data-testid="account-entry"
          onClick={() => setOpen((value) => !value)}
          disabled={loading || switchingId !== null || loggingOut}
          className={
            compact
              ? "grid h-11 w-11 place-items-center rounded-lg text-foreground transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
              : "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
          }
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t("accountMenuAria")}
          title={compact ? t("accountMenuAria") : undefined}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#2563EB]/10 text-[#2563EB]">
            {loading || switchingId ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <ProfileAvatar profile={currentProfile} />
            )}
          </span>

          {!compact && (
            <>
              <span className="min-w-0 flex-1 truncate">{currentFirstName}</span>
              <ChevronDown
                size={14}
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
            aria-label={t("accountMenuAria")}
            data-testid="account-menu-panel"
            className="absolute bottom-full left-0 z-[90] mb-2 max-h-[min(32rem,calc(100dvh-5rem))] w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2 shadow-2xl dark:border-white/10"
          >
            <div
              data-testid="account-menu-identity"
              className="flex items-center gap-3 rounded-xl px-2.5 py-2.5"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#2563EB]/10 text-[#2563EB]">
                <ProfileAvatar profile={currentProfile} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {currentName}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {roleLabel(
                    currentProfile,
                    providerRoleLabel,
                    clientRoleLabel,
                    loadingRoleLabel
                  )}
                </span>
              </span>
            </div>

            {profiles.length > 1 && (
              <div className="mt-1 border-t border-border pt-2 dark:border-white/8">
                <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("menuTitle")}
                </p>
                <div className="space-y-0.5">
                  {profiles.map((profile) => {
                    const active = profile.id === activeProfileId;
                    const switching = profile.id === switchingId;

                    return (
                      <button
                        key={profile.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => void handleSwitch(profile.id)}
                        disabled={switchingId !== null}
                        className={`flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                          active ? "bg-[#2563EB]/10" : "hover:bg-muted"
                        }`}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                          {switching ? (
                            <LoaderCircle size={14} className="animate-spin" />
                          ) : (
                            <ProfileAvatar profile={profile} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {profileFirstName(profile, t("profileFallback"))}
                        </span>
                        {active && <Check size={15} className="shrink-0 text-[#2563EB]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="mx-1 mt-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
              >
                {error}
              </p>
            )}

            <div className="mt-2 border-t border-border pt-2 dark:border-white/8">
              <Link
                href="/profile"
                role="menuitem"
                onClick={closeForNavigation}
                className="flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <UserRound size={16} className="text-muted-foreground" />
                {t("myProfile")}
              </Link>
              <Link
                href="/settings"
                role="menuitem"
                onClick={closeForNavigation}
                className="flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <Settings size={16} className="text-muted-foreground" />
                {t("settings")}
              </Link>
              <Link
                href="/support"
                role="menuitem"
                onClick={closeForNavigation}
                className="flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <CircleHelp size={16} className="text-muted-foreground" />
                {t("support")}
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => void logout()}
                disabled={loggingOut}
                className="flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
              >
                {loggingOut ? (
                  <LoaderCircle size={16} className="animate-spin text-muted-foreground" />
                ) : (
                  <LogOut size={16} className="text-muted-foreground" />
                )}
                {loggingOut ? t("loggingOut") : t("logout")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="account-switcher"
      className="relative isolate w-full"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={loading || switchingId !== null}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2 text-left text-sm transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#2563EB]/10 text-[#2563EB]">
          {loading || switchingId ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <ProfileAvatar profile={currentProfile} />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{currentName}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {roleLabel(
              currentProfile,
              providerRoleLabel,
              clientRoleLabel,
              loadingRoleLabel
            )}
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("menuAria")}
          className="absolute left-0 right-0 top-full z-[70] mt-2 max-h-[min(22rem,calc(100dvh_-_13rem))] w-full overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2 shadow-xl dark:border-white/10"
        >
          <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {t("menuTitle")}
          </p>

          <div className="space-y-1">
            {profiles.map((profile) => {
              const active = profile.id === activeProfileId;
              const switching = profile.id === switchingId;

              return (
                <button
                  key={profile.id}
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSwitch(profile.id)}
                  disabled={switchingId !== null}
                  className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition disabled:cursor-wait disabled:opacity-60 ${
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
                      {profileName(profile, t("profileFallback"))}
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
              href="/accounts"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Settings size={16} />
              <span className="truncate">{t("manageProfiles")}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
