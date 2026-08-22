import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const core = readRepoFile(
  "app/api/provider/quotes/draft/quote-draft-route-core.ts"
);
const route = readRepoFile(
  "app/api/provider/quotes/draft/route.ts"
);
const page = readRepoFile("app/provider/quotes/page.tsx");
const helper = readRepoFile("lib/provider-quote-draft.ts");
const quoteRoute = readRepoFile("app/api/quotes/quote-route-core.ts");
const privilegeMigration = readRepoFile(
  "supabase/migrations/20260819202500_klyx_provider_assistant_draft_privileges.sql"
);

describe("KLYX provider smart quote draft contract", () => {
  it("keeps draft generation provider-only, rate-limited and ownership-scoped", () => {
    expect(core).toContain('requireAccountType(profile, "provider")');
    expect(core).toContain("API_RATE_LIMIT_POLICIES.quoteDraft");
    expect(core).toContain("consumeApiRateLimit");
    expect(core).toContain("apiRateLimitExceededResponse");
    expect(core).toContain('.from("service_quotes")');
    expect(core).toContain('.eq("provider_profile_id", profile.id)');
    expect(core).toContain('quote.status !== "requested"');
    expect(core).toContain("quote.expires_at");
  });

  it("derives the draft from the server-side quote snapshot, not a client-supplied price", () => {
    expect(core).toContain("quote.unit_price");
    expect(core).toContain("quote.estimated_total");
    expect(core).toContain("quote.duration_hours");
    expect(core).toContain("buildProviderQuoteDraft");
    expect(core).not.toContain("body.providerPrice");
    expect(core).not.toContain("body.estimatedTotal");
    expect(core).not.toContain("body.unitPrice");

    expect(quoteRoute).toContain('.from("service_profiles")');
    expect(quoteRoute).toContain('"pricing_type, price, available"');
    expect(quoteRoute).toContain("unit_price: unitPrice");
    expect(quoteRoute).toContain("estimated_total:");
  });

  it("keeps hourly unknown-duration drafts non-authoritative and all drafts review-required", () => {
    expect(helper).toContain('riskLevel: "review_required"');
    expect(helper).toContain("requiresConfirmation: true");
    expect(helper).toContain('source: "quote_snapshot"');
    expect(helper).toContain("let providerPrice: number | null = null;");
    expect(helper).toContain(
      "La durée n’est pas suffisamment définie : KLYX ne propose pas de prix final automatique."
    );
  });

  it("stores only a private assistant draft and never performs transactional side effects", () => {
    expect(core).toContain('.from("provider_assistant_drafts")');
    expect(core).toContain('draft_type: "quote"');
    expect(core).toContain('status: "draft"');
    expect(privilegeMigration).toContain(
      "revoke all privileges on table public.provider_assistant_drafts\n  from public, anon, authenticated;"
    );

    for (const forbidden of [
      '.from("bookings")',
      '.from("messages")',
      'create-checkout-session',
      "stripe",
      "sendEmail",
      "resend",
    ]) {
      expect(core.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps draft preparation separate from the provider's explicit canonical send", () => {
    expect(page).toContain('"/api/provider/quotes/draft"');
    expect(page).toContain('"/api/quotes"');
    expect(page).toContain('action: "send"');
    expect(page).toContain("Vérifier et envoyer le devis");
    expect(page).toContain("Rien n’a été envoyé au client.");
    expect(page).toContain("Seul le bouton ci-dessous envoie réellement le devis au client.");

    expect(quoteRoute).toContain('if (action === "send")');
    expect(quoteRoute).toContain('requireAccountType(profile, "provider")');
  });

  it("sanitizes unexpected 5xx responses at the public route boundary", () => {
    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain('event: "provider_quote_draft_failed"');
    expect(route).toContain('code: "KLYX_PROVIDER_QUOTE_DRAFT_FAILED"');
  });
});
