import { describe, expect, it } from "vitest";

import {
  detectCatalogServiceCandidates,
  mergeServiceCandidates,
} from "@/lib/catalog-service-matcher";

const SERVICES = [
  { slug: "plombier", name: "Plombier" },
  { slug: "electricien", name: "Électricien" },
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
});
