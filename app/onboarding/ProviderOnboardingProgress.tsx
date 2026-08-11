"use client";

import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Check, CircleDashed, CreditCard,
  FileCheck2, LoaderCircle, MapPinned, RefreshCw,
  ShieldCheck, UserRoundCheck, WalletCards, Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProgressState = "loading" | "todo" | "progress" | "done";

type StudioService = {
  enabled?: boolean;
  title?: string;
  description?: string;
  price?: number | null;
  hourlyPrice?: number | null;
  fixedPrice?: number | null;
  availability?: Array<{ enabled?: boolean }>;
};

type StudioData = {
  providerProfile?: {
    headline?: string;
    bio?: string;
    yearsExperience?: number;
    isPublished?: boolean;
    verificationStatus?: string;
  };
  services?: StudioService[];
};

type ProviderZone = { id: string; is_active: boolean };
type Verification = { status: string | null };
type VerificationDocument = { id: string };

type StripeState = {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

type Step = {
  id: string;
  number: number;
  title: string;
  description: string;
  href: string;
  button: string;
  icon: typeof Wrench;
  state: ProgressState;
  stateLabel: string;
  required: boolean;
};

async function bearerToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Session manquante.");
  return session.access_token;
}

export default function ProviderOnboardingProgress() {
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [zones, setZones] = useState<ProviderZone[]>([]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [stripe, setStripe] = useState<StripeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setErrorMessage("");

    try {
      const token = await bearerToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [studioResponse, zonesResponse, verificationResponse, stripeResponse] =
        await Promise.all([
          fetch("/api/provider/studio", { cache: "no-store", headers }),
          fetch("/api/provider/zones", { cache: "no-store", headers }),
          fetch("/api/provider/verification", { cache: "no-store", headers }),
          fetch("/api/stripe/connect/status", { cache: "no-store", headers }),
        ]);

      const studioBody = await studioResponse.json();
      const zonesBody = await zonesResponse.json();
      const verificationBody = await verificationResponse.json();
      const stripeBody = await stripeResponse.json();

      if (!studioResponse.ok) throw new Error(studioBody.error || "Studio impossible.");
      if (!zonesResponse.ok) throw new Error(zonesBody.error || "Zones impossibles.");
      if (!verificationResponse.ok) {
        throw new Error(verificationBody.error || "Vérification impossible.");
      }

      setStudio(studioBody.data ?? studioBody);
      setZones(Array.isArray(zonesBody.zones) ? zonesBody.zones : []);
      setVerification(verificationBody.verification ?? null);
      setDocuments(Array.isArray(verificationBody.documents) ? verificationBody.documents : []);

      if (stripeResponse.ok && "connected" in stripeBody) {
        setStripe(stripeBody as StripeState);
      } else {
        setStripe(null);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d’actualiser ta progression."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const steps = useMemo<Step[]>(() => {
    const provider = studio?.providerProfile;
    const services = Array.isArray(studio?.services) ? studio.services : [];
    const enabledServices = services.filter((service) => service.enabled === true);

    const hasProfessionalProfile = Boolean(
      (provider?.headline ?? "").trim().length >= 5 &&
      (provider?.bio ?? "").trim().length >= 30 &&
      Number(provider?.yearsExperience ?? 0) >= 0
    );

    const hasService = enabledServices.length > 0;

    const hasPrice = enabledServices.some((service) =>
      [service.price, service.hourlyPrice, service.fixedPrice].some(
        (price) =>
          price !== null &&
          price !== undefined &&
          Number.isFinite(Number(price)) &&
          Number(price) >= 0
      )
    );

    const hasAvailability = enabledServices.some(
      (service) =>
        Array.isArray(service.availability) &&
        service.availability.some((day) => day.enabled === true)
    );

    const hasZone = zones.some((zone) => zone.is_active !== false);

    const verificationStatus =
      verification?.status ?? provider?.verificationStatus ?? "not_started";

    const verificationDone = ["approved", "verified"].includes(verificationStatus);
    const verificationStarted =
      documents.length > 0 ||
      ["incomplete", "submitted", "under_review", "pending"].includes(verificationStatus);

    const stripeDone = Boolean(
      stripe?.connected &&
      stripe.onboardingComplete &&
      stripe.chargesEnabled &&
      stripe.payoutsEnabled
    );

    const stripeStarted = Boolean(stripe?.connected || stripe?.onboardingComplete);
    const published = provider?.isPublished === true;

    return [
      { id:"profile", number:1, title:"Profil professionnel",
        description:"Présente ton activité, ton expérience et ce qui te différencie.",
        href:"/provider", button:hasProfessionalProfile?"Modifier mon profil":"Compléter mon profil",
        icon:UserRoundCheck, state:loading?"loading":hasProfessionalProfile?"done":"todo",
        stateLabel:loading?"Vérification":hasProfessionalProfile?"Terminé":"À faire", required:true },
      { id:"service", number:2, title:"Métier proposé",
        description:"Active au moins un métier. S’il n’existe pas, propose-le à KLYX.",
        href:"/provider/services/new", button:hasService?"Gérer mes métiers":"Ajouter ou proposer un métier",
        icon:Wrench, state:loading?"loading":hasService?"done":"todo",
        stateLabel:loading?"Vérification":hasService?"Terminé":"À faire", required:true },
      { id:"price", number:3, title:"Tarif",
        description:"Définis un prix horaire ou forfaitaire clair.",
        href:"/provider", button:hasPrice?"Modifier mes tarifs":"Définir mon tarif",
        icon:WalletCards, state:loading?"loading":hasPrice?"done":"todo",
        stateLabel:loading?"Vérification":hasPrice?"Terminé":"À faire", required:true },
      { id:"zone", number:4, title:"Zone d’intervention",
        description:"Indique précisément où tu travailles.",
        href:"/provider/zones", button:hasZone?"Gérer mes zones":"Ajouter une zone",
        icon:MapPinned, state:loading?"loading":hasZone?"done":"todo",
        stateLabel:loading?"Vérification":hasZone?"Terminé":"À faire", required:true },
      { id:"availability", number:5, title:"Disponibilités",
        description:"Déclare les jours et horaires où tu peux réellement intervenir.",
        href:"/provider", button:hasAvailability?"Modifier mes horaires":"Ajouter mes disponibilités",
        icon:FileCheck2, state:loading?"loading":hasAvailability?"done":"todo",
        stateLabel:loading?"Vérification":hasAvailability?"Terminé":"À faire", required:true },
      { id:"verification", number:6, title:"Vérification et confiance",
        description:verificationDone?"Ton dossier est validé.":verificationStarted?"Ton dossier est en cours.":"Commence la vérification pour renforcer la confiance.",
        href:"/provider/verification",
        button:verificationDone?"Voir ma vérification":verificationStarted?"Suivre mon dossier":"Commencer la vérification",
        icon:ShieldCheck,
        state:loading?"loading":verificationDone?"done":verificationStarted?"progress":"todo",
        stateLabel:loading?"Vérification":verificationDone?"Vérifié":verificationStarted?"En cours":"À faire",
        required:false },
      { id:"payments", number:7, title:"Paiements",
        description:stripeDone?"Stripe Connect est opérationnel.":stripeStarted?"Stripe doit encore être terminé.":"Configure ton compte de paiement pour recevoir tes gains.",
        href:"/provider/payments",
        button:stripeDone?"Voir mes paiements":stripeStarted?"Terminer Stripe":"Configurer les paiements",
        icon:CreditCard,
        state:loading?"loading":stripeDone?"done":stripeStarted?"progress":"todo",
        stateLabel:loading?"Vérification":stripeDone?"Opérationnel":stripeStarted?"En cours":"À faire",
        required:true },
      { id:"publish", number:8, title:"Publication",
        description:published?"Ton profil professionnel est publié.":"Finalise puis publie ton profil.",
        href:"/provider", button:published?"Voir mon studio":"Finaliser et publier",
        icon:BadgeCheck, state:loading?"loading":published?"done":"todo",
        stateLabel:loading?"Vérification":published?"Publié":"À faire", required:true },
    ];
  }, [documents, loading, studio, stripe, verification, zones]);

  const requiredSteps = steps.filter((step) => step.required);
  const completedRequired = requiredSteps.filter((step) => step.state === "done").length;
  const totalCompleted = steps.filter((step) => step.state === "done").length;
  const percent =
    requiredSteps.length === 0 ? 0 : Math.round((completedRequired / requiredSteps.length) * 100);
  const ready =
    requiredSteps.length > 0 && completedRequired === requiredSteps.length;

  return (
    <div className="mt-6">
      <section className="klyx-card p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
              Parcours prestataire KLYX
            </p>
            <h3 className="mt-2 text-2xl font-black sm:text-3xl">
              {ready ? "Ton activité est prête" : `${completedRequired}/${requiredSteps.length} étapes obligatoires terminées`}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              KLYX lit les données réellement enregistrées dans ton activité.
            </p>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void load(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted disabled:opacity-60"
          >
            {refreshing ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            Actualiser
          </button>
        </div>

        <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${ready ? "bg-emerald-600" : "bg-blue-600"}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-bold text-muted-foreground">
          <span>{percent}% des étapes obligatoires</span>
          <span>{totalCompleted}/{steps.length} éléments</span>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            {errorMessage}
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-4">
        {steps.map((step) => {
          const Icon = step.icon;
          const isDone = step.state === "done";
          const isProgress = step.state === "progress";

          return (
            <article
              key={step.id}
              className={`klyx-card grid gap-5 p-5 sm:grid-cols-[56px_1fr_auto] sm:items-center sm:p-6 ${
                isDone ? "border-emerald-500/20" : isProgress ? "border-amber-500/20" : ""
              }`}
            >
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${
                isDone ? "bg-emerald-500/10 text-emerald-600" :
                isProgress ? "bg-amber-500/10 text-amber-600" :
                "bg-blue-500/10 text-blue-600"
              }`}>
                {step.state === "loading" ? (
                  <LoaderCircle size={21} className="animate-spin" />
                ) : isDone ? (
                  <Check size={22} />
                ) : isProgress ? (
                  <CircleDashed size={22} />
                ) : (
                  <Icon size={22} />
                )}
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    Étape {step.number}
                  </span>
                  {!step.required && (
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-black uppercase text-muted-foreground">
                      Selon le métier
                    </span>
                  )}
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-black">
                    {step.stateLabel}
                  </span>
                </div>

                <h4 className="mt-2 text-lg font-black">{step.title}</h4>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>

              <Link
                href={step.href}
                prefetch
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted"
              >
                {step.button}
                <ArrowRight size={16} />
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
