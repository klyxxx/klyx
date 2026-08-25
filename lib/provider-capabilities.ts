export const KLYX_PROVIDER_CAPABILITY_SOURCES = [
  "provider",
  "assistant",
] as const;

export type KlyxProviderCapabilitySource =
  (typeof KLYX_PROVIDER_CAPABILITY_SOURCES)[number];

export const KLYX_PROVIDER_CAPABILITY_STATUSES = [
  "draft",
  "confirmed",
  "archived",
] as const;

export type KlyxProviderCapabilityStatus =
  (typeof KLYX_PROVIDER_CAPABILITY_STATUSES)[number];

export const KLYX_PROVIDER_CAPABILITY_LABEL_MIN_LENGTH = 2;
export const KLYX_PROVIDER_CAPABILITY_LABEL_MAX_LENGTH = 160;

/**
 * Produces a stable comparison key while preserving letters and numbers from
 * non-Latin scripts. It is intentionally not a catalog slug: capabilities can
 * remain uncatalogued and multilingual.
 */
export function normalizeKlyxProviderCapabilityLabel(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("und")
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidKlyxProviderCapabilityLabel(value: string): boolean {
  const label = value.trim();
  const normalized = normalizeKlyxProviderCapabilityLabel(label);

  return (
    label.length >= KLYX_PROVIDER_CAPABILITY_LABEL_MIN_LENGTH &&
    label.length <= KLYX_PROVIDER_CAPABILITY_LABEL_MAX_LENGTH &&
    normalized.length >= KLYX_PROVIDER_CAPABILITY_LABEL_MIN_LENGTH &&
    normalized.length <= KLYX_PROVIDER_CAPABILITY_LABEL_MAX_LENGTH
  );
}
