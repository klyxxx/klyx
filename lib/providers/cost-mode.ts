export type KlyxExternalCostMode = "zero_cash" | "guarded";

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function getKlyxExternalCostMode(
  env: NodeJS.ProcessEnv = process.env
): KlyxExternalCostMode {
  const explicit = normalized(env.KLYX_EXTERNAL_COST_MODE);

  if (explicit === "guarded") {
    return "guarded";
  }

  // Unknown or missing configuration is intentionally fail-safe. This keeps
  // local development, CI and newly deployed environments at zero paid spend.
  return "zero_cash";
}

export function isKlyxZeroCashMode(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return getKlyxExternalCostMode(env) === "zero_cash";
}
