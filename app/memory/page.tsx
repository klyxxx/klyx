"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  Brain,
  CheckCircle2,
  Languages,
  LoaderCircle,
  PawPrint,
  Save,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import KlyxSelect from "@/app/components/KlyxSelect";

type MemoryResponse = {
  preferences?: {
    default_city: string | null;
    default_budget: number | null;
    preferred_service_slugs: string[];
    household_notes: string | null;
    scheduling_notes: string | null;
    ai_memory_enabled: boolean;
  };
  memoryProfile?: {
    household_type: string | null;
    children_count: number;
    pet_types: string[];
    preferred_languages: string[];
    access_notes: string | null;
    cleaning_notes: string | null;
    babysitting_notes: string | null;
    moving_notes: string | null;
    handyman_notes: string | null;
    memory_enabled: boolean;
    last_confirmed_at: string | null;
  };
  message?: string;
  error?: string;
};

const SERVICES = [
  ["babysitting", "Baby-sitting"],
  ["cleaning", "Ménage"],
  ["moving", "Déménagement"],
  ["handyman", "Bricolage"],
] as const;

function listToText(values: string[]): string {
  return values.join(", ");
}

function textToList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

export default function MemoryPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const [defaultCity, setDefaultCity] = useState("");
  const [defaultBudget, setDefaultBudget] =
    useState("");
  const [preferredServices, setPreferredServices] =
    useState<string[]>([]);
  const [householdNotes, setHouseholdNotes] =
    useState("");
  const [schedulingNotes, setSchedulingNotes] =
    useState("");
  const [householdType, setHouseholdType] =
    useState("");
  const [childrenCount, setChildrenCount] =
    useState("0");
  const [petTypes, setPetTypes] = useState("");
  const [preferredLanguages, setPreferredLanguages] =
    useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [cleaningNotes, setCleaningNotes] =
    useState("");
  const [babysittingNotes, setBabysittingNotes] =
    useState("");
  const [movingNotes, setMovingNotes] = useState("");
  const [handymanNotes, setHandymanNotes] =
    useState("");
  const [memoryEnabled, setMemoryEnabled] =
    useState(true);
  const [lastConfirmedAt, setLastConfirmedAt] =
    useState<string | null>(null);

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  function applyResult(result: MemoryResponse) {
    const preferences = result.preferences;
    const memory = result.memoryProfile;

    if (!preferences || !memory) return;

    setDefaultCity(preferences.default_city ?? "");
    setDefaultBudget(
      preferences.default_budget == null
        ? ""
        : String(preferences.default_budget)
    );
    setPreferredServices(
      preferences.preferred_service_slugs ?? []
    );
    setHouseholdNotes(
      preferences.household_notes ?? ""
    );
    setSchedulingNotes(
      preferences.scheduling_notes ?? ""
    );
    setHouseholdType(memory.household_type ?? "");
    setChildrenCount(
      String(memory.children_count ?? 0)
    );
    setPetTypes(listToText(memory.pet_types ?? []));
    setPreferredLanguages(
      listToText(memory.preferred_languages ?? [])
    );
    setAccessNotes(memory.access_notes ?? "");
    setCleaningNotes(memory.cleaning_notes ?? "");
    setBabysittingNotes(
      memory.babysitting_notes ?? ""
    );
    setMovingNotes(memory.moving_notes ?? "");
    setHandymanNotes(memory.handyman_notes ?? "");
    setMemoryEnabled(
      preferences.ai_memory_enabled &&
        memory.memory_enabled
    );
    setLastConfirmedAt(memory.last_confirmed_at);
  }

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/memory/profile",
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result =
        (await response.json()) as MemoryResponse;

      if (!response.ok) {
        throw new Error(
          result.error || "Chargement impossible."
        );
      }

      applyResult(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger la mémoire."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleService(service: string) {
    setPreferredServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service]
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/memory/profile",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            defaultCity,
            defaultBudget:
              defaultBudget.trim() === ""
                ? null
                : Number(defaultBudget),
            preferredServiceSlugs:
              preferredServices,
            householdNotes,
            schedulingNotes,
            householdType,
            childrenCount: Number(childrenCount),
            petTypes: textToList(petTypes),
            preferredLanguages: textToList(
              preferredLanguages
            ),
            accessNotes,
            cleaningNotes,
            babysittingNotes,
            movingNotes,
            handymanNotes,
            memoryEnabled,
          }),
        }
      );

      const result =
        (await response.json()) as MemoryResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Enregistrement impossible."
        );
      }

      applyResult(result);
      setMessage(
        result.message || "Mémoire enregistrée."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Enregistrement impossible."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory() {
    const confirmed = window.confirm(
      "Supprimer toute la mémoire personnelle de ce profil client ?"
    );

    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/memory/profile",
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result =
        (await response.json()) as MemoryResponse;

      if (!response.ok) {
        throw new Error(
          result.error || "Suppression impossible."
        );
      }

      setDefaultCity("");
      setDefaultBudget("");
      setPreferredServices([]);
      setHouseholdNotes("");
      setSchedulingNotes("");
      setHouseholdType("");
      setChildrenCount("0");
      setPetTypes("");
      setPreferredLanguages("");
      setAccessNotes("");
      setCleaningNotes("");
      setBabysittingNotes("");
      setMovingNotes("");
      setHandymanNotes("");
      setMemoryEnabled(false);
      setLastConfirmedAt(null);
      setMessage(
        result.message || "Mémoire supprimée."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Suppression impossible."
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle
          className="animate-spin text-violet-600"
          size={38}
        />
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#32135f_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Brain size={15} />
            Mémoire client uniquement
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            KLYX apprend tes habitudes
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Tu choisis exactement ce que KLYX peut retenir.
            Cette mémoire appartient uniquement à ton profil
            client et peut être désactivée ou supprimée.
          </p>

          {lastConfirmedAt && (
            <p className="mt-5 text-xs text-white/55">
              Dernière confirmation :{" "}
              {new Date(
                lastConfirmedAt
              ).toLocaleString("fr-BE")}
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <div className="flex gap-3">
            <ShieldCheck
              className="shrink-0 text-emerald-600"
              size={22}
            />
            <div>
              <p className="font-black">
                Contrôle total de la mémoire
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Les prestataires ne voient pas ces informations
                automatiquement. Les détails utiles ne doivent être
                transmis que lorsqu’une réservation le nécessite.
              </p>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={19} />
            {message}
          </div>
        )}

        <form onSubmit={save} className="mt-8 space-y-6">
          <section className="klyx-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <UsersRound className="text-violet-600" />
              <h2 className="text-2xl font-black">
                Mon foyer
              </h2>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field label="Ville habituelle">
                <input
                  value={defaultCity}
                  onChange={(event) =>
                    setDefaultCity(event.target.value)
                  }
                  className="klyx-input"
                  placeholder="Bruxelles"
                />
              </Field>

              <Field label="Budget habituel maximum">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={defaultBudget}
                  onChange={(event) =>
                    setDefaultBudget(event.target.value)
                  }
                  className="klyx-input"
                  placeholder="80"
                />
              </Field>

              <Field label="Type de lieu">
                <KlyxSelect
                  value={householdType}
                  onChange={setHouseholdType}
                  options={[
                    { value: "", label: "Non renseigné" },
                    { value: "apartment", label: "Appartement" },
                    { value: "house", label: "Maison" },
                    { value: "studio", label: "Studio" },
                    { value: "office", label: "Bureau" },
                    { value: "other", label: "Autre" },
                  ]}
                  ariaLabel="Type de lieu"
                />
              </Field>

              <Field label="Nombre d’enfants">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={childrenCount}
                  onChange={(event) =>
                    setChildrenCount(event.target.value)
                  }
                  className="klyx-input"
                />
              </Field>

              <Field
                label="Animaux"
                hint="Sépare par des virgules"
              >
                <div className="relative">
                  <PawPrint
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={17}
                  />
                  <input
                    value={petTypes}
                    onChange={(event) =>
                      setPetTypes(event.target.value)
                    }
                    className="klyx-input pl-11"
                    placeholder="chien, chat"
                  />
                </div>
              </Field>

              <Field
                label="Langues préférées"
                hint="Sépare par des virgules"
              >
                <div className="relative">
                  <Languages
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={17}
                  />
                  <input
                    value={preferredLanguages}
                    onChange={(event) =>
                      setPreferredLanguages(
                        event.target.value
                      )
                    }
                    className="klyx-input pl-11"
                    placeholder="français, anglais"
                  />
                </div>
              </Field>
            </div>

            <Field
              label="Informations générales utiles"
              className="mt-5"
            >
              <textarea
                rows={4}
                maxLength={1000}
                value={householdNotes}
                onChange={(event) =>
                  setHouseholdNotes(event.target.value)
                }
                className="klyx-input resize-none"
                placeholder="Ex. troisième étage, ascenseur étroit."
              />
            </Field>

            <Field
              label="Accès au lieu"
              className="mt-5"
            >
              <textarea
                rows={3}
                maxLength={500}
                value={accessNotes}
                onChange={(event) =>
                  setAccessNotes(event.target.value)
                }
                className="klyx-input resize-none"
                placeholder="Évite les codes secrets permanents. Indique seulement les consignes générales."
              />
            </Field>
          </section>

          <section className="klyx-card p-6 sm:p-8">
            <h2 className="text-2xl font-black">
              Services habituels
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map(([slug, label]) => {
                const selected =
                  preferredServices.includes(slug);

                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => toggleService(slug)}
                    className={`rounded-2xl border p-4 text-left font-black transition ${
                      selected
                        ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                        : "border-border bg-background"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <MemoryTextarea
                label="Habitudes de ménage"
                value={cleaningNotes}
                onChange={setCleaningNotes}
                placeholder="Ex. vendredi matin, produits sans parfum."
              />
              <MemoryTextarea
                label="Habitudes de baby-sitting"
                value={babysittingNotes}
                onChange={setBabysittingNotes}
                placeholder="Ex. samedi soir, deux enfants."
              />
              <MemoryTextarea
                label="Habitudes de déménagement"
                value={movingNotes}
                onChange={setMovingNotes}
                placeholder="Ex. besoin d’un véhicule et de cartons."
              />
              <MemoryTextarea
                label="Habitudes de bricolage"
                value={handymanNotes}
                onChange={setHandymanNotes}
                placeholder="Ex. prestataire apportant ses outils."
              />
            </div>

            <Field
              label="Habitudes générales de planning"
              className="mt-5"
            >
              <textarea
                rows={3}
                maxLength={1000}
                value={schedulingNotes}
                onChange={(event) =>
                  setSchedulingNotes(event.target.value)
                }
                className="klyx-input resize-none"
                placeholder="Ex. disponible le matin en semaine."
              />
            </Field>
          </section>

          <section className="klyx-card p-6 sm:p-8">
            <label className="flex items-start gap-4 rounded-2xl border border-border bg-muted/30 p-5">
              <input
                type="checkbox"
                checked={memoryEnabled}
                onChange={(event) =>
                  setMemoryEnabled(event.target.checked)
                }
                className="mt-1 h-5 w-5 accent-violet-600"
              />
              <div>
                <p className="font-black">
                  Autoriser KLYX à utiliser cette mémoire
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Désactive cette option pour empêcher
                  l’assistant d’utiliser ces habitudes dans ses
                  recommandations.
                </p>
              </div>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 font-black text-white disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle
                  className="animate-spin"
                  size={18}
                />
              ) : (
                <Save size={18} />
              )}
              Enregistrer ma mémoire
            </button>

            <button
              type="button"
              onClick={() => void deleteMemory()}
              disabled={deleting}
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/25 text-sm font-black text-rose-600 disabled:opacity-50"
            >
              {deleting ? (
                <LoaderCircle
                  className="animate-spin"
                  size={18}
                />
              ) : (
                <Trash2 size={18} />
              )}
              Supprimer toute ma mémoire
            </button>
          </section>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-black">
        {label}
      </span>
      {hint && (
        <span className="mb-2 block text-xs text-muted-foreground">
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

function MemoryTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <textarea
        rows={4}
        maxLength={1000}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="klyx-input resize-none"
        placeholder={placeholder}
      />
    </Field>
  );
}


