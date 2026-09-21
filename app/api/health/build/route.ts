import "server-only";

export const dynamic = "force-dynamic";

const SHA_RE = /^[0-9a-f]{40}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envTrue(name: string): boolean {
  return env(name).toLowerCase() === "true";
}

function normalizedSha(name: string): string | null {
  const value = env(name).toLowerCase();
  return SHA_RE.test(value) ? value : null;
}

export async function GET(): Promise<Response> {
  const commitSha = normalizedSha("VERCEL_GIT_COMMIT_SHA");
  const drCertifiedSha = normalizedSha("KLYX_DR_CERTIFIED_SHA");
  const liveCertificationSha = normalizedSha("KLYX_LIVE_CERTIFICATION_SHA");
  const financialCertifiedSha = normalizedSha(
    "KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA"
  );
  const stripeMode = env("KLYX_STRIPE_MODE").toLowerCase();
  const stripeSecret = env("STRIPE_SECRET_KEY");
  const expectedStripePrefix =
    stripeMode === "live"
      ? "sk_live_"
      : stripeMode === "test"
        ? "sk_test_"
        : "";
  const stripeSecretModeCompatible =
    Boolean(expectedStripePrefix) &&
    stripeSecret.startsWith(expectedStripePrefix);
  const stripeWebhookConfigured =
    env("STRIPE_WEBHOOK_SECRET").startsWith("whsec_");
  const certificationProfileConfigured =
    UUID_RE.test(env("KLYX_LIVE_CERTIFICATION_PROFILE_ID"));

  return Response.json(
    {
      ok: Boolean(commitSha),
      commitSha,
      environment: env("VERCEL_ENV") || null,
      financialRuntime: {
        stripeMode:
          stripeMode === "test" || stripeMode === "live"
            ? stripeMode
            : "invalid",
        generalLiveEnabled: envTrue("KLYX_LIVE_PAYMENTS_ENABLED"),
        controlledCertificationEnabled: envTrue(
          "KLYX_LIVE_CERTIFICATION_ENABLED"
        ),
        drShaMatchesDeployment:
          Boolean(commitSha) && drCertifiedSha === commitSha,
        certificationShaMatchesDeployment:
          Boolean(commitSha) && liveCertificationSha === commitSha,
        financialCertifiedShaMatchesDeployment:
          Boolean(commitSha) && financialCertifiedSha === commitSha,
        stripeSecretModeCompatible,
        stripeWebhookConfigured,
        certificationProfileConfigured,
      },
    },
    {
      status: commitSha ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
