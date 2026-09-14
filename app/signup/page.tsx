"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";

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

const ROLELESS_COPY: Record<
  string,
  { title: string; description: string; benefit: readonly string[]; create: string }
> = {
  fr: {
    title: "Un compte. Un assistant.",
    description:
      "Demande un service, trouve des missions rémunérées et gère tes missions depuis la même conversation.",
    benefit: [
      "Aucun choix client ou prestataire à l’inscription",
      "Un seul historique KLYX",
      "Tes capacités évoluent selon ce que tu veux faire",
    ],
    create: "Créer mon compte KLYX",
  },
  en: {
    title: "One account. One assistant.",
    description:
      "Request services, find paid work and manage missions from the same conversation.",
    benefit: [
      "No client or provider choice at signup",
      "One KLYX history",
      "Your capabilities adapt to what you want to do",
    ],
    create: "Create my KLYX account",
  },
  nl: {
    title: "Eén account. Eén assistent.",
    description:
      "Vraag diensten, zoek betaalde opdrachten en beheer opdrachten vanuit hetzelfde gesprek.",
    benefit: [
      "Geen keuze tussen klant of dienstverlener bij registratie",
      "Eén KLYX-geschiedenis",
      "Je mogelijkheden passen zich aan aan wat je wilt doen",
    ],
    create: "Mijn KLYX-account maken",
  },
  de: {
    title: "Ein Konto. Ein Assistent.",
    description:
      "Fordere Services an, finde bezahlte Aufträge und verwalte Aufträge im selben Gespräch.",
    benefit: [
      "Keine Kunden- oder Anbieterwahl bei der Registrierung",
      "Ein KLYX-Verlauf",
      "Deine Möglichkeiten richten sich danach, was du tun möchtest",
    ],
    create: "Mein KLYX-Konto erstellen",
  },
};

export default function SignupPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxSignupMessageKey) => translateKlyxSignup(locale, key);
  const copy = ROLELESS_COPY[locale] ?? ROLELESS_COPY.fr;
  const captchaRef = useRef<AuthTurnstileHandle | null>(null);

  const [captchaToken, setCaptchaToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (user) {
        router.replace("/assistant");
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

  function resetCaptcha() {
    captchaRef.current?.reset();
    setCaptchaToken("");
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || password.length < 8) {
      setErrorMessage(t("invalidForm"));
      return;
    }

    if (AUTH_TURNSTILE_ENABLED && !captchaToken) {
      setErrorMessage(t("captchaRequired"));
      return;
    }

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            full_name: normalizedName,
            // Schema compatibility only. The product no longer asks users to
            // choose a permanent role; the assistant resolves capabilities.
            account_type: "client",
          },
          captchaToken: AUTH_TURNSTILE_ENABLED ? captchaToken : undefined,
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes("captcha")) {
          throw new Error(t("captchaFailed"));
        }
        throw error;
      }

      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
        return;
      }

      setMessage(t("accountCreated"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("signupFailed")
      );
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[#2563EB]"
          aria-label={t("checkingSession")}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl">
        <KlyxLogo />

        <div className="mt-10 grid overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl lg:grid-cols-[0.85fr_1.15fr]">
          <section className="relative hidden overflow-hidden border-r border-border p-10 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(37,99,235,0.18),transparent_42%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2563EB]">
                  KLYX
                </p>
                <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.055em]">
                  {copy.title}
                </h1>
                <p className="mt-5 max-w-sm leading-7 text-muted-foreground">
                  {copy.description}
                </p>
              </div>

              <div className="space-y-4 text-sm text-muted-foreground">
                {copy.benefit.map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#2563EB]/10 text-[#2563EB]">
                      <Check size={16} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-10 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2563EB]">
              KLYX
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">
              {copy.create}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {copy.description}
            </p>

            <form onSubmit={handleSignup} className="mt-8 space-y-4">
              <div className="relative">
                <UserRound
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={19}
                />
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-border bg-background pl-12 pr-4 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                  placeholder={t("namePlaceholder")}
                  autoComplete="name"
                />
              </div>

              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={19}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-border bg-background pl-12 pr-4 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                  placeholder={t("emailPlaceholder")}
                  autoComplete="email"
                />
              </div>

              <div className="relative">
                <LockKeyhole
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={19}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-border bg-background pl-12 pr-12 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                  placeholder={t("passwordPlaceholder")}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>

              <AuthTurnstile
                ref={captchaRef}
                action="signup"
                onTokenChange={setCaptchaToken}
              />

              {errorMessage && (
                <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
                  {errorMessage}
                </p>
              )}

              {message && (
                <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="min-h-14 w-full rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? t("creating") : copy.create}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-muted-foreground">
              {t("alreadyRegistered")}{" "}
              <Link
                href="/login"
                className="font-semibold text-foreground hover:text-[#2563EB]"
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
