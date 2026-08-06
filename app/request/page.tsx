"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HelpCircle,
  LoaderCircle,
  MapPin,
  Search,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ServiceCandidate = {
  slug: string;
  label: string;
  confidence: number;
  reason: string;
};

type ParsedRequest = {
  serviceSlug: string | null;
  serviceLabel: string | null;
  serviceCandidates: ServiceCandidate[];
  city: string | null;
  requestedDay: string | null;
  requestedTime: string | null;
  durationHours: number | null;
  budgetMax: number | null;
  peopleCount: number | null;
  urgency: "normal" | "today" | "urgent";
  memoryUsed: boolean;
  memoryMessage: string | null;
  missingFields: string[];
  readyForSearch: boolean;
};

const EXAMPLES = [
  "J’ai besoin d’aide samedi matin à Bruxelles.",
  "Quelqu’un pour nettoyer mon appartement demain à 10 h.",
  "Comme d’habitude vendredi soir.",
  "Monter une armoire mardi après-midi pour 80 € maximum.",
];

export default function RequestPage() {
  const router = useRouter();

  const [text, setText] = useState("");
  const [selectedServiceSlug, setSelectedServiceSlug] =
    useState("");
  const [parsed, setParsed] =
    useState<ParsedRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function accessToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  async function analyze(
    event?: FormEvent<HTMLFormElement>,
    forcedText?: string,
    forcedService?: string
  ) {
    event?.preventDefault();

    const requestText = (forcedText ?? text).trim();

    if (requestText.length < 3 || loading) return;

    setLoading(true);
    setParsed(null);
    setErrorMessage("");

    try {
      const token = await accessToken();

      const response = await fetch(
        "/api/requests/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text: requestText,
            selectedServiceSlug:
              forcedService ?? selectedServiceSlug,
          }),
        }
      );

      const result = (await response.json()) as {
        parsed?: ParsedRequest;
        error?: string;
      };

      if (!response.ok || !result.parsed) {
        throw new Error(
          result.error || "Analyse impossible."
        );
      }

      setText(requestText);
      setSelectedServiceSlug(
        result.parsed.serviceSlug ?? ""
      );
      setParsed(result.parsed);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  function chooseCandidate(candidate: ServiceCandidate) {
    setSelectedServiceSlug(candidate.slug);
    void analyze(
      undefined,
      text,
      candidate.slug
    );
  }

  function openResults() {
    if (!parsed?.serviceSlug) return;

    const params = new URLSearchParams();

    params.set("service", parsed.serviceSlug);

    if (parsed.city) {
      params.set("city", parsed.city);
    }

    if (parsed.requestedDay) {
      params.set("date", parsed.requestedDay);
    }

    if (parsed.requestedTime) {
      params.set(
        "time",
        parsed.requestedTime.slice(0, 5)
      );
    }

    params.set(
      "duration",
      String(parsed.durationHours ?? 1)
    );

    if (parsed.budgetMax != null) {
      params.set(
        "budget",
        String(parsed.budgetMax)
      );
    }

    if (text.trim()) {
      params.set(
        "q",
        text.trim().slice(0, 240)
      );
    }

    router.push(`/search?${params.toString()}`);
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="text-sm font-black text-muted-foreground"
          >
            Retour au tableau de bord
          </Link>

          <Link
            href="/memory"
            className="klyx-button-secondary min-h-10 px-4"
          >
            <Brain size={17} />
            Ma mémoire KLYX
          </Link>
        </div>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#3b165b_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Sparkles size={15} />
            Recherche universelle client
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Décris simplement ton besoin
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Pas besoin de connaître la catégorie. KLYX prépare
            la recherche et te montre ce qu’il a compris avant
            toute réservation.
          </p>
        </section>

        <section className="klyx-card mt-8 p-6 sm:p-8">
          <p className="klyx-eyebrow">
            Exemples de demandes
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={loading}
                onClick={() =>
                  void analyze(undefined, example)
                }
                className="rounded-2xl border border-border bg-background/70 p-4 text-left text-sm font-black transition hover:border-violet-500 hover:bg-violet-500/[0.05] disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => void analyze(event)}
            className="mt-6"
          >
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setParsed(null);
                setSelectedServiceSlug("");
              }}
              placeholder="Exemple : J’ai besoin d’aide samedi matin à Bruxelles."
              rows={6}
              maxLength={2000}
              className="klyx-input min-h-40 resize-none p-5 text-base"
            />

            <button
              type="submit"
              disabled={
                loading || text.trim().length < 3
              }
              className="klyx-button mt-5 w-full"
            >
              {loading ? (
                <LoaderCircle
                  className="animate-spin"
                  size={20}
                />
              ) : (
                <Search size={20} />
              )}
              {loading
                ? "KLYX analyse..."
                : "Comprendre ma demande"}
            </button>
          </form>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}
        </section>

        {parsed && (
          <section className="klyx-card mt-8 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Sparkles size={23} />
              </div>

              <div>
                <p className="klyx-eyebrow">
                  Analyse KLYX
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Voici ce que KLYX a compris
                </h2>
              </div>
            </div>

            {parsed.memoryUsed && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-sm text-cyan-800 dark:text-cyan-200">
                <Brain
                  className="mt-0.5 shrink-0"
                  size={19}
                />
                {parsed.memoryMessage}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Info
                icon={<Sparkles size={18} />}
                label="Service"
                value={
                  parsed.serviceLabel ??
                  "Service à préciser"
                }
              />
              <Info
                icon={<MapPin size={18} />}
                label="Ville"
                value={parsed.city ?? "Ville à préciser"}
              />
              <Info
                icon={<CalendarDays size={18} />}
                label="Date"
                value={
                  parsed.requestedDay ??
                  "Date à préciser"
                }
              />
              <Info
                icon={<Clock3 size={18} />}
                label="Heure et durée"
                value={[
                  parsed.requestedTime?.slice(0, 5),
                  parsed.durationHours
                    ? `${parsed.durationHours} h`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Horaire à préciser"}
              />
              <Info
                icon={<WalletCards size={18} />}
                label="Budget maximum"
                value={
                  parsed.budgetMax != null
                    ? `${parsed.budgetMax.toFixed(2)} €`
                    : "Non renseigné"
                }
              />
              {parsed.peopleCount != null && (
                <Info
                  icon={<Users size={18} />}
                  label="Nombre d’enfants"
                  value={String(parsed.peopleCount)}
                />
              )}
            </div>

            {!parsed.serviceSlug &&
              parsed.serviceCandidates.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2">
                    <HelpCircle
                      className="text-amber-500"
                      size={19}
                    />
                    <h3 className="font-black">
                      Quel service correspond le mieux ?
                    </h3>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {parsed.serviceCandidates.map(
                      (candidate) => (
                        <button
                          key={candidate.slug}
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            chooseCandidate(candidate)
                          }
                          className="rounded-2xl border border-border bg-background p-4 text-left transition hover:border-violet-500"
                        >
                          <p className="font-black">
                            {candidate.label}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Confiance :{" "}
                            {candidate.confidence} %
                          </p>
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

            {parsed.missingFields.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
                <p className="font-black">
                  Informations encore nécessaires
                </p>

                <div className="mt-3 grid gap-2">
                  {parsed.missingFields.map((field) => (
                    <p
                      key={field}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <HelpCircle
                        className="mt-0.5 shrink-0 text-amber-500"
                        size={16}
                      />
                      Précise {field}.
                    </p>
                  ))}
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  Complète directement ta phrase puis relance
                  l’analyse.
                </p>
              </div>
            )}

            {parsed.readyForSearch ? (
              <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 shrink-0 text-emerald-600"
                    size={21}
                  />
                  <div>
                    <p className="font-black">
                      La recherche est prête
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Vérifie les informations ci-dessus avant
                      de voir les prestataires.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openResults}
                  className="klyx-button mt-5 w-full"
                >
                  Voir les prestataires adaptés
                  <ArrowRight size={19} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-muted px-5 text-sm font-black text-muted-foreground"
              >
                Complète les informations manquantes
              </button>
            )}
          </section>
        )}

        <p className="mt-6 text-center text-xs leading-6 text-muted-foreground">
          KLYX ne réserve et ne paie jamais depuis cette page.
          Tu confirmes toujours le prestataire, la date et le
          paiement dans les étapes suivantes.
        </p>
      </div>
    </main>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-black">{value}</p>
    </article>
  );
}
