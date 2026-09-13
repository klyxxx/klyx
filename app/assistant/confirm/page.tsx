"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle } from "lucide-react";

import ClientRouteGuard from "@/app/components/ClientRouteGuard";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { KLYX_LOCAL_VALUE_PILOT } from "@/lib/klyx-local-value-pilot";
import { supabase } from "@/lib/supabase";

type DraftResponse = {
  conversationId: string;
  description: string;
  source: "durable_brain_messages";
  request: {
    serviceSlug: string;
    city: string;
    date: string;
    time: string;
    budget: number | null;
  };
};

type PublishedState = {
  requestId: string;
  pilotEnrolled: boolean;
  pilotNotice: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanServiceLabel(value: string): string {
  return value.replace(/[-_]+/g, " ").trim();
}

function normalizeCity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function isPilotCandidate(draft: DraftResponse | null): boolean {
  if (!draft) return false;
  const city = normalizeCity(draft.request.city);
  return (
    draft.request.serviceSlug === KLYX_LOCAL_VALUE_PILOT.serviceSlug &&
    (city === "bruxelles" || city === "brussels")
  );
}

function copy(locale: string) {
  if (locale === "en") {
    return {
      back: "Back to the assistant",
      eyebrow: "Final check",
      title: "Check this before I search.",
      intro:
        "KLYX will publish only after your explicit confirmation. No booking or payment happens here.",
      service: "Service",
      place: "Place",
      date: "Date",
      time: "Time",
      budget: "Budget",
      noBudget: "Not set",
      titleLabel: "Provider-facing title",
      descriptionLabel: "Mission description",
      pilotTitle: "Anneessens local pilot",
      pilotIntro:
        "These confirmations only decide whether this real request enters the pilot cohort. The request can still be published without them.",
      zone: "The mission really takes place in Anneessens.",
      serviceConfirm: "The need really is furniture assembly.",
      publish: "Confirm and search",
      publishing: "Publishing…",
      success: "Request published.",
      successDetail: "Compatible providers can now respond to your real request.",
      follow: "Follow the request",
      pilotIncluded: "Included in the Anneessens pilot after your explicit confirmation.",
      pilotOutside: "Published normally, outside the pilot cohort.",
      loading: "Loading the confirmed request…",
      draftError: "Unable to load the request to confirm.",
      correction: "Need to change something? Return to the assistant before publishing.",
    };
  }

  if (locale === "nl") {
    return {
      back: "Terug naar de assistent",
      eyebrow: "Laatste controle",
      title: "Controleer dit voordat ik zoek.",
      intro:
        "KLYX publiceert alleen na jouw uitdrukkelijke bevestiging. Hier wordt niets geboekt of betaald.",
      service: "Dienst",
      place: "Plaats",
      date: "Datum",
      time: "Tijd",
      budget: "Budget",
      noBudget: "Niet ingesteld",
      titleLabel: "Titel voor dienstverleners",
      descriptionLabel: "Beschrijving van de opdracht",
      pilotTitle: "Lokale pilot Anneessens",
      pilotIntro:
        "Deze bevestigingen bepalen alleen of deze echte aanvraag in de pilotcohort komt. Publiceren kan ook zonder.",
      zone: "De opdracht vindt echt plaats in Anneessens.",
      serviceConfirm: "De behoefte is echt meubelmontage.",
      publish: "Bevestigen en zoeken",
      publishing: "Publiceren…",
      success: "Aanvraag gepubliceerd.",
      successDetail: "Compatibele dienstverleners kunnen nu reageren op je echte aanvraag.",
      follow: "Aanvraag volgen",
      pilotIncluded: "Opgenomen in de Anneessens-pilot na jouw uitdrukkelijke bevestiging.",
      pilotOutside: "Normaal gepubliceerd, buiten de pilotcohort.",
      loading: "De te bevestigen aanvraag wordt geladen…",
      draftError: "De aanvraag kan niet worden geladen.",
      correction: "Iets aanpassen? Ga vóór publicatie terug naar de assistent.",
    };
  }

  if (locale === "de") {
    return {
      back: "Zurück zum Assistenten",
      eyebrow: "Letzte Prüfung",
      title: "Prüfe das, bevor ich suche.",
      intro:
        "KLYX veröffentlicht erst nach deiner ausdrücklichen Bestätigung. Hier wird nichts gebucht oder bezahlt.",
      service: "Service",
      place: "Ort",
      date: "Datum",
      time: "Zeit",
      budget: "Budget",
      noBudget: "Nicht festgelegt",
      titleLabel: "Titel für Anbieter",
      descriptionLabel: "Beschreibung des Auftrags",
      pilotTitle: "Lokaler Pilot Anneessens",
      pilotIntro:
        "Diese Bestätigungen entscheiden nur, ob diese echte Anfrage in die Pilotkohorte kommt. Veröffentlichen ist auch ohne sie möglich.",
      zone: "Der Auftrag findet tatsächlich in Anneessens statt.",
      serviceConfirm: "Der Bedarf ist tatsächlich Möbelmontage.",
      publish: "Bestätigen und suchen",
      publishing: "Wird veröffentlicht…",
      success: "Anfrage veröffentlicht.",
      successDetail: "Passende Anbieter können jetzt auf deine echte Anfrage reagieren.",
      follow: "Anfrage verfolgen",
      pilotIncluded: "Nach deiner ausdrücklichen Bestätigung in den Anneessens-Piloten aufgenommen.",
      pilotOutside: "Normal veröffentlicht, außerhalb der Pilotkohorte.",
      loading: "Zu bestätigende Anfrage wird geladen…",
      draftError: "Die Anfrage konnte nicht geladen werden.",
      correction: "Etwas ändern? Kehre vor der Veröffentlichung zum Assistenten zurück.",
    };
  }

  return {
    back: "Retour à l’assistant",
    eyebrow: "Dernière vérification",
    title: "Vérifie ceci avant que je cherche.",
    intro:
      "KLYX publie uniquement après ta confirmation explicite. Aucune réservation ni aucun paiement n’est déclenché ici.",
    service: "Service",
    place: "Lieu",
    date: "Date",
    time: "Heure",
    budget: "Budget",
    noBudget: "Non défini",
    titleLabel: "Titre visible par les prestataires",
    descriptionLabel: "Description de la mission",
    pilotTitle: "Pilote local Anneessens",
    pilotIntro:
      "Ces confirmations servent uniquement à décider si cette vraie demande entre dans la cohorte pilote. La demande peut être publiée sans les cocher.",
    zone: "La mission se déroule bien à Anneessens.",
    serviceConfirm: "Le besoin concerne bien le montage de meubles.",
    publish: "Confirmer et chercher",
    publishing: "Publication…",
    success: "Demande publiée.",
    successDetail: "Les prestataires compatibles peuvent maintenant répondre à ta vraie demande.",
    follow: "Suivre la demande",
    pilotIncluded: "Incluse dans le pilote Anneessens après ta confirmation explicite.",
    pilotOutside: "Publiée normalement, hors cohorte pilote.",
    loading: "Chargement de la demande à confirmer…",
    draftError: "Impossible de charger la demande à confirmer.",
    correction: "Quelque chose est faux ? Retourne dans l’assistant avant de publier.",
  };
}

async function accessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error("Session manquante.");
  return session.access_token;
}

export default function AssistantConfirmPage() {
  const { locale } = useKlyxLocale();
  const text = useMemo(() => copy(locale), [locale]);
  const [conversationId, setConversationId] = useState("");
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [zoneConfirmed, setZoneConfirmed] = useState(false);
  const [serviceConfirmed, setServiceConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<PublishedState | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const value = new URLSearchParams(window.location.search)
        .get("conversation")
        ?.trim();

      if (!value || !UUID_PATTERN.test(value)) {
        if (active) {
          setError(text.draftError);
          setLoading(false);
        }
        return;
      }

      setConversationId(value);

      try {
        const token = await accessToken();
        const response = await fetch(
          `/api/brain/request-draft?conversationId=${encodeURIComponent(value)}`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const body = (await response.json().catch(() => ({}))) as
          | DraftResponse
          | { error?: string };

        if (!response.ok || !("request" in body)) {
          throw new Error(
            "error" in body && body.error ? body.error : text.draftError
          );
        }

        if (!active) return;

        setDraft(body);
        setTitle(`Besoin de ${cleanServiceLabel(body.request.serviceSlug)}`.slice(0, 120));
        setDescription(
          (body.description.trim() ||
            `${cleanServiceLabel(body.request.serviceSlug)} à ${body.request.city}, le ${body.request.date} à ${body.request.time}.`)
            .slice(0, 2000)
        );
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : text.draftError);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [text.draftError]);

  const pilotCandidate = isPilotCandidate(draft);
  const assistantHref = conversationId
    ? `/assistant?conversation=${encodeURIComponent(conversationId)}`
    : "/assistant";

  async function publish() {
    if (!draft || publishing || published) return;

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < 3 || cleanDescription.length < 10) {
      setError(text.correction);
      return;
    }

    setPublishing(true);
    setError("");

    try {
      const token = await accessToken();
      const requestSnapshot = draft.request;

      const confirmationResponse = await fetch("/api/brain/confirm-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: draft.conversationId,
          request: requestSnapshot,
        }),
      });
      const confirmationBody = (await confirmationResponse.json().catch(() => ({}))) as {
        confirmationId?: string;
        error?: string;
      };

      if (!confirmationResponse.ok || !confirmationBody.confirmationId) {
        throw new Error(
          confirmationBody.error || "Impossible de confirmer la demande."
        );
      }

      const publishResponse = await fetch("/api/brain/market-publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: draft.conversationId,
          serviceSlug: requestSnapshot.serviceSlug,
          city: requestSnapshot.city,
          date: requestSnapshot.date,
          time: requestSnapshot.time,
          budget: requestSnapshot.budget,
          requestedDate: requestSnapshot.date,
          requestedTime: requestSnapshot.time,
          budgetMax: requestSnapshot.budget,
          title: cleanTitle,
          description: cleanDescription,
          confirmed: true,
          confirmationId: confirmationBody.confirmationId,
        }),
      });
      const publishBody = (await publishResponse.json().catch(() => ({}))) as {
        requestId?: string;
        error?: string;
      };

      if (!publishResponse.ok || !publishBody.requestId) {
        throw new Error(publishBody.error || "Impossible de publier la demande.");
      }

      let pilotEnrolled = false;
      let pilotNotice = text.pilotOutside;

      if (pilotCandidate && zoneConfirmed && serviceConfirmed) {
        const pilotResponse = await fetch("/api/business-pilot/enroll-request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            marketRequestId: publishBody.requestId,
            confirmedZone: true,
            confirmedService: true,
          }),
        });
        const pilotBody = (await pilotResponse.json().catch(() => ({}))) as {
          enrolled?: boolean;
          error?: string;
        };

        if (pilotResponse.ok && pilotBody.enrolled === true) {
          pilotEnrolled = true;
          pilotNotice = text.pilotIncluded;
        } else {
          pilotNotice = pilotBody.error || text.pilotOutside;
        }
      }

      setPublished({
        requestId: publishBody.requestId,
        pilotEnrolled,
        pilotNotice,
      });
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Impossible de publier la demande."
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ClientRouteGuard>
      <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href={assistantHref}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft size={17} /> {text.back}
          </Link>

          {loading ? (
            <div className="grid min-h-[65vh] place-items-center text-center">
              <div>
                <LoaderCircle className="mx-auto animate-spin" size={28} />
                <p className="mt-4 text-sm text-muted-foreground">{text.loading}</p>
              </div>
            </div>
          ) : published ? (
            <section className="flex min-h-[65vh] flex-col justify-center">
              <CheckCircle2 size={32} className="text-blue-600" />
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                {text.eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                {text.success}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                {text.successDetail}
              </p>
              <p className={`mt-4 text-sm ${published.pilotEnrolled ? "font-semibold text-blue-600" : "text-muted-foreground"}`}>
                {published.pilotNotice}
              </p>
              <Link
                href="/requests"
                className="mt-7 inline-flex min-h-11 w-fit items-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white"
              >
                {text.follow}
              </Link>
            </section>
          ) : draft ? (
            <>
              <header className="mt-14">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                  {text.eyebrow}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  {text.title}
                </h1>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {text.intro}
                </p>
              </header>

              <section className="mt-8 border-l-2 border-[#2563EB] pl-4">
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Summary label={text.service} value={cleanServiceLabel(draft.request.serviceSlug)} />
                  <Summary label={text.place} value={draft.request.city} />
                  <Summary label={text.date} value={draft.request.date} />
                  <Summary label={text.time} value={draft.request.time} />
                  <Summary
                    label={text.budget}
                    value={
                      draft.request.budget == null
                        ? text.noBudget
                        : new Intl.NumberFormat(locale === "fr" ? "fr-BE" : locale, {
                            style: "currency",
                            currency: "EUR",
                          }).format(draft.request.budget)
                    }
                  />
                </dl>
              </section>

              <section className="mt-8 space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold">{text.titleLabel}</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                    className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">{text.descriptionLabel}</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={2000}
                    rows={5}
                    className="mt-2 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none focus:border-blue-500"
                  />
                </label>
              </section>

              {pilotCandidate && (
                <section className="mt-8 border-t border-border pt-6">
                  <h2 className="text-sm font-bold">{text.pilotTitle}</h2>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {text.pilotIntro}
                  </p>
                  <div className="mt-4 space-y-3 text-sm">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={zoneConfirmed}
                        onChange={(event) => setZoneConfirmed(event.target.checked)}
                        className="mt-1"
                      />
                      <span>{text.zone}</span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={serviceConfirmed}
                        onChange={(event) => setServiceConfirmed(event.target.checked)}
                        className="mt-1"
                      />
                      <span>{text.serviceConfirm}</span>
                    </label>
                  </div>
                </section>
              )}

              {error && (
                <p role="alert" className="mt-6 text-sm font-medium text-rose-600 dark:text-rose-300">
                  {error}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3 pb-10">
                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={publishing}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  {publishing ? <LoaderCircle className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
                  {publishing ? text.publishing : text.publish}
                </button>
                <Link href={assistantHref} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                  {text.correction}
                </Link>
              </div>
            </>
          ) : (
            <section className="mt-14">
              <h1 className="text-2xl font-semibold">{text.draftError}</h1>
              {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            </section>
          )}
        </div>
      </main>
    </ClientRouteGuard>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
