"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Globe2,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import KlyxMarketSelect from "@/app/components/KlyxMarketSelect";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxFirstProfile,
  translateKlyxFirstProfileApiError,
  type KlyxFirstProfileMessageKey,
} from "@/lib/klyx-first-profile-i18n";
import { getKlyxMarket } from "@/lib/klyx-supported-markets";
import { completeKlyxFirstProfileAnalytics } from "./KlyxFirstProfileAnalytics";

// KLYX_FIRST_PROFILE_HANDOFF_13_87
// KLYX_FIRST_PROFILE_MARKET_REQUIRED_16_01
// KLYX_FIRST_PROFILE_I18N_16_02
// KLYX_FIRST_PROFILE_ROLELESS_2026_09_15

type Props = {
  initialFullName: string;
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default function FirstProfileSetup({ initialFullName }: Props) {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxFirstProfileMessageKey) =>
    translateKlyxFirstProfile(locale, key);
  const initialName = useMemo(() => splitName(initialFullName), [initialFullName]);

  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      setErrorMessage(t("currencyRequired"));
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
          currencyCode,
          // Transitional schema value only; account capability is authoritative.
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

      completeKlyxFirstProfileAnalytics();
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
        <section className="rounded-[2rem] border border-border bg-card p-7 shadow-sm sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            {t("firstSetup")}
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {t("intro")}
          </p>
        </section>

        <form onSubmit={submit} className="klyx-card mt-7 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
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
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
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
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
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
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Globe2 size={17} />
                {t("market")}
              </span>
              <KlyxMarketSelect
                value={countryCode}
                onChange={(nextCountryCode) => {
                  setCountryCode(nextCountryCode);
                  const suggestedCurrency =
                    getKlyxMarket(nextCountryCode)?.currencyCode ?? "";
                  if (suggestedCurrency) {
                    setCurrencyCode(suggestedCurrency);
                  }
                }}
                required
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("marketHint")}
              </p>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 flex items-center gap-2 text-sm font-black">
              <Globe2 size={17} />
              {t("currency")}
            </span>
            <input
              value={currencyCode}
              onChange={(event) =>
                setCurrencyCode(
                  event.target.value
                    .replace(/[^a-zA-Z]/g, "")
                    .slice(0, 3)
                    .toUpperCase()
                )
              }
              maxLength={3}
              className="klyx-input"
              placeholder={t("currencyPlaceholder")}
              autoCapitalize="characters"
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {t("currencyHint")}
            </p>
          </label>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 shrink-0" size={18} />
            <p>{t("noAutomaticAction")}</p>
          </div>

          {errorMessage && (
            <p className="mt-5 text-sm font-semibold text-destructive" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="klyx-button mt-7 w-full disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            {submitting ? t("creating") : t("confirm")}
          </button>
        </form>
      </div>
    </main>
  );
}
