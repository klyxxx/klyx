import "server-only";

export const dynamic = "force-dynamic";

const SHA_RE = /^[0-9a-f]{40}$/;

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
