import {
  klyxEmailUrl,
  renderKlyxEmail,
  type KlyxEmailContent,
} from "@/lib/email/klyx-email-template";

export function groupRefundStartedClientEmail(
  groupId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Le remboursement de votre mission groupée est en cours",
    preheader: "Stripe traite le remboursement unique de cette mission.",
    headline: "Remboursement groupé en cours",
    paragraphs: [
      "Le remboursement de votre mission groupée a été lancé.",
      "Le délai d’apparition sur votre compte dépend ensuite de votre banque et du moyen de paiement utilisé.",
    ],
    ctaLabel: "Voir la mission groupée",
    ctaUrl: klyxEmailUrl(`/booking-groups/${encodeURIComponent(groupId)}`),
    note: "Aucun nouveau paiement n’est nécessaire pendant le traitement de ce remboursement.",
  });
}

export function groupRefundStartedProviderEmail(
  groupId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Un remboursement est en cours pour une mission groupée KLYX",
    preheader: "Le remboursement de la mission est en cours de traitement.",
    headline: "Remboursement groupé en cours",
    paragraphs: [
      "Un remboursement a été lancé pour cette mission groupée.",
      "Consultez KLYX pour suivre le statut de la mission et des créneaux concernés.",
    ],
    ctaLabel: "Voir la mission groupée",
    ctaUrl: klyxEmailUrl(`/booking-groups/${encodeURIComponent(groupId)}`),
  });
}
