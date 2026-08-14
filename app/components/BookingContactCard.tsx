"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Phone,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

// KLYX_REVALIDATED_PHONE_CALL_UI_12_74

type ContactPayload = {
  contactAllowed?: boolean;
  canReveal?: boolean;
  revealed?: boolean;
  audited?: boolean;
  phoneNumber?: string | null;
  otherName?: string;
  verified?: boolean;
  accessExpiresAt?: string | null;
  displayExpiresAt?: string | null;
  reason?: string;
  actionRequired?: string;
  message?: string;
  error?: string;
};

type CallPayload = {
  callAllowed?: boolean;
  phoneNumber?: string;
  error?: string;
};

type Props = {
  bookingId: string;
  bookingStatus: string;
  otherName: string;
};

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat(
    "fr-BE",
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(new Date(value));
}

export default function BookingContactCard({
  bookingId,
  bookingStatus,
  otherName,
}: Props) {
  const [loading, setLoading] =
    useState(false);

  const [revealing, setRevealing] =
    useState(false);

  const [calling, setCalling] =
    useState(false);

  const [payload, setPayload] =
    useState<ContactPayload | null>(null);

  const statusAllowsContact =
    bookingStatus === "accepted" ||
    bookingStatus === "completed";

  async function getToken() {
    const { data } =
      await supabase.auth.getSession();

    const accessToken =
      data.session?.access_token;

    if (!accessToken) {
      throw new Error(
        "Session KLYX introuvable."
      );
    }

    return accessToken;
  }

  const loadEligibility =
    useCallback(async () => {
      if (!statusAllowsContact) return;

      setLoading(true);

      try {
        const accessToken =
          await getToken();

        const response = await fetch(
          "/api/bookings/" +
            encodeURIComponent(bookingId) +
            "/contact",
          {
            cache: "no-store",
            headers: {
              Authorization:
                "Bearer " + accessToken,
            },
          }
        );

        const result =
          (await response.json()) as ContactPayload;

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Contact indisponible."
          );
        }

        setPayload(result);
      } catch (error) {
        setPayload({
          canReveal: false,
          error:
            error instanceof Error
              ? error.message
              : "Contact indisponible.",
        });
      } finally {
        setLoading(false);
      }
    }, [bookingId, statusAllowsContact]);

  useEffect(() => {
    setPayload(null);

    if (statusAllowsContact) {
      void loadEligibility();
    }
  }, [
    statusAllowsContact,
    loadEligibility,
  ]);

  useEffect(() => {
    if (
      !payload?.revealed ||
      !payload.displayExpiresAt
    ) {
      return;
    }

    const delay =
      new Date(
        payload.displayExpiresAt
      ).getTime() - Date.now();

    if (delay <= 0) {
      setPayload((current) =>
        current
          ? {
              ...current,
              revealed: false,
              phoneNumber: null,
              displayExpiresAt: null,
            }
          : current
      );
      return;
    }

    const timer = window.setTimeout(() => {
      setPayload((current) =>
        current
          ? {
              ...current,
              revealed: false,
              phoneNumber: null,
              displayExpiresAt: null,
            }
          : current
      );
    }, delay);

    return () =>
      window.clearTimeout(timer);
  }, [
    payload?.displayExpiresAt,
    payload?.revealed,
  ]);

  async function revealPhone() {
    setRevealing(true);

    try {
      const accessToken =
        await getToken();

      const response = await fetch(
        "/api/bookings/" +
          encodeURIComponent(bookingId) +
          "/contact",
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization:
              "Bearer " + accessToken,
          },
        }
      );

      const result =
        (await response.json()) as ContactPayload;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Impossible d afficher le numero."
        );
      }

      setPayload(result);
    } catch (error) {
      setPayload((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Impossible d afficher le numero.",
      }));
    } finally {
      setRevealing(false);
    }
  }

  function hidePhone() {
    setPayload((current) =>
      current
        ? {
            ...current,
            revealed: false,
            phoneNumber: null,
            displayExpiresAt: null,
          }
        : current
    );
  }

  async function startCall() {
    setCalling(true);

    try {
      const accessToken =
        await getToken();

      const response = await fetch(
        "/api/bookings/" +
          encodeURIComponent(bookingId) +
          "/contact",
        {
          method: "PUT",
          cache: "no-store",
          headers: {
            Authorization:
              "Bearer " + accessToken,
          },
        }
      );

      const result =
        (await response.json()) as CallPayload;

      if (
        !response.ok ||
        !result.callAllowed ||
        !result.phoneNumber
      ) {
        throw new Error(
          result.error ||
            "L appel n est plus autorise."
        );
      }

      window.location.href =
        "tel:" + result.phoneNumber;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Appel impossible.";

      setPayload((current) => ({
        ...current,
        revealed: false,
        phoneNumber: null,
        displayExpiresAt: null,
        error: message,
      }));

      await loadEligibility();
    } finally {
      setCalling(false);
    }
  }

  if (!statusAllowsContact) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <LockKeyhole
            size={20}
            className="mt-0.5 text-muted-foreground"
          />

          <div>
            <p className="font-black">
              Contact protege
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Le contact devient disponible apres acceptation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !payload) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <LoaderCircle
          size={18}
          className="animate-spin"
        />
        Verification du contact...
      </div>
    );
  }

  const ownAction =
    payload.actionRequired ===
    "verify_own_phone";

  if (!payload.canReveal) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          {ownAction ? (
            <Smartphone
              size={20}
              className="mt-0.5 text-amber-500"
            />
          ) : (
            <ShieldCheck
              size={20}
              className="mt-0.5 text-violet-500"
            />
          )}

          <div>
            <p className="font-black">
              {payload.reason === "contact_expired"
                ? "Contact expire"
                : "Contact KLYX protege"}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {payload.error ||
                payload.message ||
                "Contact indisponible."}
            </p>

            {ownAction && (
              <Link
                href="/settings"
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white"
              >
                <Smartphone size={17} />
                Verifier mon numero
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const name =
    payload.otherName || otherName;

  if (!payload.revealed || !payload.phoneNumber) {
    return (
      <div className="mt-4 rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black">
              Contact de {name}
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              Le numero reste masque jusqu a ta demande.
            </p>

            {payload.accessExpiresAt && (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-500">
                <Clock3 size={14} />
                Disponible jusqu au{" "}
                {formatExpiry(
                  payload.accessExpiresAt
                )}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={revealing}
            onClick={() =>
              void revealPhone()
            }
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-black text-white disabled:opacity-60"
          >
            {revealing ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <Eye size={18} />
            )}
            Afficher le numero
          </button>
        </div>

        {payload.error && (
          <div className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">
            {payload.error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Phone
              size={18}
              className="text-emerald-500"
            />
            <p className="font-black">
              {name}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-500">
              <CheckCircle2 size={13} />
              Verifie
            </span>
          </div>

          <p className="mt-2 break-all text-lg font-black">
            {payload.phoneNumber}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Le numero sera remasque automatiquement apres 5 minutes.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={hidePhone}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border px-5 text-sm font-black"
          >
            <EyeOff size={18} />
            Masquer
          </button>

          <button
            type="button"
            disabled={calling}
            onClick={() =>
              void startCall()
            }
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white disabled:opacity-60"
          >
            {calling ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <Phone size={18} />
            )}
            Appeler
          </button>
        </div>
      </div>
    </div>
  );
}