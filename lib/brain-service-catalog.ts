import {
  detectCatalogServiceCandidates,
  mergeServiceCandidates,
  type CatalogServiceRecord,
} from "@/lib/catalog-service-matcher";
import {
  detectServiceCandidates,
  type ServiceCandidate,
} from "@/lib/universal-service-request";

export type BrainServiceCatalogRecord = CatalogServiceRecord;

function serviceIndex(
  services: readonly BrainServiceCatalogRecord[]
): Map<string, BrainServiceCatalogRecord> {
  return new Map(
    services
      .filter(
        (service) =>
          typeof service.slug === "string" &&
          service.slug.trim().length > 0
      )
      .map((service) => [service.slug, service])
  );
}

export function getBrainServiceCandidates(
  text: string,
  services: readonly BrainServiceCatalogRecord[]
): ServiceCandidate[] {
  return mergeServiceCandidates(
    services,
    detectCatalogServiceCandidates(text, services, 5),
    detectServiceCandidates(text)
  );
}

export function resolveBrainServiceSlug(params: {
  text: string;
  previousSlug: string | null;
  services: readonly BrainServiceCatalogRecord[];
}): string | null {
  const index = serviceIndex(params.services);
  const candidate = getBrainServiceCandidates(
    params.text,
    params.services
  )[0];

  if (
    candidate &&
    candidate.confidence >= 60 &&
    index.has(candidate.slug)
  ) {
    return candidate.slug;
  }

  if (
    params.previousSlug &&
    index.has(params.previousSlug)
  ) {
    return params.previousSlug;
  }

  return null;
}

export function resolveBrainPreferredServiceSlug(
  preferredSlugs: readonly string[] | null | undefined,
  services: readonly BrainServiceCatalogRecord[]
): string | null {
  if (!preferredSlugs?.length) return null;

  const index = serviceIndex(services);

  return (
    preferredSlugs.find((slug) => index.has(slug)) ??
    null
  );
}

export function brainServiceLabel(
  slug: string | null,
  services: readonly BrainServiceCatalogRecord[]
): string {
  if (!slug) return "service";

  const service = serviceIndex(services).get(slug);

  return service?.name?.trim() || service?.slug || "service";
}

export function isBrainServiceSlugAvailable(
  slug: string | null,
  services: readonly BrainServiceCatalogRecord[]
): boolean {
  return Boolean(slug && serviceIndex(services).has(slug));
}
