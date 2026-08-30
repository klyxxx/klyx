import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  FileText,
  MapPinned,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import ProviderReadinessStatus from "@/app/components/ProviderReadinessStatus";
import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";

const MANAGEMENT_ITEMS = [
  {
    title: "Services & tarifs",
    description: "Gère ce que tu proposes, tes prix, ta présentation et ta galerie.",
    href: "/provider/studio",
    icon: SlidersHorizontal,
    primary: true,
  },
  {
    title: "Missions",
    description: "Consulte les demandes et suis les missions à traiter.",
    href: "/provider/jobs",
    icon: BriefcaseBusiness,
  },
  {
    title: "Planning",
    description: "Organise tes disponibilités et ton calendrier de travail.",
    href: "/provider/planning",
    icon: CalendarDays,
  },
  {
    title: "Finances",
    description: "Suis tes paiements, rapprochements et exports financiers.",
    href: "/provider/payments",
    icon: CircleDollarSign,
  },
  {
    title: "Devis",
    description: "Prépare et suis les devis envoyés aux clients.",
    href: "/provider/quotes",
    icon: FileText,
  },
  {
    title: "Zones d’intervention",
    description: "Définis clairement où tu acceptes de travailler.",
    href: "/provider/zones",
    icon: MapPinned,
  },
  {
    title: "Capacités",
    description: "Indique les métiers, compétences et capacités que KLYX peut utiliser.",
    href: "/provider/capabilities",
    icon: Sparkles,
  },
  {
    title: "Confiance & vérification",
    description: "Gère les éléments qui renforcent ta fiabilité auprès des clients.",
    href: "/provider/trust",
    icon: ShieldCheck,
  },
  {
    title: "Vérification",
    description: "Consulte et complète les contrôles nécessaires à ton activité.",
    href: "/provider/verification",
    icon: BadgeCheck,
  },
  {
    title: "Assistant prestataire",
    description: "Utilise KLYX pour t’aider à gérer ton activité plus vite.",
    href: "/provider/assistant",
    icon: MessageSquareText,
  },
  {
    title: "Paramètres",
    description: "Retrouve les réglages généraux de ton compte KLYX.",
    href: "/settings",
    icon: Settings2,
  },
] as const;

export default async function ProviderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getActiveProfile();

  if (!profile) {
    redirect("/accounts");
  }

  if (profile.accountType !== "provider") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 max-w-3xl">
          <p className="mb-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
            Espace prestataire
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Gérer mon activité
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Tout ce qui concerne ton activité est regroupé ici. Choisis simplement ce que tu veux gérer.
          </p>
        </header>

        <div className="mb-8">
          <ProviderReadinessStatus />
        </div>

        <section aria-label="Gestion prestataire" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {MANAGEMENT_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.primary
                    ? "group rounded-3xl border border-blue-500/30 bg-blue-50/70 p-6 transition hover:border-blue-500/60 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
                    : "group rounded-3xl border border-border bg-card p-6 transition hover:border-blue-500/40 hover:bg-muted/40"
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background text-blue-600 dark:text-blue-400">
                    <Icon size={21} />
                  </div>
                  <ArrowRight
                    size={19}
                    className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                  />
                </div>

                <h2 className="mt-5 text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
