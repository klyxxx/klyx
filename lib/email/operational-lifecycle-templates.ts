import {
  klyxEmailUrl,
  renderKlyxEmail,
  type KlyxEmailContent,
} from "@/lib/email/klyx-email-template";

export type ProviderVerificationDecision =
  | "under_review"
  | "approved"
  | "changes_required"
  | "rejected"
  | "reopened";

export type DisputeLifecycleStatus =
  | "open"
  | "under_review"
  | "waiting_user"
  | "resolved"
  | "closed";

export type ServiceProposalLifecycleStatus =
  | "pending"
  | "approved"
  | "rejected";

export function providerVerificationSubmittedEmail(): KlyxEmailContent {
  return renderKlyxEmail({
    subject: "Votre dossier de vérification KLYX a été envoyé",
    preheader: "Vos documents attendent maintenant leur vérification.",
    headline: "Dossier envoyé",
    paragraphs: [
      "Votre dossier de vérification prestataire a bien été envoyé à KLYX.",
      "Nous vous informerons lorsqu’il sera approuvé ou si des informations supplémentaires sont nécessaires.",
    ],
    ctaLabel: "Suivre ma vérification",
    ctaUrl: klyxEmailUrl("/provider/verification"),
    note: "N’envoyez jamais vos documents d’identité par réponse à cet email.",
  });
}

export function providerVerificationDecisionEmail(input: {
  status: ProviderVerificationDecision;
  note?: string | null;
}): KlyxEmailContent {
  const note = input.note?.trim();

  if (input.status === "approved") {
    return renderKlyxEmail({
      subject: "Votre profil prestataire KLYX est vérifié",
      preheader: "Votre dossier de vérification a été approuvé.",
      headline: "Vérification approuvée",
      paragraphs: [
        "Votre dossier de vérification prestataire a été approuvé.",
        "Votre profil peut maintenant afficher le niveau de confiance correspondant dans KLYX.",
      ],
      ctaLabel: "Voir ma vérification",
      ctaUrl: klyxEmailUrl("/provider/verification"),
      note: note || undefined,
    });
  }

  if (input.status === "changes_required") {
    return renderKlyxEmail({
      subject: "Votre vérification KLYX doit être complétée",
      preheader: "Des informations supplémentaires sont nécessaires.",
      headline: "Documents à compléter",
      paragraphs: [
        "KLYX a examiné votre dossier et des informations ou documents doivent être corrigés avant validation.",
        "Consultez votre espace de vérification avant d’envoyer à nouveau le dossier.",
      ],
      ctaLabel: "Compléter mon dossier",
      ctaUrl: klyxEmailUrl("/provider/verification"),
      note: note || undefined,
    });
  }

  if (input.status === "rejected") {
    return renderKlyxEmail({
      subject: "Votre vérification prestataire KLYX n’a pas été validée",
      preheader: "Une décision est disponible pour votre dossier.",
      headline: "Vérification non validée",
      paragraphs: [
        "Votre dossier de vérification prestataire n’a pas été validé.",
        "Consultez votre espace KLYX pour voir les informations disponibles et les prochaines possibilités.",
      ],
      ctaLabel: "Voir ma vérification",
      ctaUrl: klyxEmailUrl("/provider/verification"),
      note: note || undefined,
    });
  }

  return renderKlyxEmail({
    subject: "Votre vérification KLYX est en cours d’examen",
    preheader: "Votre dossier est maintenant en cours d’analyse.",
    headline: input.status === "reopened" ? "Dossier rouvert" : "Vérification en cours",
    paragraphs: [
      input.status === "reopened"
        ? "Votre dossier de vérification a été rouvert et sera examiné à nouveau."
        : "Votre dossier de vérification est maintenant en cours d’examen.",
      "Vous recevrez un nouvel email lorsque le statut évoluera de manière importante.",
    ],
    ctaLabel: "Suivre ma vérification",
    ctaUrl: klyxEmailUrl("/provider/verification"),
    note: note || undefined,
  });
}

export function disputeLifecycleEmail(input: {
  bookingId: string;
  status: DisputeLifecycleStatus;
  note?: string | null;
}): KlyxEmailContent {
  const note = input.note?.trim();
  const labels: Record<DisputeLifecycleStatus, {
    subject: string;
    preheader: string;
    headline: string;
    paragraph: string;
  }> = {
    open: {
      subject: "Votre litige KLYX a été rouvert",
      preheader: "Le dossier est de nouveau actif.",
      headline: "Litige rouvert",
      paragraph: "Le dossier de litige est de nouveau ouvert.",
    },
    under_review: {
      subject: "Votre litige KLYX est en cours d’analyse",
      preheader: "KLYX examine maintenant le dossier.",
      headline: "Analyse en cours",
      paragraph: "KLYX examine maintenant les informations disponibles pour ce litige.",
    },
    waiting_user: {
      subject: "Des informations sont demandées pour votre litige KLYX",
      preheader: "Votre dossier nécessite une action de votre part.",
      headline: "Informations demandées",
      paragraph: "Des informations complémentaires sont nécessaires pour poursuivre l’examen de ce litige.",
    },
    resolved: {
      subject: "Votre litige KLYX est résolu",
      preheader: "Une décision a été enregistrée pour votre dossier.",
      headline: "Litige résolu",
      paragraph: "Une décision a été enregistrée pour ce litige.",
    },
    closed: {
      subject: "Votre dossier de litige KLYX est fermé",
      preheader: "Le traitement de ce dossier est terminé.",
      headline: "Litige fermé",
      paragraph: "Le traitement de ce dossier de litige est maintenant terminé.",
    },
  };
  const copy = labels[input.status];

  return renderKlyxEmail({
    subject: copy.subject,
    preheader: copy.preheader,
    headline: copy.headline,
    paragraphs: [
      copy.paragraph,
      "Consultez KLYX pour retrouver le statut actuel et l’historique du dossier.",
    ],
    ctaLabel: "Voir la réservation",
    ctaUrl: klyxEmailUrl(`/bookings/${encodeURIComponent(input.bookingId)}`),
    note: note || undefined,
  });
}

export function serviceProposalLifecycleEmail(input: {
  proposalName: string;
  status: ServiceProposalLifecycleStatus;
  note?: string | null;
}): KlyxEmailContent {
  const proposalName = input.proposalName.trim() || "Métier proposé";
  const note = input.note?.trim();

  if (input.status === "approved") {
    return renderKlyxEmail({
      subject: "Votre métier proposé sur KLYX a été approuvé",
      preheader: "Le métier peut maintenant rejoindre le catalogue KLYX.",
      headline: "Métier approuvé",
      paragraphs: [
        `Votre proposition « ${proposalName} » a été approuvée.`,
        "Retrouvez vos services dans votre espace prestataire pour poursuivre leur configuration.",
      ],
      ctaLabel: "Voir mes services",
      ctaUrl: klyxEmailUrl("/provider/services"),
      note: note || undefined,
    });
  }

  if (input.status === "rejected") {
    return renderKlyxEmail({
      subject: "Votre métier proposé sur KLYX n’a pas été retenu",
      preheader: "Une décision est disponible pour votre proposition.",
      headline: "Proposition non retenue",
      paragraphs: [
        `Votre proposition « ${proposalName} » n’a pas été retenue pour le catalogue KLYX.`,
        "Vous pouvez continuer à gérer les autres services disponibles depuis votre espace prestataire.",
      ],
      ctaLabel: "Voir mes services",
      ctaUrl: klyxEmailUrl("/provider/services"),
      note: note || undefined,
    });
  }

  return renderKlyxEmail({
    subject: "Votre proposition de métier KLYX a bien été reçue",
    preheader: "La proposition attend maintenant une décision.",
    headline: "Proposition reçue",
    paragraphs: [
      `Votre proposition « ${proposalName} » a bien été enregistrée.`,
      "Elle reste masquée tant qu’elle n’a pas été approuvée.",
    ],
    ctaLabel: "Voir mes services",
    ctaUrl: klyxEmailUrl("/provider/services"),
    note: note || undefined,
  });
}
