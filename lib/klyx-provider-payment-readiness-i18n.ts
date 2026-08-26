import type { KlyxProviderPaymentBlockReason } from "./klyx-provider-payment-readiness";

type SupportedLocale = "fr" | "en" | "nl" | "de";

const COPY: Record<
  SupportedLocale,
  Record<KlyxProviderPaymentBlockReason, string>
> = {
  fr: {
    TEST_MODE:
      "Stripe est configuré en mode test. Les paiements réels ne sont pas encore opérationnels.",
    LIVE_PAYMENTS_DISABLED:
      "Les paiements réels KLYX sont désactivés pour le moment.",
    MARKET_NOT_COMMERCIALLY_READY:
      "Stripe peut être configuré, mais KLYX n'a pas encore ouvert les paiements réels dans ce pays.",
    STRIPE_NOT_CONFIGURED:
      "Stripe doit encore être configuré avant de pouvoir recevoir des paiements.",
  },
  en: {
    TEST_MODE:
      "Stripe is configured in test mode. Real payments are not operational yet.",
    LIVE_PAYMENTS_DISABLED:
      "KLYX real payments are disabled for now.",
    MARKET_NOT_COMMERCIALLY_READY:
      "Stripe can be configured, but KLYX has not opened real payments in this country yet.",
    STRIPE_NOT_CONFIGURED:
      "Stripe still needs to be configured before you can receive payments.",
  },
  nl: {
    TEST_MODE:
      "Stripe is ingesteld in testmodus. Echte betalingen zijn nog niet operationeel.",
    LIVE_PAYMENTS_DISABLED:
      "Echte KLYX-betalingen zijn voorlopig uitgeschakeld.",
    MARKET_NOT_COMMERCIALLY_READY:
      "Stripe kan worden ingesteld, maar KLYX heeft echte betalingen in dit land nog niet geopend.",
    STRIPE_NOT_CONFIGURED:
      "Stripe moet nog worden ingesteld voordat je betalingen kunt ontvangen.",
  },
  de: {
    TEST_MODE:
      "Stripe ist im Testmodus eingerichtet. Echte Zahlungen sind noch nicht aktiv.",
    LIVE_PAYMENTS_DISABLED:
      "Echte KLYX-Zahlungen sind derzeit deaktiviert.",
    MARKET_NOT_COMMERCIALLY_READY:
      "Stripe kann eingerichtet werden, aber KLYX hat echte Zahlungen in diesem Land noch nicht freigeschaltet.",
    STRIPE_NOT_CONFIGURED:
      "Stripe muss noch eingerichtet werden, bevor du Zahlungen empfangen kannst.",
  },
};

export function translateKlyxProviderPaymentReadiness(
  locale: string,
  reason: KlyxProviderPaymentBlockReason
) {
  const normalized: SupportedLocale =
    locale === "en" || locale === "nl" || locale === "de" ? locale : "fr";

  return COPY[normalized][reason];
}
