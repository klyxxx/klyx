import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name]?.trim() ?? "";

  if (!value) {
    throw new Error(`${name} is required for the KLYX golden path.`);
  }

  return value;
}

function isSupabaseHost(hostname) {
  return (
    hostname.endsWith(".supabase.co") ||
    hostname.endsWith(".supabase.com")
  );
}

function assertIsolatedRuntime() {
  if (process.env.KLYX_GOLDEN_PATH_MUTATIONS_ENABLED !== "true") {
    throw new Error(
      "KLYX golden path mutations must be explicitly enabled."
    );
  }

  const e2eUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
  const productionUrl = new URL(required("KLYX_PRODUCTION_SUPABASE_URL"));

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

  const stripeSecret = required("STRIPE_SECRET_KEY");
  const stripePublic = required("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const webhookSecret = required("STRIPE_WEBHOOK_SECRET");

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

  return e2eUrl.origin;
}

async function findUserByEmail(supabase, email) {
  const wanted = email.toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(`Unable to inspect the golden-path auth user: ${error.message}`);
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === wanted
    );

    if (user) return user;
    if (data.users.length < 100) break;
  }

  return null;
}

async function main() {
  const e2eOrigin = assertIsolatedRuntime();
  const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("KLYX_E2E_EMAIL");
  required("KLYX_E2E_PASSWORD");

  const supabase = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const user = await findUserByEmail(supabase, email);

  if (!user) {
    throw new Error(
      "Dedicated golden-path auth user is missing from the isolated Supabase project."
    );
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, account_type, country_code, currency_code, city")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (profilesError) {
    throw new Error(
      `Unable to inspect golden-path profiles: ${profilesError.message}`
    );
  }

  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client || !provider) {
    throw new Error(
      "Dedicated golden-path account must own both a client and a provider profile."
    );
  }

  for (const [label, profile] of [
    ["client", client],
    ["provider", provider],
  ]) {
    if (profile.country_code !== "BE") {
      throw new Error(`${label} golden-path profile must use country_code=BE.`);
    }

    if (profile.currency_code !== "EUR") {
      throw new Error(`${label} golden-path profile must use currency_code=EUR.`);
    }
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, slug, name")
    .order("name", { ascending: true })
    .limit(500);

  if (servicesError) {
    throw new Error(
      `Unable to inspect the golden-path service catalog: ${servicesError.message}`
    );
  }

  const service = (services ?? []).find(
    (candidate) =>
      candidate.slug === "cleaning" ||
      candidate.slug === "menage" ||
      candidate.slug === "ménage"
  );

  if (!service) {
    throw new Error(
      "Golden-path Supabase needs a canonical cleaning/menage service in the services catalog."
    );
  }

  // IDs are non-secret fixture handles. Never print the dedicated email/password/keys.
  const result = {
    ready: true,
    clientProfileId: client.id,
    providerProfileId: provider.id,
    serviceId: service.id,
    serviceSlug: service.slug,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path preflight failed: ${message}`);
  process.exitCode = 1;
});
