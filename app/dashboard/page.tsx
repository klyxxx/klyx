import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveProfile } from "@/lib/active-profile";
import AccountSwitcher from "@/app/components/AccountSwitcher";
import Header from "./Header";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getActiveProfile();

  if (!profile) {
    redirect("/profile");
  }

  const isProvider = profile.accountType === "provider";

  const fullName =
    `${profile.firstName} ${profile.lastName}`.trim() ||
    user.email ||
    "Utilisateur";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Header
            email={user.email ?? ""}
            displayName={fullName}
          />

          <AccountSwitcher currentProfileId={profile.id} />
        </div>

        <section className="rounded-3xl bg-zinc-950 p-8 text-white shadow-sm dark:border dark:border-border dark:bg-card dark:text-card-foreground">
          <p className="text-sm font-medium text-zinc-400">
            {isProvider ? "Compte prestataire" : "Compte client"}
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Bonjour {profile.firstName}
          </h2>

          <p className="mt-3 max-w-2xl text-zinc-300 dark:text-muted-foreground">
            {isProvider
              ? "Gère tes services, tes disponibilités et les demandes de tes clients."
              : "Recherche, réserve et gère tous tes services du quotidien."}
          </p>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          {isProvider ? (
            <>
              <DashboardCard
                title="Mes services"
                description="Tarifs, zones, horaires, photos et publication."
                href="/provider"
              />

              <DashboardCard
                title="Demandes reçues"
                description="Consulte les demandes envoyées par les clients."
                href="/bookings"
              />

              <DashboardCard
                title="Mon profil"
                description="Modifie tes informations de prestataire."
                href="/profile"
              />
            </>
          ) : (
            <>
              <DashboardCard
                title="Trouver un service"
                description="Découvre les prestataires disponibles."
                href="/search"
              />

              <DashboardCard
                title="Mes réservations"
                description="Consulte et gère tes demandes."
                href="/bookings"
              />

              <DashboardCard
                title="Mon profil"
                description="Modifie tes informations personnelles."
                href="/profile"
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

type DashboardCardProps = {
  title: string;
  description: string;
  href: string;
};

function DashboardCard({
  title,
  description,
  href,
}: DashboardCardProps) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm transition hover:-translate-y-1 hover:bg-muted/50 hover:shadow-md"
    >
      <h2 className="text-lg font-bold">{title}</h2>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      <p className="mt-5 text-sm font-semibold text-violet-600 dark:text-violet-400">
        Ouvrir
      </p>
    </Link>
  );
}
