import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX quotes API error sanitization contract", () => {
  it("keeps GET POST and PATCH behind a secure 5xx boundary", () => {
    const source = read("app/api/quotes/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./quote-route-core"');
    expect(source).toContain("secureCoreResponse(");
    expect(source).toContain("response.status < 500");
    expect(source).toContain('"quotes_load_failed"');
    expect(source).toContain('"KLYX_QUOTES_LOAD_FAILED"');
    expect(source).toContain('"quotes_create_failed"');
    expect(source).toContain('"KLYX_QUOTES_CREATE_FAILED"');
    expect(source).toContain('"quotes_update_failed"');
    expect(source).toContain('"KLYX_QUOTES_UPDATE_FAILED"');
    expect(source).not.toContain("{ error: message }");
  });

  it("preserves quote currency and pricing business logic in the core", () => {
    const source = read("app/api/quotes/quote-route-core.ts");

    expect(source).toContain("KLYX_QUOTE_CLIENT_MONEY_14_24");
    expect(source).toContain("KLYX_QUOTE_PROVIDER_CURRENCY_GUARD_14_24");
    expect(source).toContain("KLYX_QUOTE_CURRENCY_SNAPSHOT_WRITE_14_24");
    expect(source).toContain("assertKlyxSameCurrency(");
    expect(source).toContain("calculateQuote(");
  });

  it("preserves safe quote validation and lifecycle responses", () => {
    const source = read("app/api/quotes/quote-route-core.ts");

    expect(source).toContain('"Profil non autorisé."');
    expect(source).toContain('"Devis introuvable."');
    expect(source).toContain('"Action invalide."');
    expect(source).toContain("Aucune réservation ni aucun paiement n’a été créé automatiquement.");
    expect(source).toContain('"Devis refusé."');
    expect(source).toContain('"Demande de devis annulée."');
  });

  it("confines raw Supabase messages to the non-route core module", () => {
    const route = read("app/api/quotes/route.ts");
    const core = read("app/api/quotes/quote-route-core.ts");

    expect(route).not.toContain("error.message");
    expect(route).not.toContain("profileError.message");
    expect(route).not.toContain("insertError.message");
    expect(core).toContain("error.message");
  });
});
