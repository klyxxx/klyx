import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs.readFileSync(repoPath(file), "utf8").replace(/\r\n/g, "\n");
}

const workflow = readRepoFile(".github/workflows/klyx-golden-path.yml");
const lifecycle = readRepoFile("scripts/golden-path-intent-search.mjs");

describe("KLYX intent-to-provider-search golden path", () => {
  it("keeps the lifecycle script syntactically valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-intent-search.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("runs before quote and booking lifecycle on the local production server", () => {
    const intentSearch = "node scripts/golden-path-intent-search.mjs";
    const quoteBooking = "node scripts/golden-path-client-lifecycle.mjs";

    expect(workflow).toContain("npm run start -- -p 3100");
    expect(workflow).toContain(intentSearch);
    expect(workflow).toContain(quoteBooking);
    expect(workflow.indexOf(intentSearch)).toBeLessThan(
      workflow.indexOf(quoteBooking)
    );
  });

  it("starts from a real natural-language client need", () => {
    expect(lifecycle).toContain('path: "/api/requests/analyze"');
    expect(lifecycle).toContain("ménage à Bruxelles demain à 10h");
    expect(lifecycle).toContain("pendant 2 heures");
    expect(lifecycle).toContain("budget de 100 €");
    expect(lifecycle).toContain("parsed?.readyForSearch !== true");
    expect(lifecycle).toContain("parsed?.requestedTime !== \"10:00:00\"");
    expect(lifecycle).toContain("Number(parsed?.durationHours) !== 2");
    expect(lifecycle).toContain("Number(parsed?.budgetMax) !== 100");
  });

  it("proves the analyzed request is really persisted", () => {
    expect(lifecycle).toContain('.from("service_requests")');
    expect(lifecycle).toContain('storedRequest.status !== "ready"');
    expect(lifecycle).toContain(
      "storedRequest.detected_service_slug !== expectedServiceSlug"
    );
    expect(lifecycle).toContain('storedRequest.city !== "Bruxelles"');
  });

  it("requires the fixture provider as one exact search match", () => {
    expect(lifecycle).toContain('path: `/api/search/providers?${params.toString()}`');
    expect(lifecycle).toContain("search?.exactCount !== 1");
    expect(lifecycle).toContain("search?.showingAlternatives !== false");
    expect(lifecycle).toContain("matchedProvider.profileId !== provider.id");
    expect(lifecycle).toContain("matchedProvider.userServiceId !== userService.id");
    expect(lifecycle).toContain('matchedProvider.city !== "Bruxelles"');
    expect(lifecycle).toContain('matchedProvider.pricingType !== "hourly"');
    expect(lifecycle).toContain("Number(matchedProvider.price) !== 35");
    expect(lifecycle).toContain("matchedProvider.isExactMatch !== true");
  });

  it("stays limited to the isolated local golden-path runtime", () => {
    expect(lifecycle).toContain("assertGoldenPathIsolation");
    expect(lifecycle).toContain("if (!localSupabase)");
    expect(lifecycle).toContain(
      'appOrigin !== "http://127.0.0.1:3100"'
    );
    expect(lifecycle).not.toContain("sk_live_");
    expect(lifecycle).not.toContain("SUPABASE_DB_PASSWORD");
  });
});
