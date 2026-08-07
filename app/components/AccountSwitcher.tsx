"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, Settings, UserRound } from "lucide-react";
import {
  getProfiles,
  switchAccount,
  type SavedAccount,
} from "@/lib/account-switcher";

type AccountSwitcherProps = {
  currentProfileId: string;
};

export default function AccountSwitcher({
  currentProfileId,
}: AccountSwitcherProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [profiles, setProfiles] = useState<SavedAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getProfiles()
      .then((result) => {
        if (active) setProfiles(result);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les profils."
          );
        }
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

    document.addEventListener("mousedown", closeWhenClickingOutside);
    return () =>
      document.removeEventListener("mousedown", closeWhenClickingOutside);
  }, []);

  async function handleSwitch(profileId: string) {
    if (profileId === currentProfileId) {
      setOpen(false);
      return;
    }

    try {
      setError("");
      setSwitchingId(profileId);
      await switchAccount(profileId);
setOpen(false);

window.location.replace(
  `/dashboard?profile=${encodeURIComponent(profileId)}`
);
    } catch (switchError) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : "Impossible de changer de profil."
      );
      setSwitchingId(null);
    }
  }

  const currentProfile = profiles.find(
    (profile) => profile.id === currentProfileId
  );
  const currentName = currentProfile
    ? `${currentProfile.firstName} ${currentProfile.lastName}`.trim() ||
      "Mon profil"
    : "Mon profil";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={loading}
        className="flex max-w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-sm transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-600 text-white">
          {currentProfile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentProfile.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound size={17} />
          )}
        </span>
        <span className="max-w-40 truncate">
          {loading ? "Chargement..." : currentName}
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(90vw,340px)] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="font-semibold">Profils KLYX</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Change de profil sans mot de passe.
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {profiles.map((profile) => {
              const isCurrent = profile.id === currentProfileId;
              const fullName =
                `${profile.firstName} ${profile.lastName}`.trim() ||
                "Profil KLYX";

              return (
                <button
                  key={profile.id}
                  type="button"
                  role="menuitem"
                  disabled={switchingId !== null}
                  onClick={() => handleSwitch(profile.id)}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-600 font-semibold text-white">
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      fullName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{fullName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {profile.accountType === "provider"
                        ? "Prestataire"
                        : "Client"}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                      <Check size={16} /> Actif
                    </span>
                  )}
                  {switchingId === profile.id && (
                    <span className="text-xs text-muted-foreground">
                      Changement...
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="border-t border-border px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/accounts?new=1");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition hover:bg-muted"
            >
              <Plus size={18} /> Ajouter un profil
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/accounts");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition hover:bg-muted"
            >
              <Settings size={18} /> Gérer mes profils
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
