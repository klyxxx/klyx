"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe2, LoaderCircle, MapPin, UserRound } from "lucide-react";

import KlyxSelect from "@/app/components/KlyxSelect";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxFirstProfileLocale,
  translateKlyxFirstProfile,
  translateKlyxFirstProfileApiError,
  type KlyxFirstProfileMessageKey,
} from "@/lib/klyx-first-profile-i18n";
import { KLYX_SUPPORTED_MARKETS } from "@/lib/klyx-supported-markets";

// The database still requires an account_type while KLYX migrates away from
// permanent roles. New accounts use one canonical profile and capabilities are
// resolved by the assistant per intent.

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default function FirstProfileSetup({
  initialFullName,
}: {
  initialFullName: string;
}) {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const pageLocale = resolveKlyxFirstProfileLocale(locale);
  const t = (key: KlyxFirstProfileMessageKey) =>
    translateKlyxFirstProfile(locale, key);
  const initialName = useMemo(() => splitName(initialFullName), [initialFullName]);

  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const marketOptions = useMemo(() => {
    let displayNames: Intl.DisplayNames | null = null;

    try {
      displayNames = new Intl.DisplayNames([pageLocale], { type: "region" });
    } catch {
      displayNames = null;
    }

    return [...KLYX_SUPPORTED_MARKETS]
      .map((market) => {
        const localizedName = displayNames?.of(market.countryCode);
        return {
          value: market.countryCode,
          label: `${
            localizedName && localizedName !== market.countryCode
              ? localizedName
              : market.countryName
          } · ${market.currencyCode}`,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, pageLocale));
  }, [pageLocale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanCity = city.trim();

    if (!cleanFirstName || !cleanLastName || !cleanCity) {
      setErrorMessage(t("identityRequired"));
      return;
    }

    if (!countryCode) {
      setErrorMessage(t("marketRequired"));
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/profiles/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: cleanFirstName,
          lastName: cleanLastName,
          city: cleanCity,
          countryCode,
          // Transitional schema value only; not a permanent product role.
          accountType: "client",
          serviceId: null,
        }),
      });

      const body = (await response.json()) as {
        profileId?: string;
        error?: string;
      };

      if (!response.ok || !body.profileId) {
        setErrorMessage(
          translateKlyxFirstProfileApiError(
            locale,
            body.error,
            "profileCreateFailed"
          )
        );
        return;
      }

      router.replace("/assistant");
      router.refresh();
    } catch {
      setErrorMessage(t("profileCreateFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-[2rem] border border-border bg-card p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2563EB]">
            KLYX
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
            {locale === "en"
              ? "One account for everything"
              : locale === "nl"
                ? "Eén account voor alles"
                : locale === "de"
                  ? "Ein Konto für alles"
                  : "Un compte pour tout"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {locale === "en"
              ? "Tell KLYX who you are and where you are. You will request services or earn money later from the same assistant."
              : locale === "nl"
                ? "Vertel KLYX wie je bent en waar je bent. Daarna vraag je diensten of verdien je geld via dezelfde assistent."
                : locale === "de"
                  ? "Sag KLYX, wer du bist und wo du bist. Danach kannst du über denselben Assistenten Services anfragen oder Geld verdienen."
                  : "Indique simplement qui tu es et où tu te trouves. Ensuite, tu pourras obtenir un service ou gagner de l’argent depuis le même assistant."}
          </p>
        </section>

        <form onSubmit={submit} className="klyx-card mt-7 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <UserRound size={17} />
                {t("firstName")}
              </span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                maxLength={60}
                autoComplete="given-name"
                className="klyx-input"
                placeholder={t("firstName")}
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <UserRound size={17} />
                {t("lastName")}
              </span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                maxLength={60}
                autoComplete="family-name"
                className="klyx-input"
                placeholder={t("lastName")}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <MapPin size={17} />
                {t("city")}
              </span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                maxLength={100}
                autoComplete="address-level2"
                className="klyx-input"
                placeholder={t("cityPlaceholder")}
              />
            </label>

            <div>
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Globe2 size={17} />
                {t("market")}
              </span>
              <KlyxSelect
                value={countryCode}
                onChange={setCountryCode}
                placeholder={t("marketPlaceholder")}
                options={marketOptions}
                ariaLabel={t("market")}
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("marketHint")}
              </p>
            </div>
          </div>

          {errorMessage && (
            <p className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
              {errorMessage}
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-6 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <ArrowRight size={17} />
              )}
              {submitting
                ? t("creating")
                : locale === "en"
                  ? "Continue to KLYX"
                  : locale === "nl"
                    ? "Verder naar KLYX"
                    : locale === "de"
                      ? "Weiter zu KLYX"
                      : "Continuer vers KLYX"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
