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
  BriefcaseBusiness,
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
  return "w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-blue-600/45 focus:ring-4 focus:ring-blue-600/8";
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
    } catch {
      setErrorKey("saveFailed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
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

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href={homeHref}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={18} />
          {t("home")}
        </Link>

        <header className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            {accountType === "provider"
              ? t("providerProfile")
              : t("clientProfile")}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
            {t("title")}
          </h1>
          {/* KLYX_AI_FIRST_PROFILE_15_03 */}
          {/* KLYX_PROFILE_PAGE_I18N_16_03 */}
        </header>

        {errorKey && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/8 p-4 text-red-700 dark:text-red-300">
            {t(errorKey)}
          </div>
        )}

        {messageKey && (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-emerald-700 dark:text-emerald-300">
            {t(messageKey)}
          </div>
        )}

        <form
          onSubmit={saveProfile}
          className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="flex flex-col gap-6 border-b border-border p-5 sm:flex-row sm:items-center sm:p-8">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-blue-600/20 bg-muted sm:h-36 sm:w-36">
              {avatarUrl ? (
                <img
                  key={avatarUrl}
                  src={avatarUrl}
                  alt={fullName || t("avatarAlt")}
                  className="h-full w-full object-cover"
                  onError={() => setErrorKey("avatarUnavailable")}
                />
              ) : (
                <UserRound size={56} className="text-muted-foreground" />
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold">{t("profilePhoto")}</h2>

              <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500">
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
          </div>

          <div className="p-5 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
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
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 sm:w-auto sm:min-w-48"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={19} />
              ) : (
                <Save size={19} />
              )}
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </form>

        {accountType === "provider" && (
          <Link
            href="/provider"
            className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:bg-muted/60"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/8 text-blue-600">
                <BriefcaseBusiness size={22} />
              </span>
              <div>
                <p className="font-semibold">{t("manageProviderProfile")}</p>
              </div>
            </div>
            <ChevronRight size={22} className="text-blue-600" />
          </Link>
        )}
      </div>
    </main>
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
    <div>
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
