import { NextResponse } from "next/server";
import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createDefaultAvailability,
  serviceLabel,
  type AvailabilityDay,
  type PricingType,
  type ProviderServiceDraft,
  type ProviderStudioData,
} from "@/lib/provider-studio";

const DOCUMENT_TYPES = ["identity", "address", "insurance", "company"];
const GALLERY_BUCKET = "avatars";
const DOCUMENT_BUCKET = "provider-documents";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  avatar_url: string | null;
};

type ProviderProfileRow = {
  profile_id: string;
  business_name: string | null;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  is_published: boolean | null;
  verification_status: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
};

type UserServiceRow = {
  id: string;
  service_id: string;
  active: boolean;
  provider_enabled: boolean | null;
};

type ServiceProfileRow = {
  id: string;
  user_service_id: string;
  title: string | null;
  description: string | null;
  pricing_type: string | null;
  price: number | null;
  hourly_price: number | null;
  fixed_price: number | null;
  city: string | null;
  service_area: string[] | null;
  travel_radius_km: number | null;
  available: boolean | null;
};

type AvailabilityRow = {
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type GalleryRow = {
  id: string;
  public_url: string;
  storage_path: string;
  caption: string | null;
  position: number | null;
};

type DocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  status: string;
  created_at: string;
};

type StudioServiceInput = {
  serviceId?: unknown;
  enabled?: unknown;
  title?: unknown;
  description?: unknown;
  pricingType?: unknown;
  price?: unknown;
  hourlyPrice?: unknown;
  fixedPrice?: unknown;
  city?: unknown;
  serviceArea?: unknown;
  travelRadiusKm?: unknown;
  availability?: unknown;
};

type StudioBody = {
  businessName?: unknown;
  headline?: unknown;
  bio?: unknown;
  yearsExperience?: unknown;
  publish?: unknown;
  services?: unknown;
};

type ValidatedService = {
  serviceId: string;
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

function cleanText(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("provider_profiles")) {
    return "Exécute d’abord le SQL de la fiche prestataire dans Supabase.";
  }

  return message || "Une erreur inattendue est survenue.";
}

async function requireProvider() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non connecté.");
  }

  const profile = await getActiveProfile();

  if (!profile || profile.accountType !== "provider") {
    throw new Error("Active un profil prestataire pour continuer.");
  }

  return profile;
}

function statusForError(message: string): number {
  if (message === "Non connecté.") return 401;
  if (message === "Active un profil prestataire pour continuer.") return 403;
  if (message.startsWith("Impossible de publier")) return 400;
  if (message.startsWith("Service invalide")) return 400;
  return 500;
}

function normalizedAvailability(rows: AvailabilityRow[]): AvailabilityDay[] {
  return createDefaultAvailability().map((day) => {
    const row = rows.find(
      (item) => item.day_of_week === day.dayOfWeek && item.is_active
    );

    return row
      ? {
          dayOfWeek: day.dayOfWeek,
          enabled: true,
          startTime: row.start_time.slice(0, 5),
          endTime: row.end_time.slice(0, 5),
        }
      : day;
  });
}

async function loadStudioData(profileId: string): Promise<ProviderStudioData> {
  const [
    profileResult,
    providerProfileResult,
    servicesResult,
    userServicesResult,
    galleryResult,
    documentsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, city, avatar_url")
      .eq("id", profileId)
      .single(),
    supabaseAdmin
      .from("provider_profiles")
      .select(
        "profile_id, business_name, headline, bio, years_experience, is_published, verification_status"
      )
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabaseAdmin
      .from("services")
      .select("id, name, slug")
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("user_services")
      .select("id, service_id, active, provider_enabled")
      .eq("user_id", profileId),
    supabaseAdmin
      .from("provider_gallery")
      .select("id, public_url, storage_path, caption, position")
      .eq("profile_id", profileId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("provider_documents")
      .select("id, document_type, file_name, storage_path, status, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false }),
  ]);

  const firstError = [
    profileResult.error,
    providerProfileResult.error,
    servicesResult.error,
    userServicesResult.error,
    galleryResult.error,
    documentsResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message);
  }

  const profile = profileResult.data as ProfileRow;
  const providerProfile = providerProfileResult.data as ProviderProfileRow | null;
  const services = (servicesResult.data ?? []) as ServiceRow[];
  const userServices = (userServicesResult.data ?? []) as UserServiceRow[];
  const userServiceIds = userServices.map((item) => item.id);

  let serviceProfiles: ServiceProfileRow[] = [];
  let availability: AvailabilityRow[] = [];

  if (userServiceIds.length > 0) {
    const [serviceProfilesResult, availabilityResult] = await Promise.all([
      supabaseAdmin
        .from("service_profiles")
        .select(
          "id, user_service_id, title, description, pricing_type, price, hourly_price, fixed_price, city, service_area, travel_radius_km, available"
        )
        .in("user_service_id", userServiceIds),
      supabaseAdmin
        .from("availability_slots")
        .select(
          "user_service_id, day_of_week, start_time, end_time, is_active"
        )
        .in("user_service_id", userServiceIds),
    ]);

    if (serviceProfilesResult.error) {
      throw new Error(serviceProfilesResult.error.message);
    }

    if (availabilityResult.error) {
      throw new Error(availabilityResult.error.message);
    }

    serviceProfiles = (serviceProfilesResult.data ?? []) as ServiceProfileRow[];
    availability = (availabilityResult.data ?? []) as AvailabilityRow[];
  }

  const userServiceByServiceId = new Map(
    userServices.map((item) => [item.service_id, item])
  );
  const serviceProfileByUserServiceId = new Map(
    serviceProfiles.map((item) => [item.user_service_id, item])
  );

  const studioServices: ProviderServiceDraft[] = services.map((service) => {
    const userService = userServiceByServiceId.get(service.id) ?? null;
    const serviceProfile = userService
      ? serviceProfileByUserServiceId.get(userService.id) ?? null
      : null;
    const slots = userService
      ? availability.filter((item) => item.user_service_id === userService.id)
      : [];

    return {
      serviceId: service.id,
      name: service.name,
      slug: service.slug,
      userServiceId: userService?.id ?? null,
      enabled: Boolean(userService && userService.provider_enabled !== false),
      title:
        serviceProfile?.title ??
        `${serviceLabel(service.slug, service.name)} avec ${profile.first_name ?? "KLYX"}`,
      description: serviceProfile?.description ?? "",
      pricingType:
        serviceProfile?.pricing_type === "fixed" ? "fixed" : "hourly",
      price:
        serviceProfile?.price === null || serviceProfile?.price === undefined
          ? null
          : Number(serviceProfile.price),
      hourlyPrice:
        serviceProfile?.hourly_price === null ||
        serviceProfile?.hourly_price === undefined
          ? serviceProfile?.pricing_type === "hourly" &&
            serviceProfile?.price !== null &&
            serviceProfile?.price !== undefined
            ? Number(serviceProfile.price)
            : null
          : Number(serviceProfile.hourly_price),
      fixedPrice:
        serviceProfile?.fixed_price === null ||
        serviceProfile?.fixed_price === undefined
          ? serviceProfile?.pricing_type === "fixed" &&
            serviceProfile?.price !== null &&
            serviceProfile?.price !== undefined
            ? Number(serviceProfile.price)
            : null
          : Number(serviceProfile.fixed_price),
      city: serviceProfile?.city ?? profile.city ?? "Bruxelles",
      serviceArea:
        serviceProfile?.service_area && serviceProfile.service_area.length > 0
          ? serviceProfile.service_area
          : profile.city
            ? [profile.city]
            : [],
      travelRadiusKm: Number(serviceProfile?.travel_radius_km ?? 10),
      availability: normalizedAvailability(slots),
    };
  });

  const verificationStatus = providerProfile?.verification_status;

  return {
    profile: {
      id: profile.id,
      firstName: profile.first_name ?? "",
      lastName: profile.last_name ?? "",
      city: profile.city ?? "",
      avatarUrl: profile.avatar_url,
    },
    providerProfile: {
      businessName: providerProfile?.business_name ?? "",
      headline: providerProfile?.headline ?? "",
      bio: providerProfile?.bio ?? "",
      yearsExperience: Number(providerProfile?.years_experience ?? 0),
      isPublished: Boolean(providerProfile?.is_published),
      verificationStatus:
        verificationStatus === "pending" ||
        verificationStatus === "verified" ||
        verificationStatus === "rejected"
          ? verificationStatus
          : "not_submitted",
    },
    services: studioServices,
    gallery: ((galleryResult.data ?? []) as GalleryRow[]).map((item) => ({
      id: item.id,
      publicUrl: item.public_url,
      storagePath: item.storage_path,
      caption: item.caption ?? "",
      position: Number(item.position ?? 0),
    })),
    documents: ((documentsResult.data ?? []) as DocumentRow[]).map((item) => ({
      id: item.id,
      documentType: item.document_type,
      fileName: item.file_name,
      status:
        item.status === "verified" || item.status === "rejected"
          ? item.status
          : "pending",
      createdAt: item.created_at,
    })),
  };
}

function validateAvailability(value: unknown): AvailabilityDay[] {
  if (!Array.isArray(value)) {
    return createDefaultAvailability();
  }

  const days = createDefaultAvailability();

  return days.map((defaultDay) => {
    const input = value.find(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        Number((item as { dayOfWeek?: unknown }).dayOfWeek) ===
          defaultDay.dayOfWeek
    ) as
      | {
          enabled?: unknown;
          startTime?: unknown;
          endTime?: unknown;
        }
      | undefined;

    if (!input || input.enabled !== true) {
      return defaultDay;
    }

    const startTime = cleanText(input.startTime, 5);
    const endTime = cleanText(input.endTime, 5);
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
      throw new Error("Service invalide : horaire incorrect.");
    }

    if (endTime <= startTime) {
      throw new Error("Service invalide : l’heure de fin doit suivre le début.");
    }

    return {
      dayOfWeek: defaultDay.dayOfWeek,
      enabled: true,
      startTime,
      endTime,
    };
  });
}

function validateServices(value: unknown, requireComplete: boolean): ValidatedService[] {
  if (!Array.isArray(value)) {
    throw new Error("Service invalide : liste manquante.");
  }

  const serviceIds = new Set<string>();

  return (value as StudioServiceInput[]).map((item) => {
    const serviceId = cleanText(item.serviceId, 60);

    if (!serviceId || serviceIds.has(serviceId)) {
      throw new Error("Service invalide : identifiant incorrect.");
    }

    serviceIds.add(serviceId);
    const enabled = item.enabled === true;
    const title = cleanText(item.title, 120);
    const description = cleanText(item.description, 1200);
    const pricingType: PricingType =
      item.pricingType === "fixed" ? "fixed" : "hourly";
    const priceValue =
      item.price === null || item.price === "" ? null : Number(item.price);
    const hourlyPrice =
      item.hourlyPrice === null || item.hourlyPrice === ""
        ? pricingType === "hourly"
          ? priceValue
          : null
        : Number(item.hourlyPrice);
    const fixedPrice =
      item.fixedPrice === null || item.fixedPrice === ""
        ? pricingType === "fixed"
          ? priceValue
          : null
        : Number(item.fixedPrice);
    const city = cleanText(item.city, 100);
    const travelRadiusKm = Number(item.travelRadiusKm ?? 10);
    const serviceArea = Array.isArray(item.serviceArea)
      ? Array.from(
          new Set(
            item.serviceArea
              .map((zone) => cleanText(zone, 80))
              .filter(Boolean)
          )
        ).slice(0, 10)
      : [];
    const availability = validateAvailability(item.availability);

    const selectedPrice =
      pricingType === "fixed" ? fixedPrice : hourlyPrice;

    const invalidHourly =
      hourlyPrice !== null &&
      (!Number.isFinite(hourlyPrice) || hourlyPrice < 1 || hourlyPrice > 10000);

    const invalidFixed =
      fixedPrice !== null &&
      (!Number.isFinite(fixedPrice) || fixedPrice < 1 || fixedPrice > 10000);

    if (enabled && (invalidHourly || invalidFixed)) {
      throw new Error(
        "Service invalide : chaque tarif renseigné doit être compris entre 1 € et 10 000 €."
      );
    }

    if (enabled && requireComplete && selectedPrice === null) {
      throw new Error(
        pricingType === "fixed"
          ? "Service invalide : indique un prix fixe entre 1 € et 10 000 €."
          : "Service invalide : indique un tarif horaire entre 1 € et 10 000 €."
      );
    }

    if (!Number.isInteger(travelRadiusKm) || travelRadiusKm < 0 || travelRadiusKm > 100) {
      throw new Error("Service invalide : le rayon doit être compris entre 0 et 100 km.");
    }

    return {
      serviceId,
      enabled,
      title,
      description,
      pricingType,
      price: selectedPrice,
      hourlyPrice,
      fixedPrice,
      city,
      serviceArea,
      travelRadiusKm,
      availability,
    };
  });
}

function validatePublication(
  body: {
    headline: string;
    bio: string;
    services: ValidatedService[];
  },
  avatarUrl: string | null,
  hasIdentityDocument: boolean
) {
  if (!avatarUrl) {
    throw new Error("Impossible de publier : ajoute d’abord une photo de profil.");
  }

  if (body.headline.length < 10) {
    throw new Error("Impossible de publier : le titre doit contenir au moins 10 caractères.");
  }

  if (body.bio.length < 60) {
    throw new Error("Impossible de publier : la présentation doit contenir au moins 60 caractères.");
  }

  const enabledServices = body.services.filter((service) => service.enabled);

  if (enabledServices.length === 0) {
    throw new Error("Impossible de publier : active au moins un service.");
  }

  for (const service of enabledServices) {
    if (service.title.length < 5 || service.description.length < 30) {
      throw new Error("Impossible de publier : complète le titre et la description de chaque service actif.");
    }

    if (!service.availability.some((day) => day.enabled)) {
      throw new Error("Impossible de publier : ajoute au moins une disponibilité à chaque service actif.");
    }
  }

  if (!hasIdentityDocument) {
    throw new Error("Impossible de publier : transmets d’abord une pièce d’identité.");
  }
}

export async function GET() {
  try {
    const profile = await requireProvider();
    return NextResponse.json(await loadStudioData(profile.id));
  } catch (error) {
    const message = errorMessage(error);
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await requireProvider();
    const body = (await request.json()) as StudioBody;
    const businessName = cleanText(body.businessName, 120);
    const headline = cleanText(body.headline, 120);
    const bio = cleanText(body.bio, 2000);
    const yearsExperience = Number(body.yearsExperience ?? 0);
    const publish = body.publish === true;
    const services = validateServices(body.services, publish);

    if (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 60) {
      return NextResponse.json(
        { error: "L’expérience doit être comprise entre 0 et 60 ans." },
        { status: 400 }
      );
    }

    const [
      profileResult,
      catalogueResult,
      documentsResult,
      currentProviderProfileResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("avatar_url")
        .eq("id", profile.id)
        .single(),
      supabaseAdmin
        .from("services")
        .select("id, slug"),
      supabaseAdmin
        .from("provider_documents")
        .select("document_type")
        .eq("profile_id", profile.id),
      supabaseAdmin
        .from("provider_profiles")
        .select("verification_status")
        .eq("profile_id", profile.id)
        .maybeSingle(),
    ]);

    const firstError = [
      profileResult.error,
      catalogueResult.error,
      documentsResult.error,
      currentProviderProfileResult.error,
    ].find(Boolean);

    if (firstError) {
      throw new Error(firstError.message);
    }

    if (!profileResult.data) {
      throw new Error("Profil KLYX introuvable.");
    }

    const allowedServiceIds = new Set(
      ((catalogueResult.data ?? []) as { id: string }[]).map((item) => item.id)
    );

    if (services.some((service) => !allowedServiceIds.has(service.serviceId))) {
      return NextResponse.json({ error: "Service invalide ou non disponible." }, { status: 400 });
    }

    const hasIdentityDocument = (documentsResult.data ?? []).some(
      (item) => item.document_type === "identity"
    );

    if (publish) {
      validatePublication(
        { headline, bio, services },
        profileResult.data.avatar_url,
        hasIdentityDocument
      );
    }

    const verificationStatus = hasIdentityDocument
      ? currentProviderProfileResult.data?.verification_status === "verified"
        ? "verified"
        : "pending"
      : "not_submitted";
    const { error: providerProfileError } = await supabaseAdmin
      .from("provider_profiles")
      .upsert(
        {
          profile_id: profile.id,
          business_name: businessName || null,
          headline: headline || null,
          bio: bio || null,
          years_experience: yearsExperience,
          is_published: publish,
          verification_status: verificationStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      );

    if (providerProfileError) {
      throw new Error(providerProfileError.message);
    }

    const { data: existingData, error: existingError } = await supabaseAdmin
      .from("user_services")
      .select("id, service_id, active, provider_enabled")
      .eq("user_id", profile.id);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingByServiceId = new Map(
      ((existingData ?? []) as UserServiceRow[]).map((item) => [item.service_id, item])
    );

    for (const service of services) {
      let userService = existingByServiceId.get(service.serviceId) ?? null;

      if (!service.enabled) {
        if (userService) {
          const { error } = await supabaseAdmin
            .from("user_services")
            .update({ active: false, provider_enabled: false })
            .eq("id", userService.id)
            .eq("user_id", profile.id);

          if (error) throw new Error(error.message);

          const { error: profileError } = await supabaseAdmin
            .from("service_profiles")
            .update({ available: false, updated_at: new Date().toISOString() })
            .eq("user_service_id", userService.id);

          if (profileError) throw new Error(profileError.message);
        }

        continue;
      }

      if (!userService) {
        const { data, error } = await supabaseAdmin
          .from("user_services")
          .insert({
            user_id: profile.id,
            service_id: service.serviceId,
            active: publish,
            provider_enabled: true,
          })
          .select("id, service_id, active, provider_enabled")
          .single();

        if (error) throw new Error(error.message);
        userService = data as UserServiceRow;
      } else {
        const { error } = await supabaseAdmin
          .from("user_services")
          .update({ active: publish, provider_enabled: true })
          .eq("id", userService.id)
          .eq("user_id", profile.id);

        if (error) throw new Error(error.message);
      }

      const serviceProfilePayload = {
        title: service.title || null,
        description: service.description || null,
        pricing_type: service.pricingType,
        price: service.price,
        hourly_price: service.hourlyPrice,
        fixed_price: service.fixedPrice,
        city: service.city || null,
        service_area: service.serviceArea,
        travel_radius_km: service.travelRadiusKm,
        available: publish,
        updated_at: new Date().toISOString(),
      };

      const { data: existingServiceProfile, error: existingProfileError } =
        await supabaseAdmin
          .from("service_profiles")
          .select("id")
          .eq("user_service_id", userService.id)
          .maybeSingle();

      if (existingProfileError) throw new Error(existingProfileError.message);

      if (existingServiceProfile) {
        const { error } = await supabaseAdmin
          .from("service_profiles")
          .update(serviceProfilePayload)
          .eq("id", existingServiceProfile.id)
          .eq("user_service_id", userService.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from("service_profiles").insert({
          user_service_id: userService.id,
          ...serviceProfilePayload,
          rating: 0,
          review_count: 0,
        });

        if (error) throw new Error(error.message);
      }

      const { error: deleteAvailabilityError } = await supabaseAdmin
        .from("availability_slots")
        .delete()
        .eq("user_service_id", userService.id);

      if (deleteAvailabilityError) {
        throw new Error(deleteAvailabilityError.message);
      }

      const enabledDays = service.availability.filter((day) => day.enabled);

      if (enabledDays.length > 0) {
        const { error } = await supabaseAdmin.from("availability_slots").insert(
          enabledDays.map((day) => ({
            user_service_id: userService.id,
            day_of_week: day.dayOfWeek,
            start_time: day.startTime,
            end_time: day.endTime,
            is_active: true,
            updated_at: new Date().toISOString(),
          }))
        );

        if (error) throw new Error(error.message);
      }
    }

    return NextResponse.json({
      success: true,
      published: publish,
      data: await loadStudioData(profile.id),
    });
  } catch (error) {
    const message = errorMessage(error);
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}

function extensionForFile(file: File): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };

  return extensions[file.type] ?? "bin";
}

export async function POST(request: Request) {
  try {
    const profile = await requireProvider();
    const formData = await request.formData();
    const kind = cleanText(formData.get("kind"), 20);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choisis un fichier." }, { status: 400 });
    }

    if (kind === "gallery") {
      if (!file.type.startsWith("image/") || file.size > 6 * 1024 * 1024) {
        return NextResponse.json(
          { error: "La galerie accepte une image JPG, PNG ou WEBP de 6 Mo maximum." },
          { status: 400 }
        );
      }

      const { count } = await supabaseAdmin
        .from("provider_gallery")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id);

      if ((count ?? 0) >= 8) {
        return NextResponse.json({ error: "La galerie accepte au maximum huit photos." }, { status: 400 });
      }

      const storagePath = `${profile.id}/gallery/${crypto.randomUUID()}.${extensionForFile(file)}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(GALLERY_BUCKET)
        .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: publicData } = supabaseAdmin.storage
        .from(GALLERY_BUCKET)
        .getPublicUrl(storagePath);
      const caption = cleanText(formData.get("caption"), 120);
      const { error: insertError } = await supabaseAdmin.from("provider_gallery").insert({
        profile_id: profile.id,
        storage_path: storagePath,
        public_url: publicData.publicUrl,
        caption: caption || null,
        position: count ?? 0,
      });

      if (insertError) {
        await supabaseAdmin.storage.from(GALLERY_BUCKET).remove([storagePath]);
        throw new Error(insertError.message);
      }
    } else if (kind === "document") {
      const documentType = cleanText(formData.get("documentType"), 30);
      const acceptedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

      if (!DOCUMENT_TYPES.includes(documentType)) {
        return NextResponse.json({ error: "Type de document invalide." }, { status: 400 });
      }

      if (!acceptedTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Le document doit être un PDF, JPG, PNG ou WEBP de 10 Mo maximum." },
          { status: 400 }
        );
      }

      const storagePath = `${profile.id}/${documentType}/${crypto.randomUUID()}.${extensionForFile(file)}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(DOCUMENT_BUCKET)
        .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: previous } = await supabaseAdmin
        .from("provider_documents")
        .select("id, storage_path")
        .eq("profile_id", profile.id)
        .eq("document_type", documentType)
        .maybeSingle();

      const { error: upsertError } = await supabaseAdmin
        .from("provider_documents")
        .upsert(
          {
            profile_id: profile.id,
            document_type: documentType,
            file_name: file.name.slice(0, 180),
            storage_path: storagePath,
            status: "pending",
            rejection_reason: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "profile_id,document_type" }
        );

      if (upsertError) {
        await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
        throw new Error(upsertError.message);
      }

      if (previous?.storage_path && previous.storage_path !== storagePath) {
        await supabaseAdmin.storage
          .from(DOCUMENT_BUCKET)
          .remove([previous.storage_path]);
      }
    } else {
      return NextResponse.json({ error: "Type d’envoi invalide." }, { status: 400 });
    }

    return NextResponse.json({ data: await loadStudioData(profile.id) }, { status: 201 });
  } catch (error) {
    const message = errorMessage(error);
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}

export async function DELETE(request: Request) {
  try {
    const profile = await requireProvider();
    const body = (await request.json()) as { kind?: unknown; id?: unknown };
    const kind = cleanText(body.kind, 20);
    const id = cleanText(body.id, 60);

    if (!id || (kind !== "gallery" && kind !== "document")) {
      return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
    }

    const table = kind === "gallery" ? "provider_gallery" : "provider_documents";
    const bucket = kind === "gallery" ? GALLERY_BUCKET : DOCUMENT_BUCKET;
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("id, storage_path")
      .eq("id", id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from(bucket)
      .remove([data.storage_path]);

    if (storageError) throw new Error(storageError.message);

    const { error: deleteError } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("id", id)
      .eq("profile_id", profile.id);

    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ success: true, data: await loadStudioData(profile.id) });
  } catch (error) {
    const message = errorMessage(error);
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}
