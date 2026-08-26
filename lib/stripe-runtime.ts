export type StripeRuntimeMode = "test" | "live";

export type StripeRuntimeReport = {
  mode: StripeRuntimeMode;
  ready: boolean;
  livePaymentsEnabled: boolean;
  checks: Array<{
    key: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envTrue(name: string): boolean {
  return env(name).toLowerCase() === "true";
}

export function getStripeRuntimeMode(): StripeRuntimeMode {
  const mode = env("KLYX_STRIPE_MODE").toLowerCase();

  if (mode !== "test" && mode !== "live") {
    throw new Error(
      "KLYX_STRIPE_MODE doit etre exactement test ou live."
    );
  }

  return mode;
}

export function inspectStripeRuntime(): StripeRuntimeReport {
  const mode = getStripeRuntimeMode();
  const secretKey = env("STRIPE_SECRET_KEY");
  const publishableKey = env("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const webhookSecret = env("STRIPE_WEBHOOK_SECRET");
  const appUrl = env("NEXT_PUBLIC_APP_URL");
  const commission = Number(env("KLYX_COMMISSION_PERCENT") || "15");
  const liveEnabled = envTrue("KLYX_LIVE_PAYMENTS_ENABLED");
  const platformOnlyTest = envTrue(
    "KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS"
  );

  const expectedSecretPrefix =
    mode === "live" ? "sk_live_" : "sk_test_";
  const expectedPublicPrefix =
    mode === "live" ? "pk_live_" : "pk_test_";

  let appUrlOk = false;
  let appUrlDetail = "NEXT_PUBLIC_APP_URL manquante.";

  if (appUrl) {
    try {
      const parsed = new URL(appUrl);

      if (mode === "live") {
        appUrlOk =
          parsed.protocol === "https:" &&
          parsed.hostname !== "localhost" &&
          parsed.hostname !== "127.0.0.1";

        appUrlDetail = appUrlOk
          ? parsed.origin
          : "Le mode live exige une URL HTTPS publique.";
      } else {
        appUrlOk =
          parsed.protocol === "http:" ||
          parsed.protocol === "https:";
        appUrlDetail = parsed.origin;
      }
    } catch {
      appUrlDetail = "NEXT_PUBLIC_APP_URL est invalide.";
    }
  }

  const checks = [
    {
      key: "secret_key",
      label: "Cle secrete Stripe",
      ok: secretKey.startsWith(expectedSecretPrefix),
      detail: secretKey
        ? `Doit commencer par ${expectedSecretPrefix}`
        : "STRIPE_SECRET_KEY manquante.",
    },
    {
      key: "publishable_key",
      label: "Cle publique Stripe",
      ok: publishableKey.startsWith(expectedPublicPrefix),
      detail: publishableKey
        ? `Doit commencer par ${expectedPublicPrefix}`
        : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY manquante.",
    },
    {
      key: "webhook_secret",
      label: "Secret webhook Stripe",
      ok: webhookSecret.startsWith("whsec_"),
      detail: webhookSecret
        ? "Secret webhook present."
        : "STRIPE_WEBHOOK_SECRET manquant.",
    },
    {
      key: "app_url",
      label: "Domaine KLYX",
      ok: appUrlOk,
      detail: appUrlDetail,
    },
    {
      key: "commission",
      label: "Commission KLYX",
      ok:
        Number.isFinite(commission) &&
        commission >= 0 &&
        commission <= 100,
      detail: Number.isFinite(commission)
        ? `${commission}%`
        : "KLYX_COMMISSION_PERCENT invalide.",
    },
    {
      key: "platform_only",
      label: "Paiement plateforme de test",
      ok: mode === "test" || !platformOnlyTest,
      detail:
        mode === "live" && platformOnlyTest
          ? "KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS doit etre false en live."
          : "Configuration compatible.",
    },
    {
      key: "live_switch",
      label: "Activation des paiements reels",
      ok: mode === "test" || liveEnabled,
      detail:
        mode === "live"
          ? liveEnabled
            ? "Paiements reels explicitement actives."
            : "KLYX_LIVE_PAYMENTS_ENABLED doit etre true."
          : "Non requis en mode test.",
    },
  ];

  return {
    mode,
    ready: checks.every((check) => check.ok),
    livePaymentsEnabled: liveEnabled,
    checks,
  };
}

function assertStripeRuntimeChecks(
  report: StripeRuntimeReport,
  includeCheck: (check: StripeRuntimeReport["checks"][number]) => boolean
): StripeRuntimeReport {
  const failed = report.checks
    .filter((check) => includeCheck(check) && !check.ok)
    .map((check) => check.label);

  if (failed.length > 0) {
    throw new Error(
      `Configuration Stripe KLYX bloquee : ${failed.join(", ")}.`
    );
  }

  return report;
}

export function assertStripeRuntimeConfigured(): StripeRuntimeReport {
  const report = inspectStripeRuntime();

  return assertStripeRuntimeChecks(
    report,
    (check) => check.key !== "live_switch"
  );
}

export function assertStripeRuntimeReady(): StripeRuntimeReport {
  const report = inspectStripeRuntime();

  return assertStripeRuntimeChecks(report, () => true);
}
