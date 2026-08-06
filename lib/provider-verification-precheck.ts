export type VerificationDocumentInput = {
  id: string;
  document_type: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
};

export type VerificationPrecheck = {
  passed: boolean;
  score: number;
  checks: {
    code: string;
    label: string;
    passed: boolean;
    detail: string;
  }[];
  recommendations: string[];
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function runVerificationPrecheck(
  documents: VerificationDocumentInput[]
): VerificationPrecheck {
  const identity = documents.filter(
    (document) => document.document_type === "identity"
  );
  const address = documents.filter(
    (document) => document.document_type === "address"
  );

  const validFormats = documents.every((document) =>
    ALLOWED_MIME_TYPES.has(document.mime_type)
  );

  const validSizes = documents.every(
    (document) =>
      document.size_bytes > 0 &&
      document.size_bytes <= 10 * 1024 * 1024
  );

  const normalizedNames = documents.map((document) =>
    document.original_name.trim().toLowerCase()
  );
  const duplicateNames =
    new Set(normalizedNames).size !== normalizedNames.length;

  const checks = [
    {
      code: "identity_present",
      label: "Pièce d’identité présente",
      passed: identity.length > 0,
      detail:
        identity.length > 0
          ? `${identity.length} document(s) trouvé(s).`
          : "Aucune pièce d’identité.",
    },
    {
      code: "address_present",
      label: "Justificatif d’adresse présent",
      passed: address.length > 0,
      detail:
        address.length > 0
          ? `${address.length} document(s) trouvé(s).`
          : "Aucun justificatif d’adresse.",
    },
    {
      code: "formats_allowed",
      label: "Formats autorisés",
      passed: validFormats,
      detail: validFormats
        ? "Tous les fichiers utilisent un format autorisé."
        : "Au moins un fichier utilise un format interdit.",
    },
    {
      code: "sizes_allowed",
      label: "Tailles autorisées",
      passed: validSizes,
      detail: validSizes
        ? "Tous les fichiers respectent la limite de 10 Mo."
        : "Au moins un fichier dépasse la limite.",
    },
    {
      code: "no_name_duplicates",
      label: "Pas de doublon évident",
      passed: !duplicateNames,
      detail: duplicateNames
        ? "Des noms de fichiers identiques ont été détectés."
        : "Aucun doublon évident par nom de fichier.",
    },
  ];

  const score = Math.round(
    (checks.filter((check) => check.passed).length /
      checks.length) *
      100
  );

  const recommendations: string[] = [];

  if (identity.length === 0) {
    recommendations.push("Ajouter une pièce d’identité.");
  }

  if (address.length === 0) {
    recommendations.push("Ajouter un justificatif d’adresse.");
  }

  if (!validFormats) {
    recommendations.push(
      "Remplacer les fichiers qui ne sont pas PDF, JPG, PNG ou WEBP."
    );
  }

  if (!validSizes) {
    recommendations.push(
      "Réduire les fichiers qui dépassent 10 Mo."
    );
  }

  if (duplicateNames) {
    recommendations.push(
      "Vérifier les fichiers portant le même nom."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Les contrôles techniques sont réussis. Une vérification d’authenticité reste nécessaire."
    );
  }

  return {
    passed: checks.every((check) => check.passed),
    score,
    checks,
    recommendations,
  };
}
