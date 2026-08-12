"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Phone,
  Save,
  ShieldCheck,
} from "lucide-react";

// KLYX_PHONE_SETTINGS_12_67

type PhonePayload = {
  phoneNumber?: string | null;
  verified?: boolean;
  verifiedAt?: string | null;
  visibility?: string;
  saved?: boolean;
  error?: string;
};

export default function PhoneSettingsPage() {
  const supabase = useMemo(() => {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Configuration Supabase publique manquante."
      );
    }

    return createBrowserClient(url, key);
  }, []);

  const [phoneNumber, setPhoneNumber] =
    useState("");

  const [verified, setVerified] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  async function accessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }

  useEffect(() => {
    let active = true;

    async function loadPhone() {
      try {
        const token = await accessToken();

        if (!token) {
          if (active) {
            setErrorMessage(
              "Connecte-toi pour gerer ton numero."
            );
          }

          return;
        }

        const response = await fetch(
          "/api/profile/phone",
          {
            cache: "no-store",
            headers: {
              Authorization:
                "Bearer " + token,
            },
          }
        );

        const body =
          (await response.json()) as PhonePayload;

        if (!response.ok) {
          throw new Error(
            body.error ||
              "Impossible de charger le numero."
          );
        }

        if (!active) return;

        setPhoneNumber(
          body.phoneNumber ?? ""
        );

        setVerified(
          Boolean(body.verified)
        );
      } catch (error) {
        if (!active) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Chargement impossible."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPhone();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function savePhone() {
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const token = await accessToken();

      if (!token) {
        throw new Error(
          "Session KLYX introuvable."
        );
      }

      const response = await fetch(
        "/api/profile/phone",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              "Bearer " + token,
          },
          body: JSON.stringify({
            phoneNumber,
          }),
        }
      );

      const body =
        (await response.json()) as PhonePayload;

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Enregistrement impossible."
        );
      }

      setPhoneNumber(
        body.phoneNumber ?? ""
      );

      setVerified(false);

      setMessage(
        body.phoneNumber
          ? "Numero enregistre."
          : "Numero supprime."
      );
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
    <main className="klyx-page">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={17} />
          Parametres
        </Link>

        <section className="klyx-card mt-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
              <Phone size={22} />
            </div>

            <div>
              <p className="klyx-eyebrow">
                Telephone KLYX
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                Ton numero de telephone
              </h1>

              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Ajoute un numero pour pouvoir communiquer avec la personne liee a une mission KLYX.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex gap-3">
              <ShieldCheck
                size={20}
                className="mt-0.5 shrink-0 text-emerald-600"
              />

              <div>
                <p className="font-black">
                  Numero prive
                </p>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Ton numero ne sera jamais affiche publiquement sur ton profil KLYX. Il pourra etre partage uniquement avec la personne concernee par une transaction autorisee.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-3 text-sm font-bold text-muted-foreground">
              <LoaderCircle
                size={20}
                className="animate-spin"
              />
              Chargement...
            </div>
          ) : (
            <>
              <label className="mt-8 block">
                <span className="text-sm font-black">
                  Numero international
                </span>

                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+32471503513"
                  value={phoneNumber}
                  onChange={(event) => {
                    setPhoneNumber(
                      event.target.value
                    );
                    setMessage("");
                  }}
                  className="mt-2 h-13 w-full rounded-2xl border border-border bg-background px-4 text-base font-semibold outline-none transition focus:border-violet-500"
                />
              </label>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Exemple Belgique : +32 471 50 35 13
              </p>

              <div className="mt-5 flex items-center gap-2 text-sm">
                {verified ? (
                  <>
                    <CheckCircle2
                      size={18}
                      className="text-emerald-600"
                    />
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      Numero verifie
                    </span>
                  </>
                ) : (
                  <>
                    <LockKeyhole
                      size={18}
                      className="text-muted-foreground"
                    />
                    <span className="font-semibold text-muted-foreground">
                      Verification OTP a venir
                    </span>
                  </>
                )}
              </div>

              {message && (
                <p className="mt-5 rounded-2xl bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {message}
                </p>
              )}

              {errorMessage && (
                <p className="mt-5 rounded-2xl bg-rose-500/10 p-4 text-sm font-bold text-rose-700 dark:text-rose-300">
                  {errorMessage}
                </p>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  void savePhone();
                }}
                className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={18} />
                )}

                Enregistrer
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}