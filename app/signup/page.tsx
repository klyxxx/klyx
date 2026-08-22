"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";

import AuthTurnstile, {
  AUTH_TURNSTILE_ENABLED,
  type AuthTurnstileHandle,
} from "@/app/components/AuthTurnstile";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import KlyxLogo from "@/app/ui/KlyxLogo";
import {
  translateKlyxSignup,
  type KlyxSignupMessageKey,
} from "@/lib/klyx-signup-page-i18n";
import { createClient } from "@/lib/supabase/client";

type AccountType =
  | "client"
  | "provider";

export default function SignupPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxSignupMessageKey) =>
    translateKlyxSignup(locale, key);
  const captchaRef =
    useRef<AuthTurnstileHandle | null>(null);

  const [captchaToken, setCaptchaToken] =
    useState("");
  const [name, setName] =
    useState("");
  const [email, setEmail] =
    useState("");
  const [password, setPassword] =
    useState("");

  const [
    accountType,
    setAccountType,
  ] =
    useState<AccountType>(
      "client"
    );

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    checkingSession,
    setCheckingSession,
  ] =
    useState(true);

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const requestedType =
      params.get("type");

    if (
      requestedType ===
        "provider" ||
      requestedType ===
        "client"
    ) {
      setAccountType(
        requestedType
      );
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const supabase =
        createClient();

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (user) {
        router.replace(
          "/dashboard"
        );
        router.refresh();
        return;
      }

      setCheckingSession(
        false
      );
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  function resetCaptcha() {
    captchaRef.current?.reset();
    setCaptchaToken("");
  }

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedName =
      name.trim();

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !normalizedName ||
      !normalizedEmail ||
      password.length < 8
    ) {
      setErrorMessage(
        t("invalidForm")
      );
      return;
    }

    if (
      AUTH_TURNSTILE_ENABLED &&
      !captchaToken
    ) {
      setErrorMessage(
        t("captchaRequired")
      );
      return;
    }

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const supabase =
        createClient();

      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email:
            normalizedEmail,
          password,
          options: {
            emailRedirectTo:
              `${window.location.origin}/onboarding`,
            data: {
              full_name:
                normalizedName,
              account_type:
                accountType,
            },
            captchaToken:
              AUTH_TURNSTILE_ENABLED
                ? captchaToken
                : undefined,
          },
        });

      if (error) {
        if (
          error.message
            .toLowerCase()
            .includes("captcha")
        ) {
          throw new Error(
            t("captchaFailed")
          );
        }

        throw error;
      }

      if (data.session) {
        router.replace(
          "/onboarding"
        );
        router.refresh();
        return;
      }

      setMessage(
        t("accountCreated")
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("signupFailed")
      );
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="dark grid min-h-screen place-items-center bg-background dark:bg-zinc-950 text-foreground dark:text-white">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-violet-500"
          aria-label={t("checkingSession")}
        />
      </main>
    );
  }

  return (
    <main className="dark min-h-screen bg-background dark:bg-zinc-950 px-5 py-8 text-foreground dark:text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <KlyxLogo />

        <div className="mt-10 grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-2xl lg:grid-cols-[0.85fr_1.15fr]">
          <section className="relative hidden overflow-hidden p-10 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(124,58,237,0.42),transparent_38%),linear-gradient(155deg,rgba(255,255,255,0.04),transparent)]" />

            <div className="relative flex h-full flex-col justify-between">
              <div>
                <p className="klyx-eyebrow">
                  {t("joinKlyx")}
                </p>

                <h1 className="mt-4 text-5xl font-black leading-[1.02] tracking-[-0.055em]">
                  {t("headline")}
                </h1>

                <p className="mt-5 max-w-sm leading-7 text-white/55">
                  {t("description")}
                </p>
              </div>

              <div className="space-y-4 text-sm text-white/65">
                {[
                  t("benefitFree"),
                  t("benefitRoles"),
                  t("benefitSecure"),
                ].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 text-violet-300">
                        <Check
                          size={16}
                        />
                      </span>

                      {item}
                    </div>
                  )
                )}
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-10 lg:p-12">
            <div className="flex flex-wrap items-center gap-2">
              <p className="klyx-eyebrow">
                {t("createSpace")}
              </p>

              <span className="rounded-full border border-violet-300/15 bg-violet-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">
                {t("beta")}
              </span>
            </div>

            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">
              {t("startTitle")}
            </h2>

            <p className="mt-3 text-white/50">
              {t("startSubtitle")}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setAccountType(
                    "client"
                  )
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  accountType ===
                  "client"
                    ? "border-violet-500 bg-violet-500/12 ring-4 ring-violet-500/8"
                    : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                }`}
              >
                <UserRound
                  size={22}
                  className={
                    accountType ===
                    "client"
                      ? "text-violet-400"
                      : "text-white/45"
                  }
                />

                <p className="mt-3 font-bold">
                  {t("client")}
                </p>

                <p className="mt-1 text-xs text-white/45">
                  {t("clientSubtitle")}
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setAccountType(
                    "provider"
                  )
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  accountType ===
                  "provider"
                    ? "border-violet-500 bg-violet-500/12 ring-4 ring-violet-500/8"
                    : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                }`}
              >
                <BriefcaseBusiness
                  size={22}
                  className={
                    accountType ===
                    "provider"
                      ? "text-violet-400"
                      : "text-white/45"
                  }
                />

                <p className="mt-3 font-bold">
                  {t("provider")}
                </p>

                <p className="mt-1 text-xs text-white/45">
                  {t("providerSubtitle")}
                </p>
              </button>
            </div>

            {/* KLYX_SIGNUP_ROLE_CONTINUITY_14_02 */}
            <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
                  {accountType === "provider" ? (
                    <BriefcaseBusiness size={19} />
                  ) : (
                    <UserRound size={19} />
                  )}
                </span>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                    {t("selectedProfile")}
                  </p>

                  <p className="mt-1 font-black">
                    {accountType === "provider"
                      ? t("joinAsProvider")
                      : t("joinAsClient")}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-white/50">
                    {accountType === "provider"
                      ? t("providerNext")
                      : t("clientNext")}
                  </p>
                </div>
              </div>
            </div>

            {/* KLYX_SIGNUP_NEXT_STEP_14_02 */}
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <Check
                size={17}
                className="mt-0.5 shrink-0 text-emerald-400"
              />

              <p className="text-sm leading-6 text-white/45">
                {t("profileContinuity")}
              </p>
            </div>

            <form
              onSubmit={
                handleSignup
              }
              className="mt-6 space-y-4"
            >
              <div className="relative">
                <UserRound
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                  size={19}
                />

                <input
                  type="text"
                  value={name}
                  onChange={(
                    event
                  ) =>
                    setName(
                      event.target.value
                    )
                  }
                  className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-12 pr-4 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                  placeholder={t("namePlaceholder")}
                  autoComplete="name"
                />
              </div>

              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                  size={19}
                />

                <input
                  type="email"
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-12 pr-4 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                  placeholder={t("emailPlaceholder")}
                  autoComplete="email"
                />
              </div>

              <div className="relative">
                <LockKeyhole
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                  size={19}
                />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-12 pr-12 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                  placeholder={t("passwordPlaceholder")}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (value) =>
                        !value
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
                  aria-label={
                    showPassword
                      ? t("hidePassword")
                      : t("showPassword")
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      size={19}
                    />
                  ) : (
                    <Eye
                      size={19}
                    />
                  )}
                </button>
              </div>

              <AuthTurnstile
                ref={captchaRef}
                action="signup"
                onTokenChange={
                  setCaptchaToken
                }
              />

              {errorMessage && (
                <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {errorMessage}
                </p>
              )}

              {message && (
                <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="klyx-button w-full !min-h-14"
              >
                {loading
                  ? t("creating")
                  : accountType ===
                      "provider"
                    ? t("createProvider")
                    : t("createClient")}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-white/45">
              {t("alreadyRegistered")}{" "}
              <Link
                href="/login"
                className="font-bold text-foreground dark:text-white hover:text-violet-300"
              >
                {t("signIn")}
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}