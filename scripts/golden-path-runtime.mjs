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

  if (!isSupabaseHost(e2eUrl.hostname) || !isSupabaseHost(productionUrl.hostname)) {
    throw new Error("Golden path Supabase URLs must be Supabase-hosted.");
  }

  if (
    e2eUrl.origin === productionUrl.origin ||
    e2eUrl.hostname === productionUrl.hostname
  ) {
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
