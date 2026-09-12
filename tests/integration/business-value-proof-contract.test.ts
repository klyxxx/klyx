import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("KLYX business value proof contract", () => {
  it("keeps business accounting inputs server-only and distinguishes unavailable costs", () => {
    const migration = read(
      "supabase/migrations/20260912230000_klyx_business_value_metrics.sql"
    );

    expect(migration).toContain("create table if not exists public.business_cost_tracking_state");
    expect(migration).toContain("create table if not exists public.business_cost_events");
    expect(migration).toContain("create table if not exists public.business_pilot_requests");
    expect(migration).toContain("('acquisition', 'unavailable'");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).not.toContain("grant select on table public.business_cost_events to authenticated");
  });

  it("keeps the provider income-loop cohort linked to a real market offer", () => {
    const migration = read(
      "supabase/migrations/20260912230500_klyx_business_loop_proofs.sql"
    );

    expect(migration).toContain("business_pilot_income_attempts");
    expect(migration).toContain(
      "market_offer_id uuid not null references public.market_service_offers(id)"
    );
    expect(migration).toContain("availability_verified boolean not null default false");
    expect(migration).toContain("income_goal_verified boolean not null default false");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("limits the first pilot to one real service and forbids synthetic inflation", () => {
    const pilot = read("lib/klyx-local-value-pilot.ts");

    expect(pilot).toContain('zoneLabel: "Anneessens"');
    expect(pilot).toContain('categorySlug: "bricolage-reparation"');
    expect(pilot).toContain('serviceSlug: "montage-de-meubles"');
    expect(pilot).toContain("maxActiveProviders: 5");
    expect(pilot).toContain("maxRealRequests: 20");
    expect(pilot).toContain("minimumCompletedPaidMissionsForEconomicRead: 10");
    expect(pilot).toContain("syntheticTransactionsAllowed: false");
    expect(pilot).toContain("paidAcquisitionEnabled: false");
  });

  it("protects all business APIs behind Founder auth", () => {
    const metrics = read("app/api/founder/business-metrics/route.ts");
    const costs = read("app/api/founder/business-costs/route.ts");
    const stripe = read("app/api/founder/business-costs/stripe-sync/route.ts");
    const pilot = read("app/api/founder/business-pilot/route.ts");

    for (const source of [metrics, costs, stripe, pilot]) {
      expect(source).toContain("requireKlyxFounder");
      expect(source).toContain("secureApiErrorResponse");
    }
    expect(metrics).toContain('"Cache-Control": "private, no-store, max-age=0"');
  });

  it("uses actual Stripe balance transaction fees instead of a guessed percentage", () => {
    const stripe = read("app/api/founder/business-costs/stripe-sync/route.ts");

    expect(stripe).toContain('expand: ["latest_charge.balance_transaction"]');
    expect(stripe).toContain("stripe.balanceTransactions.retrieve");
    expect(stripe).toContain("balance.fee");
    expect(stripe).toContain('source: "stripe"');
    expect(stripe).toContain('estimated: false');
    expect(stripe).not.toContain("charge.refunded && charge.amount === 0");
    expect(stripe).not.toMatch(/0\.0?29|2\.9\s*%|stripe.*percent/i);
  });

  it("keeps pilot costs cumulative instead of truncating them to the dashboard window", () => {
    const metrics = read("app/api/founder/business-metrics/route.ts");

    expect(metrics).toContain("async function loadCumulativePilotCosts");
    expect(metrics).toContain('.in("market_request_id", requestIds)');
    expect(metrics).toContain('.in("booking_id", bookingIds)');
    expect(metrics).toContain("const pilotCosts = await loadCumulativePilotCosts(");
  });

  it("requires a real dated provider availability before proving the income loop", () => {
    const pilot = read("app/api/founder/business-pilot/route.ts");

    expect(pilot).toContain("function validDate");
    expect(pilot).toContain("if (!validDate(availabilityDate))");
    expect(pilot).toContain("Une date de disponibilité réelle");
    expect(pilot).toContain("availability_date: availabilityDate");
  });

  it("requires real attribution for manually recorded costs", () => {
    const costs = read("app/api/founder/business-costs/route.ts");

    expect(costs).toContain("!serviceId && !bookingId && !marketRequestId");
    expect(costs).toContain("Impossible d'attribuer ce coût à une catégorie");
    expect(costs).toContain('source_key: sourceKey');
    expect(costs).toContain('tracking_mode: "manual"');
  });

  it("documents non-launch, fail-closed economics, stop rules and conservative expansion", () => {
    const doc = read("docs/KLYX_LOCAL_VALUE_PILOT.md");

    expect(doc).toContain("n'est **pas un lancement général**");
    expect(doc).toContain("Transactions synthétiques");
    expect(doc).toContain("10 missions réellement terminées et payées");
    expect(doc).toContain("Conditions d'arrêt");
    expect(doc).toContain("un seul élargissement à la fois");
    expect(doc).toContain("La marge nette estimée");
    expect(doc).toContain("pas un bénéfice comptable complet");
    expect(doc).toContain("Une absence de donnée ne devient jamais artificiellement `0 €`");
  });
});
