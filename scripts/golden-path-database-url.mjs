import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

function projectRefFromPublicUrl(raw, label) {
  let url;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }

  const match = url.hostname
    .toLowerCase()
    .match(/^([a-z0-9]{20})\.supabase\.(?:co|com)$/);

  if (!match) {
    throw new Error(
      `${label} must use the canonical Supabase project URL so its project ref can be verified.`
    );
  }

  return match[1];
}

function projectRefFromDatabaseUrl(url) {
  const hostname = url.hostname.toLowerCase();
  const direct = hostname.match(
    /^db\.([a-z0-9]{20})\.supabase\.co$/
  );

  if (direct) {
    return direct[1];
  }

  if (hostname.endsWith(".pooler.supabase.com")) {
    const username = decodeURIComponent(url.username);
    const pooled = username.match(/^postgres\.([a-z0-9]{20})$/);

    if (pooled) {
      return pooled[1];
    }
  }

  throw new Error(
    "KLYX_E2E_SUPABASE_DB_URL must expose the E2E Supabase project ref through the direct host or Supavisor username."
  );
}

function main() {
  assertGoldenPathIsolation();

  const rawDatabaseUrl = requiredGoldenPathEnv(
    "KLYX_E2E_SUPABASE_DB_URL"
  );
  const databasePassword = requiredGoldenPathEnv(
    "KLYX_E2E_SUPABASE_DB_PASSWORD"
  );

  let databaseUrl;

  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error("KLYX_E2E_SUPABASE_DB_URL is not a valid URL.");
  }

  if (
    databaseUrl.protocol !== "postgres:" &&
    databaseUrl.protocol !== "postgresql:"
  ) {
    throw new Error(
      "KLYX_E2E_SUPABASE_DB_URL must be a Postgres connection URL."
    );
  }

  const databaseHostname = databaseUrl.hostname.toLowerCase();
  const isSupabaseDatabaseHost =
    databaseHostname.endsWith(".supabase.co") ||
    databaseHostname.endsWith(".pooler.supabase.com");

  if (!isSupabaseDatabaseHost) {
    throw new Error(
      "KLYX_E2E_SUPABASE_DB_URL must target a Supabase-hosted database."
    );
  }

  if (!databaseUrl.username) {
    throw new Error(
      "KLYX_E2E_SUPABASE_DB_URL must include the Supabase database username."
    );
  }

  const e2eProjectRef = projectRefFromPublicUrl(
    requiredGoldenPathEnv("NEXT_PUBLIC_SUPABASE_URL"),
    "NEXT_PUBLIC_SUPABASE_URL"
  );
  const productionProjectRef = projectRefFromPublicUrl(
    requiredGoldenPathEnv("KLYX_PRODUCTION_SUPABASE_URL"),
    "KLYX_PRODUCTION_SUPABASE_URL"
  );
  const databaseProjectRef = projectRefFromDatabaseUrl(databaseUrl);

  if (e2eProjectRef === productionProjectRef) {
    throw new Error(
      "Golden path E2E and production Supabase project refs must differ."
    );
  }

  if (databaseProjectRef !== e2eProjectRef) {
    throw new Error(
      "Golden path database URL does not belong to the configured E2E Supabase project."
    );
  }

  databaseUrl.password = databasePassword;

  process.stdout.write(databaseUrl.toString());
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path database validation failed: ${message}`);
  process.exitCode = 1;
}
