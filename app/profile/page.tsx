"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  LoaderCircle,
  Save,
  UserRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { getKlyxAccountHome } from "@/lib/account-home";
import {
  resolveKlyxProfilePageApiErrorKey,
  translateKlyxProfilePage,
  type KlyxProfilePageMessageKey,
} from "@/lib/klyx-profile-page-i18n";

type AccountType = "client" | "provider";

type ProfilePayload = {
  profile?: {
    id: string;
    firstName: string;
    lastName: string;
    age: number | null;
    city: string;
    avatarUrl: string | null;
    accountType: AccountType;
  };
  error?: string;
};

function inputClassName(): string {
  return "w-full min-w-0 rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-blue-600/45 focus:ring-4 focus:ring-blue-600/8";
}

export default function ProfilePage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProfilePageMessageKey) =>
    translateKlyxProfilePage(locale, key);

  const [accountType, setAccountType] = useState<AccountType>("client");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  const [messageKey, setMessageKey] =
    useState<KlyxProfilePageMessageKey | null>(null);
  const [errorKey, setErrorKey] =
    useState<KlyxProfilePageMessageKey | null>(null);

  const fullName = useMemo(
    () => `${firstName.trim()} ${lastName.trim()}`.trim(),
    [firstName, lastName]
  );
  const homeHref = getKlyxAccountHome(accountType);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);

    try {
      const response = await fetch("/api/profile/me", {
        cache: "no-store",
      });

      const body = (await response.json()) as ProfilePayload;

      if (!response.ok) {
        setErrorKey(
          resolveKlyxProfilePageApiErrorKey(body.error, "loadFailed")
        );
        return;
      }

      if (!body.profile) {
        setErrorKey("profileNotFound");
        return;
      }

      setFirstName(body.profile.firstName);
      setLastName(body.profile.lastName);
      setAge(body.profile.age === null ? "" : String(body.profile.age));
      setCity(body.profile.city);
      setAvatarUrl(body.profile.avatarUrl ?? "");
      setAccountType(body.profile.accountType);
    } catch {
      setErrorKey("loadFailed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorKey("avatarTypeInvalid");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorKey("avatarTooLarge");
      return;
    }

    setUploading(true);
    setMessageKey(null);
    setErrorKey(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as {
        avatarUrl?: string;
        error?: string;
      };

      if (!response.ok || !body.avatarUrl) {
        setErrorKey(
          resolveKlyxProfilePageApiErrorKey(body.error, "uploadFailed")
        );
        return;
      }

      setAvatarUrl(
        `${body.avatarUrl}${body.avatarUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
      );
      setMessageKey("avatarUpdated");
    } catch {
      setErrorKey("uploadFailed");
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessageKey(null);
    setErrorKey(null);

    try {
      const response = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          city,
          age: age.trim() === "" ? null : Number(age),
        }),
      });

      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setErrorKey(
          resolveKlyxProfilePageApiErrorKey(body.error, "saveFailed")
        );
        return;
      }

      setMessageKey("saved");
      await loadProfile();
      setEditingProfile(false);
    } catch {
      setErrorKey("saveFailed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-full w-full max-w-full items-center justify-center overflow-x-hidden bg-background px-4 text-foreground">
        <div className="text-center">
          <LoaderCircle
            className="mx-auto animate-spin text-blue-600"
            size={36}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            {t("loading")}
          </p>
        </div>
      </main>
    );
  }

  const roleLabel =
    accountType === "provider" ? t("providerProfile") : t("clientProfile");

  return (
    <main className="min-h-full w-full max-w-full overflow-x-hidden bg-background px-4 pb-28 pt-7 text-foreground sm:px-6 sm:pt-10 lg:pb-10">
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <Link
          href={homeHref}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={18} />
          {t("home")}
        </Link>

        <header className="mt-6 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            {roleLabel}
          </p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-[-0.04em] [overflow-wrap:anywhere] sm:text-5xl">
            {fullName || roleLabel}
          </h1>
          {city && (
            <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {city}
            </p>
          )}
          {/* KLYX_AI_FIRST_PROFILE_15_03 */}
          {/* KLYX_PROFILE_PAGE_I18N_16_03 */}
          {/* KLYX_PROFILE_SETTINGS_ENTRY */}
          {/* KLYX_PROFILE_PROGRESSIVE_DISCLOSURE */}
          {/* KLYX_PROFILE_STABLE_SCROLL_2026_09_10 */}
        </header>

        {errorKey && (
          <div className="mt-6 break-words rounded-2xl border border-red-500/30 bg-red-500/8 p-4 text-red-700 [overflow-wrap:anywhere] dark:text-red-300">
            {t(errorKey)}
          </div>
        )}

        {messageKey && (
          <div className="mt-6 break-words rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-emerald-700 [overflow-wrap:anywhere] dark:text-emerald-300">
            {t(messageKey)}
          </div>
        )}

        {/* KLYX_PROFILE_COMPACT_CARD_2026_09_10 */}
        <section
          data-testid="profile-summary-card"
          className="mt-7 min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card/70"
        >
          <div className="flex min-w-0 items-center gap-3.5 px-4 py-4 sm:gap-4 sm:px-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted sm:h-20 sm:w-20">
              {avatarUrl ? (
                <img
                  key={avatarUrl}
                  src={avatarUrl}
                  alt={fullName || t("avatarAlt")}
                  className="h-full w-full object-cover"
                  onError={() => setErrorKey("avatarUnavailable")}
                />
              ) : (
                <UserRound size={30} className="text-muted-foreground sm:size-9" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="break-words text-base font-semibold tracking-[-0.015em] [overflow-wrap:anywhere] sm:text-lg">
                {fullName || roleLabel}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
                {roleLabel}
              </p>
            </div>
          </div>

          <div className="border-t border-border/70">
            <button
              type="button"
              aria-expanded={editingProfile}
              aria-label={t("title")}
              onClick={() => setEditingProfile((value) => !value)}
              className="flex min-h-11 w-full items-center justify-between gap-4 px-4 pb-2 pt-3.5 text-left transition hover:bg-muted/40 sm:px-5"
            >
              <span className="text-sm font-semibold">{t("title")}</span>
              <ChevronRight
                size={18}
                className={`shrink-0 text-blue-600 transition-transform ${
                  editingProfile ? "rotate-90" : ""
                }`}
              />
            </button>

            <dl
              data-testid="profile-persisted-facts"
              className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-3 px-4 pb-4 sm:grid-cols-4 sm:px-5 sm:pb-5"
            >
              <ProfileFact label={t("firstName")} value={firstName} />
              <ProfileFact label={t("lastName")} value={lastName} />
              <ProfileFact label={t("city")} value={city} />
              {age && <ProfileFact label={t("age")} value={age} />}
            </dl>
          </div>
        </section>

        {editingProfile && (
          <form
            onSubmit={saveProfile}
            className="mt-4 min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex min-w-0 flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="break-words text-lg font-semibold [overflow-wrap:anywhere]">
                  {t("profilePhoto")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  JPG · PNG · WEBP
                </p>
              </div>

              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-muted">
                {uploading ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Camera size={18} />
                )}
                {uploading ? t("uploading") : t("changePhoto")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadAvatar}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            <div className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2">
              <Field
                id="firstName"
                label={t("firstName")}
                value={firstName}
                onChange={setFirstName}
              />
              <Field
                id="lastName"
                label={t("lastName")}
                value={lastName}
                onChange={setLastName}
              />
              <Field
                id="age"
                label={t("age")}
                value={age}
                onChange={setAge}
                type="number"
                min="18"
                max="100"
                placeholder={t("agePlaceholder")}
              />
              <Field
                id="city"
                label={t("city")}
                value={city}
                onChange={setCity}
                placeholder={t("cityPlaceholder")}
              />
            </div>

            <button
              type="submit"
              disabled={saving || uploading}
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 sm:w-auto sm:min-w-48"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={19} />
              ) : (
                <Save size={19} />
              )}
              {saving ? t("saving") : t("save")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;

  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  min?: string;
  max?: string;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-foreground/80"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClassName()}
      />
    </div>
  );
}
