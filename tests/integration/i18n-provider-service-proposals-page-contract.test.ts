import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = "app/provider/services/new/page.tsx";
const i18nPath = "lib/klyx-provider-service-proposals-i18n.ts";
const routePath = "app/api/provider/service-proposals/route.ts";
const moderatorPath = "lib/service-moderator.ts";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

describe("provider service proposals i18n contract", () => {
  it("localizes page chrome without reflecting raw API errors", () => {
    const page = read(pagePath);

    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxProviderServiceProposals");
    expect(page).toContain("getKlyxProviderServiceProposalCategoryLabel");
    expect(page).not.toContain("result.error");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("setErrorMessage(error");
  });

  it("preserves the authenticated proposals GET and explicit POST payload", () => {
    const page = read(pagePath);

    expect(page).toContain('fetch("/api/provider/service-proposals"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain('"Content-Type": "application/json"');
    expect(page).toContain(
      "body: JSON.stringify({\n          proposedName,\n          category,\n          description,\n          experienceDetails,\n        })"
    );
  });

  it("keeps form boundaries and authored proposal data intact", () => {
    const page = read(pagePath);

    expect(page).toContain("maxLength={100}");
    expect(page).toContain("maxLength={800}");
    expect(page).toContain("maxLength={500}");
    expect(page).toContain("{proposal.proposedName}");
    expect(page).toContain("{proposal.adminNote}");
    expect(page).toContain("proposal.category");
  });

  it("keeps French category identifiers canonical while translating only labels", () => {
    const page = read(pagePath);
    const i18n = read(i18nPath);
    const moderator = read(moderatorPath);

    expect(page).toContain("value: canonicalCategory");
    expect(page).toContain(
      "getKlyxProviderServiceProposalCategoryLabel(\n                      locale,\n                      canonicalCategory"
    );

    for (const category of [
      "Maison et entretien",
      "Famille et garde",
      "Transport et déménagement",
      "Beauté et bien-être",
      "Cours et accompagnement",
      "Événementiel",
      "Animaux",
      "Numérique et création",
      "Réparation et technique",
      "Autre service",
    ]) {
      expect(i18n).toContain(`"${category}"`);
    }

    for (const safeCategory of [
      "Maison et entretien",
      "Famille et garde",
      "Transport et déménagement",
      "Beauté et bien-être",
      "Cours et accompagnement",
      "Événementiel",
      "Animaux",
      "Numérique et création",
      "Réparation et technique",
    ]) {
      expect(moderator).toContain(`"${safeCategory}"`);
    }

    expect(moderator).toContain("SAFE_CATEGORIES.has(input.category)");
  });

  it("does not alter server validation or moderation ownership", () => {
    const route = read(routePath);

    expect(route).toContain('profile.accountType !== "provider"');
    expect(route).toContain('.eq("profile_id", profile.id)');
    expect(route).toContain("const category = cleanText(body.category, 80);");
    expect(route).toContain(
      "const description = cleanText(body.description, 800);"
    );
    expect(route).toContain(
      "const experienceDetails = cleanText(body.experienceDetails, 500);"
    );
    expect(route).toContain("moderateServiceProposal({");
    expect(route).toContain("category,");
  });
});
