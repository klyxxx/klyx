import { NextResponse } from "next/server";

import { getActiveProfile, getOwnedProfiles } from "@/lib/active-profile";
import { requireKlyxAdmin } from "@/lib/admin-auth";
import { requireKlyxFounder, founderErrorStatus } from "@/lib/founder-auth";
import { inspectStripeRuntime } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CheckStatus = "ok" | "warning" | "error";

type Check = {
  id: string;
  group: string;
  title: string;
  status: CheckStatus;
  detail: string;
  blocking: boolean;
};

function ok(
  id: string,
  group: string,
  title: string,
  detail: string,
  blocking = true
): Check {
  return { id, group, title, status: "ok", detail, blocking };
}

function warning(
  id: string,
  group: string,
  title: string,
  detail: string,
  blocking = false
): Check {
  return { id, group, title, status: "warning", detail, blocking };
}

function error(
  id: string,
  group: string,
  title: string,
  detail: string,
  blocking = true
): Check {
  return { id, group, title, status: "error", detail, blocking };
}

export async function GET() {
  try {
    const founderUser = await requireKlyxFounder();
    const checks: Check[] = [];

    checks.push(
      ok(
        "founder",
        "Accès",
        "Compte Founder",
        founderUser.email
          ? `Founder reconnu : ${founderUser.email}`
          : "Founder reconnu."
      )
    );

    try {
      await requireKlyxAdmin();
      checks.push(
        ok(
          "admin",
          "Accès",
          "Accès Admin",
          "Le même compte possède les droits Admin."
        )
      );
    } catch (adminError) {
      checks.push(
        error(
          "admin",
          "Accès",
          "Accès Admin",
          adminError instanceof Error
            ? adminError.message
            : "Accès Admin refusé."
        )
      );
    }

    const profiles = await getOwnedProfiles();
    const activeProfile = await getActiveProfile();

    const clientProfiles = profiles.filter(
      (profile) => profile.accountType === "client"
    );
    const providerProfiles = profiles.filter(
      (profile) => profile.accountType === "provider"
    );

    checks.push(
      clientProfiles.length > 0
        ? ok(
            "client-profile",
            "Profils",
            "Profil Client",
            `${clientProfiles.length} profil(s) Client disponible(s).`
          )
        : error(
            "client-profile",
            "Profils",
            "Profil Client",
            "Aucun profil Client lié au compte Founder."
          )
    );

    checks.push(
      providerProfiles.length > 0
        ? ok(
            "provider-profile",
            "Profils",
            "Profil Prestataire",
            `${providerProfiles.length} profil(s) Prestataire disponible(s).`
          )
        : error(
            "provider-profile",
            "Profils",
            "Profil Prestataire",
            "Aucun profil Prestataire lié au compte Founder."
          )
    );

    checks.push(
      activeProfile
        ? ok(
            "active-profile",
            "Profils",
            "Profil actif",
            `${activeProfile.firstName} ${activeProfile.lastName} · ${activeProfile.accountType}`
          )
        : error(
            "active-profile",
            "Profils",
            "Profil actif",
            "Aucun profil actif."
          )
    );

    const { data: services, error: servicesError } = await supabaseAdmin
      .from("services")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (servicesError) {
      checks.push(
        error(
          "services",
          "Catalogue",
          "Catalogue métiers",
          servicesError.message
        )
      );
    } else {
      const count = services?.length ?? 0;
      checks.push(
        count > 0
          ? ok(
              "services",
              "Catalogue",
              "Catalogue métiers",
              `${count} métier(s)/service(s) disponible(s) dans public.services.`
            )
          : error(
              "services",
              "Catalogue",
              "Catalogue métiers",
              "La table public.services est vide."
            )
      );
    }

    const providerProfileIds = providerProfiles.map((profile) => profile.id);

    if (providerProfileIds.length > 0) {
      const { data: userServices, error: userServicesError } = await supabaseAdmin
        .from("user_services")
        .select("id, user_id, service_id, active, provider_enabled")
        .in("user_id", providerProfileIds);

      if (userServicesError) {
        checks.push(
          error(
            "provider-services",
            "Prestataire",
            "Services prestataire",
            userServicesError.message
          )
        );
      } else {
        const rows = userServices ?? [];
        checks.push(
          rows.length > 0
            ? ok(
                "provider-services",
                "Prestataire",
                "Services prestataire",
                `${rows.length} association(s) user_services trouvée(s).`
              )
            : warning(
                "provider-services",
                "Prestataire",
                "Services prestataire",
                "Aucun service n'est encore configuré pour le profil Prestataire."
              )
        );

        const userServiceIds = rows.map((row) => row.id);

        if (userServiceIds.length > 0) {
          const { data: serviceProfiles, error: serviceProfilesError } =
            await supabaseAdmin
              .from("service_profiles")
              .select(
                "id, user_service_id, pricing_type, price, hourly_price, fixed_price, available"
              )
              .in("user_service_id", userServiceIds);

          if (serviceProfilesError) {
            checks.push(
              error(
                "pricing",
                "Prestataire",
                "Tarifs séparés",
                serviceProfilesError.message
              )
            );
          } else {
            const rows = serviceProfiles ?? [];
            const hasColumns = rows.every(
              (row) =>
                Object.prototype.hasOwnProperty.call(row, "hourly_price") &&
                Object.prototype.hasOwnProperty.call(row, "fixed_price")
            );

            checks.push(
              hasColumns
                ? ok(
                    "pricing-columns",
                    "Prestataire",
                    "Colonnes tarifaires",
                    "hourly_price et fixed_price sont disponibles."
                  )
                : error(
                    "pricing-columns",
                    "Prestataire",
                    "Colonnes tarifaires",
                    "hourly_price ou fixed_price manque dans service_profiles."
                  )
            );

            const invalid = rows.filter((row) => {
              const selected =
                row.pricing_type === "fixed"
                  ? row.fixed_price ?? row.price
                  : row.hourly_price ?? row.price;

              return (
                selected !== null &&
                selected !== undefined &&
                (!Number.isFinite(Number(selected)) ||
                  Number(selected) < 1 ||
                  Number(selected) > 10000)
              );
            });

            checks.push(
              invalid.length === 0
                ? ok(
                    "pricing-values",
                    "Prestataire",
                    "Valeurs tarifaires",
                    "Aucun tarif actif invalide détecté."
                  )
                : error(
                    "pricing-values",
                    "Prestataire",
                    "Valeurs tarifaires",
                    `${invalid.length} service(s) possède(nt) un tarif actif invalide.`
                  )
            );

            const separated = rows.some(
              (row) =>
                row.hourly_price !== null &&
                row.fixed_price !== null &&
                Number(row.hourly_price) !== Number(row.fixed_price)
            );

            checks.push(
              separated
                ? ok(
                    "pricing-separated",
                    "Prestataire",
                    "Tarifs réellement distincts",
                    "Au moins un service possède un tarif horaire et un prix fixe différents."
                  )
                : warning(
                    "pricing-separated",
                    "Prestataire",
                    "Tarifs réellement distincts",
                    "Aucun service ne démontre encore deux montants différents. Teste par exemple 25 €/h et 100 € fixe."
                  )
            );
          }
        }
      }
    }

    const criticalSecurityTables = new Set([
      "profiles",
      "user_services",
      "service_profiles",
      "provider_profiles",
      "provider_service_zones",
      "availability_slots",
      "favorites",
      "bookings",
      "service_quotes",
      "messages",
      "reviews",
      "disputes",
      "notifications",
    ]);

    const { data: securityRows, error: securityAuditError } =
      await supabaseAdmin.rpc("klyx_security_audit");

    if (securityAuditError) {
      checks.push(
        warning(
          "security-rls",
          "Sécurité",
          "Audit RLS Supabase",
          `Audit indisponible : ${securityAuditError.message}. Exécute la migration 12.5 dans Supabase.`
        )
      );
    } else {
      const rows = (securityRows ?? []) as Array<{
        table_name: string;
        rls_enabled: boolean;
        policy_count: number;
      }>;

      const existingNames = new Set(
        rows.map((row) => row.table_name)
      );

      const missingTables = Array.from(
        criticalSecurityTables
      ).filter((name) => !existingNames.has(name));

      const unsafeRows = rows.filter(
        (row) =>
          !row.rls_enabled ||
          Number(row.policy_count ?? 0) === 0
      );

      if (unsafeRows.length === 0) {
        checks.push(
          ok(
            "security-rls",
            "Sécurité",
            "RLS Supabase",
            `${rows.length} table(s) critique(s) existante(s) avec RLS et au moins une policy.`
          )
        );
      } else {
        checks.push(
          error(
            "security-rls",
            "Sécurité",
            "RLS Supabase",
            unsafeRows
              .map(
                (row) =>
                  `${row.table_name}: RLS=${
                    row.rls_enabled ? "ON" : "OFF"
                  }, policies=${row.policy_count}`
              )
              .join(" | ")
          )
        );
      }

      checks.push(
        missingTables.length === 0
          ? ok(
              "security-schema",
              "Sécurité",
              "Tables critiques",
              "Toutes les tables critiques attendues existent."
            )
          : warning(
              "security-schema",
              "Sécurité",
              "Tables critiques",
              `Tables absentes ou non encore utilisées : ${missingTables.join(
                ", "
              )}`
            )
      );
    }
    const { error: favoritesError } = await supabaseAdmin
      .from("favorites")
      .select("id, service_profile_id")
      .limit(1);

    checks.push(
      favoritesError
        ? error(
            "favorites-table",
            "Client",
            "Favoris",
            favoritesError.message
          )
        : ok(
            "favorites-table",
            "Client",
            "Favoris",
            "La table favorites est accessible et référence service_profile_id."
          )
    );

    const { error: bookingsError } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .limit(1);

    checks.push(
      bookingsError
        ? error(
            "bookings",
            "Transactions",
            "Réservations",
            bookingsError.message
          )
        : ok(
            "bookings",
            "Transactions",
            "Réservations",
            "La table bookings est accessible."
          )
    );

    const { error: quotesError } = await supabaseAdmin
      .from("service_quotes")
      .select("id")
      .limit(1);

    checks.push(
      quotesError
        ? error(
            "quotes",
            "Transactions",
            "Devis",
            quotesError.message
          )
        : ok(
            "quotes",
            "Transactions",
            "Devis",
            "La table service_quotes est accessible."
          )
    );

    try {
      const stripe = inspectStripeRuntime();

      for (const item of stripe.checks) {
        checks.push(
          item.ok
            ? ok(
                `stripe-${item.key}`,
                "Paiement",
                item.label,
                item.detail,
                stripe.mode === "live"
              )
            : stripe.mode === "live"
              ? error(
                  `stripe-${item.key}`,
                  "Paiement",
                  item.label,
                  item.detail,
                  true
                )
              : warning(
                  `stripe-${item.key}`,
                  "Paiement",
                  item.label,
                  item.detail,
                  false
                )
        );
      }

      checks.push(
        stripe.ready
          ? ok(
              "stripe-runtime",
              "Paiement",
              "Configuration Stripe",
              `Mode ${stripe.mode} prêt.`
            )
          : warning(
              "stripe-runtime",
              "Paiement",
              "Configuration Stripe",
              `Mode ${stripe.mode} incomplet.`,
              stripe.mode === "live"
            )
      );
    } catch (stripeError) {
      checks.push(
        warning(
          "stripe-runtime",
          "Paiement",
          "Configuration Stripe",
          stripeError instanceof Error
            ? stripeError.message
            : "Configuration Stripe illisible."
        )
      );
    }

    const sumsubConfigured = Boolean(
      process.env.SUMSUB_APP_TOKEN?.trim() ||
        process.env.SUMSUB_SECRET_KEY?.trim()
    );

    checks.push(
      sumsubConfigured
        ? ok(
            "sumsub",
            "Vérification",
            "Sumsub",
            "Des variables Sumsub sont configurées.",
            false
          )
        : warning(
            "sumsub",
            "Vérification",
            "Sumsub",
            "Sumsub n'est pas encore entièrement configuré. Non bloquant pendant la Beta."
          )
    );

    const hasOk = (id: string): boolean =>
      checks.some(
        (check) =>
          check.id === id &&
          check.status === "ok"
      );

    const clientJourneyReady =
      hasOk("client-profile") &&
      hasOk("favorites-table") &&
      hasOk("bookings") &&
      hasOk("quotes");

    checks.push(
      clientJourneyReady
        ? ok(
            "beta-client-provider",
            "Beta 12.6",
            "Parcours Client → Prestataire",
            "Profil Client, favoris, devis et réservations sont disponibles."
          )
        : error(
            "beta-client-provider",
            "Beta 12.6",
            "Parcours Client → Prestataire",
            "Le socle Client → Prestataire n'est pas entièrement disponible."
          )
    );

    const providerJourneyReady =
      hasOk("provider-profile") &&
      hasOk("provider-services") &&
      hasOk("pricing-columns") &&
      hasOk("pricing-values");

    checks.push(
      providerJourneyReady
        ? ok(
            "beta-provider-ready",
            "Beta 12.6",
            "Parcours Prestataire",
            "Profil Prestataire, services et structure tarifaire sont disponibles."
          )
        : warning(
            "beta-provider-ready",
            "Beta 12.6",
            "Parcours Prestataire",
            "Le parcours Prestataire nécessite encore une configuration complète."
          )
    );

    const securityReady =
      hasOk("security-rls");

    checks.push(
      securityReady
        ? ok(
            "beta-security-gate",
            "Beta 12.6",
            "Barrière sécurité",
            "L'audit RLS ne détecte aucun blocage sur les tables critiques existantes."
          )
        : error(
            "beta-security-gate",
            "Beta 12.6",
            "Barrière sécurité",
            "La Beta ne doit pas être ouverte tant que l'audit RLS n'est pas vert."
          )
    );

    const paymentReady =
      checks.some(
        (check) =>
          check.id === "stripe-runtime" &&
          check.status === "ok"
      );

    checks.push(
      paymentReady
        ? ok(
            "beta-payment-gate",
            "Beta 12.6",
            "Paiement test",
            "La configuration Stripe du mode actuel est prête."
          )
        : warning(
            "beta-payment-gate",
            "Beta 12.6",
            "Paiement test",
            "Stripe n'est pas encore entièrement prêt. Aucun paiement réel n'est lancé par ce contrôle."
          )
    );
    const blockers = checks.filter(
      (check) => check.blocking && check.status === "error"
    ).length;

    const warnings = checks.filter(
      (check) => check.status === "warning"
    ).length;

    const okCount = checks.filter(
      (check) => check.status === "ok"
    ).length;

    return NextResponse.json({
      version: "12.6",
      stage: "beta-readiness",
      generatedAt: new Date().toISOString(),
      ready: blockers === 0,
      summary: {
        total: checks.length,
        ok: okCount,
        warnings,
        blockers,
      },
      checks,
    });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Test Center indisponible.";

    return NextResponse.json(
      { error: message },
      { status: founderErrorStatus(caught) }
    );
  }
}

