"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        if (user) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }
      } catch {
        if (active) {
          setErrorMessage(
            "Impossible de vérifier la session. Tu peux essayer de te connecter."
          );
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage("Renseigne ton adresse e-mail et ton mot de passe.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        const message = error.message.toLowerCase();

        if (message.includes("invalid login credentials")) {
          throw new Error("Adresse e-mail ou mot de passe incorrect.");
        }

        if (message.includes("email not confirmed")) {
          throw new Error("Confirme d'abord ton adresse e-mail.");
        }

        throw new Error(error.message);
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de se connecter."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage(
        "Entre ton adresse e-mail avant de demander un nouveau mot de passe."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      alert(
        "Un e-mail de réinitialisation a été envoyé si cette adresse existe."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer l'e-mail de réinitialisation."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-violet-500" />
          <p className="text-zinc-400">Vérification de la session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-white sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex text-4xl font-bold tracking-tight"
          >
            KLYX
          </Link>

          <p className="mt-3 text-zinc-400">
            Connecte-toi pour accéder à ton espace.
          </p>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl sm:p-8">
          <h1 className="text-3xl font-bold">Connexion</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Utilise les identifiants de ton compte KLYX.
          </p>

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Adresse e-mail
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="exemple@email.com"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-zinc-300"
                >
                  Mot de passe
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-sm font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Ton mot de passe"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 pr-24 outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 my-auto h-fit text-sm font-medium text-zinc-400 hover:text-white"
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-violet-600 px-6 py-4 text-lg font-semibold transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <div className="mt-6 border-t border-zinc-800 pt-6 text-center">
            <p className="text-sm text-zinc-400">
              Tu n&apos;as pas encore de compte ?
            </p>

            <Link
              href="/signup"
              className="mt-3 inline-flex w-full justify-center rounded-xl border border-zinc-700 px-6 py-3 font-semibold transition hover:bg-zinc-800"
            >
              Créer un compte
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}