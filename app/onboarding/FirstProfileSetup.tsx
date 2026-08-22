"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Globe2,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import KlyxSelect from "@/app/components/KlyxSelect";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxFirstProfileLocale,
  translateKlyxFirstProfile,
  translateKlyxFirstProfileApiError,
  type KlyxFirstProfileMessageKey,
} from "@/lib/klyx-first-profile-i18n";
import { KLYX_SUPPORTED_MARKETS } from "@/lib/klyx-supported-markets";

// KLYX_FIRST_PROFILE_HANDOFF_13_87
// KLYX_FIRST_PROFILE_MARKET_REQUIRED_16_01
// KLYX_FIRST_PROFILE_I18N_16_02

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
  initialAccountType,
}: Props) {
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
  const [accountType, setAccountType] = useState<AccountType>(initialAccountType);
  const [serviceId, setServiceId] = useState("");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // KLYX_FIRST_PROFILE_ROLE_LOCK_14_05
  const [roleChoiceUnlocked, setRoleChoiceUnlocked] = useState(false);

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
          label: `${localizedName && localizedName !== market.countryCode ? localizedName : market.countryName} · ${market.currencyCode}`,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, pageLocale));
  }, [pageLocale]);

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      try {
        const response = await fetch("/api/profiles/manage", {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json()) as {
          services?: ServiceOption[];
          error?: string;
        };

        if (!response.ok) {
          if (!cancelled) {
            setErrorMessage(
              translateKlyxFirstProfileApiError(
                locale,
                body.error,
                "servicesLoadFailed"
              )
            );
          }
          return;
        }

        if (!cancelled) {
          setServices(Array.isArray(body.services) ? body.services : []);
        }
      } catch {
        if (!cancelled) setErrorMessage(t("servicesLoadFailed"));
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    }

    void loadServices();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (accountType === "client") setServiceId("");
  }, [accountType]);

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

    if (accountType === "provider" && !serviceId) {
      setErrorMessage(t("serviceRequired"));
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
          accountType,
          serviceId: accountType === "provider" ? serviceId : null,
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

      /*
       * L'API pose le cookie klyx_active_profile.
       * L'onboarding serveur relit ensuite le vrai profil actif
       * et affiche le parcours adapté.
       */
      router.refresh();
    } catch {
      setErrorMessage(t("profileCreateFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const provider = accountType === "provider";

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-4xl">
        <section
          className={`relative overflow-hidden rounded-[2rem] border border-white/10 p-7 text-white shadow-2xl sm:p-10 ${
            provider
              ? "bg-[linear-gradient(135deg,#111827_0%,#18233f_48%,#0f172a_100%)]"
              : "bg-[linear-gradient(135deg,#17131f_0%,#32135f_52%,#111827_100%)]"
          }`}
        >
          <div
            className={`absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl ${
              provider ? "bg-blue-500/20" : "bg-violet-500/25"
            }`}
          />

          <div className="relative z-10 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
              {t("firstSetup")}
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/70 sm:text-base">
              {t("intro")}
            </p>

            {/* KLYX_INITIAL_ROLE_CONTEXT_13_87 */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-white/80">
              {provider ? <BriefcaseBusiness size={16} /> : <UserRound size={16} />}
              {provider ? t("providerSelected") : t("clientSelected")}
            </div>
          </div>
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

          <div className="mt-6">
            <p className="text-sm font-black">{t("spaceQuestion")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("spaceHint")}
            </p>

            {/* KLYX_FIRST_PROFILE_ROLE_CONFIRMATION_14_05 */}
            <div className="mt-3 rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                    {t("profileType")}
                  </p>
                  <p className="mt-1 font-black">
                    {provider ? t("provider") : t("client")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {roleChoiceUnlocked ? t("roleUnlocked") : t("roleLocked")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setRoleChoiceUnlocked((value) => !value)}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-black transition hover:bg-muted"
                >
                  {roleChoiceUnlocked ? t("lockChoice") : t("changeProfileType")}
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (!roleChoiceUnlocked) return;
                  setAccountType("client");
                }}
                disabled={!roleChoiceUnlocked}
                className={`rounded-2xl border p-5 text-left transition ${
                  accountType === "client"
                    ? "border-violet-500 bg-violet-500/10 ring-4 ring-violet-500/10"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <UserRound
                  size={22}
                  className={
                    accountType === "client"
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-muted-foreground"
                  }
                />
                <p className="mt-3 font-black">{t("client")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("clientDescription")}
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!roleChoiceUnlocked) return;
                  setAccountType("provider");
                }}
                disabled={!roleChoiceUnlocked}
                className={`rounded-2xl border p-5 text-left transition ${
                  accountType === "provider"
                    ? "border-blue-500 bg-blue-500/10 ring-4 ring-blue-500/10"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <BriefcaseBusiness
                  size={22}
                  className={
                    accountType === "provider"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground"
                  }
                />
                <p className="mt-3 font-black">{t("provider")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("providerDescription")}
                </p>
              </button>
            </div>
          </div>

          {provider && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-black">{t("firstService")}</p>
              <KlyxSelect
                value={serviceId}
                onChange={setServiceId}
                disabled={loadingServices}
                placeholder={loadingServices ? t("loading") : t("chooseService")}
                options={services.map((service) => ({
                  value: service.id,
                  label: service.name,
                }))}
                ariaLabel={t("firstService")}
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("serviceHint")}
              </p>
            </div>
          )}

          {/* KLYX_PROFILE_NEXT_STEP_PREVIEW_13_87 */}
          <section
            className={`mt-7 rounded-2xl border p-5 ${
              provider
                ? "border-blue-500/20 bg-blue-500/[0.045]"
                : "border-violet-500/20 bg-violet-500/[0.045]"
            }`}
          >
            <div className="flex items-start gap-4">
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                  provider
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                }`}
              >
                {provider ? <BriefcaseBusiness size={20} /> : <Sparkles size={20} />}
              </span>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {t("afterStep")}
                </p>
                <h2 className="mt-2 text-lg font-black">
                  {provider ? t("providerNextTitle") : t("clientNextTitle")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {provider
                    ? t("providerNextDescription")
                    : t("clientNextDescription")}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {provider ? (
                <>
                  <NextStep icon={BriefcaseBusiness} title={t("configure")} text={t("configureDescription")} />
                  <NextStep icon={Search} title={t("discover")} text={t("discoverDescription")} />
                  <NextStep icon={Sparkles} title={t("prepare")} text={t("prepareDescription")} />
                </>
              ) : (
                <>
                  <NextStep icon={Sparkles} title={t("describe")} text={t("describeDescription")} />
                  <NextStep icon={Search} title={t("compare")} text={t("compareDescription")} />
                  <NextStep icon={ShieldCheck} title={t("confirm")} text={t("confirmDescription")} />
                </>
              )}
            </div>
          </section>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loadingServices}
            className="klyx-button mt-7 w-full disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            {submitting
              ? t("creating")
              : provider
                ? t("createProvider")
                : t("createClient")}
          </button>

          <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            <p>{t("noAutomaticAction")}</p>
          </div>
        </form>
      </div>
    </main>
  );
}

function NextStep({
  icon: Icon,
  title,
  text,
}: {
  icon:
    | typeof Sparkles
    | typeof Search
    | typeof ShieldCheck
    | typeof BriefcaseBusiness;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <Icon size={17} className="text-muted-foreground" />
      <p className="mt-3 text-sm font-black">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
