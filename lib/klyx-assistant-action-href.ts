const KLYX_INTERNAL_ORIGIN = "https://klyx.invalid";

export function normalizeKlyxAssistantActionHref(
  value: unknown
): string | null {
  if (typeof value !== "string") return null;

  const href = value.trim();

  if (
    !href ||
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.includes("\\") ||
    /[\u0000-\u001F\u007F]/u.test(href)
  ) {
    return null;
  }

  try {
    const parsed = new URL(href, KLYX_INTERNAL_ORIGIN);

    if (parsed.origin !== KLYX_INTERNAL_ORIGIN) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
