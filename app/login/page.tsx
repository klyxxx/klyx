"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import AuthTurnstile, {
  AUTH_TURNSTILE_ENABLED,
  type AuthTurnstileHandle,
} from "@/app/components/AuthTurnstile";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import KlyxLogo from "@/app/ui/KlyxLogo";
import {
  translateKlyxLogin,
  type KlyxLoginMessageKey,
} from "@/lib/klyx-auth-page-i18n";
import { createClient } from "@/lib/supabase/client";

// KLYX_MULTI_PROFILE_LOGIN_13_88

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxLoginMessageKey) => translateKlyxLogin(locale, key);

  const captchaRef = useRef<AuthTurnstileHandle | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();

      if (!active) return;

      if (data.user) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setCheckingSession(false);
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  function requireCaptcha() {
    if (AUTH_TURNSTILE_ENABLED && !captchaToken) {
      setErrorMessage(t("captchaRequired"));
      setSuccessMessage("");
      return false;
    }
    return true;
  }

  function resetCaptcha() {
    captchaRef.current?.reset();
    setCaptchaToken("");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setErrorMessage(t("credentialsRequired"));
      setSuccessMessage("");
      return;
    }

    if (!requireCaptcha()) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
        options: AUTH_TURNSTILE_ENABLED ? { captchaToken } : undefined,
      });

      if (error) {
        const message = error.message.toLowerCase();

        if (message.includes("captcha")) {
          throw new Error(t("captchaFailed"));
        }
        if (message.includes("invalid login credentials")) {
          throw new Error(t("invalidCredentials"));
        }
        if (message.includes("email not confirmed")) {
          throw new Error(t("emailNotConfirmed"));
        }
        throw error;
      }

      /*
       * Une seule authentification Supabase.
       * Le profil actif KLYX est ensuite résolu côté serveur.
       * Aucun mot de passe n'est stocké pour changer de profil.
       */
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("loginFailed"));
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage(t("resetEmailRequired"));
      setSuccessMessage("");
      return;
    }

    if (!requireCaptcha()) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
          captchaToken: AUTH_TURNSTILE_ENABLED ? captchaToken : undefined,
        }
      );

      if (error) {
        if (error.message.toLowerCase().includes("captcha")) {
          throw new Error(t("captchaFailed"));
        }
        throw error;
      }

      setSuccessMessage(t("resetSent"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("resetFailed"));
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground dark:bg-zinc-950 dark:text-white">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-violet-500"
          aria-label={t("checkingSession")}
        />
      </main>
    );
  }

  return (
    <main className="dark min-h-screen bg-background text-foreground dark:bg-zinc-950 dark:text-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/8 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.34),transparent_34%),radial-gradient(circle_at_90%_80%,rgba(59,130,246,0.18),transparent_30%)]" />

        <div className="relative">
          <KlyxLogo />
        </div>

        <div className="relative max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            <Sparkles size={16} className="text-violet-400" />
            {t("connectionBadge")}
          </div>

          <h1 className="text-6xl font-black leading-[0.98] tracking-[-0.06em]">
            {t("headline")}
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-white/55">
            {t("description")}
          </p>

          {/* KLYX_LOGIN_PROFILE_CONTINUITY_13_88 */}
          <div className="mt-8 space-y-3">
            <LoginBenefit icon={UsersRound} text={t("benefitProfiles")} />
            <LoginBenefit icon={Sparkles} text={t("benefitSpaces")} />
            <LoginBenefit icon={ShieldCheck} text={t("benefitPassword")} />
          </div>
        </div>

        <div className="relative flex flex-wrap gap-6 text-sm text-white/50">
          <span className="flex items-center gap-2">
            <ShieldCheck size={17} />
            {t("secureSession")}
          </span>
          <span className="flex items-center gap-2">
            <LockKeyhole size={17} />
            {t("protectedPassword")}
          </span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <KlyxLogo />
          </div>

          <p className="klyx-eyebrow">{t("welcome")}</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">
            {t("loginTitle")}
          </h2>
          <p className="mt-3 text-white/50">{t("loginSubtitle")}</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/75">
                {t("emailLabel")}
              </span>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                  size={19}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-12 pr-4 outline-none transition placeholder:text-white/25 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                  placeholder={t("emailPlaceholder")}
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/75">
                {t("passwordLabel")}
              </span>
              <div className="relative">
                <LockKeyhole
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                  size={19}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-12 pr-12 outline-none transition placeholder:text-white/25 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                  placeholder={t("passwordPlaceholder")}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>

            <AuthTurnstile
              ref={captchaRef}
              action="login"
              onTokenChange={setCaptchaToken}
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-sm font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-50"
              >
                {t("forgotPassword")}
              </button>
            </div>

            {errorMessage && (
              <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {errorMessage}
              </p>
            )}

            {/* KLYX_PASSWORD_RESET_FEEDBACK_13_88 */}
            {successMessage && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                <p>{successMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="klyx-button w-full !min-h-14 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? t("loggingIn") : t("signIn")}
            </button>
          </form>

          {/* KLYX_LOGIN_NO_PASSWORD_SWITCH_13_88 */}
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-xs leading-5 text-white/45">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
            <p>{t("switchNotice")}</p>
          </div>

          <p className="mt-8 text-center text-sm text-white/45">
            {t("newToKlyx")} {" "}
            <Link
              href="/signup"
              className="font-bold text-foreground hover:text-violet-300 dark:text-white"
            >
              {t("createAccount")}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function LoginBenefit({
  icon: Icon,
  text,
}: {
  icon: typeof UsersRound | typeof Sparkles | typeof ShieldCheck;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 text-sm text-white/60">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-violet-300">
        <Icon size={17} />
      </span>
      <p className="pt-2">{text}</p>
    </div>
  );
}
