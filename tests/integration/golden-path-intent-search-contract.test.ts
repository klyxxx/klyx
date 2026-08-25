import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs.readFileSync(repoPath(file), "utf8").replace(/\r\n/g, "\n");
}

const workflow = readRepoFile(".github/workflows/klyx-golden-path.yml");
const intentSearch = readRepoFile("scripts/golden-path-intent-search.mjs");

describe("KLYX client intent to provider search golden path", () => {
  it("keeps the intent-search script syntactically valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-intent-search.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("runs after the provider fixture and production server but before quotes", () => {
    const fixture = "node scripts/golden-path-provider-fixture.mjs";
    const intent = "node scripts/golden-path-intent-search.mjs";
    const quoteLifecycle = "node scripts/golden-path-client-lifecycle.mjs";

    expect(workflow).toContain("npm run start -- -p 3100");
    expect(workflow).toContain(fixture);
    expect(workflow).toContain(intent);
    expect(workflow).toContain(quoteLifecycle);
    expect(workflow.indexOf(fixture)).toBeLessThan(workflow.indexOf(intent));
    expect(workflow.indexOf("npm run start -- -p 3100")).toBeLessThan(
      workflow.indexOf(intent)
    );
    expect(workflow.indexOf(intent)).toBeLessThan(
      workflow.indexOf(quoteLifecycle)
    );
  });

  it("proves ambiguity is persisted fail-closed before explicit service choice", () => {
    expect(intentSearch).toContain("J'ai besoin d'un ménage à Bruxelles à 10h");
    expect(intentSearch).toContain('path: "/api/requests/analyze"');
    expect(intentSearch).toContain("initialParsed.serviceAmbiguous !== true");
    expect(intentSearch).toContain("initialParsed.readyForSearch !== false");
    expect(intentSearch).toContain("initialParsed.serviceSlug !== null");
    expect(intentSearch).toContain("clarificationCandidates");
    expect(intentSearch).toContain("candidate?.slug === expectedServiceSlug");
    expect(intentSearch).toContain('.from("service_requests")');
    expect(intentSearch).toContain('ambiguousRequest.status !== "analyzed"');
    expect(intentSearch).toContain("ambiguousRequest.detected_service_slug !== null");
    expect(intentSearch).toContain("ambiguousRequest.parsed_payload?.serviceAmbiguous !== true");
  });

  it("requires explicit candidate selection before the request becomes search-ready", () => {
    expect(intentSearch).toContain("selectedServiceSlug: expectedServiceSlug");
    expect(intentSearch).toContain("parsed.readyForSearch !== true");
    expect(intentSearch).toContain("parsed.serviceAmbiguous !== false");
    expect(intentSearch).toContain("parsed.serviceSlug !== expectedServiceSlug");
    expect(intentSearch).toContain("parsed.missingFields.length !== 0");
    expect(intentSearch).toContain('persistedRequest.status !== "ready"');
    expect(intentSearch).toContain("persistedRequest.parsed_payload?.serviceAmbiguous !== false");
  });

  it("requires the exact fixture returned by the real provider-search API", () => {
    expect(intentSearch).toContain("/api/search/providers?");
    expect(intentSearch).toContain("Number(search.exactCount) < 1");
    expect(intentSearch).toContain("search.showingAlternatives !== false");
    expect(intentSearch).toContain("item.profileId === provider.id");
    expect(intentSearch).toContain(
      "item.userServiceId === expectedUserService.id"
    );
    expect(intentSearch).toContain("matchedProvider.isExactMatch !== true");
    expect(intentSearch).toContain("Number(matchedProvider.price) !== 35");
  });

  it("proves a free self-declared skill stays public without fake KLYX approval", () => {
    expect(intentSearch).toContain("matchedProvider.qualificationApproved !== false");
    expect(intentSearch).toContain(
      'matchedProvider.qualificationLevel !== "self_declared"'
    );
    expect(intentSearch).toContain(
      '"Compétence déclarée par le prestataire"'
    );
    expect(intentSearch).not.toContain(
      'matchedProvider.qualificationApproved !== true'
    );
    expect(intentSearch).toContain('"provider_statement"');
    expect(intentSearch).toContain('"storage_path"');
    expect(intentSearch).toContain('"review_note"');
    expect(intentSearch).toContain("Object.prototype.hasOwnProperty.call");
    expect(intentSearch).toContain("ambiguityClarificationVerified: true");
  });

  it("does not shortcut into quote, booking or payment creation", () => {
    expect(intentSearch).not.toContain('path: "/api/quotes"');
    expect(intentSearch).not.toContain('path: "/api/bookings/create"');
    expect(intentSearch).not.toContain("create-checkout-session");
    expect(intentSearch).not.toContain("sk_live_");
  });

  it("remains restricted to the ephemeral local runtime", () => {
    expect(intentSearch).toContain("assertGoldenPathIsolation");
    expect(intentSearch).toContain("if (!localSupabase)");
    expect(intentSearch).toContain(
      'appOrigin !== "http://127.0.0.1:3100"'
    );
  });
});
