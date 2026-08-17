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
  return "w-full rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 px-4 py-3 text-foreground dark:text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";
}

export default function ProfilePage() {
  const [accountType, setAccountType] = useState<AccountType>("client");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fullName = useMemo(
    () => `${firstName.trim()} ${lastName.trim()}`.trim(),
    [firstName, lastName]
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/profile/me", {
        cache: "no-store",
      });

      const body = (await response.json()) as ProfilePayload;

      if (!response.ok) {
        throw new Error(body.error || "Impossible de charger le profil.");
      }

      if (!body.profile) {
        throw new Error("Profil KLYX introuvable.");
      }

      setFirstName(body.profile.firstName);
      setLastName(body.profile.lastName);
      setAge(body.profile.age === null ? "" : String(body.profile.age));
      setCity(body.profile.city);
      setAvatarUrl(body.profile.avatarUrl ?? "");
      setAccountType(body.profile.accountType);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger le profil."
      );
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
      setErrorMessage("Choisis une image JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("La photo doit faire 5 Mo maximum.");
      return;
    }

    setUploading(true);
    setMessage("");
    setErrorMessage("");

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
        throw new Error(
          body.error || "Impossible d’envoyer la photo."
        );
      }

      setAvatarUrl(
        `${body.avatarUrl}${body.avatarUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
      );
      setMessage("Photo de profil mise à jour.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’envoyer la photo."
      );
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setErrorMessage("");

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
        throw new Error(
          body.error || "Impossible d’enregistrer le profil."
        );
      }

      setMessage("Informations personnelles enregistrées.");
      await loadProfile();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer le profil."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 text-foreground dark:text-white">
        <div className="text-center">
          <LoaderCircle
            className="mx-auto animate-spin text-violet-400"
            size={40}
          />
          <p className="mt-4 text-muted-foreground dark:text-zinc-400">
            Chargement du profil...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background dark:bg-zinc-950 px-4 py-8 text-foreground dark:text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:text-white"
        >
          <ArrowLeft size={18} />
          Tableau de bord
        </Link>

        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-400">
            {accountType === "provider" ? "Profil prestataire" : "Profil client"}
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
            Mes informations
          </h1>
                    {/* KLYX_AI_FIRST_PROFILE_15_03 */}
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            {message}
          </div>
        )}

        <form
          onSubmit={saveProfile}
          className="mt-8 rounded-3xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 p-5 sm:p-8"
        >
          <div className="flex flex-col gap-6 border-b border-border dark:border-zinc-800 pb-8 sm:flex-row sm:items-center">
            <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-violet-600 bg-muted dark:bg-zinc-800">
              {avatarUrl ? (
                <img
                  key={avatarUrl}
                  src={avatarUrl}
                  alt={fullName || "Photo de profil"}
                  className="h-full w-full object-cover"
                  onError={() =>
                    setErrorMessage("La photo enregistrée est inaccessible.")
                  }
                />
              ) : (
                <UserRound size={62} className="text-muted-foreground dark:text-zinc-500" />
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold">Photo de profil</h2>


              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 font-semibold hover:bg-violet-700">
                {uploading ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Camera size={18} />
                )}
                {uploading ? "Envoi..." : "Changer la photo"}
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

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Field id="firstName" label="Prénom" value={firstName} onChange={setFirstName} />
            <Field id="lastName" label="Nom" value={lastName} onChange={setLastName} />
            <Field
              id="age"
              label="Âge"
              value={age}
              onChange={setAge}
              type="number"
              min="18"
              max="100"
              placeholder="Exemple : 28"
            />
            <Field
              id="city"
              label="Ville"
              value={city}
              onChange={setCity}
              placeholder="Exemple : Bruxelles"
            />
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle className="animate-spin" size={19} />
            ) : (
              <Save size={19} />
            )}
            {saving ? "Enregistrement..." : "Enregistrer mes informations"}
          </button>
        </form>

        {accountType === "provider" && (
          <Link
            href="/provider"
            className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5 transition hover:bg-violet-500/15"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500 text-white">
                <BriefcaseBusiness size={22} />
              </span>
              <div>
                <p className="font-bold">Gérer ma fiche commerciale</p>

              </div>
            </div>
            <ChevronRight size={22} className="text-violet-300" />
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
        className="mb-2 block text-sm font-medium text-foreground/80 dark:text-zinc-300"
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
