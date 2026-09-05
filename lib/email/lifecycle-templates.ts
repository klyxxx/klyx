import {
  klyxEmailUrl,
  renderKlyxEmail,
  type KlyxEmailContent,
} from "@/lib/email/klyx-email-template";

type AccountType = "client" | "provider";

function accountTypeLabel(accountType: AccountType): string {
  return accountType === "provider" ? "Prestataire" : "Client";
}

export function accountCreatedEmail(input: {
  firstName?: string | null;
  accountType: AccountType;
}): KlyxEmailContent {
  const firstName = input.firstName?.trim();

  return renderKlyxEmail({
    subject: "Bienvenue sur KLYX",
    preheader: "Votre compte KLYX est prêt.",
    headline: firstName ? `Bienvenue ${firstName}` : "Bienvenue sur KLYX",
    paragraphs: [
      "Votre compte est maintenant créé et votre premier profil KLYX est prêt.",
      input.accountType === "provider"
        ? "Vous pouvez compléter vos services, vos disponibilités et votre zone d’intervention avant de recevoir vos premières demandes."
        : "Vous pouvez maintenant demander un service, comparer les propositions et suivre vos réservations au même endroit.",
    ],
    details: [
      { label: "Type de profil", value: accountTypeLabel(input.accountType) },
    ],
    ctaLabel: "Ouvrir KLYX",
    ctaUrl: klyxEmailUrl("/dashboard"),
    note: "KLYX ne vous demandera jamais votre mot de passe ou vos coordonnées bancaires par email.",
  });
}

export function profileCreatedEmail(
  accountType: AccountType
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Nouveau profil ajouté à votre compte KLYX",
    preheader: "Votre nouveau profil est disponible.",
    headline: "Votre nouveau profil est prêt",
    paragraphs: [
      `Un nouveau profil ${accountTypeLabel(accountType).toLowerCase()} a été ajouté à votre compte KLYX.`,
      "Vous pouvez passer d’un profil à l’autre depuis KLYX sans créer une nouvelle connexion.",
    ],
    details: [
      { label: "Profil ajouté", value: accountTypeLabel(accountType) },
    ],
    ctaLabel: "Gérer mes profils",
    ctaUrl: klyxEmailUrl("/accounts"),
    note: "Si vous n’êtes pas à l’origine de cette création, contactez immédiatement support@klyx.be.",
  });
}

export function profileDeletedEmail(): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Un profil KLYX a été supprimé",
    preheader: "La suppression de votre profil est confirmée.",
    headline: "Profil supprimé",
    paragraphs: [
      "Le profil que vous avez sélectionné a été supprimé de votre compte KLYX.",
      "Vos autres profils restent disponibles et votre connexion principale reste active.",
    ],
    ctaLabel: "Voir mes profils",
    ctaUrl: klyxEmailUrl("/accounts"),
    note: "Si vous n’avez pas demandé cette suppression, contactez immédiatement support@klyx.be.",
  });
}

export function accountDeletedEmail(): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre compte KLYX a été supprimé",
    preheader: "La suppression de votre compte est confirmée.",
    headline: "Votre compte a été supprimé",
    paragraphs: [
      "Votre connexion KLYX et les profils qui y étaient associés ont été supprimés conformément à votre demande.",
      "Certaines données peuvent rester conservées pendant la durée strictement nécessaire lorsque la loi, la sécurité ou les obligations de paiement l’exigent.",
    ],
    ctaLabel: "Contacter le support",
    ctaUrl: "mailto:support@klyx.be",
    note: "Si vous n’avez pas demandé cette suppression, contactez-nous immédiatement à support@klyx.be.",
  });
}

export function paymentReceivedProviderEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Paiement reçu pour votre réservation KLYX",
    preheader: "Le paiement du client est confirmé.",
    headline: "Le paiement est confirmé",
    paragraphs: [
      "Le paiement du client pour cette réservation a bien été confirmé par KLYX.",
      "Consultez la mission pour retrouver les informations utiles et la suite du parcours.",
    ],
    ctaLabel: "Voir la mission",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
    note: "Le versement disponible dépend ensuite du mode de paiement et de votre configuration Stripe Connect.",
  });
}

export function groupPaymentReceivedClientEmail(
  groupId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre paiement groupé KLYX est confirmé",
    preheader: "Un seul paiement couvre tous les créneaux de cette mission.",
    headline: "Paiement groupé confirmé",
    paragraphs: [
      "Votre paiement unique pour cette mission groupée a bien été confirmé.",
      "Tous les créneaux concernés sont maintenant rattachés à ce paiement dans KLYX.",
    ],
    ctaLabel: "Voir la mission groupée",
    ctaUrl: klyxEmailUrl(`/booking-groups/${encodeURIComponent(groupId)}`),
  });
}

export function groupPaymentReceivedProviderEmail(
  groupId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Paiement groupé reçu sur KLYX",
    preheader: "Le paiement de la mission groupée est confirmé.",
    headline: "Le paiement de la mission est confirmé",
    paragraphs: [
      "Le client a réglé la mission groupée.",
      "Vous pouvez consulter tous les créneaux concernés depuis votre espace KLYX.",
    ],
    ctaLabel: "Voir la mission groupée",
    ctaUrl: klyxEmailUrl(`/booking-groups/${encodeURIComponent(groupId)}`),
  });
}

export function groupPaymentFailedEmail(
  groupId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Le paiement groupé KLYX n’a pas abouti",
    preheader: "Aucun paiement n’a été confirmé pour cette tentative.",
    headline: "Le paiement n’a pas abouti",
    paragraphs: [
      "Le paiement de cette mission groupée n’a pas pu être confirmé.",
      "Vérifiez le statut actuel dans KLYX avant de réessayer afin d’éviter toute tentative inutile.",
    ],
    ctaLabel: "Vérifier la mission",
    ctaUrl: klyxEmailUrl(`/booking-groups/${encodeURIComponent(groupId)}`),
  });
}

export function splitPaymentReceivedClientEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Une partie de votre paiement KLYX est confirmée",
    preheader: "Cette partie de votre mission est réglée.",
    headline: "Cette partie du paiement est confirmée",
    paragraphs: [
      "Le paiement correspondant à cette partie de votre mission a été confirmé.",
      "Les autres parties éventuelles conservent leur propre statut de paiement dans KLYX.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function splitPaymentReceivedProviderEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Paiement reçu pour une partie de mission KLYX",
    preheader: "Le paiement associé à cette partie est confirmé.",
    headline: "Paiement confirmé",
    paragraphs: [
      "Le paiement correspondant à cette partie de mission a bien été confirmé.",
      "Retrouvez les réservations concernées dans votre espace prestataire.",
    ],
    ctaLabel: "Voir la mission",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function splitPaymentFailedEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Une partie de votre paiement KLYX a échoué",
    preheader: "Cette tentative de paiement n’a pas été confirmée.",
    headline: "Cette partie du paiement a échoué",
    paragraphs: [
      "Le paiement correspondant à cette partie de la mission n’a pas pu être confirmé.",
      "Consultez KLYX pour vérifier ce qui reste à payer avant de lancer une nouvelle tentative.",
    ],
    ctaLabel: "Vérifier la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function splitPaymentExpiredEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre session de paiement KLYX a expiré",
    preheader: "Aucun paiement n’a été débité pour cette session expirée.",
    headline: "La session de paiement a expiré",
    paragraphs: [
      "La session de paiement correspondant à cette partie de mission a expiré avant sa confirmation.",
      "Aucun nouveau paiement ne doit être relancé avant d’avoir vérifié le statut actuel dans KLYX.",
    ],
    ctaLabel: "Vérifier la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function refundFailedEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre remboursement KLYX nécessite une vérification",
    preheader: "Stripe n’a pas pu finaliser le remboursement.",
    headline: "Le remboursement n’a pas été finalisé",
    paragraphs: [
      "Stripe n’a pas pu finaliser le remboursement associé à cette réservation.",
      "KLYX conserve l’incident afin qu’il puisse être vérifié. Ne lancez pas un nouveau paiement pour compenser ce remboursement.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
    note: "Si le statut ne change pas, contactez support@klyx.be.",
  });
}

export function groupRefundConfirmedClientEmail(
  groupId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre mission groupée KLYX a été remboursée",
    preheader: "Le remboursement unique de la mission est confirmé.",
    headline: "Remboursement groupé confirmé",
    paragraphs: [
      "Stripe a confirmé le remboursement de la mission groupée.",
      "Tous les créneaux concernés sont maintenant rattachés à ce remboursement dans KLYX.",
    ],
    ctaLabel: "Voir la mission groupée",
    ctaUrl: klyxEmailUrl(`/booking-groups/${encodeURIComponent(groupId)}`),
  });
}

export function groupRefundConfirmedProviderEmail(
  groupId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Mission groupée annulée et remboursée",
    preheader: "Le remboursement de la mission groupée est confirmé.",
    headline: "La mission groupée est remboursée",
    paragraphs: [
      "Le remboursement groupé a été confirmé.",
      "Les créneaux associés sont annulés et leur statut est disponible dans KLYX.",
    ],
    ctaLabel: "Voir la mission groupée",
    ctaUrl: klyxEmailUrl(`/booking-groups/${encodeURIComponent(groupId)}`),
  });
}

export function groupRefundFailedEmail(
  groupId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Le remboursement groupé KLYX est à vérifier",
    preheader: "Stripe n’a pas pu finaliser le remboursement groupé.",
    headline: "Remboursement à vérifier",
    paragraphs: [
      "Stripe n’a pas pu finaliser le remboursement de cette mission groupée.",
      "KLYX conserve l’incident et le statut actuel de la mission afin qu’il puisse être vérifié.",
    ],
    ctaLabel: "Voir la mission groupée",
    ctaUrl: klyxEmailUrl(`/booking-groups/${encodeURIComponent(groupId)}`),
  });
}

export function splitRefundStartedEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Un remboursement partiel KLYX est en cours",
    preheader: "Le remboursement d’une partie de votre mission a été lancé.",
    headline: "Remboursement en cours",
    paragraphs: [
      "Le remboursement correspondant à cette partie de votre mission est en cours de traitement.",
      "Les autres parties de la mission peuvent conserver un statut différent.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function splitRefundConfirmedEmail(input: {
  bookingId: string;
  partial: boolean;
}): KlyxEmailContent {
  return renderKlyxEmail({
    subject: input.partial
      ? "Votre remboursement partiel KLYX est confirmé"
      : "Votre remboursement KLYX est confirmé",
    preheader: "Stripe a confirmé le remboursement correspondant.",
    headline: input.partial
      ? "Remboursement partiel confirmé"
      : "Remboursement confirmé",
    paragraphs: [
      "Stripe a confirmé le remboursement correspondant à cette partie de votre mission.",
      input.partial
        ? "D’autres parties de la mission peuvent encore rester payées ou en cours de remboursement."
        : "Cette partie de la mission est maintenant entièrement remboursée.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(input.bookingId)}`),
  });
}

export function splitRefundFailedEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Un remboursement KLYX est à vérifier",
    preheader: "Le remboursement de cette partie n’a pas été finalisé.",
    headline: "Remboursement à vérifier",
    paragraphs: [
      "Stripe n’a pas pu finaliser le remboursement correspondant à cette partie de la mission.",
      "Le statut est conservé dans KLYX pour vérification.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function providerPaymentsReadyEmail(): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre compte de paiement KLYX est prêt",
    preheader: "Votre configuration Stripe permet maintenant de recevoir des paiements.",
    headline: "Vos paiements sont prêts",
    paragraphs: [
      "Votre configuration de paiement prestataire est maintenant active.",
      "Vous pouvez suivre vos paiements et vos informations financières depuis votre espace KLYX.",
    ],
    ctaLabel: "Voir mes finances",
    ctaUrl: klyxEmailUrl("/provider/finance"),
  });
}

export function reviewRequestEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Comment s’est passée votre prestation KLYX ?",
    preheader: "Votre avis aide la communauté KLYX.",
    headline: "Partagez votre expérience",
    paragraphs: [
      "Votre prestation est terminée.",
      "Vous pouvez maintenant laisser un avis sur votre expérience afin d’aider les prochains utilisateurs.",
    ],
    ctaLabel: "Donner mon avis",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function reviewReceivedEmail(): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Vous avez reçu un nouvel avis sur KLYX",
    preheader: "Un client a partagé son expérience.",
    headline: "Un nouvel avis est disponible",
    paragraphs: [
      "Un client a laissé un avis après une prestation.",
      "Consultez votre profil pour voir votre note et votre historique d’avis.",
    ],
    ctaLabel: "Voir mon profil",
    ctaUrl: klyxEmailUrl("/provider/profile"),
  });
}

export function disputeOpenedEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Un litige a été ouvert sur une réservation KLYX",
    preheader: "Le dossier est maintenant enregistré dans KLYX.",
    headline: "Litige ouvert",
    paragraphs: [
      "Un litige a été ouvert pour cette réservation.",
      "Consultez le dossier dans KLYX pour suivre les informations et les prochaines étapes.",
    ],
    ctaLabel: "Voir le dossier",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function disputeUpdatedEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Mise à jour de votre litige KLYX",
    preheader: "Votre dossier de litige a évolué.",
    headline: "Votre dossier a été mis à jour",
    paragraphs: [
      "Une nouvelle information est disponible concernant votre litige.",
      "Consultez KLYX pour voir le statut actuel et les éventuelles actions demandées.",
    ],
    ctaLabel: "Voir le dossier",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function disputeResolvedEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre litige KLYX est clôturé",
    preheader: "Une décision finale est disponible pour votre dossier.",
    headline: "Litige clôturé",
    paragraphs: [
      "Le traitement de ce litige est terminé.",
      "Vous pouvez consulter le dossier dans KLYX pour retrouver la décision et l’historique.",
    ],
    ctaLabel: "Voir le dossier",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function newMessageEmail(
  bookingId: string
): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Vous avez un nouveau message sur KLYX",
    preheader: "Un message vous attend dans votre conversation KLYX.",
    headline: "Nouveau message",
    paragraphs: [
      "Un nouveau message est disponible dans la conversation liée à votre réservation.",
      "Ouvrez KLYX pour répondre et conserver tous les échanges au même endroit.",
    ],
    ctaLabel: "Ouvrir la conversation",
    ctaUrl: klyxEmailUrl(`/messages/${encodeURIComponent(bookingId)}`),
    note: "Les notifications de messages devront respecter les préférences et l’anti-spam avant activation automatique.",
  });
}
