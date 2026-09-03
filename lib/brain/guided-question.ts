export const KLYX_CONFIRMATION_BOUNDARY =
  "Vérifie le résumé puis confirme avant toute publication, réservation ou paiement.";

const GUIDED_QUESTIONS: Record<string, string> = {
  service:
    "De quel service as-tu besoin ? Décris simplement le travail à faire, même si tu ne connais pas le nom exact du métier.",
  ville:
    "Dans quelle ville ou commune la prestation doit-elle avoir lieu ?",
  date:
    "Quel jour souhaites-tu la prestation ? Tu peux répondre naturellement : demain, samedi, lundi prochain ou avec une date.",
  heure:
    "À quel moment souhaites-tu la prestation ? Par exemple : 10h30, midi, le matin, l’après-midi ou le soir.",
};

export function getKlyxGuidedQuestion(
  missingField: string | null | undefined
): string | null {
  if (!missingField) return null;
  return GUIDED_QUESTIONS[missingField] ?? "Peux-tu préciser ta demande ?";
}
