"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CreditCard,
  Languages,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Phone,
  ShieldAlert,
  Sun,
  Trash2,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import KlyxSelect from "@/app/components/KlyxSelect";
import { useTheme } from "@/app/components/ThemeProvider";
import PhoneAccessHistory from "./PhoneAccessHistory";
import PhonePrivacyControls from "./PhonePrivacyControls";
import PhoneSettingsInline from "./PhoneSettingsInline";
import { getProfilesState } from "@/lib/account-switcher";
import { KLYX_LANGUAGE_OPTIONS } from "@/lib/klyx-i18n";
import {
  resolveKlyxSettingsDeleteErrorKey,
  translateKlyxSettingsPage,
  type KlyxSettingsPageMessageKey,
} from "@/lib/klyx-settings-page-i18n";
import { createClient } from "@/lib/supabase/client";

type NotificationSettings = {
  bookings: boolean;
  messages: boolean;
  promotions: boolean;
};

type SettingsPanel =
  | "phone"
  | "appearance"
  | "payments"
  | "auth"
  | "notifications"
  | "language"
  | "privacy"
  | "delete"
  | null;

const NOTIFICATIONS_KEY = "klyx_notification_settings";
const DELETE_CONFIRMATION = "SUPPRIMER";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useKlyxLocale();
  const t = (key: KlyxSettingsPageMessageKey) =>
    translateKlyxSettingsPage(locale, key);

  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [openPanel, setOpenPanel] = useState<SettingsPanel>(null);

  const [accountType, setAccountType] =
    useState<"client" | "provider">("client");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
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

  // KLYX_SETTINGS_PROFILE_DEDUPLICATED
  // KLYX_SETTINGS_SIDEBAR_FROZEN
  // KLYX_SETTINGS_SINGLE_BLUE
  // KLYX_SETTINGS_PHONE_HISTORY_VISIBLE
  // KLYX_SETTINGS_PROGRESSIVE_DISCLOSURE

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

        setAccountType(profile.accountType);
        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");

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

  function togglePanel(panel: Exclude<SettingsPanel, null>) {
    setOpenPanel((current) => (current === panel ? null : panel));
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
      <main className="grid min-h-screen place-items-center bg-background">
        <LoaderCircle className="animate-spin text-blue-600" size={38} />
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

  const phoneLabel =
    locale === "fr"
      ? "Téléphone"
      : locale === "nl"
        ? "Telefoon"
        : locale === "de"
          ? "Telefon"
          : "Phone";

  return (
    <main className="min-h-screen bg-background px-4 pb-28 pt-7 text-foreground sm:px-6 sm:pt-10 lg:pb-12">
      <div className="mx-auto max-w-3xl">
        {/* KLYX_AI_FIRST_SETTINGS_15_03 */}
        {/* KLYX_SETTINGS_PAGE_I18N_16_05 */}
        <Link
          href="/profile"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={18} />
          {t("profile")}
        </Link>

        <header className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            KLYX
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
            {t("title")}
          </h1>
        </header>

        {messageKey && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            {t(messageKey)}
          </div>
        )}
        {errorKey && (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {t(errorKey)}
          </div>
        )}

        <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
          <SettingsDisclosure
            icon={<Phone size={20} />}
            title={phoneLabel}
            open={openPanel === "phone"}
            onToggle={() => togglePanel("phone")}
          >
            <div className="space-y-4">
              {/* KLYX_REAL_SIDEBAR_PHONE_REPAIR_12_67F */}
              <PhoneSettingsInline />
              {/* KLYX_PHONE_PRIVACY_SETTINGS_12_75 */}
              <PhonePrivacyControls />
              {/* KLYX_PHONE_ACCESS_HISTORY_SETTINGS_12_76 */}
              <PhoneAccessHistory />
            </div>
          </SettingsDisclosure>

          <SettingsDisclosure
            icon={<Sun size={20} />}
            title={t("appearance")}
            open={openPanel === "appearance"}
            onToggle={() => togglePanel("appearance")}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {(["light", "dark", "system"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`min-h-12 rounded-xl border px-4 py-3 font-semibold transition ${
                    theme === value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-border bg-background hover:bg-muted"
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
          </SettingsDisclosure>

          {accountType === "provider" && (
            <SettingsDisclosure
              icon={<CreditCard size={20} />}
              title={t("providerPayments")}
              open={openPanel === "payments"}
              onToggle={() => togglePanel("payments")}
            >
              <Link
                href="/provider/payments"
                className="inline-flex min-h-12 items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                {t("configurePayments")}
              </Link>
            </SettingsDisclosure>
          )}

          <SettingsDisclosure
            icon={<LockKeyhole size={20} />}
            title={t("auth")}
            open={openPanel === "auth"}
            onToggle={() => togglePanel("auth")}
          >
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

              <form
                onSubmit={updatePassword}
                className="space-y-4 border-t border-border pt-6"
              >
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
          </SettingsDisclosure>

          <SettingsDisclosure
            icon={<Bell size={20} />}
            title={t("notifications")}
            open={openPanel === "notifications"}
            onToggle={() => togglePanel("notifications")}
          >
            <div className="space-y-3">
              {notificationRows.map(([key, labelKey, descriptionKey]) => {
                const enabled = notifications[key];
                const label = t(labelKey);

                return (
                  <div
                    key={key}
                    className="flex min-w-0 items-center justify-between gap-5 rounded-xl border border-border bg-background p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{label}</p>
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
                      className={`relative h-8 w-14 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/20 ${
                        enabled
                          ? "border-blue-600 bg-blue-600"
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
          </SettingsDisclosure>

          <SettingsDisclosure
            icon={<Languages size={20} />}
            title={t("language")}
            open={openPanel === "language"}
            onToggle={() => togglePanel("language")}
          >
            <KlyxSelect
              value={locale}
              onChange={setLocale}
              options={KLYX_LANGUAGE_OPTIONS.map(({ value, label }) => ({
                value,
                label,
              }))}
              ariaLabel={t("language")}
            />
          </SettingsDisclosure>

          <SettingsDisclosure
            icon={<ShieldAlert size={20} />}
            title={t("privacySupport")}
            open={openPanel === "privacy"}
            onToggle={() => togglePanel("privacy")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingsLink href="/privacy" label={t("privacyPolicy")} />
              <SettingsLink href="/terms" label={t("terms")} />
              <SettingsLink href="/support" label={t("support")} />
              <SettingsLink
                href="/delete-account"
                label={t("webAccountDeletion")}
              />
            </div>
          </SettingsDisclosure>

          <SettingsDisclosure
            icon={<Trash2 size={20} />}
            title={t("deleteTitle")}
            open={openPanel === "delete"}
            onToggle={() => togglePanel("delete")}
            danger
          >
            <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4 sm:p-5">
              <p className="text-sm leading-6 text-muted-foreground">
                {t("deleteDescription")}
              </p>

              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="klyx-input mt-5 focus:border-red-500/50 focus:ring-red-500/10"
                placeholder={t("deletePlaceholder")}
              />

              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={
                  deletingAccount || deleteConfirmation !== DELETE_CONFIRMATION
                }
                className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
              >
                {deletingAccount ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Trash2 size={18} />
                )}
                {t("deleteForever")}
              </button>
            </div>
          </SettingsDisclosure>
        </section>

        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          {loggingOut ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <LogOut size={18} />
          )}
          {t("logout")}
        </button>
      </div>
    </main>
  );
}

function SettingsDisclosure({
  icon,
  title,
  open,
  onToggle,
  children,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-muted/55 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              danger
                ? "bg-red-500/10 text-red-600"
                : "bg-blue-600/8 text-blue-600"
            }`}
          >
            {icon}
          </span>
          <span
            className={`truncate font-semibold ${danger ? "text-red-600" : ""}`}
          >
            {title}
          </span>
        </div>

        <ChevronRight
          size={20}
          className={`shrink-0 transition-transform ${
            danger ? "text-red-600" : "text-blue-600"
          } ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border bg-muted/20 px-5 py-5 sm:px-6 sm:py-6">
          {children}
        </div>
      )}
    </div>
  );
}

function SettingsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-background p-4 font-semibold transition hover:bg-muted"
    >
      {label}
    </Link>
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
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="klyx-input focus:border-blue-600/45 focus:ring-4 focus:ring-blue-600/8"
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
      className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
    >
      {loading && <LoaderCircle className="animate-spin" size={17} />}
      {children}
    </button>
  );
}
