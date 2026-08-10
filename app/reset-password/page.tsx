"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Mot de passe mis à jour avec succès.");

    setTimeout(() => {
      router.replace("/login");
    }, 1500);

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 px-4 text-foreground dark:text-white">
      <div className="w-full max-w-md rounded-3xl border border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 p-8">
        <h1 className="text-3xl font-bold">Nouveau mot de passe</h1>

        <p className="mt-2 text-muted-foreground dark:text-zinc-400">
          Choisis un nouveau mot de passe pour ton compte.
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
            placeholder="Nouveau mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 p-4"
          />

          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-border dark:border-zinc-700 bg-background dark:bg-zinc-950 p-4"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 py-4 font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
          </button>
        </form>
      </div>
    </main>
  );
}