"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  DAY_LABELS,
  DOCUMENT_TYPES,
  serviceLabel,
  type AvailabilityDay,
  type ProviderServiceDraft,
  type ProviderStudioData,
} from "@/lib/provider-studio";
import KlyxSelect from "@/app/components/KlyxSelect";

type ProviderStudioProps = {
  profileId: string;
};

type ApiResult = {
  data?: ProviderStudioData;
  error?: string;
};

const DOCUMENT_STATUS: Record<string, { label: string; className: string }> = {
  pending: {
    label: "En vérification",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  verified: {
    label: "Vérifié",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  rejected: {
    label: "À remplacer",
    className: "border-red-500/30 bg-red-500/10 text-red-300",
  },
};

function inputClassName(): string {
  return "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";
}

async function readApiResponse(response: Response): Promise<ProviderStudioData> {
  const result = (await response.json()) as ProviderStudioData & ApiResult;

  if (!response.ok) {
    throw new Error(result.error ?? "Une erreur inattendue est survenue.");
  }

  return result.data ?? result;
}

export default function ProviderStudio({ profileId }: ProviderStudioProps) {
  const [studio, setStudio] = useState<ProviderStudioData | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState("0");
  const [services, setServices] = useState<ProviderServiceDraft[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
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
      applyStudioData(await readApiResponse(response));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger la fiche prestataire."
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

  const selectedService = useMemo(
    () => services.find((service) => service.serviceId === selectedServiceId) ?? null,
    [selectedServiceId, services]
  );

  const hasIdentityDocument = useMemo(
    () => studio?.documents.some((document) => document.documentType === "identity") ?? false,
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
      { label: "Photo de profil", complete: Boolean(studio?.profile.avatarUrl) },
      {
        label: "Présentation commerciale",
        complete: headline.trim().length >= 10 && bio.trim().length >= 60,
      },
      { label: "Service, tarif et horaires", complete: completeService },
      { label: "Pièce d’identité transmise", complete: hasIdentityDocument },
      { label: "Galerie professionnelle", complete: (studio?.gallery.length ?? 0) > 0 },
    ],
    [bio, completeService, hasIdentityDocument, headline, studio]
  );

  const completionPercentage = Math.round(
    (completionItems.filter((item) => item.complete).length / completionItems.length) * 100
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

  function toggleService(serviceId: string) {
    setServices((current) =>
      current.map((service) =>
        service.serviceId === serviceId
          ? { ...service, enabled: !service.enabled }
          : service
      )
    );
    setSelectedServiceId(serviceId);
  }

  function addZone(serviceId: string) {
    const zone = (zoneInputs[serviceId] ?? "").trim();

    if (!zone) return;

    const service = services.find((item) => item.serviceId === serviceId);

    if (!service || service.serviceArea.some((item) => item.toLowerCase() === zone.toLowerCase())) {
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
      const data = await readApiResponse(response);
      applyStudioData(data);
      setMessage(
        publish
          ? "Ta fiche prestataire est publiée et visible dans la recherche."
          : "Brouillon enregistré. Tes services ne sont pas visibles par les clients."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d’enregistrer la fiche."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(
    kind: "gallery" | "document",
    file: File,
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
    const data = await readApiResponse(response);

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
      await uploadMedia("gallery", file);
      setMessage("Photo ajoutée à la galerie.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d’ajouter la photo."
      );
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
      await uploadMedia("document", file, { documentType });
      setMessage("Document transmis pour vérification.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d’envoyer le document."
      );
    } finally {
      setUploadingDocument(false);
    }
  }

  async function deleteMedia(kind: "gallery" | "document", id: string) {
    if (!window.confirm("Supprimer définitivement ce fichier ?")) return;

    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/provider/studio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      const data = await readApiResponse(response);
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
      setMessage("Fichier supprimé.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de supprimer le fichier."
      );
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <LoaderCircle className="mx-auto animate-spin text-violet-400" size={42} />
          <p className="mt-4 text-zinc-400">Chargement du studio prestataire...</p>
        </div>
      </main>
    );
  }

  if (!studio) {
    return (
      <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
          {errorMessage || "La fiche prestataire est introuvable."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto min-w-0 max-w-7xl overflow-x-hidden">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft size={18} />
            Tableau de bord
          </Link>

          {studio.providerProfile.isPublished && (
            <Link
              href={`/providers/${profileId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800"
            >
              <Eye size={17} />
              Voir ma fiche publique
            </Link>
          )}
        </div>

        <header className="grid gap-6 rounded-3xl border border-zinc-800 bg-gradient-to-br from-violet-950/80 via-zinc-900 to-zinc-900 p-6 sm:p-8 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">
                Studio prestataire
              </p>
              <StatusBadge published={studio.providerProfile.isPublished} />
            </div>

            <h1 className="mt-4 text-3xl font-bold sm:text-5xl">
              Construis une fiche qui donne confiance
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-zinc-300">
              Ajoute tes services, tarifs, zones, horaires, photos et documents. Une fois publiée, ta fiche apparaît dans la recherche KLYX.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-400">Profil complété</p>
                <p className="mt-1 text-4xl font-bold text-violet-300">
                  {completionPercentage}%
                </p>
              </div>
              <ShieldCheck size={38} className="text-violet-300" />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <div className="mt-5 space-y-2">
              {completionItems.map((item) => (
                <p key={item.label} className="flex items-center gap-2 text-sm text-zinc-300">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      item.complete ? "bg-emerald-500 text-white" : "bg-zinc-700 text-zinc-400"
                    }`}
                  >
                    {item.complete ? <Check size={13} /> : null}
                  </span>
                  {item.label}
                </p>
              ))}
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            <CircleAlert className="mt-0.5 shrink-0" size={20} />
            <p>{errorMessage}</p>
          </div>
        )}

        {message && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            <BadgeCheck className="mt-0.5 shrink-0" size={20} />
            <p>{message}</p>
          </div>
        )}

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            <SectionCard
              icon={<BriefcaseBusiness size={22} />}
              title="Identité commerciale"
              description="Ces informations présentent ton activité à tous les clients."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="businessName"
                  label="Nom commercial (facultatif)"
                  value={businessName}
                  onChange={setBusinessName}
                  placeholder={`${studio.profile.firstName} Services`}
                />
                <Field
                  id="experience"
                  label="Années d’expérience"
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
                  label="Titre de ta fiche"
                  value={headline}
                  onChange={setHeadline}
                  placeholder="Exemple : Prestataire fiable et ponctuel à Bruxelles"
                />
                <Counter current={headline.length} maximum={120} />
              </div>

              <div className="mt-5">
                <label htmlFor="bio" className="mb-2 block text-sm font-medium text-zinc-300">
                  Présentation générale
                </label>
                <textarea
                  id="bio"
                  rows={7}
                  maxLength={2000}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Présente ton expérience, ta méthode de travail et ce qui rassurera tes futurs clients."
                  className={inputClassName()}
                />
                <Counter current={bio.length} maximum={2000} minimum={60} />
              </div>
            </SectionCard>

            <SectionCard
              icon={<BriefcaseBusiness size={22} />}
              title="Services proposés"
              description="Active les métiers et services que tu souhaites réellement proposer sur KLYX."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {services.map((service) => (
                  <button
                    key={service.serviceId}
                    type="button"
                    onClick={() => toggleService(service.serviceId)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      service.enabled
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {serviceLabel(service.slug, service.name)}
                      </span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          service.enabled ? "bg-violet-500" : "bg-zinc-800"
                        }`}
                      >
                        {service.enabled ? <Check size={15} /> : <Plus size={15} />}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      {service.enabled ? "Activé" : "Cliquer pour ajouter"}
                    </p>
                  </button>
                ))}
              </div>

              {enabledServices.length > 0 && (
                <div className="mt-7 border-t border-zinc-800 pt-7">
                  <div className="mb-6 flex flex-wrap gap-2">
                    {enabledServices.map((service) => (
                      <button
                        key={service.serviceId}
                        type="button"
                        onClick={() => setSelectedServiceId(service.serviceId)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          selectedServiceId === service.serviceId
                            ? "bg-white text-black"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        }`}
                      >
                        {serviceLabel(service.slug, service.name)}
                      </button>
                    ))}
                  </div>

                  {selectedService?.enabled && (
                    <ServiceEditor
                      service={selectedService}
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
                      onRemoveZone={(zone) => removeZone(selectedService.serviceId, zone)}
                    />
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<ImagePlus size={22} />}
              title="Galerie photos"
              description="Ajoute jusqu’à huit photos de tes réalisations ou de ton environnement de travail."
            >
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 px-6 py-10 text-center transition hover:border-violet-500 hover:bg-violet-500/5">
                {uploadingGallery ? (
                  <LoaderCircle className="animate-spin text-violet-400" size={32} />
                ) : (
                  <ImagePlus className="text-violet-400" size={32} />
                )}
                <span className="mt-3 font-semibold">
                  {uploadingGallery ? "Envoi en cours..." : "Ajouter une photo"}
                </span>
                <span className="mt-1 text-sm text-zinc-500">JPG, PNG ou WEBP · 6 Mo maximum</span>
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
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
                    >
                      <img
                        src={item.publicUrl}
                        alt={item.caption || "Photo du prestataire"}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => void deleteMedia("gallery", item.id)}
                        className="absolute right-2 top-2 rounded-full bg-black/75 p-2 text-white opacity-100 transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Supprimer cette photo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </figure>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<FileCheck2 size={22} />}
              title="Documents obligatoires"
              description="Les documents restent privés. Ils servent uniquement à la vérification KLYX."
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <KlyxSelect
                  value={documentType}
                  onChange={setDocumentType}
                  options={DOCUMENT_TYPES.map((type) => ({
                    value: type.value,
                    label: type.label,
                  }))}
                  ariaLabel="Type de document"
                />

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold transition hover:bg-violet-700">
                  {uploadingDocument ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <Upload size={18} />
                  )}
                  {uploadingDocument ? "Envoi..." : "Transmettre"}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingDocument}
                    onChange={handleDocumentUpload}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-zinc-500">PDF, JPG, PNG ou WEBP · 10 Mo maximum</p>

              <div className="mt-5 space-y-3">
                {studio.documents.length === 0 ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
                    Une pièce d’identité est nécessaire avant la publication.
                  </div>
                ) : (
                  studio.documents.map((document) => {
                    const type = DOCUMENT_TYPES.find(
                      (item) => item.value === document.documentType
                    );
                    const status = DOCUMENT_STATUS[document.status] ?? DOCUMENT_STATUS.pending;

                    return (
                      <div
                        key={document.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{type?.label ?? "Document"}</p>
                          <p className="mt-1 truncate text-sm text-zinc-500">
                            {document.fileName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => void deleteMedia("document", document.id)}
                            className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300"
                            aria-label="Supprimer ce document"
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

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-bold">Publication</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Enregistrer conserve un brouillon privé. Publier rend les services actifs dans la recherche.
              </p>

              <button
                type="button"
                onClick={() => void saveStudio(false)}
                disabled={saving}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 font-semibold transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
                Enregistrer le brouillon
              </button>

              <button
                type="button"
                onClick={() => void saveStudio(true)}
                disabled={saving}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-semibold transition hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
                {studio.providerProfile.isPublished ? "Mettre à jour la fiche" : "Publier ma fiche"}
              </button>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="font-bold">Résumé</h2>
              <div className="mt-4 space-y-4 text-sm">
                <SummaryRow label="Services actifs" value={String(enabledServices.length)} />
                <SummaryRow label="Photos" value={`${studio.gallery.length}/8`} />
                <SummaryRow label="Documents" value={String(studio.documents.length)} />
                <SummaryRow
                  label="Vérification"
                  value={
                    studio.providerProfile.verificationStatus === "verified"
                      ? "Vérifiée"
                      : studio.providerProfile.verificationStatus === "pending"
                        ? "En cours"
                        : "À transmettre"
                  }
                />
              </div>
            </div>

            <Link
              href="/profile"
              className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700 hover:bg-zinc-800"
            >
              <div>
                <p className="font-semibold">Informations personnelles</p>
                <p className="mt-1 text-sm text-zinc-500">Photo, nom et ville</p>
              </div>
              <ChevronRight size={20} className="text-zinc-500" />
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ServiceEditor({
  service,
  zoneInput,
  onZoneInput,
  onChange,
  onAvailabilityChange,
  onAddZone,
  onRemoveZone,
}: {
  service: ProviderServiceDraft;
  zoneInput: string;
  onZoneInput: (value: string) => void;
  onChange: (changes: Partial<ProviderServiceDraft>) => void;
  onAvailabilityChange: (day: number, changes: Partial<AvailabilityDay>) => void;
  onAddZone: () => void;
  onRemoveZone: (zone: string) => void;
}) {
  return (
    <div className="space-y-7 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-400">
          {serviceLabel(service.slug, service.name)}
        </p>
        <h3 className="mt-2 text-xl font-bold">Configurer ce service</h3>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={`title-${service.serviceId}`}
          label="Titre du service"
          value={service.title}
          onChange={(value) => onChange({ title: value })}
          placeholder="Un titre précis et rassurant"
        />
        <Field
          id={`city-${service.serviceId}`}
          label="Ville principale"
          value={service.city}
          onChange={(value) => onChange({ city: value })}
          placeholder="Bruxelles"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Description du service
        </label>
        <textarea
          rows={5}
          maxLength={1200}
          value={service.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Explique ce que tu proposes, ce qui est inclus et comment tu travailles."
          className={inputClassName()}
        />
        <Counter current={service.description.length} maximum={1200} minimum={30} />
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Tarif utilisé pour ce service
          </label>
          <div className="grid min-w-0 grid-cols-2 rounded-xl border border-zinc-700 bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => onChange({ pricingType: "hourly", price: service.hourlyPrice })}
              className={`min-w-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                service.pricingType === "hourly" ? "bg-white text-black" : "text-zinc-400"
              }`}
            >
              Par heure
            </button>
            <button
              type="button"
              onClick={() => onChange({ pricingType: "fixed", price: service.fixedPrice })}
              className={`min-w-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                service.pricingType === "fixed" ? "bg-white text-black" : "text-zinc-400"
              }`}
            >
              Prix fixe
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Les deux montants restent mémorisés. Le bouton choisit seulement le tarif actif.
          </p>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-zinc-300">Tarif par heure (€)</label>
            <div className="relative min-w-0">
              <Euro className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="number"
                min="1"
                max="10000"
                step="0.01"
                inputMode="decimal"
                value={service.hourlyPrice ?? ""}
                onChange={(event) => {
                  const hourlyPrice = event.target.value === "" ? null : Number(event.target.value);
                  onChange({
                    hourlyPrice,
                    price: service.pricingType === "hourly" ? hourlyPrice : service.price,
                  });
                }}
                className={`${inputClassName()} min-w-0 pl-11`}
                placeholder="25"
              />
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-zinc-300">Prix fixe (€)</label>
            <div className="relative min-w-0">
              <Euro className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="number"
                min="1"
                max="10000"
                step="0.01"
                inputMode="decimal"
                value={service.fixedPrice ?? ""}
                onChange={(event) => {
                  const fixedPrice = event.target.value === "" ? null : Number(event.target.value);
                  onChange({
                    fixedPrice,
                    price: service.pricingType === "fixed" ? fixedPrice : service.price,
                  });
                }}
                className={`${inputClassName()} min-w-0 pl-11`}
                placeholder="100"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-6">
        <div className="flex items-center gap-2">
          <MapPin size={19} className="text-violet-400" />
          <h3 className="font-bold">Zones d’intervention</h3>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Ajoute les communes et quartiers dans lesquels tu acceptes des demandes.
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
            placeholder="Exemple : Bruxelles, Ixelles..."
            className={inputClassName()}
          />
          <button
            type="button"
            onClick={onAddZone}
            className="shrink-0 rounded-xl bg-zinc-800 px-4 font-semibold hover:bg-zinc-700"
          >
            <Plus size={19} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {service.serviceArea.map((zone) => (
            <span
              key={zone}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-200"
            >
              {zone}
              <button type="button" onClick={() => onRemoveZone(zone)} aria-label={`Retirer ${zone}`}>
                <X size={14} />
              </button>
            </span>
          ))}
        </div>

        <div className="mt-5 max-w-xs">
          <Field
            id={`radius-${service.serviceId}`}
            label="Rayon maximum (km)"
            value={String(service.travelRadiusKm)}
            onChange={(value) => onChange({ travelRadiusKm: Number(value || 0) })}
            type="number"
            min="0"
            max="100"
          />
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-6">
        <div className="flex items-center gap-2">
          <Clock3 size={19} className="text-violet-400" />
          <h3 className="font-bold">Disponibilités hebdomadaires</h3>
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
                className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:grid-cols-[130px_1fr_1fr] sm:items-center"
              >
                <label className="flex items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(event) =>
                      onAvailabilityChange(day.dayOfWeek, { enabled: event.target.checked })
                    }
                    className="h-5 w-5 accent-violet-600"
                  />
                  {definition.label}
                </label>
                <input
                  type="time"
                  value={day.startTime}
                  disabled={!day.enabled}
                  onChange={(event) =>
                    onAvailabilityChange(day.dayOfWeek, { startTime: event.target.value })
                  }
                  className={inputClassName()}
                />
                <input
                  type="time"
                  value={day.endTime}
                  disabled={!day.enabled}
                  onChange={(event) =>
                    onAvailabilityChange(day.dayOfWeek, { endTime: event.target.value })
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
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-8">
      <div className="mb-7 flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
          {icon}
        </span>
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
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
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-zinc-300">
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
}: {
  current: number;
  maximum: number;
  minimum?: number;
}) {
  return (
    <p className={`mt-2 text-right text-xs ${minimum && current < minimum ? "text-amber-400" : "text-zinc-500"}`}>
      {minimum && current < minimum ? `Minimum ${minimum} · ` : ""}
      {current}/{maximum}
    </p>
  );
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        published
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${published ? "bg-emerald-400" : "bg-amber-400"}`} />
      {published ? "Fiche publiée" : "Brouillon privé"}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold text-zinc-200">{value}</span>
    </div>
  );
}



