"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Languages,
  LockKeyhole,
  LogOut,
  Monitor,
  Moon,
  Save,
  Sun,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTheme, type Theme } from "@/app/components/ThemeProvider";
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

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState("");

  const [currentUserId, setCurrentUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [language, setLanguage] = useState("fr");

  const [notifications, setNotifications] =
    useState<NotificationSettings>({
      bookings: true,
      messages: true,
      promotions: false,
    });

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      const supabase = createClient();

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const profileState = await getProfilesState();
        const profile = profileState.profiles.find(
          (item) => item.id === profileState.activeProfileId
        );

        if (!active) return;

        if (!profile) {
          throw new Error("Impossible de charger ton profil.");
        }

        setCurrentUserId(profile.id);
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");

        const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
        if (savedLanguage) {
          setLanguage(savedLanguage);
        }

        const savedNotifications = localStorage.getItem(NOTIFICATIONS_KEY);

        if (savedNotifications) {
          try {
            setNotifications(JSON.parse(savedNotifications));
          } catch {
            localStorage.removeItem(NOTIFICATIONS_KEY);
          }
        }

        setSavedAccounts(profileState.profiles);
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible de charger les paramètres."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [router]);

  function showSuccess(text: string) {
    setErrorMessage("");
    setMessage(text);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  function showError(text: string) {
    setMessage("");
    setErrorMessage(text);
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      showError("Le prénom et le nom sont obligatoires.");
      return;
    }

    setSavingProfile(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        })
        .eq("id", currentUserId);

      if (error) {
        throw new Error(error.message);
      }

      const profileState = await getProfilesState();
      setSavedAccounts(profileState.profiles);

      showSuccess("Profil enregistré.");
      router.refresh();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer le profil."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = newEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      showError("Entre une adresse e-mail valide.");
      return;
    }

    if (normalizedEmail === email.toLowerCase()) {
      showError("Cette adresse e-mail est déjà utilisée par ton compte.");
      return;
    }

    setSavingEmail(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail,
      });

      if (error) {
        throw new Error(error.message);
      }

      showSuccess(
        "Un message de confirmation a été envoyé à ta nouvelle adresse e-mail."
      );
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Impossible de modifier l’adresse e-mail."
      );
    } finally {
      setSavingEmail(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      showError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setSavingPassword(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      setNewPassword("");
      setConfirmPassword("");
      showSuccess("Mot de passe modifié.");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Impossible de modifier le mot de passe."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  function updateNotifications(
    key: keyof NotificationSettings,
    value: boolean
  ) {
    const updatedSettings = {
      ...notifications,
      [key]: value,
    };

    setNotifications(updatedSettings);
    localStorage.setItem(
      NOTIFICATIONS_KEY,
      JSON.stringify(updatedSettings)
    );

    showSuccess("Préférences de notifications enregistrées.");
  }

  function updateLanguage(value: string) {
    setLanguage(value);
    localStorage.setItem(LANGUAGE_KEY, value);
    document.documentElement.lang = value;
    showSuccess("Langue enregistrée.");
  }

  async function handleSwitchAccount(accountId: string) {
    if (accountId === currentUserId) return;

    setSwitchingAccountId(accountId);
    setErrorMessage("");

    try {
      await switchAccount(accountId);
      setCurrentUserId(accountId);
      setSwitchingAccountId("");
      router.refresh();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Impossible de changer de compte."
      );
      setSwitchingAccountId("");
    }
  }

  async function logout() {
    setLoggingOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-violet-600" />
          <p className="text-muted-foreground">
            Chargement des paramètres...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div>
          <p className="text-sm font-semibold text-violet-600">
            Ton compte KLYX
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Paramètres
          </h1>

          <p className="mt-2 text-muted-foreground">
            Personnalise ton compte, ta sécurité et tes préférences.
          </p>
        </div>

        {message && (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 space-y-6">
          <SettingsSection
            icon={<Sun size={22} />}
            title="Apparence"
            description="Choisis l’apparence de KLYX sur cet appareil."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <ThemeButton
                label="Clair"
                icon={<Sun size={20} />}
                selected={theme === "light"}
                onClick={() => setTheme("light")}
              />

              <ThemeButton
                label="Sombre"
                icon={<Moon size={20} />}
                selected={theme === "dark"}
                onClick={() => setTheme("dark")}
              />

              <ThemeButton
                label="Système"
                icon={<Monitor size={20} />}
                selected={theme === "system"}
                onClick={() => setTheme("system")}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<UserRound size={22} />}
            title="Profil"
            description="Modifie les informations visibles sur ton compte."
          >
            <form onSubmit={updateProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  id="firstName"
                  label="Prénom"
                  value={firstName}
                  onChange={setFirstName}
                  autoComplete="given-name"
                />

                <InputField
                  id="lastName"
                  label="Nom"
                  value={lastName}
                  onChange={setLastName}
                  autoComplete="family-name"
                />
              </div>

              <ActionButton loading={savingProfile}>
                <Save size={18} />
                {savingProfile ? "Enregistrement..." : "Enregistrer le profil"}
              </ActionButton>
            </form>
          </SettingsSection>

          <SettingsSection
            icon={<LockKeyhole size={22} />}
            title="E-mail et mot de passe"
            description="Sécurise l’accès à ton compte."
          >
            <div className="space-y-8">
              <form onSubmit={updateEmail} className="space-y-4">
                <InputField
                  id="email"
                  label="Nouvelle adresse e-mail"
                  type="email"
                  value={newEmail}
                  onChange={setNewEmail}
                  autoComplete="email"
                />

                <ActionButton loading={savingEmail}>
                  {savingEmail
                    ? "Envoi..."
                    : "Modifier l’adresse e-mail"}
                </ActionButton>
              </form>

              <div className="border-t border-border" />

              <form onSubmit={updatePassword} className="space-y-4">
                <InputField
                  id="newPassword"
                  label="Nouveau mot de passe"
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  placeholder="8 caractères minimum"
                />

                <InputField
                  id="confirmPassword"
                  label="Confirmer le mot de passe"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                />

                <ActionButton loading={savingPassword}>
                  {savingPassword
                    ? "Modification..."
                    : "Modifier le mot de passe"}
                </ActionButton>
              </form>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<Bell size={22} />}
            title="Notifications"
            description="Choisis les informations que KLYX peut t’envoyer."
          >
            <div className="space-y-3">
              <NotificationToggle
                label="Réservations"
                description="Demandes, confirmations et changements."
                checked={notifications.bookings}
                onChange={(value) =>
                  updateNotifications("bookings", value)
                }
              />

              <NotificationToggle
                label="Messages"
                description="Nouveaux messages reçus."
                checked={notifications.messages}
                onChange={(value) =>
                  updateNotifications("messages", value)
                }
              />

              <NotificationToggle
                label="Offres et nouveautés"
                description="Actualités et nouveautés de KLYX."
                checked={notifications.promotions}
                onChange={(value) =>
                  updateNotifications("promotions", value)
                }
              />
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<Languages size={22} />}
            title="Langue"
            description="Choisis la langue préférée de ton compte."
          >
            <label
              htmlFor="language"
              className="mb-2 block text-sm font-medium"
            >
              Langue de l’interface
            </label>

            <select
              id="language"
              value={language}
              onChange={(event) => updateLanguage(event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="nl">Nederlands</option>
            </select>

            <p className="mt-3 text-sm text-muted-foreground">
              Le choix est enregistré. La traduction complète des textes sera
              ajoutée lorsque les versions anglaise et néerlandaise seront
              disponibles.
            </p>
          </SettingsSection>

          <SettingsSection
            icon={<UserRound size={22} />}
            title="Profils KLYX"
            description="Change de profil sans ressaisir tes identifiants."
          >
            {savedAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun profil associé à cette connexion.
              </p>
            ) : (
              <div className="space-y-3">
                {savedAccounts.map((account) => {
                  const isCurrent = account.id === currentUserId;
                  const fullName =
                    `${account.firstName} ${account.lastName}`.trim() ||
                    "Profil KLYX";

                  return (
                    <div
                      key={account.id}
                      className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold">{fullName}</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-violet-600">
                          {account.accountType === "provider"
                            ? "Prestataire"
                            : "Client"}
                          {isCurrent ? " · Profil actuel" : ""}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() =>
                              handleSwitchAccount(account.id)
                            }
                            disabled={
                              switchingAccountId === account.id
                            }
                            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                          >
                            {switchingAccountId === account.id
                              ? "Connexion..."
                              : "Utiliser"}
                          </button>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SettingsSection>

          <section className="rounded-3xl border border-red-500/30 bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold text-red-600">
              Déconnexion
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Ta session restera active tant que tu ne te déconnectes pas ou
              que Supabase ne révoque pas la session.
            </p>

            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              <LogOut size={18} />
              {loggingOut ? "Déconnexion..." : "Se déconnecter"}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

type SettingsSectionProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
};

function SettingsSection({
  icon,
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
      <div className="flex gap-3">
        <div className="mt-0.5 text-violet-600">{icon}</div>

        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}

type ThemeButtonProps = {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
};

function ThemeButton({
  label,
  icon,
  selected,
  onClick,
}: ThemeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold transition ${
        selected
          ? "border-violet-600 bg-violet-600 text-white"
          : "border-border bg-background hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

type InputFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
};

function InputField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
}: InputFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium"
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none transition placeholder:text-muted-foreground focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
      />
    </div>
  );
}

type NotificationToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: NotificationToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {description}
        </span>
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-violet-600"
      />
    </label>
  );
}

function ActionButton({
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
      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
