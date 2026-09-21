import "server-only";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function getKlyxBuildReleaseSha(): string | null {
  const value =
    process.env.KLYX_BUILD_RELEASE_SHA?.trim().toLowerCase() ?? "";
  return SHA_PATTERN.test(value) ? value : null;
}
