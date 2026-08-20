export function requiredGoldenPathEnv(name) {
  const value = process.env[name]?.trim() ?? "";

  if (!value) {
    throw new Error(`${name} is required for the KLYX golden path.`);
  }

  return value;
}

export function isSupabaseHost(hostname) {
  return (
    hostname.endsWith(".supabase.co") ||
    hostname.endsWith(".supabase.com")
  );
}

export function isLoopbackSupabaseUrl(url) {
  const hostname = url.hostname.toLowerCase();
  const loopback =
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "[::1]";

  return (
    loopback &&
    url.protocol === "http:" &&
    url.port === "54321"
  );
}

export function assertGoldenPathIsolation() {
  if (process.env.KLYX_GOLDEN_PATH_MUTATIONS_ENABLED !== "true") {
    throw new Error(
      "KLYX golden path mutations must be explicitly enabled."
    );
  }

  const e2eUrl = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_SUPABASE_URL")
  );
  const productionUrl = new URL(
    requiredGoldenPathEnv("KLYX_PRODUCTION_SUPABASE_URL")
  );
  const localSupabase =
    process.env.KLYX_GOLDEN_PATH_LOCAL_SUPABASE === "true";

  if (!isSupabaseHost(productionUrl.hostname)) {
    throw new Error(
      "Golden path production comparison URL must target Supabase."
    );
  }

  if (localSupabase) {
    if (!isLoopbackSupabaseUrl(e2eUrl)) {
      throw new Error(
        "Golden path local Supabase must use the isolated loopback API URL on port 54321."
      );
    }
  } else {
    if (!isSupabaseHost(e2eUrl.hostname)) {
      throw new Error(
        "Golden path Supabase URL must target a Supabase-hosted project."
      );
    }

    if (e2eUrl.hostname === productionUrl.hostname) {
      throw new Error(
        "Golden path Supabase must be isolated from the production project."
      );
    }
  }

  if (e2eUrl.origin === productionUrl.origin) {
    throw new Error(
      "Golden path Supabase must be isolated from the production project."
    );
  }

  const stripeSecret = requiredGoldenPathEnv("STRIPE_SECRET_KEY");
  const stripePublic = requiredGoldenPathEnv(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  );
  const webhookSecret = requiredGoldenPathEnv("STRIPE_WEBHOOK_SECRET");

  if (!stripeSecret.startsWith("sk_test_")) {
    throw new Error("Golden path requires a Stripe sk_test_ key.");
  }

  if (!stripePublic.startsWith("pk_test_")) {
    throw new Error("Golden path requires a Stripe pk_test_ key.");
  }

  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error("Golden path requires a Stripe whsec_ secret.");
  }

  if (process.env.KLYX_STRIPE_MODE !== "test") {
    throw new Error("Golden path requires KLYX_STRIPE_MODE=test.");
  }

  if (process.env.KLYX_LIVE_PAYMENTS_ENABLED !== "false") {
    throw new Error("Golden path requires live payments to stay disabled.");
  }

  return {
    e2eOrigin: e2eUrl.origin,
    productionOrigin: productionUrl.origin,
    localSupabase,
  };
}

export async function findGoldenPathUserByEmail(supabase, email) {
  const wanted = email.toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(
        `Unable to inspect the golden-path auth user: ${error.message}`
      );
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === wanted
    );

    if (user) return user;
    if (data.users.length < 100) break;
  }

  return null;
}
