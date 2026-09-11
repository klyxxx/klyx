"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  Settings2,
  ShieldAlert,
  Sun,
  Trash2,
} from "lucide-react";

import AuthTurnstile, {
  AUTH_TURNSTILE_ENABLED,
  type AuthTurnstileHandle,
} from "@/app/components/AuthTurnstile";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
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
  const passwordCaptchaRef = useRef<AuthTurnstileHandle | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [openPanel, setOpenPanel] = useState<SettingsPanel>(null);
  const [otherSettingsOpen, setOtherSettingsOpen] = useState(false);

  const [accountType, setAccountType] =
    useState<"client" | "provider">("client");
  const [activeProfileId, setActiveProfileId] = useState("");
  const [profileCount, setProfileCount] = useState(1);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [passwordCaptchaToken, setPasswordCaptchaToken] = useState("");
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
  // KLYX_SETTINGS_PROFILE_DELETE_ISOLATION_16_07
  // KLYX_SETTINGS_COMPACT_LANGUAGE_PHONE_20260910
  // KLYX_SETTINGS_ASSISTANT_FIRST_20260911

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
        setActiveProfileId(profile.id);
        setProfileCount(state.profiles.length);
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

  function resetPasswordCaptcha() {
    passwordCaptchaRef.current?.reset();
    setPasswordCaptchaToken("");
  }

  async function requestPasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      failure("passwordResetFailed");
      return;
    }

    if (AUTH_TURNSTILE_ENABLED && !passwordCaptchaToken) {
      failure("passwordResetCaptchaRequired");
      return;
    }

    setSavingPassword(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
          captchaToken: AUTH_TURNSTILE_ENABLED
            ? passwordCaptchaToken
            : undefined,
        }
      );

      if (error) {
        failure("passwordResetFailed");
        return;
      }

      success("passwordResetSent");
    } catch {
      failure("passwordResetFailed");
    } finally {
      resetPasswordCaptcha();
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

    const hasOtherProfiles = profileCount > 1;
    const confirmKey: KlyxSettingsPageMessageKey = hasOtherProfiles
      ? "deleteProfileConfirmPrompt"
      : "deleteConfirmPrompt";

    if (!window.confirm(t(confirmKey))) return;

    setDeletingAccount(true);
    setErrorKey(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
          profileId: activeProfileId,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        deletedScope?: "profile" | "account";
      };

      if (!response.ok) {
        failure(resolveKlyxSettingsDeleteErrorKey(result.error));
        setDeletingAccount(false);
        return;
      }

      if (result.deletedScope === "profile") {
        setDeleteConfirmation("");
        router.replace("/accounts");
        router.refresh();
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
  const otherSettingsLabel =
    locale === "fr"
      ? "Autres paramètres"
      : locale === "nl"
        ? "Andere instellingen"
        : locale === "de"
          ? "Weitere Einstellungen"
          : "Other settings";
  const selectedLanguage =
    KLYX_LANGUAGE_OPTIONS.find((option) => option.value === locale) ??
    KLYX_LANGUAGE_OPTIONS[0];
  const languageLabel = selectedLanguage?.label ?? locale;
  const hasOtherProfiles = profileCount > 1;
  const deleteTitleKey: KlyxSettingsPageMessageKey = hasOtherProfiles
    ? "deleteProfileTitle"
    : "deleteTitle";
  const deleteDescriptionKey: KlyxSettingsPageMessageKey = hasOtherProfiles
    ? "deleteProfileDescription"
    : "deleteDescription";
  const deleteActionKey: KlyxSettingsPageMessageKey = hasOtherProfiles
    ? "deleteProfileForever"
    : "deleteForever";

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 pb-28 pt-6 text-foreground sm:px-6 sm:pt-8 lg:pb-12">
      <div className="mx-auto max-w-2xl">
        {/* KLYX_AI_FIRST_SETTINGS_15_03 */}
        {/* KLYX_SETTINGS_PAGE_I18N_16_05 */}
        <Link
          href="/profile"
          className="inline-flex min-h-10 items-center gap-2 px-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={18} />
          {t("profile")}
        </Link>

        <header className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            KLYX
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            {t("title")}
          </h1>
        </header>

        {messageKey && (
          <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {t(messageKey)}
          </div>
        )}
        {errorKey && (
          <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {t(errorKey)}
          </div>
        )}

        <section
          aria-label={t("title")}
          className="mt-7 border-y border-border"
        >
          <SettingsDisclosure
            icon={<Phone size={19} />}
            title={phoneLabel}
            open={openPanel === "phone"}
            onToggle={() => togglePanel("phone")}
            compactContent
          >
            <div className="space-y-3">
              {/* KLYX_REAL_SIDEBAR_PHONE_REPAIR_12_67F */}
              <PhoneSettingsInline />
              {/* KLYX_PHONE_PRIVACY_SETTINGS_12_75 */}
              <PhonePrivacyControls />
              {/* KLYX_PHONE_ACCESS_HISTORY_SETTINGS_12_76 */}
              <PhoneAccessHistory />
            </div>
          </SettingsDisclosure>

          <SettingsDisclosure
            icon={<Languages size={19} />}
            title={`${t("language")} — ${languageLabel}`}
            open={openPanel === "language"}
            onToggle={() => togglePanel("language")}
            compactContent
          >
            <LanguagePicker
              value={locale}
              onChange={setLocale}
              options={KLYX_LANGUAGE_OPTIONS.map(({ value, label }) => ({
                value,
                label,
              }))}
              ariaLabel={t("language")}
            />
          </SettingsDisclosure>
        </section>

        <section className="mt-3 border-b border-border">
          <button
            type="button"
            data-testid="settings-other-toggle"
            aria-expanded={otherSettingsOpen}
            onClick={() => setOtherSettingsOpen((current) => !current)}
            className="flex min-h-14 w-full items-center justify-between gap-4 px-2 py-3 text-left transition hover:bg-muted/45"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center text-blue-600">
                <Settings2 size={19} />
              </span>
              <span className="truncate text-sm font-semibold">
                {otherSettingsLabel}
              </span>
            </span>
            <ChevronRight
              size={19}
              className={`shrink-0 text-blue-600 transition-transform ${
                otherSettingsOpen ? "rotate-90" : ""
              }`}
            />
          </button>

          {otherSettingsOpen && (
            <div
              data-testid="settings-other-content"
              className="border-t border-border"
            >
              <SettingsDisclosure
                icon={<Sun size={19} />}
                title={t("appearance")}
                open={openPanel === "appearance"}
                onToggle={() => togglePanel("appearance")}
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  {(["light", "dark", "system"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTheme(value)}
                      className={`min-h-11 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
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
                  icon={<CreditCard size={19} />}
                  title={t("providerPayments")}
                  open={openPanel === "payments"}
                  onToggle={() => togglePanel("payments")}
                >
                  <Link
                    href="/provider/payments"
                    className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    {t("configurePayments")}
                  </Link>
                </SettingsDisclosure>
              )}

              <SettingsDisclosure
                icon={<LockKeyhole size={19} />}
                title={t("auth")}
                open={openPanel === "auth"}
                onToggle={() => togglePanel("auth")}
              >
                <div className="space-y-7">
                  <form onSubmit={updateEmail} className="space-y-4">
                    <Input
                      label={t("newEmail")}
                      type="email"
                      value={newEmail}
                      onChange={setNewEmail}
                    />
                    <Button loading={savingEmail}>{t("updateEmail")}</Button>
                  </form>

                  {/* KLYX_SETTINGS_PASSWORD_RECOVERY_20260909 */}
                  <div className="space-y-4 border-t border-border pt-5">
                    <AuthTurnstile
                      ref={passwordCaptchaRef}
                      action="password-reset"
                      onTokenChange={setPasswordCaptchaToken}
                    />
                    <button
                      type="button"
                      onClick={() => void requestPasswordReset()}
                      disabled={savingPassword}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {savingPassword && (
                        <LoaderCircle className="animate-spin" size={17} />
                      )}
                      {t("updatePassword")}
                    </button>
                  </div>
                </div>
              </SettingsDisclosure>

              <SettingsDisclosure
                icon={<Bell size={19} />}
                title={t("notifications")}
                open={openPanel === "notifications"}
                onToggle={() => togglePanel("notifications")}
              >
                <div>
                  {notificationRows.map(([key, labelKey, descriptionKey]) => {
                    const enabled = notifications[key];
                    const label = t(labelKey);

                    return (
                      <div
                        key={key}
                        className="flex min-w-0 items-center justify-between gap-5 border-b border-border px-1 py-4 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {label}
                          </p>
                          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
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
                icon={<ShieldAlert size={19} />}
                title={t("privacySupport")}
                open={openPanel === "privacy"}
                onToggle={() => togglePanel("privacy")}
              >
                <div>
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
                icon={<Trash2 size={19} />}
                title={t(deleteTitleKey)}
                open={openPanel === "delete"}
                onToggle={() => togglePanel("delete")}
                danger
              >
                <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t(deleteDescriptionKey)}
                  </p>

                  <input
                    value={deleteConfirmation}
                    onChange={(event) =>
                      setDeleteConfirmation(event.target.value)
                    }
                    className="klyx-input mt-5 focus:border-red-500/50 focus:ring-red-500/10"
                    placeholder={t("deletePlaceholder")}
                  />

                  <button
                    type="button"
                    onClick={() => void deleteAccount()}
                    disabled={
                      deletingAccount ||
                      deleteConfirmation !== DELETE_CONFIRMATION
                    }
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
                  >
                    {deletingAccount ? (
                      <LoaderCircle className="animate-spin" size={18} />
                    ) : (
                      <Trash2 size={18} />
                    )}
                    {t(deleteActionKey)}
                  </button>
                </div>
              </SettingsDisclosure>

              <div className="border-t border-border px-2 py-2">
                <button
                  type="button"
                  onClick={() => void logout()}
                  disabled={loggingOut}
                  className="inline-flex min-h-11 items-center gap-2 px-1 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                >
                  {loggingOut ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <LogOut size={18} />
                  )}
                  {t("logout")}
                </button>
              </div>
            </div>
          )}
        </section>
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
  compactContent = false,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  danger?: boolean;
  compactContent?: boolean;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-4 px-2 py-3 text-left transition hover:bg-muted/45 sm:px-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center ${
              danger ? "text-red-600" : "text-blue-600"
            }`}
          >
            {icon}
          </span>
          <span
            className={`truncate text-sm font-semibold ${
              danger ? "text-red-600" : ""
            }`}
          >
            {title}
          </span>
        </div>

        <ChevronRight
          size={19}
          className={`shrink-0 transition-transform ${
            danger ? "text-red-600" : "text-blue-600"
          } ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`border-t border-border bg-muted/15 ${
            compactContent
              ? "px-2 py-3 sm:px-3"
              : "px-3 py-4 sm:px-4"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function LanguagePicker({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="ml-auto w-full max-w-xs rounded-xl border border-border bg-background p-1.5"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
              selected
                ? "bg-blue-600 text-white"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <span className="truncate">{option.label}</span>
            <span
              aria-hidden="true"
              className="w-4 shrink-0 text-center text-xs font-black"
            >
              {selected ? "✓" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SettingsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-between gap-4 border-b border-border px-1 py-3 text-sm font-semibold transition last:border-b-0 hover:text-blue-600"
    >
      <span>{label}</span>
      <ChevronRight size={17} className="shrink-0 text-blue-600" />
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
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
    >
      {loading && <LoaderCircle className="animate-spin" size={17} />}
      {children}
    </button>
  );
}
