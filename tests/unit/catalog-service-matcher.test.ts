import { describe, expect, it } from "vitest";

import {
  CATALOG_SERVICE_MIN_DECISION_GAP,
  detectCatalogServiceCandidates,
  mergeServiceCandidates,
  resolveCatalogServiceDecision,
} from "@/lib/catalog-service-matcher";

const SERVICES = [
  { slug: "plombier", name: "Plombier" },
  { slug: "electricien", name: "Électricien" },
  { slug: "serrurier", name: "Serrurier" },
  {
    slug: "installation-chaudiere",
    name: "Installation chaudière",
  },
  {
    slug: "reparation-chaudiere",
    name: "Réparation chaudière",
  },
  {
    slug: "entretien-chaudiere",
    name: "Entretien chaudière",
  },
  {
    slug: "installation-robinetterie",
    name: "Installation de robinetterie",
  },
  { slug: "baby-sitting", name: "Baby-sitting" },
  { slug: "aide-menagere", name: "Aide ménagère" },
  {
    slug: "menage-a-domicile",
    name: "Ménage à domicile",
  },
] as const;

describe("catalog service matcher", () => {
  it("matches an explicitly named profession", () => {
    const candidates = detectCatalogServiceCandidates(
      "Je cherche un plombier demain matin",
      SERVICES
    );

    expect(candidates[0]).toMatchObject({
      slug: "plombier",
      label: "Plombier",
      confidence: 100,
    });
  });

  it("normalizes accents and punctuation", () => {
    const candidates = detectCatalogServiceCandidates(
      "Il me faut un electricien à Bruxelles",
      SERVICES
    );

    expect(candidates[0]?.slug).toBe("electricien");
    expect(candidates[0]?.confidence).toBe(100);
  });

  it("uses controlled request synonyms without free-form profession invention", () => {
    const candidates = detectCatalogServiceCandidates(
      "Ma clé est perdue et ma porte est bloquée",
      SERVICES
    );

    expect(candidates[0]).toMatchObject({
      slug: "serrurier",
    });
    expect(candidates[0]!.confidence).toBeGreaterThanOrEqual(82);
    expect(candidates[0]?.reason).toContain("synonyme contrôlé");
  });

  it("uses action words to rank close catalog services", () => {
    const candidates = detectCatalogServiceCandidates(
      "Je dois réparer ma chaudière",
      SERVICES
    );

    expect(candidates[0]?.slug).toBe(
      "reparation-chaudiere"
    );
    expect(candidates[0]!.confidence).toBeGreaterThan(
      candidates[1]!.confidence
    );
  });

  it("recognizes related word forms without inventing slugs", () => {
    const candidates = detectCatalogServiceCandidates(
      "Mon robinet fuit dans la cuisine",
      SERVICES
    );

    expect(candidates.some((candidate) =>
      candidate.slug === "installation-robinetterie"
    )).toBe(true);
  });

  it("prefers an exact service word over a related profession form", () => {
    const candidates = detectCatalogServiceCandidates(
      "J'ai besoin d'un ménage à Bruxelles",
      SERVICES
    );

    expect(candidates[0]?.slug).toBe("menage-a-domicile");

    const homeCleaning = candidates.find(
      (candidate) => candidate.slug === "menage-a-domicile"
    );
    const householdHelp = candidates.find(
      (candidate) => candidate.slug === "aide-menagere"
    );

    expect(homeCleaning).toBeDefined();
    expect(householdHelp).toBeDefined();
    expect(homeCleaning!.confidence).toBeGreaterThan(
      householdHelp!.confidence
    );
  });

  it("does not treat a generic action as a confident profession", () => {
    const candidates = detectCatalogServiceCandidates(
      "J'ai besoin d'une installation",
      SERVICES
    );

    expect(candidates).toEqual([]);
  });

  it("keeps legacy semantic candidates only when the slug exists", () => {
    const candidates = mergeServiceCandidates(
      SERVICES,
      [
        {
          slug: "babysitting",
          label: "Baby-sitting",
          confidence: 100,
          reason: "legacy",
        },
        {
          slug: "baby-sitting",
          label: "Ancien libellé",
          confidence: 90,
          reason: "catalog",
        },
      ]
    );

    expect(candidates).toEqual([
      {
        slug: "baby-sitting",
        label: "Baby-sitting",
        confidence: 90,
        reason: "catalog",
      },
    ]);
  });

  it("refuses to auto-select when two plausible services are too close", () => {
    const candidates = [
      {
        slug: "plombier",
        label: "Plombier",
        confidence: 78,
        reason: "test",
      },
      {
        slug: "installation-robinetterie",
        label: "Installation de robinetterie",
        confidence: 72,
        reason: "test",
      },
    ];

    const decision = resolveCatalogServiceDecision(candidates);

    expect(CATALOG_SERVICE_MIN_DECISION_GAP).toBe(12);
    expect(decision.selected).toBeNull();
    expect(decision.ambiguous).toBe(true);
    expect(decision.confidenceGap).toBe(6);
    expect(decision.clarificationCandidates).toEqual(candidates);
  });

  it("auto-selects only when the leading service has a clear confidence gap", () => {
    const top = {
      slug: "electricien",
      label: "Électricien",
      confidence: 90,
      reason: "test",
    };
    const decision = resolveCatalogServiceDecision([
      top,
      {
        slug: "plombier",
        label: "Plombier",
        confidence: 70,
        reason: "test",
      },
    ]);

    expect(decision.selected).toEqual(top);
    expect(decision.ambiguous).toBe(false);
    expect(decision.confidenceGap).toBe(20);
  });
});
