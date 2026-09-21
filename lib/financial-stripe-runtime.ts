import "server-only";

import Stripe from "stripe";

import { assertLiveFinancialMutationAuthorized } from "@/lib/live-financial-authorization-server";
import {
  getProviderStripeDestination,
  getProviderStripeDestinationStrict,
  type ProviderStripeDestination,
} from "@/lib/stripe-connect-account";
import {
  getStripeRuntimeMode,
  type StripeRuntimeMode,
} from "@/lib/stripe-runtime";

export type FinancialStripeCapability =
  | "payments"
  | "settlement_release"
  | "refunds";

export type FinancialStripeRuntime = {
  mode: StripeRuntimeMode;
  livemode: boolean;
  stripe: Stripe;
};

export function getFinancialStripeRuntime(): FinancialStripeRuntime {
  const mode = getStripeRuntimeMode();
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";

  if (mode === "live" && !key.startsWith("sk_live_")) {
    throw new Error("KLYX_FINANCIAL_STRIPE_LIVE_KEY_REQUIRED");
  }

  if (mode === "test" && !key.startsWith("sk_test_")) {
    throw new Error("KLYX_FINANCIAL_STRIPE_TEST_KEY_REQUIRED");
  }

  return {
    mode,
    livemode: mode === "live",
    stripe: new Stripe(key),
  };
}

export async function assertFinancialStripeWriteAuthorized(input: {
  capability: FinancialStripeCapability;
  countryCode?: string | null;
  currency?: string | null;
}): Promise<FinancialStripeRuntime> {
  const runtime = getFinancialStripeRuntime();

  if (runtime.mode === "live") {
    await assertLiveFinancialMutationAuthorized(input);
  }

  return runtime;
}

export function assertStripeObjectMode(
  livemode: boolean,
  runtime: Pick<FinancialStripeRuntime, "livemode">,
  code = "KLYX_FINANCIAL_STRIPE_MODE_MISMATCH"
): void {
  if (livemode !== runtime.livemode) {
    throw new Error(code);
  }
}

export async function getProviderFinancialDestination(
  profileId: string,
  mode: StripeRuntimeMode
): Promise<ProviderStripeDestination> {
  return mode === "live"
    ? getProviderStripeDestinationStrict(profileId)
    : getProviderStripeDestination(profileId);
}
