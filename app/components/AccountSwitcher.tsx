"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  LoaderCircle,
  Plus,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  getProfiles,
  switchAccount,
  type SavedAccount,
} from "@/lib/account-switcher";

// KLYX_MULTI_PROFILE_SWITCHER_13_89

type AccountSwitcherProps = {
  currentProfileId: string;
};

export default function AccountSwitcher({
  currentProfileId,
}: AccountSwitcherProps) {
  const router =
    useRouter();

  const containerRef =
    useRef<HTMLDivElement>(
      null
    );

  const [
    profiles,
    setProfiles,
  ] =
    useState<SavedAccount[]>(
      []
    );

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    switchingId,
    setSwitchingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    activeProfileId,
    setActiveProfileId,
  ] =
    useState(
      currentProfileId
    );

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    router.prefetch(
      "/dashboard"
    );

    router.prefetch(
      "/accounts"
    );
  }, [
    router,
  ]);

  useEffect(() => {
    setActiveProfileId(
      currentProfileId
    );
  }, [
    currentProfileId,
  ]);

  useEffect(() => {
    let active =
      true;

    getProfiles()
      .then(
        (
          result
        ) => {
          if (
            active
          ) {
            setProfiles(
              result
            );
          }
        }
      )
      .catch(
        (
          loadError:
            unknown
        ) => {
          if (
            active
          ) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Impossible de charger les profils."
            );
          }
        }
      )
      .finally(() => {
        if (
          active
        ) {
          setLoading(
            false
          );
        }
      });

    return () => {
      active =
        false;
    };
  }, []);

  useEffect(() => {
    function closeWhenClickingOutside(
      event:
        MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(
          false
        );
      }
    }

    function closeWithEscape(
      event:
        KeyboardEvent
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        setOpen(
          false
        );
      }
    }

    document.addEventListener(
      "mousedown",
      closeWhenClickingOutside
    );

    document.addEventListener(
      "keydown",
      closeWithEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        closeWhenClickingOutside
      );

      document.removeEventListener(
        "keydown",
        closeWithEscape
      );
    };
  }, []);

  async function handleSwitch(
    profileId:
      string
  ) {
    if (
      profileId ===
        activeProfileId ||
      switchingId
    ) {
      setOpen(
        false
      );

      return;
    }

    try {
      setError("");

      setSwitchingId(
        profileId
      );

      await switchAccount(
        profileId
      );

      setActiveProfileId(
        profileId
      );

      setOpen(
        false
      );

      router.replace(
        `/dashboard?profile=${encodeURIComponent(
          profileId
        )}`
      );

      router.refresh();
    } catch (
      switchError
    ) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : "Impossible de changer de profil."
      );
    } finally {
      setSwitchingId(
        null
      );
    }
  }

  const currentProfile =
    profiles.find(
      (
        profile
      ) =>
        profile.id ===
        activeProfileId
    );

  const currentName =
    currentProfile
      ? `${currentProfile.firstName} ${currentProfile.lastName}`.trim() ||
        "Mon profil"
      : "Mon profil";
  // KLYX_ACTIVE_PROFILE_ROLE_14_08
  const currentRoleLabel =
    currentProfile?.accountType === "provider"
      ? "Prestataire"
      : "Client";

  const currentRole =
    currentProfile?.accountType ===
    "provider"
      ? "Prestataire"
      : "Client";

  const currentRoleColor =
    currentProfile?.accountType ===
    "provider"
      ? "bg-blue-600"
      : "bg-violet-600";

  return (
    <div
      ref={
        containerRef
      }
      className="relative"
    >
      {/* KLYX_ACTIVE_PROFILE_TRIGGER_13_89 */}
      <button
        type="button"
        onClick={() =>
          setOpen(
            (
              value
            ) =>
              !value
          )
        }
        disabled={
          loading ||
          switchingId !==
            null
        }
        className="flex max-w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2 text-sm text-card-foreground shadow-sm transition hover:bg-muted disabled:cursor-wait disabled:opacity-60 sm:px-4"
        aria-expanded={
          open
        }
        aria-haspopup="menu"
      >
        <span
          className={
            `flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-white ${currentRoleColor}`
          }
        >
          {switchingId ? (
            <LoaderCircle
              className="animate-spin"
              size={18}
            />
          ) : currentProfile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                currentProfile.avatarUrl
              }
              alt=""
              className="h-full w-full object-cover"
            />
          ) : currentProfile?.accountType ===
            "provider" ? (
            <BriefcaseBusiness
              size={18}
            />
          ) : (
            <UserRound
              size={18}
            />
          )}
        </span>

        <span className="min-w-0 text-left">
                  {/* KLYX_ACTIVE_PROFILE_ROLE_BADGE_14_08 */}
        <span className="min-w-0 max-w-44 text-left">
          <span className="block truncate text-sm font-semibold">
            {switchingId
              ? "Changement..."
              : loading
                ? "Chargement..."
                : currentName}
          </span>

          {!loading && !switchingId && currentProfile && (
            <span
              className={`mt-0.5 block text-[11px] font-bold ${
                currentProfile.accountType === "provider"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-violet-600 dark:text-violet-400"
              }`}
            >
              {currentRoleLabel}
            </span>
          )}
        </span>

          {!loading &&
            !switchingId && (
            <span className="block text-xs text-muted-foreground">
              {currentRole}
            </span>
          )}
        </span>

        <ChevronDown
          size={17}
          className={
            `shrink-0 transition ${
              open
                ? "rotate-180"
                : ""
            }`
          }
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-border bg-popover text-popover-foreground shadow-2xl"
        >
          {/* KLYX_PROFILE_SWITCHER_HEADER_13_89 */}
          <div className="border-b border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-black">
                  Profils KLYX
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Change d’espace sans te reconnecter.
                </p>
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-black text-muted-foreground">
                <UsersRound
                  size={14}
                />

                {profiles.length}
              </span>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {profiles.length ===
            0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                Aucun profil KLYX disponible.
              </div>
            ) : (
              profiles.map(
                (
                  profile
                ) => {
                  const isCurrent =
                    profile.id ===
                    activeProfileId;

                  const isSwitching =
                    switchingId ===
                    profile.id;

                  const fullName =
                    `${profile.firstName} ${profile.lastName}`.trim() ||
                    "Profil KLYX";

                  const provider =
                    profile.accountType ===
                    "provider";

                  return (
                    <button
                      key={
                        profile.id
                      }
                      type="button"
                      role="menuitem"
                      disabled={
                        switchingId !==
                        null
                      }
                      onClick={() =>
                        void handleSwitch(
                          profile.id
                        )
                      }
                      className={
                        `flex w-full items-center gap-3 rounded-2xl p-3 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                          isCurrent
                            ? provider
                              ? "bg-blue-500/10"
                              : "bg-violet-500/10"
                            : "hover:bg-muted"
                        }`
                      }
                    >
                      <div
                        className={
                          `flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full font-black text-white ${
                            provider
                              ? "bg-blue-600"
                              : "bg-violet-600"
                          }`
                        }
                      >
                        {isSwitching ? (
                          <LoaderCircle
                            className="animate-spin"
                            size={18}
                          />
                        ) : profile.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              profile.avatarUrl
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : provider ? (
                          <BriefcaseBusiness
                            size={18}
                          />
                        ) : (
                          <UserRound
                            size={18}
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">
                          {fullName}
                        </p>

                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={
                              `text-xs font-bold ${
                                provider
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-violet-600 dark:text-violet-400"
                              }`
                            }
                          >
                            {provider
                              ? "Prestataire"
                              : "Client"}
                          </span>

                          {profile.city && (
                            <span className="truncate text-xs text-muted-foreground">
                              · {profile.city}
                            </span>
                          )}
                        </div>
                      </div>

                      {isCurrent && (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                          <Check
                            size={15}
                          />

                          Actif
                        </span>
                      )}

                      {isSwitching && (
                        <span className="shrink-0 text-xs font-bold text-violet-500">
                          Synchronisation
                        </span>
                      )}
                    </button>
                  );
                }
              )
            )}
          </div>

          {error && (
            <p className="border-t border-border px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {/* KLYX_PROFILE_SWITCH_SECURITY_13_89 */}
          <div className="border-t border-border bg-muted/30 px-4 py-3">
            <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck
                size={15}
                className="mt-0.5 shrink-0 text-emerald-600"
              />

              <p>
                Le changement de profil utilise ta session KLYX actuelle.
                Aucun mot de passe n’est demandé ni stocké pour basculer
                entre tes espaces.
              </p>
            </div>
          </div>

          <div className="border-t border-border p-2">
                        {/* KLYX_SWITCHER_PROFILE_CREATION_14_07 */}
            <div className="grid gap-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(
                    "/accounts?new=1&type=client"
                  );
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition hover:bg-muted"
              >
                <UserRound size={18} />

                <div>
                  <p className="font-semibold">
                    Ajouter un client
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Créer un profil pour réserver des services.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(
                    "/accounts?new=1&type=provider"
                  );
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition hover:bg-muted"
              >
                <BriefcaseBusiness size={18} />

                <div>
                  <p className="font-semibold">
                    Ajouter un prestataire
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Créer un profil pour proposer des services.
                  </p>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(
                  false
                );

                router.push(
                  "/accounts"
                );
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-black transition hover:bg-muted"
            >
              <Settings
                size={18}
              />

              Gérer mes profils
            </button>
          </div>
        </div>
      )}
    </div>
  );
}