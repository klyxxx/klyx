import {
  klyxEmailUrl,
  renderKlyxEmail,
  type KlyxEmailContent,
} from "@/lib/email/klyx-email-template";

function formatBookingDate(value: string): string {
  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const date = new Date(`${trimmed}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return trimmed;
  }

  return new Intl.DateTimeFormat("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Brussels",
  }).format(date);
}

export function quoteRequestedEmail(): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Nouvelle demande de devis sur KLYX",
    preheader: "Un client souhaite recevoir votre proposition.",
    headline: "Vous avez une nouvelle demande",
    paragraphs: [
      "Un client souhaite recevoir un devis pour un service que vous proposez.",
      "Consultez sa demande puis envoyez votre proposition directement depuis votre espace KLYX.",
    ],
    ctaLabel: "Voir la demande",
    ctaUrl: klyxEmailUrl("/provider/quotes"),
    note: "Répondez depuis KLYX afin que le devis, le prix et la suite du parcours restent au même endroit.",
  });
}

export function quoteSentEmail(quoteId: string): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre devis KLYX est prêt",
    preheader: "Le prestataire a répondu à votre demande.",
    headline: "Votre devis est arrivé",
    paragraphs: [
      "Le prestataire a répondu à votre demande de devis.",
      "Vous pouvez maintenant consulter le montant, les détails de la proposition et décider tranquillement de la suite.",
    ],
    ctaLabel: "Consulter le devis",
    ctaUrl: klyxEmailUrl(`/quotes/${encodeURIComponent(quoteId)}`),
    note: "Aucune réservation ni aucun paiement n’est créé tant que vous ne confirmez pas la suite dans KLYX.",
  });
}

export function quoteAcceptedEmail(): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre devis a été accepté",
    preheader: "Bonne nouvelle : le client a accepté votre proposition.",
    headline: "Bonne nouvelle, votre devis est accepté",
    paragraphs: [
      "Le client a accepté votre proposition.",
      "Retrouvez le devis dans KLYX pour consulter les détails et poursuivre la mission au bon moment.",
    ],
    ctaLabel: "Voir le devis",
    ctaUrl: klyxEmailUrl("/provider/quotes"),
  });
}

export function quoteRejectedEmail(): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre devis n’a pas été retenu",
    preheader: "Le client a choisi de ne pas poursuivre cette proposition.",
    headline: "Le client ne poursuit pas ce devis",
    paragraphs: [
      "Le client a choisi de ne pas poursuivre cette proposition.",
      "Aucune action n’est nécessaire. Vos autres demandes et missions restent disponibles dans KLYX.",
    ],
    ctaLabel: "Voir mes devis",
    ctaUrl: klyxEmailUrl("/provider/quotes"),
  });
}

export function quoteCancelledEmail(): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Une demande de devis a été annulée",
    preheader: "Le client a annulé cette demande de devis.",
    headline: "Cette demande a été annulée",
    paragraphs: [
      "Le client a annulé sa demande de devis.",
      "Vous n’avez rien à faire pour cette demande. Retrouvez vos autres opportunités dans votre espace KLYX.",
    ],
    ctaLabel: "Voir mes devis",
    ctaUrl: klyxEmailUrl("/provider/quotes"),
  });
}

export function bookingRequestedEmail(input: {
  bookingId: string;
  service: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
}): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Nouvelle demande de réservation sur KLYX",
    preheader: "Un client souhaite réserver l’un de vos services.",
    headline: "Vous avez une nouvelle réservation à examiner",
    paragraphs: [
      "Un client souhaite réserver l’un de vos services.",
      "Vérifiez le créneau et les informations de la demande avant d’accepter ou de refuser.",
    ],
    details: [
      { label: "Service", value: input.service },
      { label: "Date", value: formatBookingDate(input.bookingDate) },
      {
        label: "Horaire",
        value: `${input.startTime} – ${input.endTime}`,
      },
    ],
    ctaLabel: "Voir la demande",
    ctaUrl: klyxEmailUrl("/provider/jobs"),
    note: "Le client sera informé dès que vous aurez répondu dans KLYX.",
  });
}

export function bookingAcceptedEmail(bookingId: string): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre réservation est confirmée",
    preheader: "Le prestataire a accepté votre demande de réservation.",
    headline: "Votre demande a été acceptée",
    paragraphs: [
      "Le prestataire a accepté votre demande de réservation.",
      "Consultez maintenant votre réservation dans KLYX pour voir les détails et la prochaine action disponible.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function bookingRejectedEmail(bookingId: string): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre demande de réservation n’a pas été acceptée",
    preheader: "Le prestataire ne peut pas accepter cette demande.",
    headline: "Cette demande n’a pas été acceptée",
    paragraphs: [
      "Le prestataire ne peut pas accepter cette demande de réservation.",
      "Vous pouvez consulter les détails dans KLYX et organiser une autre solution quand vous le souhaitez.",
    ],
    ctaLabel: "Voir la demande",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function bookingCancelledEmail(input: {
  bookingId: string;
  refundStarted?: boolean;
}): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre réservation a été annulée",
    preheader: "Une réservation KLYX vient d’être annulée.",
    headline: "Cette réservation a été annulée",
    paragraphs: [
      "La réservation a été annulée dans KLYX.",
      input.refundStarted
        ? "Un remboursement a également été lancé pour le paiement associé."
        : "Consultez la réservation pour retrouver les informations utiles.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(input.bookingId)}`),
  });
}

export function refundStartedEmail(bookingId: string): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre remboursement est en cours",
    preheader: "La demande de remboursement a bien été lancée.",
    headline: "Votre remboursement a été lancé",
    paragraphs: [
      "La demande de remboursement liée à votre réservation a bien été transmise.",
      "Le délai d’apparition sur votre compte dépend ensuite de votre banque et de votre moyen de paiement.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
    note: "Vous n’avez aucune nouvelle action de paiement à effectuer pour ce remboursement.",
  });
}

export function refundConfirmedEmail(bookingId: string): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre remboursement est confirmé",
    preheader: "Le remboursement de votre réservation est confirmé.",
    headline: "Votre remboursement est confirmé",
    paragraphs: [
      "Le remboursement lié à votre réservation a été confirmé.",
      "Selon votre banque, quelques jours peuvent encore être nécessaires avant qu’il apparaisse sur votre compte.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function paymentReceivedEmail(bookingId: string): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Paiement reçu par KLYX",
    preheader: "Votre paiement a bien été enregistré.",
    headline: "Votre paiement est confirmé",
    paragraphs: [
      "Votre paiement a bien été enregistré pour cette réservation.",
      "Vous pouvez retrouver le statut et les informations de la réservation directement dans KLYX.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}

export function paymentFailedEmail(bookingId: string): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre paiement KLYX n’a pas abouti",
    preheader: "Le paiement n’a pas pu être confirmé.",
    headline: "Le paiement n’a pas abouti",
    paragraphs: [
      "Le paiement de cette réservation n’a pas pu être confirmé.",
      "Consultez KLYX pour voir le statut actuel avant de réessayer. Aucun paiement réussi ne doit être effectué une seconde fois.",
    ],
    ctaLabel: "Vérifier la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(bookingId)}`),
  });
}
