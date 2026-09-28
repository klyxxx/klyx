function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9€$£\s'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

export function getDeterministicKlyxReply(message: string): string | null {
  const value = normalized(message);
  if (!value) return "Dis-moi simplement ce que tu veux organiser.";

  if (
    value.length <= 48 &&
    hasAny(value, ["bonjour", "salut", "bonsoir", "hello", "hey"])
  ) {
    return "Bonjour. Dis-moi simplement ce que tu veux organiser et KLYX te guide jusqu’à la prochaine action utile.";
  }

  if (
    hasAny(value, [
      "que peux tu faire",
      "que peut faire klyx",
      "a quoi sert klyx",
      "comment fonctionne klyx",
      "capacites de klyx",
    ])
  ) {
    return "KLYX peut comprendre un besoin, chercher et comparer des prestataires, préparer un devis, organiser une réservation et suivre la mission. Les paiements, vérifications et autres actions sensibles restent contrôlés par les moteurs KLYX, jamais par l’IA seule.";
  }

  if (
    hasAny(value, [
      "comment demander un service",
      "comment reserver un service",
      "je veux demander un service",
    ])
  ) {
    return "Indique le service, la ville et le moment souhaité. KLYX pourra ensuite rechercher les options disponibles et te demander confirmation avant toute réservation ou paiement.";
  }

  if (hasAny(value, ["prix", "combien", "budget", "tarif", "cout"])) {
    return "Je peux t’aider à cadrer le budget. Indique d’abord le service, la ville et le moment souhaité. Un prix réel ne sera annoncé que depuis les données KLYX ou un devis confirmé.";
  }

  if (
    hasAny(value, [
      "est ce que l ia paie",
      "ia peut payer",
      "ia peut rembourser",
      "llm source de verite",
      "llm source de vérité",
    ])
  ) {
    return "Non. L’IA KLYX peut comprendre et proposer, mais elle n’est jamais l’autorité de paiement, remboursement, éligibilité ou settlement. Ces mutations restent déterministes et côté serveur.";
  }

  return null;
}
