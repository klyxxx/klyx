import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";

import ProviderReadinessStatus from "@/app/components/ProviderReadinessStatus";
import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";

type SecondaryLink = {
  label: string;
  href: string;
};

const SECONDARY_LINKS: SecondaryLink[] = [
  { label: "Services & tarifs", href: "/provider/studio" },
  { label: "Proposer un nouveau métier", href: "/provider/services/new" },
  { label: "Planning", href: "/provider/planning" },
  { label: "Devis", href: "/provider/quotes" },
  { label: "Zones d’intervention", href: "/provider/zones" },
  { label: "Capacités", href: "/provider/capabilities" },
  { label: "Confiance", href: "/provider/trust" },
  { label: "Vérification", href: "/provider/verification" },
  { label: "Assistant prestataire", href: "/provider/assistant" },
  { label: "Paramètres", href: "/settings" },
];

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
      <div className="mx-auto max-w-4xl">
        <header className="mb-7 max-w-2xl">
          <p className="text-sm font-semibold text-[#2563EB]">Espace prestataire</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Votre activité
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            KLYX vous montre ce qui demande votre attention maintenant.
          </p>
        </header>

        <ProviderReadinessStatus />

        <section className="mt-6" aria-label="Gestion secondaire">
          <details className="group overflow-hidden rounded-3xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold transition hover:bg-muted/40 sm:px-6">
              <span>Gérer autre chose</span>
              <ChevronDown
                size={18}
                className="text-muted-foreground transition group-open:rotate-180"
              />
            </summary>

            <div className="border-t border-border px-5 sm:px-6">
              {SECONDARY_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group/link flex min-h-12 items-center justify-between gap-4 border-b border-border/70 py-3 text-sm font-medium last:border-b-0 hover:text-[#2563EB]"
                >
                  <span>{item.label}</span>
                  <ArrowRight
                    size={16}
                    className="text-muted-foreground transition group-hover/link:translate-x-1 group-hover/link:text-[#2563EB]"
                  />
                </Link>
              ))}
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
