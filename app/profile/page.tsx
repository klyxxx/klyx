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
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Camera,
  ChevronRight,
  LoaderCircle,
  Save,
  UserRound,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import {
  getActiveClientProfile,
  type AccountType,
} from "@/lib/account-switcher";

type ProfileRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  city: string | null;
  avatar_url: string | null;
};

const AVATAR_BUCKET = "avatars";

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function inputClassName(): string {
  return "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";
}

export default function ProfilePage() {
  const router = useRouter();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [accountType, setAccountType] =
    useState<AccountType>("client");

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
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const activeProfile = await getActiveClientProfile();

      if (!activeProfile || !isValidUuid(activeProfile.id)) {
        throw new Error(
          "Le profil actif KLYX est invalide. Sélectionne de nouveau ton profil."
        );
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, age, city, avatar_url"
        )
        .eq("id", activeProfile.id)
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("Profil KLYX introuvable.");
      }

      const profile = data as ProfileRecord;

      if (!isValidUuid(profile.id)) {
        throw new Error("Identifiant du profil KLYX invalide.");
      }

      setProfileId(profile.id);
      setAccountType(activeProfile.accountType);
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setAge(
        typeof profile.age === "number"
          ? profile.age.toString()
          : ""
      );
      setCity(profile.city ?? "");
      setAvatarUrl(profile.avatar_url?.trim() ?? "");
    } catch (error) {
      setProfileId(null);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger le profil."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function uploadAvatar(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (!profileId || !isValidUuid(profileId)) {
      setErrorMessage(
        "Le profil actif n'est pas encore disponible. Actualise la page."
      );
      return;
    }

    if (
      !file.type.startsWith("image/") ||
      file.size > 5 * 1024 * 1024
    ) {
      setErrorMessage(
        "Choisis une image JPG, PNG ou WEBP de 5 Mo maximum."
      );
      return;
    }

    setUploading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("Session expirée.");
      }

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(
        extension
      )
        ? extension
        : "jpg";

      const filePath =
        `${profileId}/avatar-${Date.now()}.${safeExtension}`;

      const { error: uploadError } =
        await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type,
          });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error(
          "Impossible de générer l'adresse de la photo."
        );
      }

      const { data: updatedProfile, error: profileError } =
        await supabase
          .from("profiles")
          .update({
            avatar_url: publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profileId)
          .eq("owner_user_id", user.id)
          .select("id, avatar_url")
          .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (!updatedProfile) {
        throw new Error(
          "KLYX n'a pas pu associer cette photo au profil."
        );
      }

      setAvatarUrl(
        `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
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

  async function saveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!profileId || !isValidUuid(profileId)) {
      setErrorMessage(
        "Profil actif invalide. Actualise la page avant d'enregistrer."
      );
      return;
    }

    const normalizedAge =
      age.trim() === "" ? null : Number(age);

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !city.trim()
    ) {
      setErrorMessage(
        "Le prénom, le nom et la ville sont obligatoires."
      );
      return;
    }

    if (
      normalizedAge !== null &&
      (!Number.isInteger(normalizedAge) ||
        normalizedAge < 18 ||
        normalizedAge > 100)
    ) {
      setErrorMessage(
        "L’âge doit être compris entre 18 et 100 ans."
      );
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("Session expirée.");
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
          age: normalizedAge,
          city: city.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .eq("owner_user_id", user.id)
        .select("id")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error(
          "Impossible de modifier ce profil KLYX."
        );
      }

      setMessage(
        "Informations personnelles enregistrées."
      );
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
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <LoaderCircle
            className="mx-auto animate-spin text-violet-400"
            size={40}
          />

          <p className="mt-4 text-zinc-400">
            Chargement du profil...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={18} />
          Tableau de bord
        </Link>

        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-400">
            {accountType === "provider"
              ? "Profil prestataire"
              : "Profil client"}
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
            Mes informations
          </h1>

          <p className="mt-3 text-zinc-400">
            Gère la photo et les informations personnelles
            du profil actuellement actif.
          </p>
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
          className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-8"
        >
          <div className="flex flex-col gap-6 border-b border-zinc-800 pb-8 sm:flex-row sm:items-center">
            <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-violet-600 bg-zinc-800">
              {avatarUrl ? (
                <img
                  key={avatarUrl}
                  src={avatarUrl}
                  alt={
                    fullName || "Photo de profil"
                  }
                  className="h-full w-full object-cover"
                  onError={() => {
                    setAvatarUrl("");
                    setErrorMessage(
                      "La photo enregistrée est inaccessible. Choisis une nouvelle photo."
                    );
                  }}
                />
              ) : (
                <UserRound
                  size={62}
                  className="text-zinc-500"
                />
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold">
                Photo de profil
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Une photo claire augmente la confiance des
                autres utilisateurs.
              </p>

              <label
                className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold ${
                  profileId
                    ? "cursor-pointer bg-violet-600 hover:bg-violet-700"
                    : "cursor-not-allowed bg-zinc-700 text-zinc-400"
                }`}
              >
                {uploading ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={18}
                  />
                ) : (
                  <Camera size={18} />
                )}

                {uploading
                  ? "Envoi..."
                  : "Changer la photo"}

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadAvatar}
                  disabled={uploading || !profileId}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Field
              id="firstName"
              label="Prénom"
              value={firstName}
              onChange={setFirstName}
            />

            <Field
              id="lastName"
              label="Nom"
              value={lastName}
              onChange={setLastName}
            />

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
            disabled={
              saving ||
              uploading ||
              !profileId
            }
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle
                className="animate-spin"
                size={19}
              />
            ) : (
              <Save size={19} />
            )}

            {saving
              ? "Enregistrement..."
              : "Enregistrer mes informations"}
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
                <p className="font-bold">
                  Gérer ma fiche commerciale
                </p>

                <p className="mt-1 text-sm text-violet-200/70">
                  Services, tarifs, zones, horaires,
                  galerie et documents
                </p>
              </div>
            </div>

            <ChevronRight
              size={22}
              className="text-violet-300"
            />
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
        className="mb-2 block text-sm font-medium text-zinc-300"
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className={inputClassName()}
      />
    </div>
  );
}