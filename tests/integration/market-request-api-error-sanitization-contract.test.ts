import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/market/requests/route.ts"
);

function source(): string {
  return fs.readFileSync(routePath, "utf8");
}

describe("KLYX market request API error sanitization contract", () => {
  it("uses the secure boundary for GET POST and PATCH failures", () => {
    const code = source();

    expect(code).toContain('from "@/lib/api-error"');
    expect(code).toContain("secureMarketRequestError(");
    expect(code).toContain('"market_requests_load_failed"');
    expect(code).toContain('"market_request_create_failed"');
    expect(code).toContain('"market_request_update_failed"');
    expect(code).toContain('"KLYX_MARKET_REQUESTS_LOAD_FAILED"');
    expect(code).toContain('"KLYX_MARKET_REQUEST_CREATE_FAILED"');
    expect(code).toContain('"KLYX_MARKET_REQUEST_UPDATE_FAILED"');
  });

  it("does not expose Supabase messages from the request lifecycle", () => {
    const code = source();

    expect(code).not.toContain("offerError.message");
    expect(code).not.toContain("serviceError.message");
    expect(code).not.toContain("providerError.message");
    expect(code).not.toContain("providerProfileError.message");
    expect(code).not.toContain("serviceProfileError.message");
    expect(code).not.toContain("existingError.message");
  });

  it("only republishes explicit safe authentication errors from catches", () => {
    const code = source();

    expect(code).toContain("SAFE_MARKET_AUTH_MESSAGES");
    expect(code).toContain(
      "status < 500 && SAFE_MARKET_AUTH_MESSAGES.has(message)"
    );
  });

  it("keeps market business validation responses intact", () => {
    const code = source();

    expect(code).toContain("KLYX_PROFILE_MARKET_REQUIRED");
    expect(code).toContain('"Service introuvable."');
    expect(code).toContain('"Demande introuvable."');
    expect(code).toContain('"Cette demande ne peut plus être annulée."');
    expect(code).toContain('"Action invalide."');
  });
});
