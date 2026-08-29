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

import {
  getProfiles,
  switchAccount,
  type SavedAccount,
} from "@/lib/account-switcher";

type AccountSwitcherProps = {
  currentProfileId: string;
};

function profileName(profile: SavedAccount | undefined) {
  if (!profile) return "Mon profil";
  return `${profile.firstName} ${profile.lastName}`.trim() || "Mon profil";
}

function roleLabel(profile: SavedAccount | undefined) {
  return profile?.accountType === "provider" ? "Prestataire" : "Client";
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
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les profils."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
    if (profileId === activeProfileId || switchingId) {
      setOpen(false);
      return;
    }

    const targetProfile = profiles.find((profile) => profile.id === profileId);
    if (!targetProfile) {
      setError("Profil KLYX introuvable.");
      return;
    }

    try {
      setError("");
      setSwitchingId(profileId);
      await switchAccount(profileId);
      setActiveProfileId(profileId);
      setOpen(false);
      // ActiveProfileSync owns the full-document role transition.
    } catch (switchError) {
      setSwitchingId(null);
      setError(
        switchError instanceof Error
          ? switchError.message
          : "Impossible de changer de profil."
      );
    }
  }

  const currentProfile = profiles.find(
    (profile) => profile.id === activeProfileId
  );
  const currentName = profileName(currentProfile);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={loading || switchingId !== null}
        className="flex min-h-12 max-w-full items-center gap-3 rounded-2xl border border-border bg-card/80 px-3 py-2 text-left text-sm shadow-sm transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-600/10 text-blue-700 dark:text-blue-300">
          {switchingId ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <ProfileAvatar profile={currentProfile} />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{currentName}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {roleLabel(currentProfile)}
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
          aria-label="Changer de profil KLYX"
          className="absolute right-0 z-50 mt-2 w-[min(88vw,320px)] overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl dark:border-white/10"
        >
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Profils KLYX
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
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                    active ? "bg-blue-600/10" : "hover:bg-muted"
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                    {switching ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <ProfileAvatar profile={profile} />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {profileName(profile)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {roleLabel(profile)}
                    </span>
                  </span>

                  {active && <Check size={16} className="text-blue-600" />}
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-border pt-2 dark:border-white/8">
            <Link
              href="/accounts"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Settings size={16} />
              Gérer les profils
            </Link>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 max-w-xs text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
