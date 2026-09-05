"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Euro,
  Eye,
  FileCheck2,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import KlyxSelect from "@/app/components/KlyxSelect";
import type { KlyxLocale } from "@/lib/klyx-i18n";
import {
  getKlyxProviderStudioDayLabel,
  getKlyxProviderStudioDocumentStatusLabel,
  getKlyxProviderStudioDocumentTypeLabel,
  getKlyxProviderStudioServiceLabel,
  translateKlyxProviderStudio,
  type KlyxProviderStudioMessageKey,
} from "@/lib/klyx-provider-studio-i18n";
import {
  DAY_LABELS,
  DOCUMENT_TYPES,
  type AvailabilityDay,
  type ProviderServiceDraft,
  type ProviderStudioData,
} from "@/lib/provider-studio";

type ProviderStudioProps = {
  profileId: string;
};

type ApiResult = {
  data?: ProviderStudioData;
  error?: string;
};

const DOCUMENT_STATUS_CLASS: Record<string, string> = {
  pending:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  verified:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

function inputClassName(): string {
  return "w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10";
}

function normalizeServiceSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function readApiResponse(
  response: Response,
  fallbackError: string
): Promise<ProviderStudioData> {
  const result = (await response.json()) as ProviderStudioData & ApiResult;

  if (!response.ok) {
    throw new Error(fallbackError);
  }

  return result.data ?? result;
}

export default function ProviderStudio({ profileId }: ProviderStudioProps) {
  const { locale } = useKlyxLocale();
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const t = (
    key: KlyxProviderStudioMessageKey,
    params?: Record<string, string | number>
  ) => translateKlyxProviderStudio(locale, key, params);

  const [studio, setStudio] = useState<ProviderStudioData | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState("0");
  const [services, setServices] = useState<ProviderServiceDraft[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [zoneInputs, setZoneInputs] = useState<Record<string, string>>({});
  const [documentType, setDocumentType] = useState("identity");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const applyStudioData = useCallback((data: ProviderStudioData) => {
    setStudio(data);
    setBusinessName(data.providerProfile.businessName);
    setHeadline(data.providerProfile.headline);
    setBio(data.providerProfile.bio);
    setYearsExperience(String(data.providerProfile.yearsExperience));
    setServices(data.services);
    setSelectedServiceId((current) => {
      if (current && data.services.some((service) => service.serviceId === current)) {
        return current;
      }

      return (
        data.services.find((service) => service.enabled)?.serviceId ??
        data.services[0]?.serviceId ??
        ""
      );
    });
  }, []);

  const loadStudio = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/provider/studio", {
        method: "GET",
        cache: "no-store",
      });
      applyStudioData(
        await readApiResponse(
          response,
          translateKlyxProviderStudio(localeRef.current, "loadError")
        )
      );
    } catch {
      setErrorMessage(
        translateKlyxProviderStudio(localeRef.current, "loadError")
      );
    } finally {
      setLoading(false);
    }
  }, [applyStudioData]);

  useEffect(() => {
    // Chargement initial depuis l’API sécurisée du profil actif.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudio();
  }, [loadStudio]);

  const enabledServices = useMemo(
    () => services.filter((service) => service.enabled),
    [services]
  );

  const availableServiceMatches = useMemo(() => {
    const query = normalizeServiceSearch(serviceSearch);

    if (!query) return [];

    return services
      .filter((service) => !service.enabled)
      .filter((service) =>
        normalizeServiceSearch(
          getKlyxProviderStudioServiceLabel(locale, service.slug, service.name)
        ).includes(query)
      )
      .slice(0, 8);
  }, [locale, serviceSearch, services]);

  const selectedService = useMemo(
    () => services.find((service) => service.serviceId === selectedServiceId) ?? null,
    [selectedServiceId, services]
  );

  const hasIdentityDocument = useMemo(
    () =>
      studio?.documents.some((document) => document.documentType === "identity") ??
      false,
    [studio?.documents]
  );

  const completeService = useMemo(
    () =>
      enabledServices.some(
        (service) =>
          service.title.trim().length >= 5 &&
          service.description.trim().length >= 30 &&
          (service.pricingType === "fixed"
            ? service.fixedPrice !== null
            : service.hourlyPrice !== null) &&
          service.city.trim().length > 0 &&
          service.serviceArea.length > 0 &&
          service.availability.some((day) => day.enabled)
      ),
    [enabledServices]
  );

  const completionItems = useMemo(
    () => [
      {
        label: translateKlyxProviderStudio(locale, "completionAvatar"),
        complete: Boolean(studio?.profile.avatarUrl),
      },
      {
        label: translateKlyxProviderStudio(locale, "completionPresentation"),
        complete: headline.trim().length >= 10 && bio.trim().length >= 60,
      },
      {
        label: translateKlyxProviderStudio(locale, "completionService"),
        complete: completeService,
      },
      {
        label: translateKlyxProviderStudio(locale, "completionIdentity"),
        complete: hasIdentityDocument,
      },
      {
        label: translateKlyxProviderStudio(locale, "completionGallery"),
        complete: (studio?.gallery.length ?? 0) > 0,
      },
    ],
    [bio, completeService, hasIdentityDocument, headline, locale, studio]
  );

  const completionPercentage = Math.round(
    (completionItems.filter((item) => item.complete).length / completionItems.length) *
      100
  );

  function updateService(
    serviceId: string,
    changes: Partial<ProviderServiceDraft>
  ) {
    setServices((current) =>
      current.map((service) =>
        service.serviceId === serviceId ? { ...service, ...changes } : service
      )
    );
  }

  function updateAvailability(
    serviceId: string,
    dayOfWeek: number,
    changes: Partial<AvailabilityDay>
  ) {
    setServices((current) =>
      current.map((service) =>
        service.serviceId === serviceId
          ? {
              ...service,
              availability: service.availability.map((day) =>
                day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day
              ),
            }
          : service
      )
    );
  }

  function activateService(serviceId: string) {
    updateService(serviceId, { enabled: true });
    setSelectedServiceId(serviceId);
    setServiceSearch("");
  }

  function deactivateService(serviceId: string) {
    updateService(serviceId, { enabled: false });

    if (selectedServiceId === serviceId) {
      setSelectedServiceId(
        enabledServices.find((service) => service.serviceId !== serviceId)
          ?.serviceId ?? ""
      );
    }
  }

  function addZone(serviceId: string) {
    const zone = (zoneInputs[serviceId] ?? "").trim();

    if (!zone) return;

    const service = services.find((item) => item.serviceId === serviceId);

    if (
      !service ||
      service.serviceArea.some((item) => item.toLowerCase() === zone.toLowerCase())
    ) {
      setZoneInputs((current) => ({ ...current, [serviceId]: "" }));
      return;
    }

    updateService(serviceId, {
      serviceArea: [...service.serviceArea, zone].slice(0, 10),
    });
    setZoneInputs((current) => ({ ...current, [serviceId]: "" }));
  }

  function removeZone(serviceId: string, zone: string) {
    const service = services.find((item) => item.serviceId === serviceId);

    if (!service) return;

    updateService(serviceId, {
      serviceArea: service.serviceArea.filter((item) => item !== zone),
    });
  }

  async function saveStudio(publish: boolean) {
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/provider/studio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          headline,
          bio,
          yearsExperience: Number(yearsExperience || 0),
          publish,
          services,
        }),
      });
      const data = await readApiResponse(response, t("saveError"));
      applyStudioData(data);
      setMessage(publish ? t("savePublishedSuccess") : t("saveDraftSuccess"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrorMessage(t("saveError"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(
    kind: "gallery" | "document",
    file: File,
    fallbackError: string,
    extra?: { documentType?: string }
  ) {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    if (extra?.documentType) {
      formData.append("documentType", extra.documentType);
    }

    const response = await fetch("/api/provider/studio", {
      method: "POST",
      body: formData,
    });
    const data = await readApiResponse(response, fallbackError);

    setStudio((current) =>
      current
        ? {
            ...current,
            profile: data.profile,
            providerProfile: data.providerProfile,
            gallery: data.gallery,
            documents: data.documents,
          }
        : data
    );
  }

  async function handleGalleryUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setUploadingGallery(true);
    setMessage("");
    setErrorMessage("");

    try {
      await uploadMedia("gallery", file, t("galleryUploadError"));
      setMessage(t("galleryUploadSuccess"));
    } catch {
      setErrorMessage(t("galleryUploadError"));
    } finally {
      setUploadingGallery(false);
    }
  }

  async function handleDocumentUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setUploadingDocument(true);
    setMessage("");
    setErrorMessage("");

    try {
      await uploadMedia(
        "document",
        file,
        t("documentUploadError"),
        { documentType }
      );
      setMessage(t("documentUploadSuccess"));
    } catch {
      setErrorMessage(t("documentUploadError"));
    } finally {
      setUploadingDocument(false);
    }
  }

  async function deleteMedia(kind: "gallery" | "document", id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;

    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/provider/studio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      const data = await readApiResponse(response, t("deleteError"));
      setStudio((current) =>
        current
          ? {
              ...current,
              profile: data.profile,
              providerProfile: data.providerProfile,
              gallery: data.gallery,
              documents: data.documents,
            }
          : data
      );
      setMessage(t("deleteSuccess"));
    } catch {
      setErrorMessage(t("deleteError"));
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-[55vh] place-items-center bg-background text-foreground">
        <div className="text-center">
          <LoaderCircle className="mx-auto animate-spin text-primary" size={36} />
          <p className="mt-4 text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </main>
    );
  }

  if (!studio) {
    return (
      <main className="bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
          {errorMessage || t("notFound")}
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background px-4 pb-28 pt-6 text-foreground sm:px-6 sm:pt-8 lg:pb-12 lg:px-8">
      <div className="mx-auto min-w-0 max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {t("eyebrow")}
              </p>
              <StatusBadge
                published={studio.providerProfile.isPublished}
                locale={locale}
              />
            </div>
            {/* KLYX_AI_FIRST_PROVIDER_STUDIO_15_03 */}
            {/* KLYX_PROVIDER_STUDIO_AURA_NOIR */}
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              {t("pageTitle")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t("pageDescription")}
            </p>
          </div>

          {studio.providerProfile.isPublished && (
            <Link
              href={`/providers/${profileId}`}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
            >
              <Eye size={17} />
              {t("publicProfile")}
            </Link>
          )}
        </header>

        {errorMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
            <CircleAlert className="mt-0.5 shrink-0" size={20} />
            <p>{errorMessage}</p>
          </div>
        )}

        {message && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
            <BadgeCheck className="mt-0.5 shrink-0" size={20} />
            <p>{message}</p>
          </div>
        )}

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-6">
            <SectionCard
              icon={<BriefcaseBusiness size={21} />}
              title={t("presentationTitle")}
              description={t("presentationDescription")}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="businessName"
                  label={t("businessNameLabel")}
                  value={businessName}
                  onChange={setBusinessName}
                  placeholder={`${studio.profile.firstName} ${t("businessSuffix")}`}
                />
                <Field
                  id="experience"
                  label={t("experienceLabel")}
                  value={yearsExperience}
                  onChange={setYearsExperience}
                  type="number"
                  min="0"
                  max="60"
                />
              </div>

              <div className="mt-5">
                <Field
                  id="headline"
                  label={t("headlineLabel")}
                  value={headline}
                  onChange={setHeadline}
                  placeholder={t("headlinePlaceholder")}
                />
                <Counter current={headline.length} maximum={120} locale={locale} />
              </div>

              <div className="mt-5">
                <label htmlFor="bio" className="mb-2 block text-sm font-medium">
                  {t("bioLabel")}
                </label>
                <textarea
                  id="bio"
                  rows={6}
                  maxLength={2000}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder={t("bioPlaceholder")}
                  className={inputClassName()}
                />
                <Counter
                  current={bio.length}
                  maximum={2000}
                  minimum={60}
                  locale={locale}
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={<BriefcaseBusiness size={21} />}
              title={t("servicesTitle")}
              description={t("servicesDescription")}
            >
              {/* KLYX_PROVIDER_SERVICE_SEARCH_16_13 */}
              <div className="relative">
                <Search
                  size={19}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && availableServiceMatches[0]) {
                      event.preventDefault();
                      activateService(availableServiceMatches[0].serviceId);
                    }
                    if (event.key === "Escape") setServiceSearch("");
                  }}
                  placeholder={t("serviceSearchPlaceholder")}
                  aria-label={t("serviceSearchAria")}
                  autoComplete="off"
                  className={`${inputClassName()} pl-12`}
                />

                {serviceSearch.trim() && (
                  <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-lg">
                    {availableServiceMatches.length > 0 ? (
                      availableServiceMatches.map((service) => {
                        const label = getKlyxProviderStudioServiceLabel(
                          locale,
                          service.slug,
                          service.name
                        );
                        return (
                          <button
                            key={service.serviceId}
                            type="button"
                            onClick={() => activateService(service.serviceId)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                          >
                            <span className="font-semibold">{label}</span>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Plus size={16} />
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-4 py-4 text-sm text-muted-foreground">
                        {t("noServiceFound")}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("serviceSearchHint")}
              </p>

              {enabledServices.length > 0 && (
                <div className="mt-7 border-t border-border pt-7">
                  <div className="mb-6 flex flex-wrap gap-2">
                    {enabledServices.map((service) => {
                      const active = selectedServiceId === service.serviceId;
                      const label = getKlyxProviderStudioServiceLabel(
                        locale,
                        service.slug,
                        service.name
                      );
                      return (
                        <div
                          key={service.serviceId}
                          className={`inline-flex items-center overflow-hidden rounded-full border text-sm font-semibold transition ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-muted text-foreground"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedServiceId(service.serviceId)}
                            className="px-4 py-2"
                          >
                            {label}
                          </button>
                          <button
                            type="button"
                            onClick={() => deactivateService(service.serviceId)}
                            aria-label={t("removeServiceAria", { name: label })}
                            className="mr-1 grid h-7 w-7 place-items-center rounded-full transition hover:bg-black/10 dark:hover:bg-white/10"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {selectedService?.enabled && (
                    <ServiceEditor
                      service={selectedService}
                      locale={locale}
                      zoneInput={zoneInputs[selectedService.serviceId] ?? ""}
                      onZoneInput={(value) =>
                        setZoneInputs((current) => ({
                          ...current,
                          [selectedService.serviceId]: value,
                        }))
                      }
                      onChange={(changes) =>
                        updateService(selectedService.serviceId, changes)
                      }
                      onAvailabilityChange={(day, changes) =>
                        updateAvailability(selectedService.serviceId, day, changes)
                      }
                      onAddZone={() => addZone(selectedService.serviceId)}
                      onRemoveZone={(zone) =>
                        removeZone(selectedService.serviceId, zone)
                      }
                    />
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<ImagePlus size={21} />}
              title={t("galleryTitle")}
              description={t("galleryDescription")}
            >
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background px-6 py-9 text-center transition hover:border-primary/50 hover:bg-accent/20">
                {uploadingGallery ? (
                  <LoaderCircle className="animate-spin text-primary" size={30} />
                ) : (
                  <ImagePlus className="text-primary" size={30} />
                )}
                <span className="mt-3 font-semibold">
                  {uploadingGallery ? t("galleryUploading") : t("galleryAddPhoto")}
                </span>
                <span className="mt-1 text-sm text-muted-foreground">
                  {t("galleryFileHint")}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingGallery || studio.gallery.length >= 8}
                  onChange={handleGalleryUpload}
                />
              </label>

              {studio.gallery.length > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {studio.gallery.map((item) => (
                    <figure
                      key={item.id}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-background"
                    >
                      <img
                        src={item.publicUrl}
                        alt={item.caption || t("galleryPhotoAlt")}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => void deleteMedia("gallery", item.id)}
                        className="absolute right-2 top-2 rounded-full bg-black/75 p-2 text-white opacity-100 transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label={t("galleryDeleteAria")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </figure>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<FileCheck2 size={21} />}
              title={t("documentsTitle")}
              description={t("documentsDescription")}
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <KlyxSelect
                  value={documentType}
                  onChange={setDocumentType}
                  options={DOCUMENT_TYPES.map((type) => ({
                    value: type.value,
                    label: getKlyxProviderStudioDocumentTypeLabel(
                      locale,
                      type.value,
                      type.label
                    ),
                  }))}
                  ariaLabel={t("documentTypeAria")}
                />

                <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90">
                  {uploadingDocument ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <Upload size={18} />
                  )}
                  {uploadingDocument ? t("documentUploading") : t("documentTransmit")}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingDocument}
                    onChange={handleDocumentUpload}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("documentFileHint")}
              </p>

              <div className="mt-5 space-y-3">
                {studio.documents.length === 0 ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">
                    {t("identityRequired")}
                  </div>
                ) : (
                  studio.documents.map((document) => {
                    const type = DOCUMENT_TYPES.find(
                      (item) => item.value === document.documentType
                    );
                    const statusClass =
                      DOCUMENT_STATUS_CLASS[document.status] ??
                      DOCUMENT_STATUS_CLASS.pending;
                    return (
                      <div
                        key={document.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background p-4"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {getKlyxProviderStudioDocumentTypeLabel(
                              locale,
                              document.documentType,
                              type?.label
                            )}
                          </p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {document.fileName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}
                          >
                            {getKlyxProviderStudioDocumentStatusLabel(
                              locale,
                              document.status
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => void deleteMedia("document", document.id)}
                            className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
                            aria-label={t("documentDeleteAria")}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("completionTitle")}
                  </p>
                  <p className="mt-1 text-3xl font-bold text-primary">
                    {completionPercentage}%
                  </p>
                </div>
                <ShieldCheck size={30} className="text-primary" />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <div className="mt-4 space-y-2">
                {completionItems.map((item) => (
                  <p key={item.label} className="flex items-center gap-2 text-xs">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        item.complete
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.complete ? <Check size={13} /> : null}
                    </span>
                    <span className="text-muted-foreground">{item.label}</span>
                  </p>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold">{t("publicationTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("publicationDescription")}
              </p>

              <button
                type="button"
                onClick={() => void saveStudio(true)}
                disabled={saving}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
                {studio.providerProfile.isPublished
                  ? t("updateProfile")
                  : t("publishProfile")}
              </button>

              <button
                type="button"
                onClick={() => void saveStudio(false)}
                disabled={saving}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <Save size={17} />
                )}
                {t("saveDraft")}
              </button>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">{t("summaryTitle")}</h2>
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow
                  label={t("activeServices")}
                  value={String(enabledServices.length)}
                />
                <SummaryRow label={t("photos")} value={`${studio.gallery.length}/8`} />
                <SummaryRow
                  label={t("documents")}
                  value={String(studio.documents.length)}
                />
                <SummaryRow
                  label={t("verification")}
                  value={
                    studio.providerProfile.verificationStatus === "verified"
                      ? t("verificationVerified")
                      : studio.providerProfile.verificationStatus === "pending"
                        ? t("verificationPending")
                        : t("verificationMissing")
                  }
                />
              </div>
            </section>

            <Link
              href="/profile"
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition hover:bg-muted"
            >
              <div>
                <p className="text-sm font-semibold">{t("personalInfo")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("personalInfoDescription")}
                </p>
              </div>
              <ChevronRight size={19} className="text-primary" />
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ServiceEditor({
  service,
  locale,
  zoneInput,
  onZoneInput,
  onChange,
  onAvailabilityChange,
  onAddZone,
  onRemoveZone,
}: {
  service: ProviderServiceDraft;
  locale: KlyxLocale;
  zoneInput: string;
  onZoneInput: (value: string) => void;
  onChange: (changes: Partial<ProviderServiceDraft>) => void;
  onAvailabilityChange: (
    day: number,
    changes: Partial<AvailabilityDay>
  ) => void;
  onAddZone: () => void;
  onRemoveZone: (zone: string) => void;
}) {
  const t = (
    key: KlyxProviderStudioMessageKey,
    params?: Record<string, string | number>
  ) => translateKlyxProviderStudio(locale, key, params);

  return (
    <div className="space-y-7 rounded-2xl border border-border bg-background p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {getKlyxProviderStudioServiceLabel(locale, service.slug, service.name)}
        </p>
        <h3 className="mt-2 text-xl font-semibold">{t("configureService")}</h3>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={`title-${service.serviceId}`}
          label={t("serviceTitleLabel")}
          value={service.title}
          onChange={(value) => onChange({ title: value })}
          placeholder={t("serviceTitlePlaceholder")}
        />
        <Field
          id={`city-${service.serviceId}`}
          label={t("cityLabel")}
          value={service.city}
          onChange={(value) => onChange({ city: value })}
          placeholder={t("cityPlaceholder")}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          {t("serviceDescriptionLabel")}
        </label>
        <textarea
          rows={5}
          maxLength={1200}
          value={service.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder={t("serviceDescriptionPlaceholder")}
          className={inputClassName()}
        />
        <Counter
          current={service.description.length}
          maximum={1200}
          minimum={30}
          locale={locale}
        />
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium">
            {t("pricingLabel")}
          </label>
          <div className="grid min-w-0 grid-cols-2 rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() =>
                onChange({ pricingType: "hourly", price: service.hourlyPrice })
              }
              className={`min-w-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                service.pricingType === "hourly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("hourly")}
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ pricingType: "fixed", price: service.fixedPrice })
              }
              className={`min-w-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                service.pricingType === "fixed"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("fixed")}
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t("pricingHint")}
          </p>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <PriceField
            label={t("hourlyRateLabel")}
            value={service.hourlyPrice}
            placeholder="25"
            onChange={(hourlyPrice) =>
              onChange({
                hourlyPrice,
                price:
                  service.pricingType === "hourly" ? hourlyPrice : service.price,
              })
            }
          />
          <PriceField
            label={t("fixedPriceLabel")}
            value={service.fixedPrice}
            placeholder="100"
            onChange={(fixedPrice) =>
              onChange({
                fixedPrice,
                price:
                  service.pricingType === "fixed" ? fixedPrice : service.price,
              })
            }
          />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <MapPin size={19} className="text-primary" />
          <h3 className="font-semibold">{t("zonesTitle")}</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("zonesDescription")}
        </p>

        <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={zoneInput}
            onChange={(event) => onZoneInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddZone();
              }
            }}
            placeholder={t("zonePlaceholder")}
            className={inputClassName()}
          />
          <button
            type="button"
            onClick={onAddZone}
            className="grid min-h-12 w-12 place-items-center rounded-xl border border-border bg-background transition hover:bg-muted"
            aria-label={t("addZoneAria")}
          >
            <Plus size={19} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {service.serviceArea.map((zone) => (
            <span
              key={zone}
              className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-accent/40 px-3 py-1.5 text-sm text-primary"
            >
              {zone}
              <button
                type="button"
                onClick={() => onRemoveZone(zone)}
                aria-label={t("removeZoneAria", { zone })}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>

        <div className="mt-5 max-w-xs">
          <Field
            id={`radius-${service.serviceId}`}
            label={t("radiusLabel")}
            value={String(service.travelRadiusKm)}
            onChange={(value) =>
              onChange({ travelRadiusKm: Number(value || 0) })
            }
            type="number"
            min="0"
            max="100"
          />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Clock3 size={19} className="text-primary" />
          <h3 className="font-semibold">{t("availabilityTitle")}</h3>
        </div>
        <div className="mt-4 space-y-3">
          {DAY_LABELS.map((definition) => {
            const day = service.availability.find(
              (item) => item.dayOfWeek === definition.value
            );
            if (!day) return null;

            return (
              <div
                key={definition.value}
                className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[130px_1fr_1fr] sm:items-center"
              >
                <label className="flex items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(event) =>
                      onAvailabilityChange(day.dayOfWeek, {
                        enabled: event.target.checked,
                      })
                    }
                    className="h-5 w-5 accent-primary"
                  />
                  {getKlyxProviderStudioDayLabel(locale, definition.value)}
                </label>
                <input
                  type="time"
                  value={day.startTime}
                  disabled={!day.enabled}
                  onChange={(event) =>
                    onAvailabilityChange(day.dayOfWeek, {
                      startTime: event.target.value,
                    })
                  }
                  className={inputClassName()}
                />
                <input
                  type="time"
                  value={day.endTime}
                  disabled={!day.enabled}
                  onChange={(event) =>
                    onAvailabilityChange(day.dayOfWeek, {
                      endTime: event.target.value,
                    })
                  }
                  className={inputClassName()}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PriceField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  placeholder: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <div className="relative min-w-0">
        <Euro
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={18}
        />
        <input
          type="number"
          min="1"
          max="10000"
          step="0.01"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : Number(event.target.value))
          }
          className={`${inputClassName()} min-w-0 pl-11`}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
      <div className="mb-6 flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/40 text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClassName()}
      />
    </div>
  );
}

function Counter({
  current,
  maximum,
  minimum,
  locale,
}: {
  current: number;
  maximum: number;
  minimum?: number;
  locale: KlyxLocale;
}) {
  return (
    <p
      className={`mt-2 text-right text-xs ${
        minimum && current < minimum ? "text-amber-600" : "text-muted-foreground"
      }`}
    >
      {minimum && current < minimum
        ? translateKlyxProviderStudio(locale, "minimumCounter", { minimum })
        : ""}
      {current}/{maximum}
    </p>
  );
}

function StatusBadge({
  published,
  locale,
}: {
  published: boolean;
  locale: KlyxLocale;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        published
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          published ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      {translateKlyxProviderStudio(
        locale,
        published ? "publishedStatus" : "draftStatus"
      )}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
