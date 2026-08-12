"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  CheckCircle2,
  LoaderCircle,
  MessageSquareText,
  Phone,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";

// KLYX_PHONE_OTP_UI_12_69

type PhonePayload = {
  phoneNumber?: string | null;
  verified?: boolean;
  verifiedAt?: string | null;
  error?: string;
};

type OtpPayload = {
  sent?: boolean;
  verified?: boolean;
  alreadyVerified?: boolean;
  maskedPhone?: string;
  retryAfter?: number;
  error?: string;
};

export default function PhoneSettingsInline() {
  const supabase = useMemo(() => {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Configuration Supabase manquante."
      );
    }

    return createBrowserClient(url, key);
  }, []);

  const [phoneNumber, setPhoneNumber] =
    useState("");

  const [savedPhone, setSavedPhone] =
    useState("");

  const [verified, setVerified] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [sendingOtp, setSendingOtp] =
    useState(false);

  const [verifyingOtp, setVerifyingOtp] =
    useState(false);

  const [otpSent, setOtpSent] =
    useState(false);

  const [otpCode, setOtpCode] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [cooldown, setCooldown] =
    useState(0);

  async function getToken() {
    const { data } =
      await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }

  useEffect(() => {
    let mounted = true;

    async function loadPhone() {
      try {
        const token = await getToken();

        if (!token) {
          throw new Error(
            "Session KLYX introuvable."
          );
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

        const result =
          (await response.json()) as PhonePayload;

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Chargement impossible."
          );
        }

        if (!mounted) return;

        const value = result.phoneNumber ?? "";

        setPhoneNumber(value);
        setSavedPhone(value);
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

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((value) =>
        value > 0 ? value - 1 : 0
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function savePhone() {
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const token = await getToken();

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

      const result =
        (await response.json()) as PhonePayload;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Enregistrement impossible."
        );
      }

      const value = result.phoneNumber ?? "";

      setPhoneNumber(value);
      setSavedPhone(value);
      setVerified(Boolean(result.verified));
      setOtpSent(false);
      setOtpCode("");

      setMessage(
        value
          ? "Numero enregistre. Tu peux maintenant le verifier."
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

  async function sendOtp() {
    if (!savedPhone) {
      setErrorMessage(
        "Enregistre un numero avant de demander un code."
      );
      return;
    }

    if (phoneNumber !== savedPhone) {
      setErrorMessage(
        "Enregistre le nouveau numero avant de le verifier."
      );
      return;
    }

    setSendingOtp(true);
    setMessage("");
    setErrorMessage("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error(
          "Session KLYX introuvable."
        );
      }

      const response = await fetch(
        "/api/profile/phone/otp/send",
        {
          method: "POST",
          headers: {
            Authorization:
              "Bearer " + token,
          },
        }
      );

      const result =
        (await response.json()) as OtpPayload;

      if (!response.ok) {
        if (result.retryAfter) {
          setCooldown(result.retryAfter);
        }

        throw new Error(
          result.error ||
            "Envoi du code impossible."
        );
      }

      if (result.alreadyVerified) {
        setVerified(true);
        setMessage("Numero deja verifie.");
        return;
      }

      setOtpSent(true);
      setCooldown(result.retryAfter ?? 60);

      setMessage(
        "Code SMS envoye vers " +
          (result.maskedPhone ?? savedPhone) +
          "."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Envoi du code impossible."
      );
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    const cleanCode =
      otpCode.replace(/\D/g, "");

    if (cleanCode.length < 4) {
      setErrorMessage("Entre le code SMS recu.");
      return;
    }

    setVerifyingOtp(true);
    setMessage("");
    setErrorMessage("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error(
          "Session KLYX introuvable."
        );
      }

      const response = await fetch(
        "/api/profile/phone/otp/verify",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              "Bearer " + token,
          },
          body: JSON.stringify({
            code: cleanCode,
          }),
        }
      );

      const result =
        (await response.json()) as OtpPayload;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Verification impossible."
        );
      }

      setVerified(true);
      setOtpSent(false);
      setOtpCode("");
      setMessage(
        "Numero verifie avec succes."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Verification impossible."
      );
    } finally {
      setVerifyingOtp(false);
    }
  }

  const unsaved = phoneNumber !== savedPhone;

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

              {verified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-500">
                  <CheckCircle2 size={14} />
                  Verifie
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-500">
                  A verifier
                </span>
              )}
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Ton numero reste prive et devient accessible uniquement aux participants autorises de ta mission KLYX.
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
          <LoaderCircle
            size={19}
            className="animate-spin"
          />
          Chargement du numero...
        </div>
      ) : (
        <div className="mt-6 space-y-5">
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
              onClick={() => void savePhone()}
              className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-60"
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
          </div>

          <p className="text-xs font-semibold text-muted-foreground">
            Format international : +32 471 50 35 13
          </p>

          {!verified && savedPhone && !unsaved && (
            <div className="rounded-2xl border border-border bg-background/60 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <MessageSquareText
                  size={20}
                  className="mt-0.5 shrink-0 text-violet-500"
                />

                <div className="min-w-0 flex-1">
                  <p className="font-black">
                    Verification par SMS
                  </p>

                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    KLYX envoie un code unique sur le numero enregistre.
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={
                        sendingOtp || cooldown > 0
                      }
                      onClick={() => void sendOtp()}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white disabled:opacity-50"
                    >
                      {sendingOtp ? (
                        <LoaderCircle
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <Send size={17} />
                      )}

                      {cooldown > 0
                        ? "Renvoyer dans " + cooldown + " s"
                        : "Envoyer le code"}
                    </button>
                  </div>

                  {otpSent && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input
                        value={otpCode}
                        onChange={(event) =>
                          setOtpCode(
                            event.target.value
                              .replace(/\D/g, "")
                              .slice(0, 10)
                          )
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Code SMS"
                        className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-center text-lg font-black tracking-[0.25em] outline-none focus:border-violet-500"
                      />

                      <button
                        type="button"
                        disabled={verifyingOtp}
                        onClick={() =>
                          void verifyOtp()
                        }
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-50"
                      >
                        {verifyingOtp ? (
                          <LoaderCircle
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <CheckCircle2 size={17} />
                        )}
                        Verifier
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {verified && (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">
              <CheckCircle2 size={18} />
              Ce numero est verifie par KLYX.
            </div>
          )}

          {message && (
            <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </section>
  );
}