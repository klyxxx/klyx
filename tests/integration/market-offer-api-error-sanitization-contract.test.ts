import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX market offer API error sanitization contract", () => {
  it("keeps the public route behind a secure 5xx boundary", () => {
    const source = read("app/api/market/requests/[id]/offers/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./offer-route-core"');
    expect(source).toContain("secureCoreResponse(");
    expect(source).toContain("response.status < 500");
    expect(source).toContain('"market_offer_create_failed"');
    expect(source).toContain('"KLYX_MARKET_OFFER_CREATE_FAILED"');
    expect(source).toContain('"market_offer_update_failed"');
    expect(source).toContain('"KLYX_MARKET_OFFER_UPDATE_FAILED"');
    expect(source).not.toContain("{ error: message }");
  });

  it("preserves the atomic multi-slot recovery contract in the core", () => {
    const source = read(
      "app/api/market/requests/[id]/offers/offer-route-core.ts"
    );

    expect(source).toContain("KLYX_MULTI_SLOT_OFFER_ATOMIC_RECOVERY_13_10");
    expect(source).toContain(
      "KLYX_MULTI_SLOT_OFFER_ATOMIC_COVERAGE_REQUIRED"
    );
    expect(source).toContain(
      "KLYX_MULTI_SLOT_OFFER_ATOMIC_REQUEST_NOT_OPEN"
    );
    expect(source).toContain(
      "KLYX_MULTI_SLOT_OFFER_ATOMIC_CONTEXT_REQUIRED"
    );
    expect(source).toContain(
      "KLYX_MULTI_SLOT_OFFER_ATOMIC_INVALID_SLOT_COUNT"
    );
  });

  it("preserves duplicate-quote recovery and safe business responses", () => {
    const source = read(
      "app/api/market/requests/[id]/offers/offer-route-core.ts"
    );

    expect(source).toContain("service_quotes_market_request_id_unique");
    expect(source).toContain('"Montant invalide."');
    expect(source).toContain('"Demande introuvable."');
    expect(source).toContain('"Offre introuvable."');
    expect(source).toContain('"Action invalide."');
    expect(source).toContain("MULTI_SLOT_GROUP_BOOKING_REQUIRED");
  });

  it("keeps raw provider errors confined to the non-route core module", () => {
    const route = read("app/api/market/requests/[id]/offers/route.ts");
    const core = read(
      "app/api/market/requests/[id]/offers/offer-route-core.ts"
    );

    expect(route).not.toContain("requestError.message");
    expect(route).not.toContain("userServiceError.message");
    expect(route).not.toContain("quoteError.message");
    expect(core).toContain("requestError.message");
  });
});
