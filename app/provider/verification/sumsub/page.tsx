"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import SumsubWebSdk from "@sumsub/websdk-react";
import { createClient } from "@/lib/supabase/client";

type Verification = {
  status: string;
  identity_status: string;
  address_status: string;
  trust_level: string;
  external_provider: string | null;
  external_applicant_id: string | null;
  external_review_status: string | null;
  external_review_answer: string | null;
  external_reject_type: string | null;
  external_moderation_comment: string | null;
  external_sandbox_mode: boolean | null;
  external_updated_at: string | null;
};

type StatusResponse = {
  configured?: boolean;
  verification?: Verification | null;
  error?: string;
};

const LABELS: Record<string, string> = {
  approved: "Vérifié",
  under_review: "En vérification",
  submitted: "Envoyé",
  changes_required: "À reprendre",
  rejected: "Refusé",
  not_started: "Non commencé",
};

export default function SumsubVerificationPage() {
  const [accessToken, setAccessToken] =
    useState("");
  const [verification, setVerification] =
    useState<Verification | null>(null);
  const [configured, setConfigured] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  async function token() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Session manquante."
      );
    }

    return session.access_token;
  }

  const loadStatus =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const accessToken =
          await token();

        const response = await fetch(
          "/api/provider/sumsub/status",
          {
            cache: "no-store",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

        const body =
          (await response.json()) as StatusResponse;

        if (!response.ok) {
          throw new Error(
            body.error ||
              "Chargement impossible."
          );
        }

        setConfigured(
          body.configured === true
        );
        setVerification(
          body.verification ?? null
        );
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Chargement impossible."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const getSdkToken =
    useCallback(async () => {
      const sessionToken =
        await token();

      const response = await fetch(
        "/api/provider/sumsub/token",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${sessionToken}`,
          },
        }
      );

      const body =
        (await response.json()) as {
          token?: string;
          error?: string;
        };

      if (!response.ok || !body.token) {
        throw new Error(
          body.error ||
            "Token Sumsub impossible."
        );
      }

      return body.token;
    }, []);

  async function start() {
    setError("");

    try {
      const sdkToken =
        await getSdkToken();

      setAccessToken(sdkToken);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Démarrage impossible."
      );
    }
  }

  async function refreshToken() {
    return getSdkToken();
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/provider/verification"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
        >
          <ArrowLeft size={17} />
          Vérification prestataire
        </Link>

        <section className="mt-6 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <ShieldCheck size={15} />
            Vérification externe
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Vérification Sumsub
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Sumsub contrôle les éléments du niveau de
            vérification KLYX. KLYX reçoit ensuite la
            décision automatiquement.
          </p>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-600">
            {error}
          </div>
        )}

        {loading ? (
          <section className="klyx-card mt-6 grid min-h-52 place-items-center">
            <LoaderCircle
              className="animate-spin"
              size={36}
            />
          </section>
        ) : (
          <>
            <section className="klyx-card mt-6 p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-muted-foreground">
                    Statut KLYX
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {LABELS[
                      verification?.status ??
                        "not_started"
                    ] ??
                      verification?.status ??
                      "Non commencé"}
                  </p>

                  {verification
                    ?.external_review_answer && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Décision Sumsub :{" "}
                      <strong>
                        {
                          verification.external_review_answer
                        }
                      </strong>
                    </p>
                  )}

                  {verification
                    ?.external_moderation_comment && (
                    <p className="mt-3 text-sm text-amber-600">
                      {
                        verification.external_moderation_comment
                      }
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadStatus()
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-black"
                >
                  <RefreshCw size={17} />
                  Actualiser
                </button>
              </div>
            </section>

            {!configured ? (
              <section className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm">
                Sumsub n'est pas encore configuré par
                l'administrateur KLYX.
              </section>
            ) : verification?.status ===
              "approved" ? (
              <section className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-6">
                <div className="flex items-center gap-3">
                  <BadgeCheck
                    size={26}
                    className="text-emerald-600"
                  />
                  <div>
                    <p className="font-black">
                      Vérification réussie
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      La décision externe a été reçue
                      par KLYX.
                    </p>
                  </div>
                </div>
              </section>
            ) : accessToken ? (
              <section className="klyx-card mt-6 overflow-hidden p-2">
                <SumsubWebSdk
                  accessToken={accessToken}
                  expirationHandler={
                    refreshToken
                  }
                  config={{
                    lang: "fr",
                  }}
                  options={{
                    adaptIframeHeight: true,
                    addViewportTag: true,
                  }}
                  onMessage={() => {
                    void loadStatus();
                  }}
                  onError={(sdkError: unknown) => {
  console.error(
    "Sumsub SDK:",
    sdkError
  );
}}
                />
              </section>
            ) : (
              <section className="klyx-card mt-6 p-6">
                <p className="font-black">
                  Commencer la vérification
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Les documents sont transmis directement
                  au parcours sécurisé Sumsub.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void start()
                  }
                  className="mt-5 inline-flex h-12 items-center rounded-xl bg-violet-600 px-5 text-sm font-black text-white"
                >
                  Démarrer avec Sumsub
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
