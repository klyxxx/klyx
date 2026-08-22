"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxResetPassword,
  type KlyxResetPasswordMessageKey,
} from "@/lib/klyx-reset-password-page-i18n";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxResetPasswordMessageKey) =>
    translateKlyxResetPassword(locale, key);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage(t("passwordUpdated"));

    setTimeout(() => {
      router.replace("/login");
    }, 1500);

    setLoading(false);
  }

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background px-4 text-foreground dark:bg-zinc-950 dark:text-white">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        <p className="mt-2 text-muted-foreground dark:text-zinc-400">
          {t("subtitle")}
        </p>

        {error && (
          <div className="mt-5 rounded-xl bg-red-500/10 p-3 text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-xl bg-emerald-500/10 p-3 text-emerald-300">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <input
            type="password"
            placeholder={t("newPasswordPlaceholder")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-border bg-background p-4 dark:border-zinc-700 dark:bg-zinc-950"
          />

          <input
            type="password"
            placeholder={t("confirmPasswordPlaceholder")}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-border bg-background p-4 dark:border-zinc-700 dark:bg-zinc-950"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 py-4 font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? t("updating") : t("updatePassword")}
          </button>
        </form>
      </div>
    </main>
  );
}
