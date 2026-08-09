"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  FileText,
  LoaderCircle,
  Send,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ProviderSearchItem } from "@/lib/provider-search";
import type { MatchingFilters } from "@/lib/intelligent-matching";

function providerName(
  provider: ProviderSearchItem
): string {
  const fullName = `${provider.firstName ?? ""} ${
    provider.lastName ?? ""
  }`.trim();

  return (
    provider.businessName ||
    fullName ||
    "Prestataire KLYX"
  );
}

function initialTitle(
  provider: ProviderSearchItem
): string {
  return `Demande de devis — ${provider.serviceLabel}`;
}

function initialDescription(
  provider: ProviderSearchItem,
  filters: MatchingFilters
): string {
  const parts = [
    `Je souhaite recevoir un devis pour ${provider.serviceLabel.toLowerCase()}.`,
  ];

  if (filters.city.trim()) {
    parts.push(`Lieu : ${filters.city.trim()}.`);
  }

  if (filters.date) {
    parts.push(`Date souhaitée : ${filters.date}.`);
  }

  if (filters.startTime) {
    parts.push(`Heure de début : ${filters.startTime}.`);
  }

  if (filters.endTime) {
    parts.push(`Heure de fin : ${filters.endTime}.`);
  }

  if (filters.budget) {
    parts.push(
      `Budget indicatif : ${filters.budget} € maximum.`
    );
  }

  return parts.join("\n");
}

export default function QuoteRequestButton({
  provider,
  filters,
}: {
  provider: ProviderSearchItem;
  filters: MatchingFilters;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(
    initialTitle(provider)
  );
  const [description, setDescription] = useState(
    initialDescription(provider, filters)
  );
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const durationHours = useMemo(() => {
    if (!filters.startTime || !filters.endTime) {
      return null;
    }

    const [startHour, startMinute] =
      filters.startTime.split(":").map(Number);

    const [endHour, endMinute] =
      filters.endTime.split(":").map(Number);

    const start =
      startHour * 60 + startMinute;

    const end =
      endHour * 60 + endMinute;

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start
    ) {
      return null;
    }

    return (end - start) / 60;
  }, [
    filters.startTime,
    filters.endTime,
  ]);

  async function accessToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      title.trim().length < 3 ||
      description.trim().length < 10
    ) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const token = await accessToken();

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          providerProfileId:
            provider.profileId,
          userServiceId:
            provider.userServiceId,
          title: title.trim(),
          description: description.trim(),
          requestedDate:
            filters.date || null,
          requestedTime:
            filters.startTime || null,
          durationHours,
        }),
      });

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Impossible d’envoyer la demande."
        );
      }

      setSent(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’envoyer la demande."
      );
    } finally {
      setLoading(false);
    }
  }

  function close() {
    if (loading) return;

    setOpen(false);

    if (sent) {
      setSent(false);
      setTitle(initialTitle(provider));
      setDescription(
        initialDescription(provider, filters)
      );
    }

    setErrorMessage("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 text-sm font-black text-violet-700 transition hover:bg-violet-500/15 dark:text-violet-300"
      >
        <FileText size={17} />
        Demander un devis
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Demander un devis"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-border bg-background p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="klyx-eyebrow">
                  Demande de devis
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {providerName(provider)}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {provider.serviceLabel}
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {sent ? (
              <div className="mt-8 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 size={30} />
                </span>

                <h3 className="mt-5 text-xl font-black">
                  Demande envoyée
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Le prestataire peut maintenant
                  confirmer ou ajuster le montant
                  depuis son espace professionnel.
                </p>

                <a
                  href="/quotes"
                  className="klyx-button mt-6 w-full"
                >
                  Voir mes devis
                </a>

                <button
                  type="button"
                  onClick={close}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-black"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="mt-7 grid gap-5"
              >
                <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
                  <Summary
                    label="Ville"
                    value={
                      filters.city || "À préciser"
                    }
                  />
                  <Summary
                    label="Date"
                    value={
                      filters.date || "À préciser"
                    }
                  />
                  <Summary
                    label="Début"
                    value={
                      filters.startTime || "À préciser"
                    }
                  />
                  <Summary
                    label="Fin"
                    value={
                      filters.endTime || "À préciser"
                    }
                  />
                </div>

                <label>
                  <span className="mb-2 block text-sm font-black">
                    Titre
                  </span>

                  <input
                    type="text"
                    maxLength={160}
                    value={title}
                    onChange={(event) =>
                      setTitle(event.target.value)
                    }
                    className="klyx-input"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-black">
                    Décris précisément ton besoin
                  </span>

                  <textarea
                    rows={7}
                    minLength={10}
                    maxLength={2000}
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value
                      )
                    }
                    className="klyx-input resize-none"
                  />
                </label>

                {errorMessage && (
                  <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                    {errorMessage}
                  </div>
                )}

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs leading-6 text-muted-foreground">
                  KLYX calcule une estimation avec
                  le tarif publié. Le prestataire
                  confirme ensuite son prix. Cette
                  demande ne crée ni réservation ni
                  paiement.
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    title.trim().length < 3 ||
                    description.trim().length < 10
                  }
                  className="klyx-button w-full"
                >
                  {loading ? (
                    <LoaderCircle
                      className="animate-spin"
                      size={18}
                    />
                  ) : (
                    <Send size={18} />
                  )}
                  Envoyer la demande
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">
        {value}
      </p>
    </div>
  );
}

