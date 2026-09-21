import "server-only";

import Stripe from "stripe";

import { getStripeRuntimeMode } from "@/lib/stripe-runtime";

const PAYMENT_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "refund.created",
  "refund.failed",
  "refund.updated",
] as const;

const CONNECT_EVENTS = ["account.updated"] as const;

export type StripeLiveInfrastructureReport = {
  ready: boolean;
  platformAccountId: string | null;
  platformChargesEnabled: boolean;
  expectedPaymentWebhookUrl: string | null;
  expectedConnectWebhookUrl: string | null;
  paymentWebhookReady: boolean;
  connectWebhookReady: boolean;
  paymentWebhookMissingEvents: string[];
  connectWebhookMissingEvents: string[];
};

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("https://")) return null;
  return trimmed;
}

function enabledEvents(endpoint: Stripe.WebhookEndpoint | null): Set<string> {
  return new Set(endpoint?.enabled_events ?? []);
}

function missingEvents(
  endpoint: Stripe.WebhookEndpoint | null,
  required: readonly string[]
): string[] {
  const enabled = enabledEvents(endpoint);
  return required.filter((event) => !enabled.has(event));
}

export async function inspectStripeLiveInfrastructure(): Promise<StripeLiveInfrastructureReport> {
  if (getStripeRuntimeMode() !== "live") {
    return {
      ready: false,
      platformAccountId: null,
      platformChargesEnabled: false,
      expectedPaymentWebhookUrl: null,
      expectedConnectWebhookUrl: null,
      paymentWebhookReady: false,
      connectWebhookReady: false,
      paymentWebhookMissingEvents: [...PAYMENT_EVENTS],
      connectWebhookMissingEvents: [...CONNECT_EVENTS],
    };
  }

  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key.startsWith("sk_live_")) {
    throw new Error("KLYX_STRIPE_LIVE_SECRET_REQUIRED");
  }

  const origin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (!origin) {
    throw new Error("KLYX_STRIPE_LIVE_APP_ORIGIN_REQUIRED");
  }

  const stripe = new Stripe(key);
  const [account, endpointList] = await Promise.all([
    stripe.accounts.retrieve(),
    stripe.webhookEndpoints.list({ limit: 100 }),
  ]);

  const paymentUrl = `${origin}/api/stripe/webhook`;
  const connectUrl = `${origin}/api/stripe/connect-webhook`;

  const paymentEndpoint =
    endpointList.data.find(
      (endpoint) =>
        endpoint.livemode &&
        endpoint.status === "enabled" &&
        endpoint.url === paymentUrl
    ) ?? null;

  const connectEndpoint =
    endpointList.data.find(
      (endpoint) =>
        endpoint.livemode &&
        endpoint.status === "enabled" &&
        endpoint.url === connectUrl
    ) ?? null;

  const paymentMissing = missingEvents(paymentEndpoint, PAYMENT_EVENTS);
  const connectMissing = missingEvents(connectEndpoint, CONNECT_EVENTS);

  const paymentWebhookReady =
    Boolean(paymentEndpoint) && paymentMissing.length === 0;
  const connectWebhookReady =
    Boolean(connectEndpoint) && connectMissing.length === 0;
  const platformChargesEnabled = account.charges_enabled === true;

  return {
    ready:
      platformChargesEnabled &&
      paymentWebhookReady &&
      connectWebhookReady,
    platformAccountId: account.id,
    platformChargesEnabled,
    expectedPaymentWebhookUrl: paymentUrl,
    expectedConnectWebhookUrl: connectUrl,
    paymentWebhookReady,
    connectWebhookReady,
    paymentWebhookMissingEvents: paymentMissing,
    connectWebhookMissingEvents: connectMissing,
  };
}
