import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";
import FirstProfileSetup from "./FirstProfileSetup";
import ProviderOnboardingProgress from "./ProviderOnboardingProgress";

type ClientStep = {
  title: string;
  description: string;
  href: string;
  button: string;
  icon: typeof UserRound;
};

const clientSteps: ClientStep[] = [
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
      "Décris ton besoin. KLYX le structure, prépare la recherche et attend ta confirmation avant publication.",
    href: "/assistant/market",
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

// KLYX_ONBOARDING_REAL_WORKFLOWS_13_86
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
      typeof metadata.full_name === "string" ? metadata.full_name : "";

    const accountType =
      metadata.account_type === "provider" ? "provider" : "client";

    return (
      <FirstProfileSetup
        initialFullName={fullName}
        initialAccountType={accountType}
      />
    );
  }

  const provider = profile.accountType === "provider";

  const firstName =
    profile.firstName?.trim() || user.email?.split("@")[0] || "";

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section
          className={`relative overflow-hidden rounded-[2rem] border border-white/10 p-7 text-foreground dark:text-white shadow-2xl sm:p-10 ${
            provider
              ? "bg-[linear-gradient(135deg,#111827_0%,#18233f_48%,#0f172a_100%)]"
              : "bg-[linear-gradient(135deg,#17131f_0%,#32135f_52%,#111827_100%)]"
          }`}
        >
          <div
            className={`absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl ${
              provider ? "bg-blue-500/20" : "bg-violet-500/25"
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
              {firstName ? `Bienvenue ${firstName}` : "Bienvenue sur KLYX"}
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
              {provider
                ? "KLYX mesure maintenant les éléments essentiels réellement configurés dans ton espace prestataire."
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
                {provider ? "Parcours prestataire" : "Parcours client"}
              </span>
            </div>
          </div>
        </section>

                {/* KLYX_ROLE_NEXT_ACTION_14_03 */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-card">
          <div className="grid lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="p-6 sm:p-8">
              <p
                className={`text-xs font-black uppercase tracking-[0.18em] ${
                  provider
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-violet-600 dark:text-violet-400"
                }`}
              >
                Prochaine action
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                {provider
                  ? "Prépare ton activité avant de répondre aux missions."
                  : "Organise ton premier besoin avec KLYX."}
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                {provider
                  ? "Complète les éléments essentiels de ton profil prestataire, puis consulte les opportunités compatibles avec tes services."
                  : "Décris simplement ce dont tu as besoin. KLYX prépare la demande et attend toujours ta confirmation avant publication."}
              </p>

              {/* KLYX_ROLE_SAFETY_CONTEXT_14_03 */}
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
                <BadgeCheck
                  size={18}
                  className={`mt-0.5 shrink-0 ${
                    provider
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                />

                <p className="text-sm leading-6 text-muted-foreground">
                  {provider
                    ? "Ton profil et tes services restent sous ton contrôle. KLYX ne répond à aucune mission automatiquement."
                    : "KLYX peut comprendre et préparer ton besoin, mais ne publie, ne réserve et ne paie rien sans ton action explicite."}
                </p>
              </div>
            </div>

            <div className="border-t border-border p-6 lg:min-w-72 lg:border-l lg:border-t-0">
              {provider ? (
                <div className="grid gap-3">
                  <Link
                    href="/provider"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-500"
                  >
                    <BriefcaseBusiness size={18} />
                    Préparer mon activité
                    <ArrowRight size={17} />
                  </Link>

                  <Link
                    href="/provider/jobs"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-black transition hover:bg-muted"
                  >
                    Voir les opportunités
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3">
                  <Link
                    href="/assistant/market"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500"
                  >
                    <Sparkles size={18} />
                    Organiser mon besoin
                    <ArrowRight size={17} />
                  </Link>

                  <Link
                    href="/search"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-black transition hover:bg-muted"
                  >
                    <Search size={18} />
                    Chercher moi-même
                  </Link>
                </div>
              )}
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
            {provider ? "Prépare ton activité" : "Commence en quelques étapes"}
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            {provider
              ? "La progression ci-dessous vient des données réelles de ton profil prestataire."
              : "Chaque bouton ouvre une fonction KLYX déjà existante."}
          </p>

          {provider ? (
            <>
              <ProviderOnboardingProgress />

              {/* KLYX_PROVIDER_ONBOARDING_SHORTCUTS_13_86 */}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Link
                  href="/provider/jobs"
                  prefetch
                  className="klyx-card klyx-card-hover flex items-start gap-4 p-5"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Search size={20} />
                  </span>

                  <div>
                    <p className="font-black">
                      Voir mes opportunités KLYX
                    </p>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Découvre les missions compatibles avec ton profil,
                      tes services et tes disponibilités.
                    </p>

                    <span className="mt-3 inline-flex items-center gap-2 text-sm font-black text-blue-600 dark:text-blue-400">
                      Ouvrir les opportunités
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </Link>

                <Link
                  href="/provider/assistant"
                  prefetch
                  className="klyx-card klyx-card-hover flex items-start gap-4 p-5"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Sparkles size={20} />
                  </span>

                  <div>
                    <p className="font-black">
                      Utiliser l’Assistant Prestataire
                    </p>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Prépare une réponse, un devis ou une disponibilité
                      avant toute action envers le client.
                    </p>

                    <span className="mt-3 inline-flex items-center gap-2 text-sm font-black text-violet-600 dark:text-violet-400">
                      Ouvrir l’assistant
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </Link>
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
                <BadgeCheck
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />

                <p className="text-sm leading-6 text-muted-foreground">
                  KLYX peut t’aider à préparer ton activité,
                  mais aucune offre ni mission n’est acceptée
                  automatiquement à ta place.
                </p>
              </div>
            </>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {clientSteps.map((step, index) => {
                const Icon = step.icon;

                return (
                  <article
                    key={step.href}
                    className="klyx-card relative flex min-h-64 flex-col overflow-hidden p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                        <Icon size={22} />
                      </span>

                      <span className="grid h-8 min-w-8 place-items-center rounded-full border border-border bg-background px-2 text-xs font-black text-muted-foreground">
                        {index + 1}
                      </span>
                    </div>

                    <h3 className="mt-6 text-lg font-black">{step.title}</h3>

                    <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>

                    <Link
                      href={step.href}
                      prefetch
                      className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-600 dark:text-violet-400"
                    >
                      {step.button}
                      <ArrowRight size={16} />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
