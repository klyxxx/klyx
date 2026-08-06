export type RiskLevel =
  | "low"
  | "moderate"
  | "high"
  | "critical";

export type RiskSignal = {
  code: string;
  label: string;
  points: number;
  detail: string;
};

export type RiskRecommendation = {
  code: string;
  label: string;
  detail: string;
};

export type RiskAssessment = {
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
  recommendations: RiskRecommendation[];
};

export type RiskMetrics = {
  totalBookings: number;
  cancelledBookings: number;
  rejectedBookings: number;
  paidBookings: number;
  failedPayments: number;
  openedDisputes: number;
  receivedDisputes: number;
  urgentSafetyReports: number;
  completedBookings: number;
  isProvider: boolean;
  identityComplete: boolean;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function levelFor(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

export function calculateRisk(
  metrics: RiskMetrics
): RiskAssessment {
  const signals: RiskSignal[] = [];
  const recommendations: RiskRecommendation[] = [];

  const cancellationRate =
    metrics.totalBookings > 0
      ? metrics.cancelledBookings / metrics.totalBookings
      : 0;

  if (
    metrics.totalBookings >= 3 &&
    cancellationRate >= 0.5
  ) {
    signals.push({
      code: "repeated_cancellations",
      label: "Annulations répétées",
      points: cancellationRate >= 0.75 ? 30 : 18,
      detail:
        `${metrics.cancelledBookings} réservation(s) annulée(s) sur ` +
        `${metrics.totalBookings}.`,
    });

    recommendations.push({
      code: "reduce_cancellations",
      label: "Réduire les annulations",
      detail:
        "Vérifie les horaires et disponibilités avant chaque confirmation.",
    });
  }

  if (metrics.openedDisputes >= 2) {
    signals.push({
      code: "multiple_opened_disputes",
      label: "Plusieurs litiges ouverts",
      points: Math.min(25, metrics.openedDisputes * 6),
      detail:
        `${metrics.openedDisputes} dossier(s) ouvert(s) par ce profil.`,
    });
  }

  if (metrics.receivedDisputes >= 2) {
    signals.push({
      code: "multiple_received_disputes",
      label: "Plusieurs signalements reçus",
      points: Math.min(30, metrics.receivedDisputes * 8),
      detail:
        `${metrics.receivedDisputes} signalement(s) reçu(s).`,
    });

    recommendations.push({
      code: "review_disputes",
      label: "Consulter les dossiers",
      detail:
        "Réponds aux signalements et ajoute des explications précises.",
    });
  }

  if (metrics.failedPayments >= 2) {
    signals.push({
      code: "payment_failures",
      label: "Paiements échoués",
      points: Math.min(20, metrics.failedPayments * 5),
      detail:
        `${metrics.failedPayments} échec(s) de paiement enregistré(s).`,
    });

    recommendations.push({
      code: "verify_payment_method",
      label: "Vérifier le moyen de paiement",
      detail:
        "Utilise un moyen de paiement valide avant une nouvelle réservation.",
    });
  }

  if (metrics.urgentSafetyReports > 0) {
    signals.push({
      code: "safety_report",
      label: "Signalement de sécurité",
      points: Math.min(
        55,
        metrics.urgentSafetyReports * 35
      ),
      detail:
        `${metrics.urgentSafetyReports} signalement(s) de sécurité prioritaire(s).`,
    });

    recommendations.push({
      code: "safety_review",
      label: "Dossier prioritaire",
      detail:
        "Le dossier doit être examiné avant toute décision importante.",
    });
  }

  if (
    metrics.isProvider &&
    !metrics.identityComplete
  ) {
    signals.push({
      code: "identity_incomplete",
      label: "Vérification incomplète",
      points: 15,
      detail:
        "Le profil prestataire n’a pas encore terminé sa vérification.",
    });

    recommendations.push({
      code: "complete_identity",
      label: "Terminer la vérification",
      detail:
        "Complète Stripe et les informations professionnelles.",
    });
  }

  if (
    metrics.completedBookings >= 5 &&
    metrics.receivedDisputes === 0 &&
    cancellationRate < 0.2
  ) {
    signals.push({
      code: "positive_history",
      label: "Historique fiable",
      points: -15,
      detail:
        `${metrics.completedBookings} missions terminées sans litige reçu.`,
    });
  }

  const score = clamp(
    signals.reduce(
      (total, signal) => total + signal.points,
      0
    )
  );

  if (recommendations.length === 0) {
    recommendations.push({
      code: "keep_good_practices",
      label: "Continuer les bonnes pratiques",
      detail:
        "Respecte les horaires, utilise la messagerie KLYX et confirme chaque étape.",
    });
  }

  return {
    score,
    level: levelFor(score),
    signals,
    recommendations,
  };
}
