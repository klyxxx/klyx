"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

// KLYX_PHONE_PRIVACY_UI_12_75

type Visibility =
  | "private"
  | "transaction_participants";

type PrivacyPayload = {
  visibility?: Visibility;
  hasPhone?: boolean;
  verified?: boolean;
  saved?: boolean;
  error?: string;
};

export default function PhonePrivacyControls() {
  const [visibility, setVisibility] =
    useState<Visibility>(
      "transaction_participants"
    );

  const [hasPhone, setHasPhone] =
    useState(false);

  const [verified, setVerified] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState<Visibility | null>(null);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const getToken = useCallback(async () => {
    const { data } =
      await supabase.auth.getSession();

    const token =
      data.session?.access_token;

    if (!token) {
      throw new Error(
        "Session KLYX introuvable."
      );
    }

    return token;
  }, []);

  const loadPrivacy =
    useCallback(async () => {
      setLoading(true);

      try {
        const token = await getToken();

        const response = await fetch(
          "/api/profile/phone/privacy",
          {
            cache: "no-store",
            headers: {
              Authorization:
                "Bearer " + token,
            },
          }
        );

        const result =
          (await response.json()) as PrivacyPayload;

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Chargement impossible."
          );
        }

        setVisibility(
          result.visibility ??
            "transaction_participants"
        );

        setHasPhone(
          Boolean(result.hasPhone)
        );

        setVerified(
          Boolean(result.verified)
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Chargement impossible."
        );
      } finally {
        setLoading(false);
      }
    }, [getToken]);

  useEffect(() => {
    void loadPrivacy();
  }, [loadPrivacy]);

  async function changeVisibility(
    nextVisibility: Visibility
  ) {
    if (
      nextVisibility === visibility
    ) {
      return;
    }

    setSaving(nextVisibility);
    setMessage("");
    setErrorMessage("");

    try {
      const token = await getToken();

      const response = await fetch(
        "/api/profile/phone/privacy",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              "Bearer " + token,
          },
          body: JSON.stringify({
            visibility: nextVisibility,
          }),
        }
      );

      const result =
        (await response.json()) as PrivacyPayload;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Modification impossible."
        );
      }

      setVisibility(
        result.visibility ??
          nextVisibility
      );

      setHasPhone(
        Boolean(result.hasPhone)
      );

      setVerified(
        Boolean(result.verified)
      );

      setMessage(
        nextVisibility === "private"
          ? "Ton numero est maintenant prive."
          : "Le partage avec les participants de mission est active."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Modification impossible."
      );
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <section className="mb-7 rounded-[30px] border border-border bg-card p-6">
        <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
          <LoaderCircle
            size={19}
            className="animate-spin"
          />
          Chargement de la confidentialite...
        </div>
      </section>
    );
  }

  return (
    <section className="mb-7 rounded-[30px] border border-border bg-card p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
          <ShieldCheck size={22} />
        </div>

        <div>
          <h2 className="text-xl font-black">
            Confidentialite du telephone
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tu controles si ton numero peut etre revele aux personnes liees a une mission KLYX.
          </p>
        </div>
      </div>

      {!hasPhone && (
        <div className="mt-5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400">
          Ajoute d abord ton numero de telephone.
        </div>
      )}

      {hasPhone && !verified && (
        <div className="mt-5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400">
          Ton numero doit etre verifie par SMS avant tout partage.
        </div>
      )}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <button
          type="button"
          disabled={saving !== null}
          onClick={() =>
            void changeVisibility(
              "transaction_participants"
            )
          }
          className={
            "flex min-h-28 items-start gap-4 rounded-2xl border p-5 text-left transition " +
            (visibility ===
            "transaction_participants"
              ? "border-violet-500 bg-violet-500/[0.07]"
              : "border-border bg-background hover:border-violet-500/40")
          }
        >
          <Users
            size={21}
            className="mt-0.5 shrink-0 text-violet-500"
          />

          <span>
            <span className="block font-black">
              Participants de mission
            </span>

            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              Ton numero peut etre revele uniquement a ton client ou prestataire autorise.
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={saving !== null}
          onClick={() =>
            void changeVisibility(
              "private"
            )
          }
          className={
            "flex min-h-28 items-start gap-4 rounded-2xl border p-5 text-left transition " +
            (visibility === "private"
              ? "border-rose-500 bg-rose-500/[0.06]"
              : "border-border bg-background hover:border-rose-500/40")
          }
        >
          <EyeOff
            size={21}
            className="mt-0.5 shrink-0 text-rose-500"
          />

          <span>
            <span className="block font-black">
              Toujours prive
            </span>

            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              Ton numero ne peut plus etre revele dans aucune mission.
            </span>
          </span>
        </button>
      </div>

      {saving && (
        <div className="mt-4 flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <LoaderCircle
            size={16}
            className="animate-spin"
          />
          Enregistrement...
        </div>
      )}

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
    </section>
  );
}