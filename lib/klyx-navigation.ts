export type KlyxNavRole =
  | "all"
  | "client"
  | "provider"
  | "admin";

export type KlyxNavItem = {
  title: string;
  href: string;
  role: KlyxNavRole;
  group: string;
  keywords: string[];
};

export const KLYX_NAV_ITEMS: KlyxNavItem[] = [
  {
    title: "Vue d’ensemble",
    href: "/dashboard",
    role: "all",
    group: "Principal",
    keywords: ["accueil", "dashboard", "tableau de bord"],
  },
  {
    title: "Assistant KLYX",
    href: "/brain",
    role: "client",
    group: "IA",
    keywords: ["assistant", "ia", "brain", "aide"],
  },
  {
    title: "KLYX Agent",
    href: "/agent",
    role: "client",
    group: "IA",
    keywords: ["agent", "automatique", "ia"],
  },
  {
    title: "Ma mémoire KLYX",
    href: "/memory",
    role: "client",
    group: "IA",
    keywords: ["memoire", "préférences", "preferences"],
  },
  {
    title: "Trouver un service",
    href: "/search",
    role: "client",
    group: "Services",
    keywords: ["recherche", "prestataire", "service", "trouver"],
  },
  {
    title: "Couverture locale",
    href: "/coverage",
    role: "client",
    group: "Services",
    keywords: ["zone", "couverture", "ville", "local"],
  },
  {
    title: "Recherche par photo",
    href: "/request/photo",
    role: "client",
    group: "Services",
    keywords: ["photo", "image", "recherche"],
  },
  {
    title: "Mes réservations",
    href: "/bookings",
    role: "client",
    group: "Réservations",
    keywords: ["reservation", "réservation", "mission", "payer", "annuler"],
  },
  {
    title: "Mes devis",
    href: "/quotes",
    role: "client",
    group: "Réservations",
    keywords: ["devis", "prix", "offre"],
  },
  {
    title: "Messages",
    href: "/messages",
    role: "client",
    group: "Communication",
    keywords: ["message", "chat", "conversation"],
  },
  {
    title: "Favoris",
    href: "/favorites",
    role: "client",
    group: "Compte",
    keywords: ["favori", "prestataire"],
  },
  {
    title: "Notifications",
    href: "/notifications",
    role: "all",
    group: "Compte",
    keywords: ["notification", "alerte"],
  },
  {
    title: "Centre de confiance",
    href: "/trust",
    role: "client",
    group: "Confiance",
    keywords: ["confiance", "sécurité", "securite", "litige"],
  },
  {
    title: "Mon profil",
    href: "/profile",
    role: "all",
    group: "Compte",
    keywords: ["profil", "compte"],
  },
  {
    title: "Paramètres",
    href: "/settings",
    role: "all",
    group: "Compte",
    keywords: ["parametre", "paramètre", "langue", "theme", "thème"],
  },
  {
    title: "Mon activité",
    href: "/provider",
    role: "provider",
    group: "Prestataire",
    keywords: ["activité", "activite", "studio", "prestataire"],
  },
  {
    title: "Assistant professionnel",
    href: "/provider/assistant",
    role: "provider",
    group: "Prestataire",
    keywords: ["assistant", "professionnel", "ia"],
  },
  {
    title: "Réservations & missions",
    href: "/bookings",
    role: "provider",
    group: "Prestataire",
    keywords: ["reservation", "mission", "accepter", "refuser"],
  },
  {
    title: "Demandes de devis",
    href: "/provider/quotes",
    role: "provider",
    group: "Prestataire",
    keywords: ["devis", "demande", "prix"],
  },
  {
    title: "Planning intelligent",
    href: "/provider/planning",
    role: "provider",
    group: "Prestataire",
    keywords: ["planning", "horaire", "disponibilité", "disponibilite"],
  },
  {
    title: "Zones d'intervention",
    href: "/provider/zones",
    role: "provider",
    group: "Prestataire",
    keywords: ["zone", "ville", "rayon", "intervention"],
  },
  {
    title: "Ajouter un métier",
    href: "/provider/services/new",
    role: "provider",
    group: "Prestataire",
    keywords: ["métier", "metier", "service", "ajouter"],
  },
  {
    title: "Mes compétences",
    href: "/provider/skills",
    role: "provider",
    group: "Confiance",
    keywords: [
      "competence",
      "compétence",
      "diplome",
      "diplôme",
      "formation",
      "preuve",
      "certificat",
    ],
  },
  {
    title: "Paiements",
    href: "/provider/payments",
    role: "provider",
    group: "Finance",
    keywords: ["paiement", "stripe", "argent", "commission"],
  },
  {
    title: "Vérification prestataire",
    href: "/provider/verification",
    role: "provider",
    group: "Confiance",
    keywords: ["verification", "vérification", "identite", "identité", "document"],
  },
  {
    title: "Score et avis",
    href: "/scores",
    role: "provider",
    group: "Confiance",
    keywords: ["score", "avis", "note"],
  },
  {
    title: "Confiance professionnelle",
    href: "/provider/trust",
    role: "provider",
    group: "Confiance",
    keywords: ["confiance", "litige", "sécurité", "securite"],
  },
  {
    title: "Centre Admin KLYX",
    href: "/admin",
    role: "admin",
    group: "Administration",
    keywords: ["admin", "administration", "supervision", "controle", "contrôle"],
  },
  {
    title: "Compétences prestataires",
    href: "/admin/skills",
    role: "admin",
    group: "Administration",
    keywords: ["competence", "compétence", "diplome", "diplôme", "preuve", "sumsub"],
  },
  {
    title: "Vérifications prestataires",
    href: "/admin/verifications",
    role: "admin",
    group: "Administration",
    keywords: ["verification", "identite", "document", "kyc"],
  },
  {
    title: "Litiges",
    href: "/admin/disputes",
    role: "admin",
    group: "Administration",
    keywords: ["litige", "dispute", "incident"],
  },
  {
    title: "Services KLYX",
    href: "/admin/services",
    role: "admin",
    group: "Administration",
    keywords: ["service", "catalogue", "metier", "métier"],
  },
  {
    title: "Audit financier",
    href: "/admin/finance",
    role: "admin",
    group: "Administration",
    keywords: ["finance", "audit", "stripe", "paiement", "argent"],
  },
];

export function normalizeKlyxSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function searchKlyxNavigation(
  query: string,
  accountType: "client" | "provider" | null,
  isAdmin: boolean
): KlyxNavItem[] {
  const normalized = normalizeKlyxSearch(query);

  if (!normalized) return [];

  return KLYX_NAV_ITEMS.filter((item) => {
    const roleAllowed =
      item.role === "all" ||
      item.role === accountType ||
      (item.role === "admin" && isAdmin);

    if (!roleAllowed) return false;

    const haystack = normalizeKlyxSearch(
      [
        item.title,
        item.group,
        item.href,
        ...item.keywords,
      ].join(" ")
    );

    return normalized
      .split(/\s+/)
      .every((word) => haystack.includes(word));
  }).slice(0, 10);
}
