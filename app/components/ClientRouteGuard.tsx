"use client";

import type {
  ReactNode,
} from "react";

import {
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type AccountType =
  | "client"
  | "provider";

type ProfileResponse = {
  profile?: {
    accountType:
      AccountType;
  };

  error?: string;
};

type GuardState =
  | "checking"
  | "allowed"
  | "redirecting"
  | "error";

export default function ClientRouteGuard({
  children,
}: {
  children:
    ReactNode;
}) {
  const router =
    useRouter();

  const [
    state,
    setState,
  ] =
    useState<GuardState>(
      "checking"
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  useEffect(() => {
    let active =
      true;

    async function check() {
      try {
        const response =
          await fetch(
            "/api/profile/me",
            {
              cache:
                "no-store",
            }
          );

        if (
          response.status ===
          401
        ) {
          if (active) {
            setState(
              "redirecting"
            );
          }

          router.replace(
            "/login"
          );

          return;
        }

        const body =
          (await response.json()) as
            ProfileResponse;

        if (
          !response.ok ||
          !body.profile
        ) {
          throw new Error(
            body.error ||
              "Impossible de vérifier le profil KLYX."
          );
        }

        if (
          body.profile
            .accountType ===
          "provider"
        ) {
          if (active) {
            setState(
              "redirecting"
            );
          }

          router.replace(
            "/provider/assistant"
          );

          return;
        }

        if (active) {
          setState(
            "allowed"
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de vérifier le profil KLYX."
        );

        setState(
          "error"
        );
      }
    }

    void check();

    return () => {
      active =
        false;
    };
  }, [
    router,
  ]);

  if (
    state ===
    "allowed"
  ) {
    return (
      <>
        {children}
      </>
    );
  }

  if (
    state ===
    "error"
  ) {
    return (
      <main className="klyx-page grid min-h-[60vh] place-items-center">
        <section className="w-full max-w-lg rounded-3xl border border-rose-500/25 bg-rose-500/10 p-6 text-center">
          <ShieldCheck
            size={30}
            className="mx-auto text-rose-600"
          />

          <h1 className="mt-4 text-xl font-black">
            Vérification impossible
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="klyx-button mt-5"
          >
            Réessayer
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="klyx-page grid min-h-[60vh] place-items-center">
      <div className="text-center">
        <LoaderCircle
          size={34}
          className="mx-auto animate-spin text-violet-600"
        />

        <p className="mt-4 text-sm font-bold text-muted-foreground">
          {state ===
          "redirecting"
            ? "Redirection vers ton espace KLYX..."
            : "Vérification du profil actif..."}
        </p>
      </div>
    </main>
  );
}