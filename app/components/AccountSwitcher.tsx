"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  LoaderCircle,
  Settings,
  UserRound,
} from "lucide-react";

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

type AccountSwitcherProps = {
  currentProfileId: string;
};

function profileName(
  profile: SavedAccount | undefined,
  fallbackLabel: string
) {
  if (!profile) return fallbackLabel;
  return `${profile.firstName} ${profile.lastName}`.trim() || fallbackLabel;
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
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt=""
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
}: AccountSwitcherProps) {
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

  const currentProfile = profiles.find(
    (profile) => profile.id === activeProfileId
  );
  const currentName = profileName(currentProfile, t("profileFallback"));
  const providerRoleLabel = t("providerRole");
  const clientRoleLabel = t("clientRole");
  const loadingRoleLabel = t("loadingRole");

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
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-600/10 text-blue-700 dark:text-blue-300">
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
                    active ? "bg-blue-600/10" : "hover:bg-muted"
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

                  {active && <Check size={16} className="shrink-0 text-blue-600" />}
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
