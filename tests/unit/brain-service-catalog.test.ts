import { describe, expect, it } from "vitest";

import {
  brainServiceLabel,
  getBrainServiceCandidates,
  isBrainServiceSlugAvailable,
  resolveBrainPreferredServiceSlug,
  resolveBrainServiceSlug,
  type BrainServiceCatalogRecord,
} from "@/lib/brain-service-catalog";

const services: BrainServiceCatalogRecord[] = [
  {
    slug: "cleaning",
    name: "Ménage",
  },
  {
    slug: "plombier",
    name: "Plombier",
  },
  {
    slug: "photographe-mariage",
    name: "Photographe mariage",
  },
  {
    slug: "garde-enfants",
    name: "Garde d'enfants",
  },
];

describe("KLYX Brain live service catalog", () => {
  it("detects an exact profession from the live catalog", () => {
    expect(
      resolveBrainServiceSlug({
        text: "Je cherche un plombier pour une fuite.",
        previousSlug: null,
        services,
      })
    ).toBe("plombier");
  });

  it("keeps historical semantic rules only when the slug exists in the live catalog", () => {
    const candidates = getBrainServiceCandidates(
      "Quelqu'un peut nettoyer mon appartement ?",
      services
    );

    expect(candidates[0]?.slug).toBe("cleaning");

    expect(
      resolveBrainServiceSlug({
        text: "Quelqu'un peut nettoyer mon appartement ?",
        previousSlug: null,
        services: services.filter(
          (service) => service.slug !== "cleaning"
        ),
      })
    ).toBeNull();
  });

  it("retains a valid previous service when the new message does not change it", () => {
    expect(
      resolveBrainServiceSlug({
        text: "Demain vers 14h.",
        previousSlug: "photographe-mariage",
        services,
      })
    ).toBe("photographe-mariage");
  });

  it("lets an explicit new profession replace the previous service", () => {
    expect(
      resolveBrainServiceSlug({
        text: "En fait je cherche un plombier.",
        previousSlug: "photographe-mariage",
        services,
      })
    ).toBe("plombier");
  });

  it("drops a stale previous service that no longer exists", () => {
    expect(
      resolveBrainServiceSlug({
        text: "Demain vers 14h.",
        previousSlug: "ancien-metier",
        services,
      })
    ).toBeNull();
  });

  it("uses only a live catalog service from memory preferences", () => {
    expect(
      resolveBrainPreferredServiceSlug(
        ["ancien-metier", "garde-enfants"],
        services
      )
    ).toBe("garde-enfants");
  });

  it("resolves labels and availability from the same catalog source", () => {
    expect(
      brainServiceLabel("photographe-mariage", services)
    ).toBe("Photographe mariage");

    expect(
      isBrainServiceSlugAvailable("plombier", services)
    ).toBe(true);

    expect(
      isBrainServiceSlugAvailable("ancien-metier", services)
    ).toBe(false);
  });
});
