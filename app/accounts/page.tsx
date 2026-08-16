"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Camera,
  Check,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  createProfile,
  deleteProfile,
  getAvailableServices,
  getProfilesState,
  switchAccount,
  updateProfile,
  type AccountType,
  type SavedAccount,
  type ServiceOption,
} from "@/lib/account-switcher";
import { supabase } from "@/lib/supabase";
import KlyxMarketSelect from "@/app/components/KlyxMarketSelect";
import { getKlyxMarket } from "@/lib/klyx-supported-markets";
import KlyxServiceSelect from "@/app/components/KlyxServiceSelect";

type FormMode = "create" | "edit" | null;

type ProfileForm = {
  firstName: string;
  lastName: string;
  city: string;
  countryCode: string;
  accountType: AccountType;
  serviceId: string;
};

const EMPTY_FORM: ProfileForm = {
  firstName: "",
  lastName: "",
  city: "",
  countryCode: "",
  accountType: "client",
  serviceId: "",
};

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_PROFILES = 5;

async function fetchAccountsData() {
  const [profilesState, availableServices] = await Promise.all([
    getProfilesState(),
    getAvailableServices(),
  ]);

  return {
    profiles: profilesState.profiles,
    activeProfileId: profilesState.activeProfileId,
    services: availableServices,
  };
}

function AccountStatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black tracking-[-0.04em]">
        {value}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}
export default function AccountsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<SavedAccount[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // KLYX_CREATED_PROFILE_NEXT_ACTION_14_13
  const [
    createdAccountType,
    setCreatedAccountType,
  ] = useState<AccountType | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchAccountsData()
      .then((data) => {
        if (mounted) {
          setProfiles(data.profiles);
          setActiveProfileId(data.activeProfileId);
          setServices(data.services);
        }
      })
      .catch((loadError: unknown) => {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les profils."
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  useEffect(() => {
    if (loading || profiles.length >= MAX_PROFILES) return;

    const query = new URLSearchParams(window.location.search);
    const requestedType = query.get("type");
    const wantsNewProfile =
      query.get("new") === "1" ||
      requestedType === "client" ||
      requestedType === "provider";

    if (!wantsNewProfile) return;

    const timer = window.setTimeout(() => {
      setEditingProfileId(null);
      setForm({
        ...EMPTY_FORM,
        accountType: requestedType === "provider" ? "provider" : "client",
      });
      setAvatarFile(null);
      setAvatarPreview("");
      setRemoveAvatar(false);
      setFormMode("create");
      window.history.replaceState({}, "", "/accounts");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loading, profiles.length]);

  const editingProfile = useMemo(
    () => profiles.find((profile) => profile.id === editingProfileId) ?? null,
    [editingProfileId, profiles]
  );

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  async function refreshData() {
    const data = await fetchAccountsData();
    setProfiles(data.profiles);
    setActiveProfileId(data.activeProfileId);
    setServices(data.services);
  }

  function openCreateForm(accountType: AccountType = "client") {
    resetMessages();
    setEditingProfileId(null);
    setForm({ ...EMPTY_FORM, accountType });
    setAvatarFile(null);
    setAvatarPreview("");
    setRemoveAvatar(false);
    setFormMode("create");
  }

  function openEditForm(profile: SavedAccount) {
    resetMessages();
    setEditingProfileId(profile.id);
    setForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      city: profile.city,
      countryCode:
        profile.countryCode ?? "",
      accountType: profile.accountType,
      serviceId: "",
    });
    setAvatarFile(null);
    setAvatarPreview(profile.avatarUrl ?? "");
    setRemoveAvatar(false);
    setFormMode("edit");
  }

  function closeForm() {
    if (saving) return;
    setFormMode(null);
    setEditingProfileId(null);
    setAvatarFile(null);
    setAvatarPreview("");
    setRemoveAvatar(false);
  }

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("La photo choisie doit être une image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setError("La photo ne peut pas dépasser 5 Mo.");
      event.target.value = "";
      return;
    }

    setError("");
    setRemoveAvatar(false);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function clearAvatar() {
    setAvatarFile(null);
    setAvatarPreview("");
    setRemoveAvatar(true);
  }

  async function uploadAvatar(profileId: string, file: File): Promise<string> {
    const rawExtension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const extension = rawExtension.replace(/[^a-z0-9]/g, "") || "jpg";
    const filePath = `${profileId}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Impossible d’envoyer la photo : ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

    return publicUrl;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const city = form.city.trim();
    const countryCode =
      form.countryCode.trim().toUpperCase();

    if (!firstName || !lastName || !city || !countryCode) {
      setError("Le prénom, le nom, la ville et le pays sont obligatoires.");
      return;
    }

    if (
      formMode === "create" &&
      form.accountType === "provider" &&
      !form.serviceId
    ) {
      setError("Choisis le premier métier proposé par ce prestataire.");
      return;
    }

    setSaving(true);

    try {
      let profileId = editingProfileId;

      if (formMode === "create") {
        profileId = await createProfile({
          firstName,
          lastName,
          city,
          countryCode,
          accountType: form.accountType,
          serviceId:
            form.accountType === "provider" ? form.serviceId : null,
        });
      }

      if (!profileId) {
        throw new Error("Profil KLYX introuvable.");
      }

      let avatarUrl: string | null | undefined;

      if (avatarFile) {
        avatarUrl = await uploadAvatar(profileId, avatarFile);
      } else if (removeAvatar) {
        avatarUrl = null;
      }

      await updateProfile(profileId, {
        firstName,
        lastName,
        city,
        countryCode,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      });

      if (avatarFile || removeAvatar) {
        const keepFileName = avatarUrl
          ? decodeURIComponent(new URL(avatarUrl).pathname).split("/").pop()
          : null;

        const { data: objects } = await supabase.storage
          .from(AVATAR_BUCKET)
          .list(profileId, { limit: 100 });

        const storedObjects = (objects ?? []) as Array<{ name: string }>;

        const pathsToRemove =
          storedObjects
            .filter((object) => object.name !== keepFileName)
            .map((object) => `${profileId}/${object.name}`);

        if (pathsToRemove.length > 0) {
          await supabase.storage.from(AVATAR_BUCKET).remove(pathsToRemove);
        }
      }

            if (formMode === "create") {
        setCreatedAccountType(form.accountType);
      } else {
        setCreatedAccountType(null);
      }
await refreshData();
      setFormMode(null);
      setEditingProfileId(null);
      setAvatarFile(null);
      setAvatarPreview("");
      setRemoveAvatar(false);
      setSuccess(
        formMode === "create"
          ? "Profil créé et activé sans nouveau mot de passe."
          : "Profil modifié avec succès."
      );
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible d’enregistrer le profil."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitch(profileId: string) {
    if (profileId === activeProfileId) return;

    try {
      resetMessages();
      setSwitchingId(profileId);
      await switchAccount(profileId);
      setActiveProfileId(profileId);
      router.push("/dashboard");
      router.refresh();
    } catch (switchError) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : "Impossible de changer de profil."
      );
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleDelete(profile: SavedAccount) {
    // KLYX_ACTIVE_PROFILE_DELETE_GUARD_14_12
    if (profile.id === activeProfileId) {
      setError(
        "Active d’abord un autre profil avant de supprimer celui-ci."
      );
      return;
    }

    if (profiles.length <= 1) {
      setError(
        "Ta connexion KLYX doit conserver au moins un profil."
      );
      return;
    }
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    const confirmed = window.confirm(
      `Supprimer le profil ${fullName} ? La connexion principale restera active.`
    );

    if (!confirmed) return;

    try {
      resetMessages();
      setDeletingId(profile.id);
      await deleteProfile(profile.id);
      await refreshData();
      setSuccess(`Le profil ${fullName} a été supprimé.`);
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer le profil."
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Chargement des profils...</p>
      </main>
    );
  }

  // KLYX_ACCOUNT_OVERVIEW_13_90
  const clientProfiles =
    profiles.filter(
      (profile) =>
        profile.accountType ===
        "client"
    ).length;

  const providerProfiles =
    profiles.filter(
      (profile) =>
        profile.accountType ===
        "provider"
    ).length;

  const activeProfile =
    profiles.find(
      (profile) =>
        profile.id ===
        activeProfileId
    ) ?? null;

  const activeProfileName =
    activeProfile
      ? `${activeProfile.firstName} ${activeProfile.lastName}`.trim() ||
        "Profil KLYX"
      : "Aucun profil actif";

  const activeProfileRole =
    activeProfile?.accountType ===
    "provider"
      ? "Prestataire"
      : activeProfile
        ? "Client"
        : "—";
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} /> Retour au tableau de bord
        </button>

                {/* KLYX_MULTI_PROFILE_OVERVIEW_13_90 */}
        <section className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                Ta connexion KLYX
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
                Tous tes profils en un coup d’œil
              </h1>
            </div>

            <span className="w-fit rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-muted-foreground shadow-sm">
              {profiles.length} / {MAX_PROFILES} profils
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AccountStatCard
              label="Profils KLYX"
              value={profiles.length}
              detail="Une seule connexion"
            />

            <AccountStatCard
              label="Clients"
              value={clientProfiles}
              detail="Services du quotidien"
            />

            <AccountStatCard
              label="Prestataires"
              value={providerProfiles}
              detail="Activités professionnelles"
            />

            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.045] p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
                Profil actif
              </p>

              <p className="mt-3 truncate text-lg font-black">
                {activeProfileName}
              </p>

              <p className="mt-1 text-sm font-bold text-violet-600 dark:text-violet-400">
                {activeProfileRole}
              </p>
            </div>
          </div>

          {/* KLYX_ACCOUNT_SESSION_SAFETY_13_90 */}
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
            Tous ces profils utilisent la même connexion KLYX.
            Changer de profil ne demande pas un nouveau mot de passe
            et ne crée pas une nouvelle session.
          </div>
        </section>
        {/* KLYX_PROFILE_QUICK_CREATE_13_91 */}
        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            disabled={profiles.length >= MAX_PROFILES}
            onClick={() =>
              openCreateForm(
                "client"
              )
            }
            className="group rounded-3xl border border-violet-500/20 bg-violet-500/[0.045] p-6 text-left transition hover:-translate-y-0.5 hover:border-violet-500/35 hover:bg-violet-500/[0.07] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <UserRound size={21} />
              </span>

              <Plus
                size={20}
                className="text-violet-600 transition group-hover:rotate-90 dark:text-violet-400"
              />
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
              Nouveau profil
            </p>

            <h2 className="mt-2 text-xl font-black">
              Ajouter un profil client
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Crée un espace pour rechercher des services,
              utiliser l’assistant KLYX et gérer des réservations.
            </p>
          </button>

          <button
            type="button"
            disabled={profiles.length >= MAX_PROFILES}
            onClick={() =>
              openCreateForm(
                "provider"
              )
            }
            className="group rounded-3xl border border-blue-500/20 bg-blue-500/[0.045] p-6 text-left transition hover:-translate-y-0.5 hover:border-blue-500/35 hover:bg-blue-500/[0.07] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Briefcase size={21} />
              </span>

              <Plus
                size={20}
                className="text-blue-600 transition group-hover:rotate-90 dark:text-blue-400"
              />
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
              Nouveau profil
            </p>

            <h2 className="mt-2 text-xl font-black">
              Ajouter un profil prestataire
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Crée un espace professionnel avec métier,
              opportunités, assistant prestataire et missions.
            </p>
          </button>

          {/* KLYX_PROFILE_LIMIT_GUIDANCE_13_91 */}
          {profiles.length >= MAX_PROFILES && (
            <div className="md:col-span-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm leading-6 text-amber-700 dark:text-amber-300">
              Tu as atteint la limite de {MAX_PROFILES} profils KLYX.
              Supprime un profil inutilisé avant d’en créer un nouveau.
            </div>
          )}
        </section>
<section className="overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col gap-5 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
                KLYX
              </p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
                Mes profils
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Une connexion, jusqu’à cinq profils, aucun nouveau mot de passe.
              </p>
              {/* KLYX_PROFILE_TYPE_GUIDANCE_14_06 */}
              <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
                Ajoute directement le type de profil dont tu as besoin.
                Chaque profil garde son propre rôle, ses données et son parcours KLYX.
              </p>
            </div>

                        {/* KLYX_EXPLICIT_PROFILE_CREATION_14_06 */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={profiles.length >= MAX_PROFILES}
                onClick={() => openCreateForm("client")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserRound size={18} />
                Ajouter un client
              </button>

              <button
                type="button"
                disabled={profiles.length >= MAX_PROFILES}
                onClick={() => openCreateForm("provider")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Briefcase size={18} />
                Ajouter un prestataire
              </button>
            </div>
          </div>

                    {/* KLYX_PROFILE_CAPACITY_14_11 */}
          <div className="px-6 pt-5">
            <div
              className={`rounded-2xl border p-4 ${
                profiles.length >= MAX_PROFILES
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-border bg-muted/30"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black">
                    Profils KLYX
                  </p>

                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {profiles.length >= MAX_PROFILES
                      ? "Tu as atteint la limite actuelle. Supprime un profil pour pouvoir en créer un nouveau."
                      : "Tu peux utiliser plusieurs profils sous la même connexion principale."}
                  </p>
                </div>

                <div
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black ${
                    profiles.length >= MAX_PROFILES
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  }`}
                >
                  {profiles.length} / {MAX_PROFILES} profils
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (profiles.length / MAX_PROFILES) * 100
                    )}%`,
                  }}
                />
              </div>

              {/* KLYX_PROFILE_LIMIT_GUARD_14_11 */}
              {profiles.length >= MAX_PROFILES && (
                <p className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-300">
                  La création de nouveaux profils est désactivée tant que la limite est atteinte.
                </p>
              )}
            </div>
          </div>
{(error || success) && (
            <div className="px-6 pt-5">
              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </p>
              )}
                            {success && (
                <div className="space-y-3">
                  <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">
                    {success}
                  </p>

                  {/* KLYX_CREATED_PROFILE_HANDOFF_14_13 */}
                  {createdAccountType && (
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
                        Profil prêt
                      </p>

                      <p className="mt-2 font-black">
                        {createdAccountType === "provider"
                          ? "Ton profil prestataire est prêt."
                          : "Ton profil client est prêt."}
                      </p>

                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {createdAccountType === "provider"
                          ? "Prépare ton activité avant de répondre aux opportunités."
                          : "Tu peux maintenant organiser ton premier besoin avec KLYX."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              createdAccountType === "provider"
                                ? "/provider"
                                : "/assistant/market"
                            )
                          }
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700"
                        >
                          {createdAccountType === "provider"
                            ? "Préparer mon activité"
                            : "Organiser mon premier besoin"}
                        </button>

                        {createdAccountType === "provider" && (
                          <button
                            type="button"
                            onClick={() =>
                              router.push("/provider/jobs")
                            }
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-black transition hover:bg-muted"
                          >
                            Voir les opportunités
                          </button>
                        )}
                      </div>

                      {/* KLYX_CREATED_PROFILE_EXPLICIT_CONTROL_14_13 */}
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        KLYX ne lance aucune action automatiquement. Tu choisis quand continuer.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 p-6">
            {profiles.map((profile) => {
              const isActive = profile.id === activeProfileId;
              const fullName =
                `${profile.firstName} ${profile.lastName}`.trim() ||
                "Profil KLYX";

              return (
                <article
                  key={profile.id}
                  className={`rounded-2xl border p-4 transition sm:p-5 ${
                    isActive
                      ? "border-violet-500 bg-violet-50/70 dark:bg-violet-950/20"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <ProfileAvatar profile={profile} size="large" />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold">{fullName}</h2>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-1 text-xs font-semibold text-white">
                            <Check size={13} /> Actif
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {profile.accountType === "provider"
                          ? "Compte prestataire"
                          : "Compte client"}
                        {profile.city ? ` · ${profile.city}` : ""}
                        {profile.countryCode
                          ? ` · ${profile.countryCode}`
                          : ""}
                        {profile.currencyCode
                          ? ` · ${profile.currencyCode}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
                    {/* KLYX_ACTIVE_PROFILE_DELETE_NOTICE_14_12 */}
                    {isActive && profiles.length > 1 && (
                      <p className="w-full text-xs text-muted-foreground sm:text-right">
                        Pour supprimer ce profil, active d’abord un autre profil.
                      </p>
                    )}
                    {!isActive && (
                      <button
                        type="button"
                        disabled={switchingId !== null || deletingId !== null}
                        onClick={() => handleSwitch(profile.id)}
                        className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                      >
                        {switchingId === profile.id
                          ? "Changement..."
                          : "Utiliser"}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={saving || deletingId !== null}
                      onClick={() => openEditForm(profile)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
                    >
                      <Pencil size={16} /> Modifier
                    </button>

                    <button
                      type="button"
                      disabled={
                        isActive ||
                        profiles.length <= 1 ||
                        deletingId !== null ||
                        switchingId !== null
                      }
                      onClick={() => handleDelete(profile)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:hover:bg-red-950/30"
                    >
                      <Trash2 size={16} />
                      {deletingId === profile.id ? "Suppression..." : "Supprimer"}
                    </button>
                  </div>
                </article>
              );
            })}

            {profiles.length >= MAX_PROFILES && (
              <p className="pt-2 text-center text-sm text-muted-foreground">
                La limite de cinq profils est atteinte.
              </p>
            )}
          </div>
        </section>
      </div>

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-form-title"
            className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-border p-6">
              <div>
                <h2 id="profile-form-title" className="text-xl font-bold">
                  {formMode === "create"
                    ? "Ajouter un profil"
                    : "Modifier le profil"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formMode === "create"
                    ? "Aucun nouvel e-mail ni mot de passe nécessaire."
                    : `Profil ${editingProfile?.accountType === "provider" ? "prestataire" : "client"}`}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                className="rounded-full p-2 transition hover:bg-muted disabled:opacity-50"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {formMode === "create" && (
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold">
                    Type de profil
                  </legend>
                  <div className="grid grid-cols-2 gap-3">
                    <AccountTypeButton
                      type="client"
                      selected={form.accountType === "client"}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          accountType: "client",
                          serviceId: "",
                        }))
                      }
                    />
                    <AccountTypeButton
                      type="provider"
                      selected={form.accountType === "provider"}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          accountType: "provider",
                        }))
                      }
                    />
                  </div>
                </fieldset>
              )}

              <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/60 p-5">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-violet-600 text-2xl font-bold text-white">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview}
                      alt="Aperçu du profil"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (form.firstName.charAt(0) || "K").toUpperCase()
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted">
                    <Camera size={17} /> Choisir une photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={selectAvatar}
                      className="sr-only"
                    />
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={clearAvatar}
                      className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      Retirer
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG ou WebP · 5 Mo maximum
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Prénom"
                  value={form.firstName}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, firstName: value }))
                  }
                  autoComplete="given-name"
                />
                <FormField
                  label="Nom"
                  value={form.lastName}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, lastName: value }))
                  }
                  autoComplete="family-name"
                />
              </div>

              <FormField
                label="Ville"
                value={form.city}
                onChange={(value) =>
                  setForm((current) => ({ ...current, city: value }))
                }
                autoComplete="address-level2"
              />
              {/* KLYX_PROFILE_COUNTRY_FIELD_14_21 */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">
                  Pays
                </span>

                <KlyxMarketSelect
                  value={form.countryCode}
                  onChange={(countryCode) =>
                    setForm((current) => ({
                      ...current,
                      countryCode,
                    }))
                  }
                  required
                />

                {form.countryCode && (
                  <span className="mt-2 block text-xs text-muted-foreground">
                    Devise KLYX :{" "}
                    {getKlyxMarket(
                      form.countryCode
                    )?.currencyCode ?? "—"}
                  </span>
                )}
              </label>

              {formMode === "create" && form.accountType === "provider" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Premier métier
                  </span>
                  <KlyxServiceSelect
                    value={form.serviceId}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        serviceId: value,
                      }))
                    }
                    placeholder="Choisir un métier"
                    searchPlaceholder="Ex. plombier, photographe, développeur..."
                    required
                    options={services.map((service) => ({
                      value: service.id,
                      label: service.name,
                      keywords: service.slug,
                    }))}
                    ariaLabel="Premier métier proposé"
                  />
                  {services.length === 0 && (
                    <span className="mt-2 block text-xs text-red-600 dark:text-red-400">
                      Aucun service n’est encore disponible dans Supabase.
                    </span>
                  )}
                </label>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeForm}
                  className="rounded-xl border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving
                    ? "Enregistrement..."
                    : formMode === "create"
                      ? "Créer et utiliser"
                      : "Enregistrer"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function ProfileAvatar({
  profile,
  size,
}: {
  profile: SavedAccount;
  size: "large" | "small";
}) {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const sizeClass = size === "large" ? "h-14 w-14 text-lg" : "h-10 w-10";

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-600 font-semibold text-white ${sizeClass}`}
    >
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt={fullName || "Profil KLYX"}
          className="h-full w-full object-cover"
        />
      ) : (
        (fullName.charAt(0) || "K").toUpperCase()
      )}
    </div>
  );
}

function AccountTypeButton({
  type,
  selected,
  onClick,
}: {
  type: AccountType;
  selected: boolean;
  onClick: () => void;
}) {
  const isProvider = type === "provider";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-violet-500 bg-violet-50 text-violet-950 ring-2 ring-violet-500/20 dark:bg-violet-950/30 dark:text-violet-100"
          : "border-border hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-2 font-semibold">
        {isProvider ? <Briefcase size={18} /> : <UserRound size={18} />}
        {isProvider ? "Prestataire" : "Client"}
      </span>
      <span className="mt-2 block text-xs text-muted-foreground">
        {isProvider ? "Proposer des services" : "Réserver des services"}
      </span>
    </button>
  );
}

function FormField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        maxLength={label === "Ville" ? 100 : 60}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
      />
    </label>
  );
}

