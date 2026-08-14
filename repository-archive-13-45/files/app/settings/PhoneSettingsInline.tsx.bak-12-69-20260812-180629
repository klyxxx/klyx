"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { CheckCircle2, LoaderCircle, Phone, Save, ShieldCheck } from "lucide-react";

// KLYX_PHONE_INLINE_12_67C

type PhonePayload = {
  phoneNumber?: string | null;
  verified?: boolean;
  error?: string;
};

export default function PhoneSettingsInline() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error("Configuration Supabase manquante.");
    }

    return createBrowserClient(url, key);
  }, []);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  useEffect(() => {
    let mounted = true;

    async function loadPhone() {
      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Session KLYX introuvable.");
        }

        const response = await fetch("/api/profile/phone", {
          cache: "no-store",
          headers: {
            Authorization: "Bearer " + token,
          },
        });

        const result = (await response.json()) as PhonePayload;

        if (!response.ok) {
          throw new Error(result.error || "Chargement impossible.");
        }

        if (!mounted) return;

        setPhoneNumber(result.phoneNumber ?? "");
        setVerified(Boolean(result.verified));
      } catch (error) {
        if (!mounted) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Chargement impossible."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadPhone();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function savePhone() {
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Session KLYX introuvable.");
      }

      const response = await fetch("/api/profile/phone", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          phoneNumber,
        }),
      });

      const result = (await response.json()) as PhonePayload;

      if (!response.ok) {
        throw new Error(result.error || "Enregistrement impossible.");
      }

      setPhoneNumber(result.phoneNumber ?? "");
      setVerified(Boolean(result.verified));
      setMessage("Numero enregistre avec succes.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Enregistrement impossible."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-7 rounded-[30px] border border-violet-500/30 bg-violet-500/[0.05] p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
            <Phone size={21} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-black">
                Numero de telephone
              </h2>

              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-500">
                Prive
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Client et prestataire pourront utiliser ce numero uniquement lorsqu une mission KLYX autorise le contact.
            </p>
          </div>
        </div>

        <ShieldCheck
          size={22}
          className="hidden shrink-0 text-emerald-500 sm:block"
        />
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-3 text-sm font-bold text-muted-foreground">
          <LoaderCircle size={19} className="animate-spin" />
          Chargement du numero...
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => {
                setPhoneNumber(event.target.value);
                setMessage("");
                setErrorMessage("");
              }}
              placeholder="+32471503513"
              className="h-13 min-w-0 flex-1 rounded-2xl border border-border bg-background px-5 text-base font-bold outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
            />

            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void savePhone();
              }}
              className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}

              Enregistrer le numero
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">
              Exemple Belgique : +32 471 50 35 13
            </span>

            {verified && (
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-500">
                <CheckCircle2 size={15} />
                Numero verifie
              </span>
            )}
          </div>

          {message && (
            <div className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </section>
  );
}