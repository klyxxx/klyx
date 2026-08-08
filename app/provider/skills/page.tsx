"use client";

import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  FileCheck2,
  FileText,
  GraduationCap,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveClientProfile } from "@/lib/account-switcher";

type ProofType =
  | "diploma"
  | "training_certificate"
  | "professional_license"
  | "insurance"
  | "experience_reference"
  | "portfolio"
  | "other";

type SkillDocument = {
  id: string;
  proof_type: ProofType;
  original_name: string;
  status: string;
  rejection_reason: string | null;
  uploaded_at: string;
};

type Skill = {
  userServiceId: string;
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  active: boolean;
  providerEnabled: boolean;
  verification: {
    id: string;
    status: string;
    provider_statement: string | null;
    years_experience: number | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    review_note: string | null;
    documents: SkillDocument[];
  } | null;
};

const PROOFS: Array<{
  value: ProofType;
  label: string;
}> = [
  { value: "diploma", label: "Diplôme" },
  {
    value: "training_certificate",
    label: "Certificat de formation",
  },
  {
    value: "professional_license",
    label: "Licence ou autorisation professionnelle",
  },
  {
    value: "insurance",
    label: "Assurance professionnelle",
  },
  {
    value: "experience_reference",
    label: "Référence d’expérience",
  },
  {
    value: "portfolio",
    label: "Portfolio / preuve de réalisations",
  },
  {
    value: "other",
    label: "Autre justificatif",
  },
];

const STATUS: Record<string, string> = {
  not_started: "À compléter",
  submitted: "Envoyée",
  under_review: "En vérification",
  approved: "Compétence vérifiée",
  changes_required: "Corrections demandées",
  rejected: "Refusée",
};

function safeFileName(name: string) {
  const extension = name.includes(".")
    ? name.split(".").pop()?.toLowerCase() ?? "file"
    : "file";

  return `${crypto.randomUUID()}.${extension.replace(
    /[^a-z0-9]/g,
    ""
  )}`;
}

export default function ProviderSkillsPage() {
  const [profileId, setProfileId] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [proofTypes, setProofTypes] = useState<
    Record<string, ProofType>
  >({});
  const [statements, setStatements] = useState<
    Record<string, string>
  >({});
  const [years, setYears] = useState<
    Record<string, number>
  >({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function token() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const profile =
        await getActiveClientProfile();
      setProfileId(profile.id);

      const accessToken = await token();

      const response = await fetch(
        "/api/provider/skills-verification",
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const body = (await response.json()) as {
        skills?: Skill[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Chargement impossible."
        );
      }

      const nextSkills = body.skills ?? [];
      setSkills(nextSkills);

      setStatements(
        Object.fromEntries(
          nextSkills.map((skill) => [
            skill.userServiceId,
            skill.verification
              ?.provider_statement ?? "",
          ])
        )
      );

      setYears(
        Object.fromEntries(
          nextSkills.map((skill) => [
            skill.userServiceId,
            Number(
              skill.verification
                ?.years_experience ?? 0
            ),
          ])
        )
      );

      setProofTypes((current) => ({
        ...Object.fromEntries(
          nextSkills.map((skill) => [
            skill.userServiceId,
            current[skill.userServiceId] ??
              "training_certificate",
          ])
        ),
      }));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Chargement impossible."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function upload(
    skill: Skill,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !profileId) return;

    setBusy(skill.userServiceId);
    setError("");
    setMessage("");

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(
          "Le fichier dépasse 10 Mo."
        );
      }

      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ].includes(file.type)
      ) {
        throw new Error(
          "Utilise un PDF, JPG, PNG ou WEBP."
        );
      }

      const path =
        `${profileId}/skills/${skill.userServiceId}/${safeFileName(file.name)}`;

      const { error: uploadError } =
        await supabase.storage
          .from("provider-verification")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const accessToken = await token();

      const response = await fetch(
        "/api/provider/skills-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            userServiceId:
              skill.userServiceId,
            proofType:
              proofTypes[
                skill.userServiceId
              ] ?? "training_certificate",
            storagePath: path,
            originalName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        await supabase.storage
          .from("provider-verification")
          .remove([path]);

        throw new Error(
          body.error ||
            "Enregistrement impossible."
        );
      }

      setMessage(
        body.message || "Preuve ajoutée."
      );

      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Envoi impossible."
      );
    } finally {
      setBusy(null);
    }
  }

  async function save(
    skill: Skill,
    submit: boolean
  ) {
    setBusy(skill.userServiceId);
    setError("");
    setMessage("");

    try {
      const accessToken = await token();

      const response = await fetch(
        "/api/provider/skills-verification",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            userServiceId:
              skill.userServiceId,
            providerStatement:
              statements[
                skill.userServiceId
              ] ?? "",
            yearsExperience:
              years[skill.userServiceId] ?? 0,
            submit,
          }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Action impossible."
        );
      }

      setMessage(
        body.message ||
          "Informations enregistrées."
      );

      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Action impossible."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/provider"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
        >
          <ArrowLeft size={17} />
          Mon activité
        </Link>

        <section className="mt-6 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <GraduationCap size={15} />
            Confiance KLYX
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Mes compétences
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Tu peux proposer autant de métiers que tu
            maîtrises. Chaque métier possède son propre
            dossier de preuves et sa propre validation KLYX.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
          <div className="flex gap-3">
            <ShieldCheck
              size={21}
              className="shrink-0 text-blue-600"
            />
            <div>
              <p className="font-black">
                Une compétence est vérifiée séparément
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Selon le métier, une preuve peut être un
                diplôme, une formation, une licence,
                une assurance, une référence
                professionnelle ou un portfolio. KLYX
                demandera ensuite les justificatifs
                obligatoires adaptés aux activités
                réglementées.
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-600">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-600">
            {message}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-black"
          >
            <RefreshCw size={17} />
            Actualiser
          </button>
        </div>

        {loading ? (
          <div className="klyx-card mt-6 grid min-h-56 place-items-center">
            <LoaderCircle
              size={38}
              className="animate-spin"
            />
          </div>
        ) : skills.length === 0 ? (
          <section className="klyx-card mt-6 p-8 text-center">
            <BriefcaseBusiness
              size={34}
              className="mx-auto text-muted-foreground"
            />
            <h2 className="mt-4 text-xl font-black">
              Aucun métier ajouté
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajoute d'abord un métier dans ton activité.
            </p>
            <Link
              href="/provider/services/new"
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white"
            >
              Ajouter un métier
            </Link>
          </section>
        ) : (
          <section className="mt-6 grid gap-5">
            {skills.map((skill) => {
              const verification =
                skill.verification;
              const status =
                verification?.status ??
                "not_started";
              const locked = [
                "submitted",
                "under_review",
                "approved",
              ].includes(status);

              return (
                <article
                  key={skill.userServiceId}
                  className="klyx-card p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
                        {status === "approved" ? (
                          <BadgeCheck size={23} />
                        ) : (
                          <BriefcaseBusiness
                            size={22}
                          />
                        )}
                      </span>

                      <div>
                        <h2 className="text-xl font-black">
                          {skill.serviceName}
                        </h2>
                        <p className="mt-1 text-sm font-bold text-muted-foreground">
                          {STATUS[status] ??
                            status}
                        </p>

                        {verification?.review_note && (
                          <p className="mt-3 max-w-2xl rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                            {verification.review_note}
                          </p>
                        )}
                      </div>
                    </div>

                    {status === "approved" && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-600">
                        <CheckCircle2
                          size={17}
                        />
                        Compétence vérifiée
                      </span>
                    )}
                  </div>

                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-black">
                        Années d'expérience
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        disabled={locked}
                        value={
                          years[
                            skill.userServiceId
                          ] ?? 0
                        }
                        onChange={(event) =>
                          setYears((current) => ({
                            ...current,
                            [skill.userServiceId]:
                              Number(
                                event.target.value
                              ),
                          }))
                        }
                        className="klyx-input mt-2"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-black">
                        Type de preuve
                      </span>
                      <select
                        disabled={locked}
                        value={
                          proofTypes[
                            skill.userServiceId
                          ] ??
                          "training_certificate"
                        }
                        onChange={(event) =>
                          setProofTypes(
                            (current) => ({
                              ...current,
                              [skill.userServiceId]:
                                event.target
                                  .value as ProofType,
                            })
                          )
                        }
                        className="klyx-input mt-2"
                      >
                        {PROOFS.map((proof) => (
                          <option
                            key={proof.value}
                            value={proof.value}
                          >
                            {proof.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-5 block">
                    <span className="text-sm font-black">
                      Explique ton expérience pour ce métier
                    </span>
                    <textarea
                      rows={4}
                      disabled={locked}
                      value={
                        statements[
                          skill.userServiceId
                        ] ?? ""
                      }
                      onChange={(event) =>
                        setStatements(
                          (current) => ({
                            ...current,
                            [skill.userServiceId]:
                              event.target.value,
                          })
                        )
                      }
                      className="klyx-input mt-2 resize-y"
                      placeholder="Formation, années d'expérience, types de missions réalisées..."
                    />
                  </label>

                  <div className="mt-5">
                    <p className="text-sm font-black">
                      Preuves ajoutées
                    </p>

                    {!verification ||
                    verification.documents.length ===
                      0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Aucune preuve pour ce métier.
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {verification.documents.map(
                          (document) => (
                            <div
                              key={document.id}
                              className="flex items-center gap-3 rounded-xl border border-border p-3"
                            >
                              <FileText
                                size={17}
                                className="text-violet-600"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black">
                                  {
                                    document.original_name
                                  }
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {PROOFS.find(
                                    (proof) =>
                                      proof.value ===
                                      document.proof_type
                                  )?.label ??
                                    document.proof_type}
                                  {" · "}
                                  {document.status}
                                </p>
                              </div>
                              <FileCheck2
                                size={18}
                                className="text-muted-foreground"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {!locked && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm font-black">
                        {busy ===
                        skill.userServiceId ? (
                          <LoaderCircle
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <Upload size={17} />
                        )}
                        Ajouter une preuve
                        <input
                          type="file"
                          hidden
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          disabled={
                            busy ===
                            skill.userServiceId
                          }
                          onChange={(event) =>
                            void upload(
                              skill,
                              event
                            )
                          }
                        />
                      </label>

                      <button
                        type="button"
                        disabled={
                          busy ===
                          skill.userServiceId
                        }
                        onClick={() =>
                          void save(
                            skill,
                            false
                          )
                        }
                        className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-black"
                      >
                        Enregistrer
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy ===
                          skill.userServiceId
                        }
                        onClick={() =>
                          void save(skill, true)
                        }
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white"
                      >
                        <Send size={17} />
                        Envoyer à KLYX
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
