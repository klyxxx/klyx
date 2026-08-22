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
  Camera,
  CheckCircle2,
  Eye,
  ImageIcon,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile } from "@/lib/account-switcher";

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
  const extension =
    name.split(".").pop()?.toLowerCase() || "jpg";

  return `${crypto.randomUUID()}.${extension.replace(
    /[^a-z0-9]/g,
    ""
  )}`;
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
  const [analysis, setAnalysis] =
    useState<Analysis | null>(null);
  const [requestId, setRequestId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile =
          await getActiveClientProfile();
        setProfileId(profile.id);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Profil client introuvable."
        );
      }
    }

    void loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
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

  function chooseFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selected = event.target.files?.[0];
    event.target.value = "";

    if (!selected) return;

    setErrorMessage("");
    setAnalysis(null);
    setRequestId("");

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(selected.type)
    ) {
      setErrorMessage(
        "Utilise une image JPG, PNG ou WEBP."
      );
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setErrorMessage(
        "La photo dépasse la limite de 10 Mo."
      );
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();

    if (
      !file ||
      !profileId ||
      description.trim().length < 10
    ) {
      return;
    }

    setUploading(true);
    setErrorMessage("");
    setAnalysis(null);

    let uploadedPath = "";

    try {
      const dimensions =
        await imageDimensions(file);
      uploadedPath =
        `${profileId}/${safeFileName(file.name)}`;

      const { error: uploadError } =
        await supabase.storage
          .from("client-service-photos")
          .upload(uploadedPath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

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
        error?: string;
      };

      if (
        !response.ok ||
        !body.requestId ||
        !body.analysis
      ) {
        await supabase.storage
          .from("client-service-photos")
          .remove([uploadedPath]);

        throw new Error(
          body.error || "Analyse impossible."
        );
      }

      setRequestId(body.requestId);
      setAnalysis(body.analysis);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Analyse impossible."
      );
    } finally {
      setUploading(false);
    }
  }

  function openSearch(serviceSlug?: string) {
    const slug =
      serviceSlug ?? analysis?.serviceSlug;

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

      const body = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Suppression impossible."
        );
      }

      setFile(null);
      setAnalysis(null);
      setRequestId("");
      setDescription("");

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Suppression impossible."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/request"
          className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground"
        >
          <ArrowLeft size={17} />
          Recherche universelle
        </Link>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#263b68_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Camera size={15} />
            Recherche par photo client
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Montre le problème à KLYX
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Ajoute une photo privée et décris brièvement le
            besoin. Tu peux ensuite autoriser KLYX à analyser
            réellement le contenu visuel pour proposer le métier
            le plus pertinent.
          </p>
        </section>

        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <LockKeyhole
            className="mt-0.5 shrink-0 text-amber-600"
            size={21}
          />
          <div>
            <p className="font-black">
              Photo privée
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Évite les visages, documents d’identité,
              plaques d’immatriculation et informations
              personnelles visibles. L’analyse visuelle est
              optionnelle et doit être autorisée pour chaque photo.
            </p>
          </div>
        </div>

        <form
          onSubmit={analyze}
          className="klyx-card mt-8 p-6 sm:p-8"
        >
          {!previewUrl ? (
            <label className="grid min-h-72 cursor-pointer place-items-center rounded-[2rem] border-2 border-dashed border-border bg-background/50 p-8 text-center transition hover:border-violet-500">
              <div>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
                  <Upload size={28} />
                </span>
                <p className="mt-5 text-lg font-black">
                  Choisir une photo
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  JPG, PNG ou WEBP · maximum 10 Mo
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
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Aperçu du problème"
                className="max-h-[32rem] w-full object-contain"
              />

              <button
                type="button"
                onClick={() => void deletePhoto()}
                disabled={deleting || uploading}
                className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-xl bg-black/70 text-white backdrop-blur"
                aria-label="Supprimer la photo"
              >
                {deleting ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={18}
                  />
                ) : (
                  <Trash2 size={18} />
                )}
              </button>
            </div>
          )}

          <label className="mt-6 block">
            <span className="mb-2 block text-sm font-black">
              Décris brièvement le besoin
            </span>

            <textarea
              rows={5}
              minLength={10}
              maxLength={1500}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setAnalysis(null);
              }}
              className="klyx-input resize-none"
              placeholder="Ex. Le robinet de la cuisine fuit sous l’évier."
            />
          </label>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
            <input
              type="checkbox"
              checked={useVision}
              onChange={(event) => {
                setUseVision(event.target.checked);
                setAnalysis(null);
              }}
              className="mt-1 h-4 w-4 accent-violet-600"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-black">
                <Eye size={18} className="text-violet-600" />
                Autoriser l’analyse visuelle IA de cette photo
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                Si tu coches cette option, KLYX peut transmettre
                cette photo privée au moteur IA configuré pour
                identifier uniquement le type de service utile.
                Si la vision est indisponible, ta description sert
                automatiquement de solution de repli.
              </span>
            </span>
          </label>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={
              uploading ||
              !file ||
              description.trim().length < 10
            }
            className="klyx-button mt-5 w-full"
          >
            {uploading ? (
              <LoaderCircle
                className="animate-spin"
                size={19}
              />
            ) : useVision ? (
              <Eye size={19} />
            ) : (
              <Search size={19} />
            )}
            {uploading
              ? useVision
                ? "KLYX analyse la photo..."
                : "KLYX analyse la description..."
              : useVision
                ? "Analyser la photo avec KLYX"
                : "Analyser ma description"}
          </button>
        </form>

        {analysis && (
          <section className="klyx-card mt-8 p-6 sm:p-8">
            <div className="flex gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                {analysis.analysisMode === "vision_ai" ? (
                  <Eye size={23} />
                ) : (
                  <CheckCircle2 size={23} />
                )}
              </span>

              <div>
                <p className="klyx-eyebrow">
                  {analysis.analysisMode === "vision_ai"
                    ? "Vision KLYX"
                    : "Analyse de la description"}
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {analysis.serviceLabel ??
                    "Service à préciser"}
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {analysis.summary}
                </p>
              </div>
            </div>

            {analysis.analysisMode === "vision_ai" &&
              analysis.visionConfidence != null && (
                <div className="mt-5 flex gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                  <ShieldCheck
                    className="mt-0.5 shrink-0 text-violet-600"
                    size={19}
                  />
                  <div className="text-sm leading-6 text-muted-foreground">
                    <p className="font-black text-foreground">
                      Confiance des indices visuels :{" "}
                      {analysis.visionConfidence} %
                    </p>
                    <p className="mt-1">
                      {analysis.visionContributed
                        ? "Les indices visuels ont contribué au classement des métiers proposés."
                        : "Les indices visuels n’étaient pas assez fiables pour modifier le classement des métiers."}
                    </p>
                  </div>
                </div>
              )}

            <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-muted-foreground">
              {analysis.limitations}
            </div>

            {analysis.candidates.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {analysis.candidates.map(
                  (candidate) => (
                    <button
                      key={candidate.slug}
                      type="button"
                      onClick={() =>
                        openSearch(candidate.slug)
                      }
                      className="rounded-2xl border border-border bg-background p-4 text-left transition hover:border-violet-500"
                    >
                      <p className="font-black">
                        {candidate.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Compatibilité KLYX :{" "}
                        {candidate.confidence} %
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {candidate.reason}
                      </p>
                    </button>
                  )
                )}
              </div>
            )}

            {analysis.serviceSlug && (
              <button
                type="button"
                onClick={() => openSearch()}
                className="klyx-button mt-6 w-full"
              >
                Rechercher ce service
                <ArrowRight size={18} />
              </button>
            )}
          </section>
        )}

        <div className="mt-6 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
          <ImageIcon
            className="mt-1 shrink-0"
            size={15}
          />
          <p>
            La vision n’est utilisée que lorsque tu l’autorises
            pour cette photo et que l’environnement KLYX l’a
            activée. L’analyse classe un besoin de service : elle
            ne publie, ne réserve et ne paie rien automatiquement.
          </p>
        </div>
      </div>
    </main>
  );
}
