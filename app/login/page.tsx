"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import KlyxLogo from "@/app/ui/KlyxLogo";

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
    return () => { active = false; };
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
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) throw new Error("Adresse e-mail ou mot de passe incorrect.");
        if (error.message.toLowerCase().includes("email not confirmed")) throw new Error("Confirme d’abord ton adresse e-mail.");
        throw error;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de se connecter.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("Entre ton adresse e-mail avant de réinitialiser le mot de passe.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      alert("Un e-mail de réinitialisation a été envoyé si cette adresse existe.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d’envoyer l’e-mail.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <main className="grid min-h-screen place-items-center bg-background dark:bg-zinc-950 text-foreground dark:text-white"><div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-violet-500" /></main>;
  }

  return (
    <main className="dark min-h-screen bg-background dark:bg-zinc-950 text-foreground dark:text-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/8 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.34),transparent_34%),radial-gradient(circle_at_90%_80%,rgba(59,130,246,0.18),transparent_30%)]" />
        <div className="relative"><KlyxLogo /></div>
        <div className="relative max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"><Sparkles size={16} className="text-violet-400" /> Votre quotidien, mieux organisé</div>
          <h1 className="text-6xl font-black leading-[0.98] tracking-[-0.06em]">Retrouvez tout ce dont vous avez besoin, au même endroit.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/55">Réservez des prestataires, suivez vos demandes et gérez vos services depuis une expérience claire et sécurisée.</p>
        </div>
        <div className="relative flex gap-6 text-sm text-white/50"><span className="flex items-center gap-2"><ShieldCheck size={17} /> Paiement sécurisé</span><span className="flex items-center gap-2"><LockKeyhole size={17} /> Données protégées</span></div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><KlyxLogo /></div>
          <p className="klyx-eyebrow">Bienvenue</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">Connexion à KLYX</h2>
          <p className="mt-3 text-white/50">Accédez à votre espace personnel.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">Adresse e-mail</span><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={19} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-12 pr-4 outline-none transition placeholder:text-white/25 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" placeholder="vous@exemple.com" autoComplete="email" /></div></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">Mot de passe</span><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={19} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-12 pr-12 outline-none transition placeholder:text-white/25 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" placeholder="Votre mot de passe" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
            <div className="flex justify-end"><button type="button" onClick={handleForgotPassword} className="text-sm font-semibold text-violet-400 hover:text-violet-300">Mot de passe oublié ?</button></div>
            {errorMessage && <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</p>}
            <button type="submit" disabled={loading} className="klyx-button w-full !min-h-14">{loading ? "Connexion..." : "Se connecter"}</button>
          </form>
          <p className="mt-8 text-center text-sm text-white/45">Nouveau sur KLYX ? <Link href="/signup" className="font-bold text-foreground dark:text-white hover:text-violet-300">Créer un compte</Link></p>
        </div>
      </section>
    </main>
  );
}
