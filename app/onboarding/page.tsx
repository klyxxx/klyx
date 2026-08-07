import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CreditCard,
  MapPinned,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";
import FirstProfileSetup from "./FirstProfileSetup";

type Step = {
  title: string;
  description: string;
  href: string;
  button: string;
  icon: typeof UserRound;
};

const clientSteps: Step[] = [
  {
    title: "Complète ton profil",
    description:
      "Ajoute tes informations principales pour que KLYX puisse personnaliser ton expérience.",
    href: "/profile",
    button: "Compléter mon profil",
    icon: UserRound,
  },
  {
    title: "Explique ton premier besoin",
    description:
      "Utilise l’assistant KLYX pour décrire ce que tu veux faire sans devoir connaître le bon métier.",
    href: "/brain",
    button: "Parler à KLYX",
    icon: Sparkles,
  },
  {
    title: "Compare les prestataires",
    description:
      "Recherche toi-même par service, ville, disponibilité, prix et niveau de confiance.",
    href: "/search",
    button: "Explorer les services",
    icon: Search,
  },
];

const providerSteps: Step[] = [
  {
    title: "Construis ton profil professionnel",
    description:
      "Ajoute une présentation claire, tes informations professionnelles et une photo adaptée.",
    href: "/provider",
    button: "Ouvrir mon studio",
    icon: BriefcaseBusiness,
  },
  {
    title: "Ajoute ton premier métier",
    description:
      "Indique précisément ce que tu sais faire et configure ton tarif.",
    href: "/provider/services/new",
    button: "Ajouter un métier",
    icon: Wrench,
  },
  {
    title: "Définis ta zone d’intervention",
    description:
      "Choisis les communes dans lesquelles les clients peuvent te trouver.",
    href: "/provider/zones",
    button: "Configurer mes zones",
    icon: MapPinned,
  },
  {
    title: "Renforce ta confiance",
    description:
      "Prépare les éléments de vérification qui permettront de rassurer les futurs clients.",
    href: "/provider/verification",
    button: "Commencer la vérification",
    icon: ShieldCheck,
  },
  {
    title: "Prépare les paiements",
    description:
      "Connecte ton espace de paiement professionnel lorsque tu es prêt à recevoir des missions payées.",
    href: "/provider/payments",
    button: "Configurer les paiements",
    icon: CreditCard,
  },
];

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getActiveProfile();

  if (!profile) {
    const metadata =
      (user.user_metadata ?? {}) as Record<string, unknown>;

    const fullName =
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : "";

    const accountType =
      metadata.account_type === "provider"
        ? "provider"
        : "client";

    return (
      <FirstProfileSetup
        initialFullName={fullName}
        initialAccountType={accountType}
      />
    );
  }

  const provider = profile.accountType === "provider";
  const steps = provider ? providerSteps : clientSteps;

  const firstName =
    profile.firstName?.trim() ||
    user.email?.split("@")[0] ||
    "";

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section
          className={`relative overflow-hidden rounded-[2rem] border border-white/10 p-7 text-white shadow-2xl sm:p-10 ${
            provider
              ? "bg-[linear-gradient(135deg,#111827_0%,#18233f_48%,#0f172a_100%)]"
              : "bg-[linear-gradient(135deg,#17131f_0%,#32135f_52%,#111827_100%)]"
          }`}
        >
          <div
            className={`absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl ${
              provider
                ? "bg-blue-500/20"
                : "bg-violet-500/25"
            }`}
          />

          <div className="relative z-10 max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
              {provider ? (
                <BriefcaseBusiness size={15} />
              ) : (
                <Sparkles size={15} />
              )}
              Première configuration
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] sm:text-5xl">
              {firstName
                ? `Bienvenue ${firstName}`
                : "Bienvenue sur KLYX"}
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
              {provider
                ? "Ton espace prestataire est distinct de ton espace client. Configure les éléments essentiels avant de recevoir tes premières demandes."
                : "Ton espace client est prêt. KLYX peut maintenant t’aider à trouver et organiser ton premier service."}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-zinc-950 shadow-lg"
              >
                Voir mon tableau de bord
                <ArrowRight size={17} />
              </Link>

              <span className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 text-sm font-black text-white/80">
                <BadgeCheck size={17} />
                {provider
                  ? "Parcours prestataire"
                  : "Parcours client"}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <p
            className={
              provider
                ? "text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400"
                : "klyx-eyebrow"
            }
          >
            Démarrage
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            {provider
              ? "Prépare ton activité"
              : "Commence en quelques étapes"}
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            Tu peux quitter cette page à tout moment. Chaque bouton ouvre une
            fonction KLYX déjà existante : l’onboarding n’ajoute aucun système
            parallèle.
          </p>

          <div
            className={`mt-6 grid gap-5 ${
              provider
                ? "md:grid-cols-2 xl:grid-cols-3"
                : "md:grid-cols-3"
            }`}
          >
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.href}
                  className="klyx-card relative flex min-h-64 flex-col overflow-hidden p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`grid h-12 w-12 place-items-center rounded-2xl ${
                        provider
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                      }`}
                    >
                      <Icon size={22} />
                    </span>

                    <span className="grid h-8 min-w-8 place-items-center rounded-full border border-border bg-background px-2 text-xs font-black text-muted-foreground">
                      {index + 1}
                    </span>
                  </div>

                  <h3 className="mt-6 text-lg font-black">
                    {step.title}
                  </h3>

                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>

                  <Link
                    href={step.href}
                    prefetch
                    className={`mt-5 inline-flex items-center gap-2 text-sm font-black ${
                      provider
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-violet-600 dark:text-violet-400"
                    }`}
                  >
                    {step.button}
                    <ArrowRight size={16} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="klyx-card p-6 sm:p-8">
            <p className="klyx-eyebrow">Séparation des rôles</p>
            <h2 className="mt-2 text-xl font-black">
              Client et prestataire restent deux expériences différentes
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Les fonctions professionnelles ne sont pas ajoutées au parcours
              client, et les outils personnels ne sont pas utilisés comme
              outils de gestion professionnelle.
            </p>
          </div>

          <div className="klyx-card p-6 sm:p-8">
            <p className="klyx-eyebrow">Contrôle</p>
            <h2 className="mt-2 text-xl font-black">
              Aucune action sensible n’est automatique
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Cet onboarding guide l’utilisateur vers les fonctions existantes.
              Il ne crée aucune réservation, aucun devis et aucun paiement sans
              action explicite de l’utilisateur.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

