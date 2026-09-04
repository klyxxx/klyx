import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";

import ProviderReadinessStatus from "@/app/components/ProviderReadinessStatus";
import { getActiveProfile } from "@/lib/active-profile";
import {
  translateKlyxProviderDashboard,
  type KlyxProviderDashboardMessageKey,
} from "@/lib/klyx-provider-dashboard-i18n";
import { getServerKlyxLocale } from "@/lib/klyx-server-i18n";
import { createClient } from "@/lib/supabase/server";

type SecondaryLink = {
  labelKey: KlyxProviderDashboardMessageKey;
  href: string;
};

const SECONDARY_LINKS: SecondaryLink[] = [
  { labelKey: "servicesPricing", href: "/provider/studio" },
  { labelKey: "proposeNewTrade", href: "/provider/services/new" },
  { labelKey: "planning", href: "/provider/planning" },
  { labelKey: "quotes", href: "/provider/quotes" },
  { labelKey: "serviceAreas", href: "/provider/zones" },
  { labelKey: "capabilities", href: "/provider/capabilities" },
  { labelKey: "trust", href: "/provider/trust" },
  { labelKey: "verification", href: "/provider/verification" },
  { labelKey: "providerAssistant", href: "/provider/assistant" },
  { labelKey: "settings", href: "/settings" },
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

  const locale = await getServerKlyxLocale();
  const t = (key: KlyxProviderDashboardMessageKey) =>
    translateKlyxProviderDashboard(locale, key);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7 max-w-2xl">
          <p className="text-sm font-semibold text-[#2563EB]">{t("spaceLabel")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {t("subtitle")}
          </p>
        </header>

        <ProviderReadinessStatus />

        <section className="mt-6" aria-label={t("secondaryAria")}>
          <details className="group overflow-hidden rounded-3xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold transition hover:bg-muted/40 sm:px-6">
              <span>{t("manageMore")}</span>
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
                  <span>{t(item.labelKey)}</span>
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
