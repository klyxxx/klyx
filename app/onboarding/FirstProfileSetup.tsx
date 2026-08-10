"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  LoaderCircle,
  MapPin,
  UserRound,
} from "lucide-react";
import KlyxSelect from "@/app/components/KlyxSelect";

type AccountType = "client" | "provider";

type ServiceOption = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  initialFullName: string;
  initialAccountType: AccountType;
};

function splitName(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default function FirstProfileSetup({
  initialFullName,
  initialAccountType,
}: Props) {
  const router = useRouter();

  const initialName = useMemo(
    () => splitName(initialFullName),
    [initialFullName]
  );

  const [firstName, setFirstName] =
    useState(initialName.firstName);
  const [lastName, setLastName] =
    useState(initialName.lastName);
  const [city, setCity] = useState("");
  const [accountType, setAccountType] =
    useState<AccountType>(initialAccountType);
  const [serviceId, setServiceId] =
    useState("");
  const [services, setServices] =
    useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] =
    useState(true);
  const [submitting, setSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      try {
        const response = await fetch(
          "/api/profiles/manage",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const body =
          (await response.json()) as {
            services?: ServiceOption[];
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            body.error ||
              "Impossible de charger les services."
          );
        }

        if (!cancelled) {
          setServices(
            Array.isArray(body.services)
              ? body.services
              : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible de charger les services."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingServices(false);
        }
      }
    }

    void loadServices();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (accountType === "client") {
      setServiceId("");
    }
  }, [accountType]);

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanFirstName =
      firstName.trim();
    const cleanLastName =
      lastName.trim();
    const cleanCity = city.trim();

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanCity
    ) {
      setErrorMessage(
        "Prénom, nom et ville sont obligatoires."
      );
      return;
    }

    if (
      accountType === "provider" &&
      !serviceId
    ) {
      setErrorMessage(
        "Choisis ton premier métier."
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/profiles/manage",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            firstName:
              cleanFirstName,
            lastName:
              cleanLastName,
            city: cleanCity,
            accountType,
            serviceId:
              accountType === "provider"
                ? serviceId
                : null,
          }),
        }
      );

      const body =
        (await response.json()) as {
          profileId?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !body.profileId
      ) {
        throw new Error(
          body.error ||
            "Impossible de créer le profil KLYX."
        );
      }

      /*
       * L'API pose déjà le cookie klyx_active_profile.
       * On recharge uniquement les Server Components
       * de l'onboarding, pas tout le navigateur.
       */
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de créer le profil KLYX."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#32135f_52%,#111827_100%)] p-7 text-white shadow-2xl sm:p-10">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl" />

          <div className="relative z-10 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
              Première configuration
            </p>

            <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] sm:text-5xl">
              Créons ton premier profil KLYX
            </h1>

            <p className="mt-4 text-sm leading-7 text-white/70 sm:text-base">
              Ton compte est connecté. Il manque seulement quelques
              informations pour créer ton espace actif.
            </p>
          </div>
        </section>

        <form
          onSubmit={submit}
          className="klyx-card mt-7 p-6 sm:p-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <UserRound size={17} />
                Prénom
              </span>

              <input
                value={firstName}
                onChange={(event) =>
                  setFirstName(
                    event.target.value
                  )
                }
                maxLength={60}
                autoComplete="given-name"
                className="klyx-input"
                placeholder="Prénom"
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <UserRound size={17} />
                Nom
              </span>

              <input
                value={lastName}
                onChange={(event) =>
                  setLastName(
                    event.target.value
                  )
                }
                maxLength={60}
                autoComplete="family-name"
                className="klyx-input"
                placeholder="Nom"
              />
            </label>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 flex items-center gap-2 text-sm font-black">
              <MapPin size={17} />
              Ville
            </span>

            <input
              value={city}
              onChange={(event) =>
                setCity(event.target.value)
              }
              maxLength={100}
              autoComplete="address-level2"
              className="klyx-input"
              placeholder="Ex. Bruxelles"
            />
          </label>

          <div className="mt-6">
            <p className="text-sm font-black">
              Quel espace veux-tu créer ?
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setAccountType("client")
                }
                className={`rounded-2xl border p-5 text-left transition ${
                  accountType === "client"
                    ? "border-violet-500 bg-violet-500/10 ring-4 ring-violet-500/10"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <UserRound
                  size={22}
                  className={
                    accountType ===
                    "client"
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-muted-foreground"
                  }
                />

                <p className="mt-3 font-black">
                  Client
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Je cherche et réserve des services.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setAccountType(
                    "provider"
                  )
                }
                className={`rounded-2xl border p-5 text-left transition ${
                  accountType ===
                  "provider"
                    ? "border-blue-500 bg-blue-500/10 ring-4 ring-blue-500/10"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <BriefcaseBusiness
                  size={22}
                  className={
                    accountType ===
                    "provider"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground"
                  }
                />

                <p className="mt-3 font-black">
                  Prestataire
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Je propose mes compétences aux clients.
                </p>
              </button>
            </div>
          </div>

          {accountType === "provider" && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-black">
                Premier métier
              </p>

              <KlyxSelect
                value={serviceId}
                onChange={setServiceId}
                disabled={loadingServices}
                placeholder={
                  loadingServices
                    ? "Chargement..."
                    : "Choisir un métier"
                }
                options={services.map(
                  (service) => ({
                    value: service.id,
                    label: service.name,
                  })
                )}
                ariaLabel="Premier métier"
              />

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Tu pourras ajouter d’autres métiers ensuite depuis ton
                espace prestataire.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              loadingServices
            }
            className="klyx-button mt-7 w-full disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle
                className="animate-spin"
                size={18}
              />
            ) : (
              <ArrowRight size={18} />
            )}

            {submitting
              ? "Création du profil..."
              : accountType ===
                  "provider"
                ? "Créer mon espace prestataire"
                : "Créer mon espace client"}
          </button>
        </form>
      </div>
    </main>
  );
}



