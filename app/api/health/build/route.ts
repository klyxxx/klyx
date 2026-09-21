import "server-only";

export const dynamic = "force-dynamic";

function normalizedShaValue(name: string): string | null {
  const value = process.env[name]?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{40}$/.test(value) ? value : null;
}

function envTrue(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export async function GET(): Promise<Response> {
  const commitSha = normalizedShaValue("VERCEL_GIT_COMMIT_SHA");
  const liveCertificationSha = normalizedShaValue(
    "KLYX_LIVE_CERTIFICATION_SHA"
  );
  const drCertifiedSha = normalizedShaValue("KLYX_DR_CERTIFIED_SHA");
  const productionFinancialCertifiedSha = normalizedShaValue(
    "KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA"
  );

  return Response.json(
    {
      ok: Boolean(commitSha),
      commitSha,
      environment: process.env.VERCEL_ENV?.trim() || null,
      financialRuntime: {
        stripeMode: process.env.KLYX_STRIPE_MODE?.trim().toLowerCase() || null,
        livePaymentsEnabled: envTrue("KLYX_LIVE_PAYMENTS_ENABLED"),
        liveCertificationEnabled: envTrue(
          "KLYX_LIVE_CERTIFICATION_ENABLED"
        ),
        liveCertificationSha,
        drCertifiedSha,
        productionFinancialCertifiedSha,
        certificationProfileConfigured: Boolean(
          process.env.KLYX_LIVE_CERTIFICATION_PROFILE_ID?.trim()
        ),
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
