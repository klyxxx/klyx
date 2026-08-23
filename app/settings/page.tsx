"use client";
import PhoneSettingsInline from "./PhoneSettingsInline";
import PhonePrivacyControls from "./PhonePrivacyControls";
import PhoneAccessHistory from "./PhoneAccessHistory";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CreditCard,
  Languages,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Save,
  ShieldAlert,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { useTheme } from "@/app/components/ThemeProvider";
import KlyxSelect from "@/app/components/KlyxSelect";
import { KLYX_LANGUAGE_OPTIONS } from "@/lib/klyx-i18n";
import {
  resolveKlyxSettingsDeleteErrorKey,
  translateKlyxSettingsPage,
  type KlyxSettingsPageMessageKey,
} from "@/lib/klyx-settings-page-i18n";
import {
  getProfilesState,
  switchAccount,
  type SavedAccount,
} from "@/lib/account-switcher";

type NotificationSettings = {
  bookings: boolean;
  messages: boolean;
  promotions: boolean;
};

const NOTIFICATIONS_KEY = "klyx_notification_settings";
const DELETE_CONFIRMATION = "SUPPRIMER";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useKlyxLocale();
  const t = (key: KlyxSettingsPageMessageKey) =>
    translateKlyxSettingsPage(locale, key);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState("");

  const [currentProfileId, setCurrentProfileId] = useState("");
  const [accountType, setAccountType] =
    useState<"client" | "provider">("client");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [messageKey, setMessageKey] =
    useState<KlyxSettingsPageMessageKey | null>(null);
  const [errorKey, setErrorKey] =
    useState<KlyxSettingsPageMessageKey | null>(null);
  const [notifications, setNotifications] =
    useState<NotificationSettings>({
      bookings: true,
      messages: true,
      promotions: false,
    });

  useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const state = await getProfilesState();
        const profile =
          state.profiles.find((item) => item.id === state.activeProfileId) ??
          state.profiles[0];

        if (!profile) {
          if (active) setErrorKey("loadFailed");
          return;
        }
        if (!active) return;

        setCurrentProfileId(profile.id);
        setAccountType(profile.accountType);
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");
        setSavedAccounts(state.profiles);

        const savedNotifications = localStorage.getItem(NOTIFICATIONS_KEY);
        if (savedNotifications) {
          setNotifications(JSON.parse(savedNotifications));
        }
      } catch {
        if (active) setErrorKey("loadFailed");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  function success(key: KlyxSettingsPageMessageKey) {
    setErrorKey(null);
    setMessageKey(key);
  }

  function failure(key: KlyxSettingsPageMessageKey) {
    setMessageKey(null);
    setErrorKey(key);
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);

    try {
      // KLYX_SETTINGS_PROFILE_SERVER_BOUNDARY_16_04
      const currentResponse = await fetch("/api/profile/me", {
        cache: "no-store",
      });
      const currentBody = (await currentResponse.json()) as {
        profile?: {
          city: string;
          age: number | null;
        };
        error?: string;
      };

      if (!currentResponse.ok || !currentBody.profile) {
        failure("profileLoadFailed");
        return;
      }

      const response = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          city: currentBody.profile.city,
          age: currentBody.profile.age,
        }),
      });

      if (!response.ok) {
        failure("profileSaveFailed");
        return;
      }

      success("profileSaved");
    } catch {
      failure("profileSaveFailed");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEmail(true);

    try {
      if (!newEmail.trim() || newEmail.trim() === email) {
        failure("emailRequired");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim().toLowerCase(),
      });

      if (error) {
        failure("emailUpdateFailed");
        return;
      }
      success("emailConfirmationSent");
    } catch {
      failure("emailUpdateFailed");
    } finally {
      setSavingEmail(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);

    try {
      if (newPassword.length < 8) {
        failure("passwordMin");
        return;
      }
      if (newPassword !== confirmPassword) {
        failure("passwordMismatch");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        failure("passwordUpdateFailed");
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      success("passwordChanged");
    } catch {
      failure("passwordUpdateFailed");
    } finally {
      setSavingPassword(false);
    }
  }

  function updateNotifications(
    key: keyof NotificationSettings,
    value: boolean
  ) {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  }

  async function logout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function deleteAccount() {
    if (deleteConfirmation !== DELETE_CONFIRMATION) return;
    if (!window.confirm(t("deleteConfirmPrompt"))) return;

    setDeletingAccount(true);
    setErrorKey(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        failure(resolveKlyxSettingsDeleteErrorKey(result.error));
        setDeletingAccount(false);
        return;
      }

      localStorage.clear();
      router.replace("/signup?deleted=1");
      router.refresh();
    } catch {
      failure("deleteFailed");
      setDeletingAccount(false);
    }
  }

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin text-violet-600" size={38} />
      </main>
    );
  }

  const notificationRows = [
    ["bookings", "bookings", "bookingsDescription"],
    ["messages", "messages", "messagesDescription"],
    ["promotions", "promotions", "promotionsDescription"],
  ] as const satisfies ReadonlyArray<
    readonly [
      keyof NotificationSettings,
      KlyxSettingsPageMessageKey,
      KlyxSettingsPageMessageKey,
    ]
  >;

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        {/* KLYX_AI_FIRST_SETTINGS_15_03 */}
        {/* KLYX_SETTINGS_PAGE_I18N_16_05 */}
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">{t("title")}</h1>

        {messageKey && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
            {t(messageKey)}
          </div>
        )}
        {errorKey && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm">
            {t(errorKey)}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* KLYX_REAL_SIDEBAR_PHONE_REPAIR_12_67F */}
          <PhoneSettingsInline />
          {/* KLYX_PHONE_PRIVACY_SETTINGS_12_75 */}
          <PhonePrivacyControls />
          {/* KLYX_PHONE_ACCESS_HISTORY_SETTINGS_12_76 */}

          <Section icon={<Sun />} title={t("appearance")}>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["light", "dark", "system"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    theme === value
                      ? "bg-violet-600 text-white"
                      : "border-border"
                  }`}
                >
                  {value === "light"
                    ? t("themeLight")
                    : value === "dark"
                      ? t("themeDark")
                      : t("themeSystem")}
                </button>
              ))}
            </div>
          </Section>

          {accountType === "provider" && (
            <Section icon={<CreditCard />} title={t("providerPayments")}>
              <Link
                href="/provider/payments"
                className="inline-flex h-12 items-center rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white"
              >
                {t("configurePayments")}
              </Link>
            </Section>
          )}

          <Section icon={<UserRound />} title={t("profile")}>
            <form onSubmit={updateProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={t("firstName")} value={firstName} onChange={setFirstName} />
                <Input label={t("lastName")} value={lastName} onChange={setLastName} />
              </div>
              <Button loading={savingProfile}>
                <Save size={18} />
                {t("save")}
              </Button>
            </form>
          </Section>

          <Section icon={<LockKeyhole />} title={t("auth")}>
            <div className="space-y-8">
              <form onSubmit={updateEmail} className="space-y-4">
                <Input
                  label={t("newEmail")}
                  type="email"
                  value={newEmail}
                  onChange={setNewEmail}
                />
                <Button loading={savingEmail}>{t("updateEmail")}</Button>
              </form>

              <form onSubmit={updatePassword} className="space-y-4 border-t border-border pt-6">
                <Input
                  label={t("newPassword")}
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                />
                <Input
                  label={t("confirmPassword")}
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
                <Button loading={savingPassword}>{t("updatePassword")}</Button>
              </form>
            </div>
          </Section>

          <Section icon={<Bell />} title={t("notifications")}>
            <div className="space-y-3">
              {notificationRows.map(([key, labelKey, descriptionKey]) => {
                const enabled = notifications[key];
                const label = t(labelKey);

                return (
                  <div
                    key={key}
                    className="flex min-w-0 items-center justify-between gap-5 rounded-2xl border border-border bg-background/50 p-4 sm:p-5"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-foreground">{label}</p>

                      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {t(descriptionKey)}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${label} : ${
                        enabled ? t("enabled") : t("disabled")
                      }`}
                      onClick={() => updateNotifications(key, !enabled)}
                      className={`relative h-8 w-14 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/20 ${
                        enabled
                          ? "border-violet-500 bg-violet-600"
                          : "border-border bg-muted dark:bg-white/10"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ${
                          enabled ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section icon={<Languages />} title={t("language")}>
            <KlyxSelect
              value={locale}
              onChange={setLocale}
              options={KLYX_LANGUAGE_OPTIONS.map(({ value, label }) => ({
                value,
                label,
              }))}
              ariaLabel={t("language")}
            />
          </Section>

          <Section icon={<UserRound />} title={t("profiles")}>
            <div className="space-y-3">
              {savedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-2xl border border-border p-4"
                >
                  <div>
                    <p className="font-black">
                      {account.firstName} {account.lastName}
                    </p>
                    <p className="text-xs text-violet-600">
                      {account.accountType === "provider"
                        ? t("roleProvider")
                        : t("roleClient")}
                    </p>
                  </div>
                  {account.id !== currentProfileId && (
                    <button
                      type="button"
                      onClick={async () => {
                        setSwitchingAccountId(account.id);
                        try {
                          await switchAccount(account.id);
                          window.location.reload();
                        } catch {
                          setSwitchingAccountId("");
                          failure("switchFailed");
                        }
                      }}
                      disabled={switchingAccountId === account.id}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"
                    >
                      {t("useProfile")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section icon={<ShieldAlert />} title={t("privacySupport")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/privacy"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                {t("privacyPolicy")}
              </Link>
              <Link
                href="/terms"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                {t("terms")}
              </Link>
              <Link
                href="/support"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                {t("support")}
              </Link>
              <Link
                href="/delete-account"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                {t("webAccountDeletion")}
              </Link>
            </div>
          </Section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border px-5 font-bold"
            >
              <LogOut size={18} />
              {t("logout")}
            </button>
          </section>

          <section className="rounded-3xl border border-rose-500/30 bg-rose-500/[0.06] p-6">
            <div className="flex gap-4">
              <ShieldAlert className="text-rose-600" />
              <div>
                <h2 className="text-xl font-black text-rose-600">
                  {t("deleteTitle")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("deleteDescription")}
                </p>
              </div>
            </div>

            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className="klyx-input mt-5"
              placeholder={t("deletePlaceholder")}
            />

            <button
              type="button"
              onClick={() => void deleteAccount()}
              disabled={
                deletingAccount || deleteConfirmation !== DELETE_CONFIRMATION
              }
              className="mt-4 inline-flex h-12 items-center gap-2 rounded-2xl bg-rose-600 px-5 font-bold text-white disabled:opacity-40"
            >
              {deletingAccount ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Trash2 size={18} />
              )}
              {t("deleteForever")}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 text-violet-600">
        {icon}
        <h2 className="text-xl font-black text-foreground">{title}</h2>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="klyx-input"
      />
    </label>
  );
}

function Button({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 font-bold text-white disabled:opacity-60"
    >
      {loading && <LoaderCircle className="animate-spin" size={17} />}
      {children}
    </button>
  );
}
