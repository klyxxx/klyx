"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  ImageIcon,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { getActiveClientProfile } from "@/lib/account-switcher";
import { supabase } from "@/lib/supabase";

// KLYX_PREMIUM_PHOTO_ASSISTANT_16_01
// KLYX_ASSISTANT_PHOTO_ATTACHMENT_RENDER_16_07

type Candidate = {
  slug: string;
  label: string;
  confidence: number;
  reason: string;
};

type Analysis = {
  serviceSlug: string | null;
  serviceLabel: string | null;
  candidates: Candidate[];
  summary: string;
  limitations: string;
  analysisMode: "description_assisted" | "vision_ai";
  visionConfidence: number | null;
  visionContributed: boolean;
};

function safeFileName(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase() || "jpg";

  return `${crypto.randomUUID()}.${extension.replace(/[^a-z0-9]/g, "")}`;
}

async function imageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      URL.revokeObjectURL(url);
    };

    image.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };

    image.src = url;
  });
}

export default function PhotoRequestPage() {
  const router = useRouter();

  const [profileId, setProfileId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [description, setDescription] = useState("");
  const [useVision, setUseVision] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [requestId, setRequestId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getActiveClientProfile();
        setProfileId(profile.id);
      } catch {
        setErrorMessage("Profil client introuvable pour le moment.");
      }
    }

    void loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";

    if (!selected) return;

    setErrorMessage("");
    setAnalysis(null);
    setRequestId("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setErrorMessage("Utilise une image JPG, PNG ou WEBP.");
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setErrorMessage("La photo dépasse la limite de 10 Mo.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();

    if (!file || !profileId || description.trim().length < 10) return;

    setUploading(true);
    setErrorMessage("");
    setAnalysis(null);

    let uploadedPath = "";

    try {
      const dimensions = await imageDimensions(file);
      uploadedPath = `${profileId}/${safeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from("client-service-photos")
        .upload(uploadedPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw new Error("Photo upload unavailable");

      const accessToken = await token();
      const response = await fetch(
        "/api/requests/photo",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            storagePath: uploadedPath,
            originalName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            width: dimensions.width,
            height: dimensions.height,
            description,
            useVision,
          }),
        }
      );

      const body = (await response.json()) as {
        requestId?: string;
        analysis?: Analysis;
      };

      if (!response.ok || !body.requestId || !body.analysis) {
        await supabase.storage
          .from("client-service-photos")
          .remove([uploadedPath]);

        throw new Error("Photo analysis unavailable");
      }

      setRequestId(body.requestId);
      setAnalysis(body.analysis);
    } catch {
      if (uploadedPath) {
        await supabase.storage
          .from("client-service-photos")
          .remove([uploadedPath]);
      }
      setErrorMessage("KLYX ne peut pas analyser cette photo pour le moment.");
    } finally {
      setUploading(false);
    }
  }

  function openSearch(serviceSlug?: string) {
    const slug = serviceSlug ?? analysis?.serviceSlug;
    if (!slug) return;

    const params = new URLSearchParams({
      service: slug,
      q: description.trim().slice(0, 240),
    });

    router.push(`/search?${params.toString()}`);
  }

  async function deletePhoto() {
    if (!requestId) {
      setFile(null);
      setAnalysis(null);
      setDescription("");

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
      return;
    }

    setDeleting(true);
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch(
        "/api/requests/photo",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ requestId }),
        }
      );

      if (!response.ok) {
        throw new Error("Photo deletion unavailable");
      }

      setFile(null);
      setAnalysis(null);
      setRequestId("");
      setDescription("");

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
    } catch {
      setErrorMessage("KLYX ne peut pas supprimer cette photo pour le moment.");
    } finally {
      setDeleting(false);
    }
  }

  const ready = Boolean(
    file && profileId && description.trim().length >= 10 && !uploading
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/assistant"
          className="inline-flex h-9 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Assistant KLYX
        </Link>

        <header className="mx-auto max-w-2xl pb-7 pt-6 text-center sm:pt-10">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
            <Sparkles size={21} />
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Montre-moi ce qu’il faut faire.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Ajoute une photo et quelques mots. KLYX garde l’image entière visible et t’aide à identifier le bon métier.
          </p>
        </header>

        <form
          onSubmit={analyze}
          className="overflow-hidden rounded-[26px] border border-border bg-background shadow-sm dark:border-white/10 dark:bg-zinc-950"
        >
          <div className="border-b border-border p-4 dark:border-white/10 sm:p-5">
            {!previewUrl ? (
              <label className="group grid min-h-52 cursor-pointer place-items-center rounded-[22px] border border-dashed border-border bg-muted/20 p-6 text-center transition hover:border-[#2563EB]/35 hover:bg-[#2563EB]/[0.035] dark:border-white/10">
                <div>
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB] transition group-hover:scale-105">
                    <Upload size={20} />
                  </span>
                  <p className="mt-3 text-sm font-bold">Ajouter une photo</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    JPG, PNG ou WEBP · 10 Mo max
                  </p>
                </div>
                <input
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseFile}
                />
              </label>
            ) : (
              <div className="overflow-hidden rounded-[22px] border border-border bg-muted/20 dark:border-white/10 dark:bg-white/[0.025]">
                <div className="relative flex min-h-56 items-center justify-center p-3 sm:min-h-72 sm:p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Aperçu du problème"
                    className="max-h-[420px] max-w-full rounded-[18px] object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => void deletePhoto()}
                    disabled={deleting || uploading}
                    className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:bg-muted disabled:opacity-50 dark:border-white/10 dark:bg-zinc-950/90"
                    aria-label="Supprimer la photo"
                  >
                    {deleting ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>

                <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border px-3 py-2.5 dark:border-white/10 sm:px-4">
                  <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                    {file?.name}
                  </span>
                  <label className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#2563EB] transition hover:bg-[#2563EB]/[0.06]">
                    Remplacer
                    <input
                      type="file"
                      hidden
                      accept="image/jpeg,image/png,image/webp"
                      onChange={chooseFile}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5">
            <label htmlFor="klyx-photo-description" className="text-xs font-bold text-muted-foreground">
              Explique le besoin
            </label>
            <textarea
              id="klyx-photo-description"
              rows={5}
              minLength={10}
              maxLength={1500}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setAnalysis(null);
              }}
              className="mt-2 min-h-32 w-full resize-none bg-transparent text-base leading-7 outline-none placeholder:text-muted-foreground/70"
              placeholder="Ex. Il y a une fuite sous l’évier et je ne sais pas quel professionnel appeler."
            />
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>{description.trim().length}/1500</span>
              <span>10 caractères minimum</span>
            </div>
          </div>

          <div className="border-t border-border px-4 py-3 dark:border-white/10 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-1 py-1">
                <input
                  type="checkbox"
                  checked={useVision}
                  onChange={(event) => {
                    setUseVision(event.target.checked);
                    setAnalysis(null);
                  }}
                  className="peer sr-only"
                />
                <span className="relative h-6 w-11 shrink-0 rounded-full bg-muted transition peer-checked:bg-[#2563EB] after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5 dark:bg-white/[0.10]" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold">
                    <Eye size={14} className="text-[#2563EB]" />
                    Autoriser l’analyse visuelle IA de cette photo
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                    Autorisation valable uniquement pour cette photo. Sans accord, KLYX utilise uniquement ta description.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={!ready}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {uploading ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : useVision ? (
                  <Eye size={17} />
                ) : (
                  <Search size={17} />
                )}
                {uploading
                  ? "Analyse en cours…"
                  : useVision
                    ? "Analyser avec KLYX"
                    : "Analyser la demande"}
              </button>
            </div>

            <div className="mt-3 flex items-start gap-2 border-t border-border/60 pt-3 text-[10px] leading-4 text-muted-foreground dark:border-white/10">
              <LockKeyhole size={13} className="mt-0.5 shrink-0" />
              <p>
                Photo privée. Évite les visages, pièces d’identité, plaques et informations personnelles visibles.
              </p>
            </div>
          </div>
        </form>

        {errorMessage && (
          <div
            role="alert"
            className="mx-auto mt-4 max-w-3xl rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300"
          >
            {errorMessage}
          </div>
        )}

        {analysis && (
          <section className="mx-auto mt-8 max-w-3xl pb-10">
            {previewUrl && (
              <div className="mb-7 flex justify-end">
                <div className="w-full max-w-md">
                  <div className="overflow-hidden rounded-2xl border border-border bg-muted/20 dark:border-white/10 dark:bg-white/[0.025]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Photo envoyée à KLYX"
                      className="max-h-72 w-full object-contain"
                    />
                  </div>
                  <p className="mt-2 rounded-2xl rounded-tr-md bg-[#2563EB] px-4 py-3 text-sm leading-6 text-white">
                    {description.trim()}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 sm:gap-4">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#2563EB] text-white">
                <Sparkles size={17} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">KLYX</p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground dark:border-white/10">
                    {analysis.analysisMode === "vision_ai" ? (
                      <Eye size={11} />
                    ) : (
                      <CheckCircle2 size={11} />
                    )}
                    {analysis.analysisMode === "vision_ai"
                      ? "Vision KLYX"
                      : "Analyse de la description"}
                  </span>
                </div>

                <p className="mt-3 text-base leading-7 text-foreground/90">
                  {analysis.summary}
                </p>

                {analysis.analysisMode === "vision_ai" &&
                  analysis.visionConfidence != null && (
                    <div className="mt-4 rounded-2xl border border-[#2563EB]/15 bg-[#2563EB]/[0.045] p-4">
                      <p className="text-xs font-bold text-foreground">
                        Confiance des indices visuels : {analysis.visionConfidence} %
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {analysis.visionContributed
                          ? "Les indices visuels ont contribué au classement des métiers proposés."
                          : "Les indices visuels n’étaient pas assez fiables pour modifier le classement des métiers."}
                      </p>
                    </div>
                  )}

                {analysis.serviceLabel && (
                  <div className="mt-4 rounded-2xl border border-border bg-card/65 p-4 dark:border-white/8 dark:bg-white/[0.025]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      Service recommandé
                    </p>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-bold">{analysis.serviceLabel}</p>

                      {analysis.serviceSlug && (
                        <button
                          type="button"
                          onClick={() => openSearch()}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background transition hover:opacity-90"
                        >
                          Voir les prestataires
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {analysis.candidates.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      Compatibilité KLYX
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {analysis.candidates.slice(0, 4).map((candidate) => (
                        <button
                          key={candidate.slug}
                          type="button"
                          onClick={() => openSearch(candidate.slug)}
                          className="rounded-2xl border border-border bg-background px-3 py-3 text-left text-xs transition hover:border-[#2563EB]/30 hover:bg-[#2563EB]/[0.05] dark:border-white/10"
                          title={candidate.reason}
                        >
                          <span className="flex items-center justify-between gap-3 font-semibold">
                            <span className="inline-flex items-center gap-2">
                              <ImageIcon size={13} />
                              {candidate.label}
                            </span>
                            <span className="text-muted-foreground">
                              {candidate.confidence} %
                            </span>
                          </span>
                          <span className="mt-1.5 block leading-5 text-muted-foreground">
                            {candidate.reason}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  <p>{analysis.limitations}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mx-auto mt-6 flex max-w-3xl items-start gap-2 pb-8 text-xs leading-6 text-muted-foreground">
          <ShieldCheck className="mt-1 shrink-0" size={15} />
          <p>
            La vision n’est utilisée que si tu l’autorises pour cette photo. L’analyse aide à choisir un service : elle ne publie, ne réserve et ne paie rien automatiquement.
          </p>
        </div>
      </div>
    </main>
  );
}
