import * as WebBrowser from "expo-web-browser";

/**
 * Mobile never computes amount, commission, beneficiary, settlement or refund.
 * It only opens a server-created KLYX checkout URL. The KLYX server remains the
 * financial authority and Stripe remains an external payment processor.
 */
export async function openKlyxCheckout(checkoutUrl: string) {
  const url = checkoutUrl.trim();
  if (!url.startsWith("https://")) {
    throw new Error("URL de paiement KLYX invalide.");
  }

  return WebBrowser.openAuthSessionAsync(url, "klyx://payment-return");
}
