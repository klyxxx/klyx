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
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxAccountsPage,
  type KlyxAccountsPageMessageKey,
  type KlyxAccountsPageMessageValues,
} from "@/lib/klyx-accounts-page-i18n";

type FormMode = "create" | "edit" | null;

type ProfileForm = {
  firstName: string;
  lastName: string;
  city: string;
  countryCode: string;
  accountType: AccountType;
  serviceId: string;
};

type PageNotice = {
  key: KlyxAccountsPageMessageKey;
  values?: KlyxAccountsPageMessageValues;
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

export default function AccountsPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (
    key: KlyxAccountsPageMessageKey,
    values?: KlyxAccountsPageMessageValues
  ) => translateKlyxAccountsPage(locale, key, values);

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
  const [error, setError] = useState<PageNotice | null>(null);
  const [success, setSuccess] = useState<PageNotice | null>(null);
  // KLYX_CREATED_PROFILE_NEXT_ACTION_14_13
  const [createdAccountType, setCreatedAccountType] =
    useState<AccountType | null>(null);

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
        console.error("KLYX accounts load failed", loadError);
        if (mounted) {
          setError({ key: "loadFailed" });
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
    setError(null);
    setSuccess(null);
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
      countryCode: profile.countryCode ?? "",
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
      setError({ key: "avatarImageOnly" });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setError({ key: "avatarTooLarge" });
      event.target.value = "";
      return;
    }

    setError(null);
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
      console.error("KLYX avatar upload failed", uploadError);
      throw new Error("avatar-upload-failed");
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
    const countryCode = form.countryCode.trim().toUpperCase();

    if (!firstName || !lastName || !city || !countryCode) {
      setError({ key: "requiredFields" });
      return;
    }

    if (
      formMode === "create" &&
      form.accountType === "provider" &&
      !form.serviceId
    ) {
      setError({ key: "providerServiceRequired" });
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
        throw new Error("profile-not-found");
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
        const pathsToRemove = storedObjects
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
      setSuccess({
        key: formMode === "create" ? "profileCreated" : "profileUpdated",
      });
      router.refresh();
    } catch (submitError: unknown) {
      console.error("KLYX profile save failed", submitError);
      setError({ key: "profileSaveFailed" });
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
    } catch (switchError: unknown) {
      console.error("KLYX profile switch failed", switchError);
      setError({ key: "switchFailed" });
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleDelete(profile: SavedAccount) {
    // KLYX_ACTIVE_PROFILE_DELETE_GUARD_14_12
    if (profile.id === activeProfileId) {
      setError({ key: "activeDeleteBlocked" });
      return;
    }

    if (profiles.length <= 1) {
      setError({ key: "minimumProfileBlocked" });
      return;
    }

    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    const confirmed = window.confirm(
      t("deleteConfirm", { name: fullName || t("profileDefault") })
    );

    if (!confirmed) return;

    try {
      resetMessages();
      setDeletingId(profile.id);
      await deleteProfile(profile.id);
      await refreshData();
      setSuccess({
        key: "deleteSuccess",
        values: { name: fullName || t("profileDefault") },
      });
      router.refresh();
    } catch (deleteError: unknown) {
      console.error("KLYX profile delete failed", deleteError);
      setError({ key: "deleteFailed" });
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">{t("loading")}</p>
      </main>
    );
  }

  // KLYX_ACCOUNT_OVERVIEW_13_90
  // KLYX_ACCOUNTS_PAGE_I18N_16_06
  return (
    <main className="min-h-screen bg-background px-4 pb-28 pt-8 text-foreground sm:px-6 sm:py-12 lg:pb-12">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} /> {t("backDashboard")}
        </button>

        {/* KLYX_MULTI_PROFILE_OVERVIEW_13_90 */}
        <header className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
              KLYX
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              {t("myProfiles")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              {t("myProfilesDescription")}
            </p>
            {/* KLYX_PROFILE_TYPE_GUIDANCE_14_06 */}
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {t("profileTypeGuidance")}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {/* KLYX_PROFILE_CAPACITY_14_11 */}
            <span className="text-xs font-medium text-muted-foreground sm:text-right">
              {t("profilesCount", {
                count: profiles.length,
                max: MAX_PROFILES,
              })}
            </span>

            {/* KLYX_PROFILE_QUICK_CREATE_13_91 */}
            {/* KLYX_EXPLICIT_PROFILE_CREATION_14_06 */}
            <button
              type="button"
              disabled={profiles.length >= MAX_PROFILES}
              onClick={() => openCreateForm()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={17} />
              {t("addProfile")}
            </button>
          </div>
        </header>

        {/* KLYX_ACCOUNT_SESSION_SAFETY_13_90 */}
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          {t("sessionSafety")}
        </p>

        {/* KLYX_PROFILE_LIMIT_GUIDANCE_13_91 */}
        {/* KLYX_PROFILE_LIMIT_GUARD_14_11 */}
        {profiles.length >= MAX_PROFILES && (
          <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            {t("limitGuidance", { max: MAX_PROFILES })}
          </p>
        )}

        {(error || success) && (
          <div className="mt-6 space-y-3">
            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-700 dark:text-red-300">
                {t(error.key, error.values)}
              </p>
            )}

            {success && (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                {t(success.key, success.values)}
              </p>
            )}

            {/* KLYX_CREATED_PROFILE_HANDOFF_14_13 */}
            {success && createdAccountType && (
              <div className="rounded-2xl border border-border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
                <div>
                  <p className="font-semibold">
                    {createdAccountType === "provider"
                      ? t("providerReady")
                      : t("clientReady")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {createdAccountType === "provider"
                      ? t("providerNextDescription")
                      : t("clientNextDescription")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      createdAccountType === "provider"
                        ? "/provider"
                        : "/assistant/market"
                    )
                  }
                  className="mt-4 inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 sm:mt-0 sm:w-auto"
                >
                  {createdAccountType === "provider"
                    ? t("prepareActivity")
                    : t("organizeFirstNeed")}
                </button>
                {/* KLYX_CREATED_PROFILE_EXPLICIT_CONTROL_14_13 */}
              </div>
            )}
          </div>
        )}

        <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold">{t("profilesLabel")}</p>
          </div>

          <div>
            {profiles.map((profile, index) => {
              const isActive = profile.id === activeProfileId;
              const fullName =
                `${profile.firstName} ${profile.lastName}`.trim() ||
                t("profileDefault");

              return (
                <article
                  key={profile.id}
                  className={`px-5 py-5 sm:px-6 ${
                    index > 0 ? "border-t border-border" : ""
                  } ${isActive ? "bg-blue-600/[0.035]" : "bg-card"}`}
                >
                  <div className="flex items-start gap-4">
                    <ProfileAvatar profile={profile} size="large" />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold">{fullName}</h2>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/10 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                            <Check size={13} /> {t("active")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {profile.accountType === "provider"
                          ? t("providerAccount")
                          : t("clientAccount")}
                        {profile.city ? ` · ${profile.city}` : ""}
                        {profile.countryCode ? ` · ${profile.countryCode}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 sm:justify-end">
                    {/* KLYX_ACTIVE_PROFILE_DELETE_NOTICE_14_12 */}
                    {!isActive && (
                      <button
                        type="button"
                        disabled={switchingId !== null || deletingId !== null}
                        onClick={() => void handleSwitch(profile.id)}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {switchingId === profile.id
                          ? t("switching")
                          : t("use")}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={saving || deletingId !== null}
                      onClick={() => openEditForm(profile)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
                    >
                      <Pencil size={15} /> {t("edit")}
                    </button>

                    {!isActive && profiles.length > 1 && (
                      <button
                        type="button"
                        disabled={deletingId !== null || switchingId !== null}
                        onClick={() => void handleDelete(profile)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-500/8 disabled:opacity-40"
                        aria-label={`${t("delete")} ${fullName}`}
                        title={t("delete")}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {profiles.length >= MAX_PROFILES && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("limitReachedShort")}
          </p>
        )}
      </div>

      {formMode && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-form-title"
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-border bg-background text-foreground shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-border p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
                  KLYX
                </p>
                <h2 id="profile-form-title" className="mt-1 text-xl font-bold">
                  {formMode === "create" ? t("addProfile") : t("editProfile")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formMode === "create"
                    ? t("noNewCredentials")
                    : t("profileType", {
                        role:
                          editingProfile?.accountType === "provider"
                            ? t("provider").toLocaleLowerCase(locale)
                            : t("client").toLocaleLowerCase(locale),
                      })}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                className="rounded-full p-2 transition hover:bg-muted disabled:opacity-50"
                aria-label={t("close")}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5 pb-8 sm:p-6">
              {formMode === "create" && (
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold">
                    {t("profileType").replace("{{role}}", "").trim()}
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

              <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/45 p-5">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-xl font-semibold text-white">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview}
                      alt={t("avatarPreview")}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (form.firstName.charAt(0) || "K").toUpperCase()
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted">
                    <Camera size={17} /> {t("choosePhoto")}
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
                      className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/8"
                    >
                      {t("remove")}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("avatarRequirements")}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={t("firstName")}
                  value={form.firstName}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, firstName: value }))
                  }
                  autoComplete="given-name"
                />
                <FormField
                  label={t("lastName")}
                  value={form.lastName}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, lastName: value }))
                  }
                  autoComplete="family-name"
                />
              </div>

              <FormField
                label={t("city")}
                value={form.city}
                onChange={(value) =>
                  setForm((current) => ({ ...current, city: value }))
                }
                autoComplete="address-level2"
                maxLength={100}
              />

              {/* KLYX_PROFILE_COUNTRY_FIELD_14_21 */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">
                  {t("country")}
                </span>
                <KlyxMarketSelect
                  value={form.countryCode}
                  onChange={(countryCode) =>
                    setForm((current) => ({ ...current, countryCode }))
                  }
                  required
                />
                {form.countryCode && (
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {t("klyxCurrency", {
                      currency:
                        getKlyxMarket(form.countryCode)?.currencyCode ?? "—",
                    })}
                  </span>
                )}
              </label>

              {formMode === "create" && form.accountType === "provider" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    {t("firstService")}
                  </span>
                  <KlyxServiceSelect
                    value={form.serviceId}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, serviceId: value }))
                    }
                    placeholder={t("chooseProfession")}
                    searchPlaceholder={t("searchProfession")}
                    required
                    options={services.map((service) => ({
                      value: service.id,
                      label: service.name,
                      keywords: service.slug,
                    }))}
                    ariaLabel={t("firstProfessionAria")}
                  />
                  {services.length === 0 && (
                    <span className="mt-2 block text-xs text-red-600 dark:text-red-400">
                      {t("noServices")}
                    </span>
                  )}
                </label>
              )}

              {error && (
                <p className="rounded-xl bg-red-500/8 p-3 text-sm text-red-700 dark:text-red-300">
                  {t(error.key, error.values)}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeForm}
                  className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving
                    ? t("saving")
                    : formMode === "create"
                      ? t("createAndUse")
                      : t("save")}
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
  const { locale } = useKlyxLocale();
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const sizeClass = size === "large" ? "h-14 w-14 text-lg" : "h-10 w-10";

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 font-semibold text-white ${sizeClass}`}
    >
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt={
            fullName || translateKlyxAccountsPage(locale, "profileDefault")
          }
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
  const { locale } = useKlyxLocale();
  const isProvider = type === "provider";
  const t = (key: KlyxAccountsPageMessageKey) =>
    translateKlyxAccountsPage(locale, key);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-blue-600 bg-blue-600/[0.045] ring-2 ring-blue-600/10"
          : "border-border hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-2 font-semibold">
        {isProvider ? <Briefcase size={18} /> : <UserRound size={18} />}
        {isProvider ? t("provider") : t("client")}
      </span>
      <span className="mt-2 block text-xs leading-5 text-muted-foreground">
        {isProvider ? t("providerOfferServices") : t("clientBookServices")}
      </span>
    </button>
  );
}

function FormField({
  label,
  value,
  onChange,
  autoComplete,
  maxLength = 60,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  maxLength?: number;
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
        maxLength={maxLength}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
      />
    </label>
  );
}
