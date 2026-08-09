export type PricingType = "hourly" | "fixed";

export type AvailabilityDay = {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export type ProviderServiceDraft = {
  serviceId: string;
  name: string;
  slug: string;
  userServiceId: string | null;
  enabled: boolean;
  title: string;
  description: string;
  pricingType: PricingType;
  price: number | null;
  hourlyPrice: number | null;
  fixedPrice: number | null;
  city: string;
  serviceArea: string[];
  travelRadiusKm: number;
  availability: AvailabilityDay[];
};

export type ProviderGalleryItem = {
  id: string;
  publicUrl: string;
  storagePath: string;
  caption: string;
  position: number;
};

export type ProviderDocument = {
  id: string;
  documentType: string;
  fileName: string;
  status: "pending" | "verified" | "rejected";
  createdAt: string;
};

export type ProviderStudioData = {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    city: string;
    avatarUrl: string | null;
  };
  providerProfile: {
    businessName: string;
    headline: string;
    bio: string;
    yearsExperience: number;
    isPublished: boolean;
    verificationStatus: "not_submitted" | "pending" | "verified" | "rejected";
  };
  services: ProviderServiceDraft[];
  gallery: ProviderGalleryItem[];
  documents: ProviderDocument[];
};

export const DAY_LABELS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
] as const;

export const DOCUMENT_TYPES = [
  { value: "identity", label: "Pièce d’identité" },
  { value: "address", label: "Justificatif de domicile" },
  { value: "insurance", label: "Assurance professionnelle" },
  { value: "company", label: "Document d’entreprise" },
] as const;

export function createDefaultAvailability(): AvailabilityDay[] {
  return DAY_LABELS.map((day) => ({
    dayOfWeek: day.value,
    enabled: false,
    startTime: "09:00",
    endTime: "18:00",
  }));
}

export function serviceLabel(slug: string, fallback = "Service KLYX"): string {
  const labels: Record<string, string> = {
    babysitting: "Baby-sitting",
    cleaning: "Ménage",
    moving: "Déménagement",
    handyman: "Bricolage",
  };

  return labels[slug] ?? fallback;
}

export function formatServicePrice(
  price: number | null,
  pricingType: PricingType
): string {
  if (price === null) {
    return "Prix à confirmer";
  }

  return pricingType === "fixed"
    ? `${price.toFixed(2)} € forfait`
    : `${price.toFixed(2)} €/h`;
}

