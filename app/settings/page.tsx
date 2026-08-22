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
  Monitor,
  Moon,
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
const LANGUAGE_KEY = "klyx_language";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { setLocale } = useKlyxLocale();

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
  const [language, setLanguage] = useState("fr");
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
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

        if (!profile) throw new Error("Profil introuvable.");
        if (!active) return;

        setCurrentProfileId(profile.id);
        setAccountType(profile.accountType);
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");
        setSavedAccounts(state.profiles);

        const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
        if (savedLanguage) setLanguage(savedLanguage);

        const savedNotifications = localStorage.getItem(NOTIFICATIONS_KEY);
        if (savedNotifications) {
          setNotifications(JSON.parse(savedNotifications));
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les paramètres."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  function success(text: string) {
    setErrorMessage("");
    setMessage(text);
  }

  function failure(text: string) {
    setMessage("");
    setErrorMessage(text);
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        })
        .eq("id", currentProfileId);

      if (error) throw new Error(error.message);
      success("Profil enregistré.");
    } catch (error) {
      failure(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEmail(true);

    try {
      if (!newEmail.trim() || newEmail.trim() === email) {
        throw new Error("Entre une nouvelle adresse e-mail.");
      }

      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim().toLowerCase(),
      });

      if (error) throw new Error(error.message);
      success("E-mail de confirmation envoyé.");
    } catch (error) {
      failure(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);

    try {
      if (newPassword.length < 8) {
        throw new Error("8 caractères minimum.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Les mots de passe ne correspondent pas.");
      }

      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw new Error(error.message);
      setNewPassword("");
      setConfirmPassword("");
      success("Mot de passe modifié.");
    } catch (error) {
      failure(error instanceof Error ? error.message : "Erreur.");
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
    if (deleteConfirmation !== "SUPPRIMER") return;
    if (!window.confirm("Supprimer définitivement le compte KLYX ?")) return;

    setDeletingAccount(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Suppression impossible.");
      }

      localStorage.clear();
      router.replace("/signup?deleted=1");
      router.refresh();
    } catch (error) {
      failure(error instanceof Error ? error.message : "Erreur.");
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

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        {/* KLYX_AI_FIRST_SETTINGS_15_03 */}
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Paramètres</h1>

        {message && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
            {message}
          </div>
        )}
        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* KLYX_REAL_SIDEBAR_PHONE_REPAIR_12_67F */}
          <PhoneSettingsInline />
          {/* KLYX_PHONE_PRIVACY_SETTINGS_12_75 */}
          <PhonePrivacyControls />
          {/* KLYX_PHONE_ACCESS_HISTORY_SETTINGS_12_76 */}
          <Section icon={<Sun />} title="Apparence">
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
                    ? "Clair"
                    : value === "dark"
                      ? "Sombre"
                      : "Système"}
                </button>
              ))}
            </div>
          </Section>

          {accountType === "provider" && (
            <Section icon={<CreditCard />} title="Paiements prestataire">
              <Link
                href="/provider/payments"
                className="inline-flex h-12 items-center rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white"
              >
                Configurer les paiements
              </Link>
            </Section>
          )}

          <Section icon={<UserRound />} title="Profil">
            <form onSubmit={updateProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Prénom" value={firstName} onChange={setFirstName} />
                <Input label="Nom" value={lastName} onChange={setLastName} />
              </div>
              <Button loading={savingProfile}>
                <Save size={18} />
                Enregistrer
              </Button>
            </form>
          </Section>

          <Section icon={<LockKeyhole />} title="E-mail et mot de passe">
            <div className="space-y-8">
              <form onSubmit={updateEmail} className="space-y-4">
                <Input
                  label="Nouvel e-mail"
                  type="email"
                  value={newEmail}
                  onChange={setNewEmail}
                />
                <Button loading={savingEmail}>Modifier l’e-mail</Button>
              </form>

              <form onSubmit={updatePassword} className="space-y-4 border-t border-border pt-6">
                <Input
                  label="Nouveau mot de passe"
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                />
                <Input
                  label="Confirmer"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
                <Button loading={savingPassword}>Modifier le mot de passe</Button>
              </form>
            </div>
          </Section>

                    <Section icon={<Bell />} title="Notifications">
            <div className="space-y-3">
              {(
                [
                  [
                    "bookings",
                    "Réservations",
                    "Réservations et rappels.",
                  ],
                  [
                    "messages",
                    "Messages",
                    "Nouveaux messages.",
                  ],
                  [
                    "promotions",
                    "Nouveautés",
                    "Nouveautés KLYX.",
                  ],
                ] as const
              ).map(([key, label, description]) => {
                const enabled = notifications[key];

                return (
                  <div
                    key={key}
                    className="flex min-w-0 items-center justify-between gap-5 rounded-2xl border border-border bg-background/50 p-4 sm:p-5"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-foreground">
                        {label}
                      </p>

                      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {description}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${label} : ${
                        enabled ? "activé" : "désactivé"
                      }`}
                      onClick={() =>
                        updateNotifications(key, !enabled)
                      }
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

          <Section icon={<Languages />} title="Langue">
            <KlyxSelect
              value={language}
              onChange={(value) => {
                setLanguage(value);
                setLocale(value);
              }}
              options={[
                { value: "fr", label: "Français" },
                { value: "en", label: "English" },
                { value: "nl", label: "Nederlands" },
              ]}
              ariaLabel="Langue"
            />
          </Section>

          <Section icon={<UserRound />} title="Profils KLYX">
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
                      {account.accountType}
                    </p>
                  </div>
                  {account.id !== currentProfileId && (
                    <button
                      type="button"
                      onClick={async () => {
                        setSwitchingAccountId(account.id);
                        await switchAccount(account.id);
                        window.location.reload();
                      }}
                      disabled={switchingAccountId === account.id}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"
                    >
                      Utiliser
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Section>

                    <Section icon={<ShieldAlert />} title="Confidentialité et assistance">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/privacy"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                Politique de confidentialité
              </Link>
              <Link
                href="/terms"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                Conditions d’utilisation
              </Link>
              <Link
                href="/support"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                Assistance KLYX
              </Link>
              <Link
                href="/delete-account"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                Suppression du compte sur le web
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
              Se déconnecter
            </button>
          </section>

          <section className="rounded-3xl border border-rose-500/30 bg-rose-500/[0.06] p-6">
            <div className="flex gap-4">
              <ShieldAlert className="text-rose-600" />
              <div>
                <h2 className="text-xl font-black text-rose-600">
                  Supprimer mon compte
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Une réservation active doit être terminée ou annulée. Si le compte contient des paiements à conserver, KLYX peut traiter la suppression avec anonymisation et conservation limitée des données obligatoires.
                </p>
              </div>
            </div>

            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className="klyx-input mt-5"
              placeholder="Écris SUPPRIMER"
            />

            <button
              type="button"
              onClick={() => void deleteAccount()}
              disabled={
                deletingAccount || deleteConfirmation !== "SUPPRIMER"
              }
              className="mt-4 inline-flex h-12 items-center gap-2 rounded-2xl bg-rose-600 px-5 font-bold text-white disabled:opacity-40"
            >
              {deletingAccount ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Trash2 size={18} />
              )}
              Supprimer définitivement
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
