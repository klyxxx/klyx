import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Search,
  Sparkles,
} from "lucide-react";

import AccountSwitcher from "@/app/components/AccountSwitcher";
import { getActiveProfile } from "@/lib/active-profile";
import { isKlyxFounder } from "@/lib/founder-auth";
import { createClient } from "@/lib/supabase/server";

import ClientDashboard from "./ClientDashboard";
import Header from "./Header";
import ProviderDashboard from "./ProviderDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, founder] = await Promise.all([
    getActiveProfile(),
    isKlyxFounder(),
  ]);

  if (!profile) {
    redirect("/accounts");
  }

  const fullName =
    `${profile.firstName} ${profile.lastName}`.trim() ||
    user.email ||
    "Utilisateur KLYX";

  return (
    <main className="klyx-page">
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <Header
          email={user.email ?? ""}
          displayName={fullName}
          isFounder={founder}
          accountType={profile.accountType}
        />

        <AccountSwitcher
          currentProfileId={profile.id}
        />
      </div>

            {/* KLYX_DASHBOARD_RESUME_CENTER_14_04 */}
      <section className="mb-8 overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid gap-px bg-border lg:grid-cols-[1fr_auto]">
          <div className="bg-card p-6 sm:p-7">
            <p
              className={`text-xs font-black uppercase tracking-[0.18em] ${
                profile.accountType === "provider"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-violet-600 dark:text-violet-400"
              }`}
            >
              Reprendre mon parcours
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
              {profile.accountType === "provider"
                ? "Trouve ta prochaine mission."
                : "Organise ton prochain besoin."}
            </h2>

            {/* KLYX_AI_FIRST_DASHBOARD_15_02 */}
          </div>

          <div className="grid gap-3 bg-card p-6 lg:min-w-80">
            {profile.accountType === "provider" ? (
              <>
                <Link
                  href="/provider/jobs"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-500"
                >
                  <BriefcaseBusiness size={18} />
                  Voir mes opportunités
                  <ArrowRight size={17} />
                </Link>

                <Link
                  href="/provider"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-black transition hover:bg-muted"
                >
                  Gérer mon activité
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/assistant/market"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500"
                >
                  <Sparkles size={18} />
                  Organiser un besoin
                  <ArrowRight size={17} />
                </Link>

                <Link
                  href="/search"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-black transition hover:bg-muted"
                >
                  <Search size={18} />
                  Chercher moi-même
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
{profile.accountType === "provider" ? (
        <ProviderDashboard
          firstName={profile.firstName}
        />
      ) : (
        <ClientDashboard
          firstName={profile.firstName}
        />
      )}
    </main>
  );
}
