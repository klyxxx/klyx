export type KlyxServiceCategory = {
  slug: string;
  name: string;
  description: string;
  services: readonly string[];
};

/**
 * KLYX_UNIVERSAL_SERVICE_CATALOG_14_14
 *
 * Catalogue fonctionnel de départ.
 *
 * Principe :
 * - KLYX n'est pas limité à quelques métiers.
 * - Les catégories sont extensibles.
 * - Un service personnalisé pourra être ajouté lorsqu'un métier
 *   n'existe pas encore dans le catalogue.
 * - Les métiers réglementés devront plus tard utiliser les contrôles
 *   de documents, licences et vérifications adaptés au pays.
 */
export const KLYX_SERVICE_CATALOG = [
  {
    slug: "menage-entretien",
    name: "Ménage & entretien",
    description:
      "Entretien courant, nettoyage spécialisé et services domestiques.",
    services: [
      "Ménage à domicile",
      "Nettoyage de bureaux",
      "Nettoyage commercial",
      "Nettoyage industriel",
      "Nettoyage après travaux",
      "Nettoyage après déménagement",
      "Nettoyage avant état des lieux",
      "Nettoyage de vitres",
      "Nettoyage de tapis",
      "Nettoyage de moquettes",
      "Nettoyage de canapé",
      "Nettoyage de matelas",
      "Nettoyage haute pression",
      "Nettoyage de façade",
      "Nettoyage de toiture",
      "Nettoyage de gouttières",
      "Désinfection",
      "Débarras",
      "Vide-maison",
      "Repassage",
      "Blanchisserie",
      "Pressing à domicile",
      "Aide ménagère",
      "Conciergerie",
    ],
  },

  {
    slug: "bricolage-reparation",
    name: "Bricolage & réparation",
    description:
      "Petits travaux, installations et réparations du quotidien.",
    services: [
      "Bricolage général",
      "Montage de meubles",
      "Pose d'étagères",
      "Fixation TV murale",
      "Installation de luminaires",
      "Pose de tringles",
      "Pose de rideaux",
      "Pose de stores",
      "Réparation de meubles",
      "Réparation de portes",
      "Réparation de fenêtres",
      "Réparation de volets",
      "Réparation de serrures",
      "Pose de serrure",
      "Petite plomberie",
      "Petite électricité",
      "Pose de joints",
      "Silicone et étanchéité",
      "Installation d'électroménager",
      "Réparation d'électroménager",
    ],
  },

  {
    slug: "construction-renovation",
    name: "Construction & rénovation",
    description:
      "Travaux de rénovation, second œuvre et construction.",
    services: [
      "Maçonnerie",
      "Rénovation générale",
      "Entreprise générale du bâtiment",
      "Peinture intérieure",
      "Peinture extérieure",
      "Plâtrerie",
      "Enduit",
      "Pose de cloisons",
      "Plaquiste",
      "Isolation",
      "Isolation thermique",
      "Isolation acoustique",
      "Carrelage",
      "Faïence",
      "Pose de parquet",
      "Pose de sol stratifié",
      "Pose de vinyle",
      "Pose de moquette",
      "Chape",
      "Menuiserie",
      "Ébénisterie",
      "Charpente",
      "Couverture",
      "Toiture",
      "Étanchéité toiture",
      "Façade",
      "Ravalement de façade",
      "Terrassement",
      "Démolition",
      "Ferronnerie",
      "Soudure",
      "Vitrier",
      "Pose de fenêtres",
      "Pose de portes",
      "Cuisine équipée",
      "Installation de salle de bain",
    ],
  },

  {
    slug: "plomberie-chauffage-climatisation",
    name: "Plomberie, chauffage & climatisation",
    description:
      "Installations sanitaires, chauffage, ventilation et dépannage.",
    services: [
      "Plombier",
      "Débouchage",
      "Recherche de fuite",
      "Réparation de fuite",
      "Installation sanitaire",
      "Installation de WC",
      "Installation de douche",
      "Installation de baignoire",
      "Installation de robinetterie",
      "Chauffagiste",
      "Entretien chaudière",
      "Installation chaudière",
      "Réparation chaudière",
      "Installation radiateur",
      "Entretien radiateur",
      "Pompe à chaleur",
      "Climatisation",
      "Installation climatisation",
      "Entretien climatisation",
      "Ventilation",
      "VMC",
    ],
  },

  {
    slug: "electricite-energie",
    name: "Électricité & énergie",
    description:
      "Installations électriques, énergie et équipements connectés.",
    services: [
      "Électricien",
      "Dépannage électrique",
      "Mise aux normes électriques",
      "Tableau électrique",
      "Prises et interrupteurs",
      "Éclairage",
      "Domotique",
      "Maison connectée",
      "Installation borne de recharge",
      "Installation photovoltaïque",
      "Entretien panneaux solaires",
      "Batterie domestique",
      "Audit énergétique",
    ],
  },

  {
    slug: "demenagement-transport",
    name: "Déménagement & transport",
    description:
      "Transport de biens, déménagement et manutention.",
    services: [
      "Déménagement",
      "Petit déménagement",
      "Déménagement international",
      "Déménagement d'entreprise",
      "Aide au déménagement",
      "Manutention",
      "Portage de meubles",
      "Monte-meubles",
      "Emballage de cartons",
      "Déballage de cartons",
      "Location avec chauffeur",
      "Transport de meubles",
      "Transport de colis",
      "Livraison locale",
      "Coursier",
      "Coursier à vélo",
      "Transport express",
      "Transport de marchandises",
    ],
  },

  {
    slug: "jardin-exterieur",
    name: "Jardin & extérieur",
    description:
      "Entretien des espaces verts et aménagement extérieur.",
    services: [
      "Jardinier",
      "Entretien de jardin",
      "Tonte de pelouse",
      "Taille de haies",
      "Élagage",
      "Abattage d'arbre",
      "Débroussaillage",
      "Ramassage de feuilles",
      "Plantation",
      "Potager",
      "Paysagiste",
      "Aménagement de jardin",
      "Arrosage automatique",
      "Pose de clôture",
      "Pose de portail",
      "Terrasse",
      "Pavage",
      "Piscine",
      "Entretien piscine",
      "Nettoyage extérieur",
      "Déneigement",
    ],
  },

  {
    slug: "automobile-mobilite",
    name: "Automobile & mobilité",
    description:
      "Entretien, réparation et assistance pour véhicules.",
    services: [
      "Mécanicien automobile",
      "Mécanicien moto",
      "Entretien automobile",
      "Vidange",
      "Freins",
      "Pneus",
      "Montage de pneus",
      "Batterie automobile",
      "Diagnostic automobile",
      "Électricité automobile",
      "Carrosserie",
      "Débosselage",
      "Peinture automobile",
      "Nettoyage automobile",
      "Detailing automobile",
      "Lavage automobile",
      "Dépannage automobile",
      "Remorquage",
      "Réparation vélo",
      "Entretien vélo",
      "Réparation trottinette",
    ],
  },

  {
    slug: "enfants-famille",
    name: "Enfants & famille",
    description:
      "Garde, accompagnement et aide familiale.",
    services: [
      "Baby-sitting",
      "Garde d'enfants",
      "Nounou",
      "Garde après l'école",
      "Accompagnement scolaire",
      "Sortie d'école",
      "Garde de nuit",
      "Garde d'enfants événementielle",
      "Animation enfants",
      "Aide aux devoirs",
      "Soutien parental",
      "Accompagnement familial",
    ],
  },

  {
    slug: "aide-a-la-personne",
    name: "Aide à la personne",
    description:
      "Accompagnement non médical et assistance quotidienne.",
    services: [
      "Aide à domicile",
      "Compagnie pour personne âgée",
      "Courses à domicile",
      "Préparation de repas à domicile",
      "Accompagnement aux rendez-vous",
      "Aide administrative à domicile",
      "Assistance quotidienne",
      "Garde de nuit à domicile",
      "Aide à la mobilité",
      "Lecture et compagnie",
    ],
  },

  {
    slug: "animaux",
    name: "Animaux",
    description:
      "Garde, promenade, entretien et accompagnement des animaux.",
    services: [
      "Garde de chien",
      "Garde de chat",
      "Pet-sitting",
      "Promenade de chien",
      "Visite d'animaux à domicile",
      "Pension pour animaux",
      "Toilettage chien",
      "Toilettage chat",
      "Éducation canine",
      "Comportementaliste animalier",
      "Transport d'animaux",
      "Aquariophilie",
      "Entretien aquarium",
    ],
  },

  {
    slug: "beaute-coiffure",
    name: "Beauté & coiffure",
    description:
      "Prestations beauté, esthétique et soins personnels.",
    services: [
      "Coiffeur",
      "Coiffeur à domicile",
      "Barbier",
      "Tresses",
      "Locks",
      "Extensions capillaires",
      "Maquillage",
      "Maquillage événementiel",
      "Esthéticienne",
      "Manucure",
      "Pédicure esthétique",
      "Prothésiste ongulaire",
      "Pose de faux cils",
      "Extension de cils",
      "Sourcils",
      "Épilation",
      "Soins du visage",
      "Massage bien-être",
    ],
  },

  {
    slug: "bien-etre-sport",
    name: "Bien-être & sport",
    description:
      "Coaching sportif, relaxation et accompagnement bien-être.",
    services: [
      "Coach sportif",
      "Personal trainer",
      "Coach fitness",
      "Coach running",
      "Coach musculation",
      "Coach football",
      "Coach basketball",
      "Coach tennis",
      "Coach natation",
      "Professeur de yoga",
      "Professeur de pilates",
      "Professeur de danse",
      "Préparation physique",
      "Stretching",
      "Méditation",
      "Relaxation",
      "Massage sportif",
    ],
  },

  {
    slug: "cours-education",
    name: "Cours & éducation",
    description:
      "Cours particuliers, soutien scolaire et apprentissage.",
    services: [
      "Cours particuliers",
      "Soutien scolaire",
      "Aide aux devoirs",
      "Cours de mathématiques",
      "Cours de français",
      "Cours de néerlandais",
      "Cours d'anglais",
      "Cours d'espagnol",
      "Cours d'allemand",
      "Cours de sciences",
      "Cours de physique",
      "Cours de chimie",
      "Cours d'informatique",
      "Cours de programmation",
      "Cours de musique",
      "Cours de piano",
      "Cours de guitare",
      "Cours de chant",
      "Cours de dessin",
      "Préparation aux examens",
      "Alphabétisation",
      "Formation professionnelle",
    ],
  },

  {
    slug: "informatique-tech",
    name: "Informatique & technologie",
    description:
      "Assistance informatique, développement et technologies numériques.",
    services: [
      "Dépannage informatique",
      "Réparation ordinateur",
      "Réparation PC",
      "Réparation Mac",
      "Installation ordinateur",
      "Configuration Wi-Fi",
      "Installation réseau",
      "Cybersécurité",
      "Sauvegarde de données",
      "Récupération de données",
      "Support informatique",
      "Administration système",
      "Développeur web",
      "Développeur mobile",
      "Développeur logiciel",
      "Développeur frontend",
      "Développeur backend",
      "Développeur full-stack",
      "DevOps",
      "Cloud",
      "Intégration API",
      "Automatisation",
      "Intelligence artificielle",
      "Data analyst",
      "Data engineer",
      "UX designer",
      "UI designer",
      "Création de site internet",
      "Création de boutique en ligne",
      "WordPress",
      "Shopify",
    ],
  },

  {
    slug: "photo-video-audio",
    name: "Photo, vidéo & audio",
    description:
      "Création audiovisuelle, production et post-production.",
    services: [
      "Photographe",
      "Photographe mariage",
      "Photographe événementiel",
      "Photographe portrait",
      "Photographe immobilier",
      "Vidéaste",
      "Vidéaste mariage",
      "Vidéaste événementiel",
      "Montage vidéo",
      "Retouche photo",
      "Drone",
      "Motion design",
      "Animation 2D",
      "Animation 3D",
      "Ingénieur du son",
      "Mixage audio",
      "Mastering audio",
      "Podcast",
      "Voix off",
      "Studio d'enregistrement",
    ],
  },

  {
    slug: "design-creation",
    name: "Design & création",
    description:
      "Graphisme, création artistique et communication visuelle.",
    services: [
      "Graphiste",
      "Designer graphique",
      "Logo",
      "Identité visuelle",
      "Illustration",
      "Dessin",
      "Design produit",
      "Design packaging",
      "Infographie",
      "Présentation professionnelle",
      "Mise en page",
      "Création de flyers",
      "Création d'affiches",
      "Création de cartes de visite",
      "Architecture intérieure",
      "Décoration intérieure",
      "Home staging",
    ],
  },

  {
    slug: "marketing-communication",
    name: "Marketing & communication",
    description:
      "Communication, acquisition, contenu et présence numérique.",
    services: [
      "Community manager",
      "Social media manager",
      "Création de contenu",
      "Copywriting",
      "Rédaction web",
      "SEO",
      "SEA",
      "Publicité en ligne",
      "Email marketing",
      "Marketing digital",
      "Stratégie marketing",
      "Relations publiques",
      "Communication",
      "Influence marketing",
      "Gestion de réputation",
      "Branding",
    ],
  },

  {
    slug: "administratif-business",
    name: "Administratif & business",
    description:
      "Assistance administrative et services aux indépendants et entreprises.",
    services: [
      "Assistant administratif",
      "Assistant virtuel",
      "Secrétariat",
      "Saisie de données",
      "Classement de documents",
      "Aide aux démarches administratives",
      "Création de CV",
      "Lettre de motivation",
      "Traduction",
      "Interprétariat",
      "Transcription",
      "Relecture",
      "Correction de texte",
      "Gestion de projet",
      "Business plan",
      "Conseil en entreprise",
      "Conseil commercial",
      "Prospection commerciale",
      "Téléprospection",
      "Service client",
      "Recrutement",
      "Ressources humaines",
    ],
  },

  {
    slug: "comptabilite-finance",
    name: "Comptabilité & finance",
    description:
      "Prestations administratives financières et comptables.",
    services: [
      "Comptable",
      "Aide comptable",
      "Tenue de livres",
      "Facturation",
      "Gestion administrative financière",
      "Préparation de documents comptables",
      "Conseil budgétaire",
    ],
  },

  {
    slug: "evenementiel",
    name: "Événementiel",
    description:
      "Organisation, animation et logistique événementielle.",
    services: [
      "Organisateur d'événement",
      "Wedding planner",
      "Coordinateur de mariage",
      "Décorateur événementiel",
      "DJ",
      "Animateur",
      "Maître de cérémonie",
      "Musicien",
      "Chanteur",
      "Groupe de musique",
      "Serveur événementiel",
      "Hôtesse événementielle",
      "Barman événementiel",
      "Location de matériel événementiel",
      "Sonorisation",
      "Éclairage événementiel",
      "Photobooth",
      "Sécurité événementielle",
    ],
  },

  {
    slug: "restauration-cuisine",
    name: "Cuisine & restauration",
    description:
      "Cuisine à domicile, traiteur et personnel de restauration.",
    services: [
      "Chef à domicile",
      "Cuisinier à domicile",
      "Traiteur",
      "Pâtissier",
      "Cake designer",
      "Boulanger",
      "Serveur",
      "Barman",
      "Barista",
      "Aide-cuisinier",
      "Préparation de repas",
      "Meal prep",
      "Buffet événementiel",
      "Barbecue à domicile",
    ],
  },

  {
    slug: "mode-textile",
    name: "Mode & textile",
    description:
      "Confection, réparation et personnalisation textile.",
    services: [
      "Couturier",
      "Couturière",
      "Retouches vêtements",
      "Créateur de vêtements",
      "Styliste",
      "Costumier",
      "Broderie",
      "Impression textile",
      "Réparation de chaussures",
      "Cordonnier",
      "Personal shopper",
      "Conseil en image",
    ],
  },

  {
    slug: "logistique-stockage",
    name: "Logistique & stockage",
    description:
      "Préparation, stockage, manutention et logistique.",
    services: [
      "Manutentionnaire",
      "Préparateur de commandes",
      "Emballeur",
      "Inventaire",
      "Gestion de stock",
      "Magasinier",
      "Cariste",
      "Aide logistique",
      "Installation de mobilier professionnel",
      "Montage de stand",
    ],
  },

  {
    slug: "securite-surveillance",
    name: "Sécurité & surveillance",
    description:
      "Prestations de surveillance et sécurité selon autorisations locales.",
    services: [
      "Agent de sécurité",
      "Gardiennage",
      "Surveillance de site",
      "Veilleur de nuit",
      "Sécurité événementielle",
      "Contrôle d'accès",
      "Installation caméra de surveillance",
      "Installation alarme",
      "Sécurité incendie",
    ],
  },

  {
    slug: "immobilier",
    name: "Immobilier",
    description:
      "Services pratiques autour des logements et biens immobiliers.",
    services: [
      "État des lieux",
      "Photographie immobilière",
      "Home staging",
      "Gestion locative",
      "Conciergerie locative",
      "Remise de clés",
      "Visite de logement",
      "Entretien logement Airbnb",
      "Nettoyage location courte durée",
      "Maintenance locative",
    ],
  },

  {
    slug: "tourisme-hospitalite",
    name: "Tourisme & hospitalité",
    description:
      "Accueil, accompagnement et services aux voyageurs.",
    services: [
      "Guide local",
      "Guide touristique",
      "Accompagnateur touristique",
      "Conciergerie voyage",
      "Accueil voyageurs",
      "Check-in location",
      "Check-out location",
      "Bagagerie",
      "Organisation d'excursion",
    ],
  },

  {
    slug: "agriculture-nature",
    name: "Agriculture & nature",
    description:
      "Travaux agricoles, entretien et services liés aux espaces naturels.",
    services: [
      "Ouvrier agricole",
      "Aide agricole",
      "Maraîchage",
      "Entretien de terrain",
      "Plantation",
      "Récolte",
      "Entretien de verger",
      "Entretien forestier",
      "Bûcheronnage",
      "Apiculture",
    ],
  },

  {
    slug: "services-professionnels",
    name: "Services professionnels",
    description:
      "Expertises spécialisées proposées par professionnels qualifiés.",
    services: [
      "Consultant",
      "Coach professionnel",
      "Coach carrière",
      "Formateur",
      "Interprète",
      "Traducteur",
      "Médiateur",
      "Architecte",
      "Architecte d'intérieur",
      "Géomètre",
      "Expert technique",
      "Auditeur",
    ],
  },

  {
    slug: "autres-services",
    name: "Autres services",
    description:
      "Pour tous les métiers et prestations qui ne figurent pas encore dans le catalogue.",
    services: [
      "Autre service à domicile",
      "Autre service professionnel",
      "Autre service technique",
      "Autre service créatif",
      "Autre service événementiel",
      "Autre service de transport",
      "Autre métier ou prestation",
    ],
  },
] as const satisfies readonly KlyxServiceCategory[];

export type KlyxCatalogCategorySlug =
  (typeof KLYX_SERVICE_CATALOG)[number]["slug"];

export const KLYX_ALL_SERVICE_NAMES = KLYX_SERVICE_CATALOG.flatMap(
  (category) => [...category.services]
);

export const KLYX_TOTAL_CATEGORIES =
  KLYX_SERVICE_CATALOG.length;

export const KLYX_TOTAL_SERVICES =
  KLYX_ALL_SERVICE_NAMES.length;

export function getKlyxCategory(
  slug: string
): KlyxServiceCategory | null {
  return (
    KLYX_SERVICE_CATALOG.find(
      (category) => category.slug === slug
    ) ?? null
  );
}

export function searchKlyxServices(
  query: string
): Array<{
  categorySlug: string;
  categoryName: string;
  serviceName: string;
}> {
  const normalizedQuery = query
    .trim()
    .toLocaleLowerCase("fr");

  if (!normalizedQuery) {
    return [];
  }

  return KLYX_SERVICE_CATALOG.flatMap((category) =>
    category.services
      .filter((serviceName) =>
        serviceName
          .toLocaleLowerCase("fr")
          .includes(normalizedQuery)
      )
      .map((serviceName) => ({
        categorySlug: category.slug,
        categoryName: category.name,
        serviceName,
      }))
  );
}

/**
 * Toujours conserver cette option.
 * Elle garantit qu'un prestataire n'est jamais exclu
 * simplement parce que son métier n'est pas encore catalogué.
 */
export const KLYX_CUSTOM_SERVICE_FALLBACK = {
  categorySlug: "autres-services",
  serviceName: "Autre métier ou prestation",
} as const;

// KLYX_ANY_PROFESSION_ALLOWED_14_14
export const KLYX_ANY_PROFESSION_ALLOWED = true;