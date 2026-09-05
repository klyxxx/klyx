"use client";

import {
  type ChangeEvent,
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

import KlyxSelect from "@/app/components/KlyxSelect";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import SkillRequirementsPanel from "@/app/provider/skills/SkillRequirementsPanel";
import { getActiveClientProfile } from "@/lib/account-switcher";
import {
  translateKlyxProviderSkillDocumentStatus,
  translateKlyxProviderSkillProofType,
  translateKlyxProviderSkills,
  translateKlyxProviderSkillStatus,
  type KlyxProviderSkillsMessageKey,
} from "@/lib/klyx-provider-skills-i18n";
import { supabase } from "@/lib/supabase";

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

const PROOF_TYPES: ProofType[] = [
  "diploma",
  "training_certificate",
  "professional_license",
  "insurance",
  "experience_reference",
  "portfolio",
  "other",
];

function safeFileName(name: string) {
  const extension = name.includes(".")
    ? name.split(".").pop()?.toLowerCase() ?? "file"
    : "file";

  return `${crypto.randomUUID()}.${extension.replace(/[^a-z0-9]/g, "")}`;
}

export default function ProviderSkillsPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderSkillsMessageKey) =>
    translateKlyxProviderSkills(locale, key);

  const proofOptions = PROOF_TYPES.map((proofType) => ({
    value: proofType,
    label: translateKlyxProviderSkillProofType(locale, proofType),
  }));

  const [profileId, setProfileId] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [proofTypes, setProofTypes] = useState<Record<string, ProofType>>({});
  const [statements, setStatements] = useState<Record<string, string>>({});
  const [years, setYears] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requirementsReady, setRequirementsReady] =
    useState<Record<string, boolean>>({});

  function handleRequirementReady(userServiceId: string, ready: boolean) {
    setRequirementsReady((current) => {
      if (current[userServiceId] === ready) {
        return current;
      }

      return {
        ...current,
        [userServiceId]: ready,
      };
    });
  }

  async function token() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("KLYX_PROVIDER_SKILLS_SESSION_MISSING");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const profile = await getActiveClientProfile();
      setProfileId(profile.id);

      const accessToken = await token();
      const response = await fetch("/api/provider/skills-verification", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = (await response.json()) as {
        skills?: Skill[];
      };

      if (!response.ok) {
        throw new Error("KLYX_PROVIDER_SKILLS_LOAD_FAILED");
      }

      const nextSkills = body.skills ?? [];
      setSkills(nextSkills);

      setStatements(
        Object.fromEntries(
          nextSkills.map((skill) => [
            skill.userServiceId,
            skill.verification?.provider_statement ?? "",
          ])
        )
      );

      setYears(
        Object.fromEntries(
          nextSkills.map((skill) => [
            skill.userServiceId,
            Number(skill.verification?.years_experience ?? 0),
          ])
        )
      );

      setProofTypes((current) => ({
        ...Object.fromEntries(
          nextSkills.map((skill) => [
            skill.userServiceId,
            current[skill.userServiceId] ?? "training_certificate",
          ])
        ),
      }));
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Locale changes presentation only and must not repeat provider reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        throw new Error("KLYX_PROVIDER_SKILL_FILE_TOO_LARGE");
      }

      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ].includes(file.type)
      ) {
        throw new Error("KLYX_PROVIDER_SKILL_INVALID_FILE_TYPE");
      }

      const path = `${profileId}/skills/${skill.userServiceId}/${safeFileName(
        file.name
      )}`;

      const { error: uploadError } = await supabase.storage
        .from("provider-verification")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error("KLYX_PROVIDER_SKILL_STORAGE_UPLOAD_FAILED");
      }

      const accessToken = await token();
      const response = await fetch("/api/provider/skills-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userServiceId: skill.userServiceId,
          proofType:
            proofTypes[skill.userServiceId] ?? "training_certificate",
          storagePath: path,
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });

      if (!response.ok) {
        await supabase.storage.from("provider-verification").remove([path]);
        throw new Error("KLYX_PROVIDER_SKILL_DOCUMENT_REGISTER_FAILED");
      }

      setMessage(t("proofAdded"));
      await load();
    } catch (uploadFailure) {
      if (
        uploadFailure instanceof Error &&
        uploadFailure.message === "KLYX_PROVIDER_SKILL_FILE_TOO_LARGE"
      ) {
        setError(t("fileTooLarge"));
      } else if (
        uploadFailure instanceof Error &&
        uploadFailure.message === "KLYX_PROVIDER_SKILL_INVALID_FILE_TYPE"
      ) {
        setError(t("invalidFileType"));
      } else {
        setError(t("uploadError"));
      }
    } finally {
      setBusy(null);
    }
  }

  async function save(skill: Skill, submit: boolean) {
    setBusy(skill.userServiceId);
    setError("");
    setMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/skills-verification", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userServiceId: skill.userServiceId,
          providerStatement: statements[skill.userServiceId] ?? "",
          yearsExperience: years[skill.userServiceId] ?? 0,
          submit,
        }),
      });

      if (!response.ok) {
        throw new Error("KLYX_PROVIDER_SKILL_SAVE_FAILED");
      }

      setMessage(submit ? t("submitted") : t("saved"));
      await load();
    } catch {
      setError(t("saveError"));
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
          {t("backProvider")}
        </Link>

        <section className="mt-6 rounded-[2rem] bg-[#2563EB] p-8 text-white shadow-[0_28px_90px_rgba(37,99,235,0.18)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <GraduationCap size={15} />
            {t("eyebrow")}
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            {t("description")}
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-[#2563EB]/20 bg-[#2563EB]/10 p-5">
          <div className="flex gap-3">
            <ShieldCheck size={21} className="shrink-0 text-[#2563EB]" />
            <div>
              <p className="font-black">{t("trustTitle")}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("trustDescription")}
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
            {t("refresh")}
          </button>
        </div>

        {loading ? (
          <div className="klyx-card mt-6 grid min-h-56 place-items-center">
            <LoaderCircle size={38} className="animate-spin" />
          </div>
        ) : skills.length === 0 ? (
          <section className="klyx-card mt-6 p-8 text-center">
            <BriefcaseBusiness
              size={34}
              className="mx-auto text-muted-foreground"
            />
            <h2 className="mt-4 text-xl font-black">{t("emptyTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("emptyDescription")}
            </p>
            <Link
              href="/provider/services/new"
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#2563EB] px-4 text-sm font-black text-white transition hover:opacity-90"
            >
              {t("addSkill")}
            </Link>
          </section>
        ) : (
          <section className="mt-6 grid gap-5">
            {skills.map((skill) => {
              const verification = skill.verification;
              const status = verification?.status ?? "not_started";
              const locked = ["submitted", "under_review", "approved"].includes(
                status
              );

              return (
                <article key={skill.userServiceId} className="klyx-card p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
                        {status === "approved" ? (
                          <BadgeCheck size={23} />
                        ) : (
                          <BriefcaseBusiness size={22} />
                        )}
                      </span>

                      <div>
                        <h2 className="text-xl font-black">{skill.serviceName}</h2>
                        <p className="mt-1 text-sm font-bold text-muted-foreground">
                          {translateKlyxProviderSkillStatus(locale, status)}
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
                        <CheckCircle2 size={17} />
                        {t("verified")}
                      </span>
                    )}
                  </div>

                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-black">
                        {t("yearsExperience")}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        disabled={locked}
                        value={years[skill.userServiceId] ?? 0}
                        onChange={(event) =>
                          setYears((current) => ({
                            ...current,
                            [skill.userServiceId]: Number(event.target.value),
                          }))
                        }
                        className="klyx-input mt-2"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-black">{t("proofType")}</span>
                      <KlyxSelect
                        disabled={locked}
                        value={
                          proofTypes[skill.userServiceId] ??
                          "training_certificate"
                        }
                        onChange={(value) =>
                          setProofTypes((current) => ({
                            ...current,
                            [skill.userServiceId]: value as ProofType,
                          }))
                        }
                        options={proofOptions}
                        placeholder={t("proofPlaceholder")}
                        ariaLabel={`${t("proofType")} — ${skill.serviceName}`}
                        className="mt-2"
                      />
                    </label>
                  </div>

                  <label className="mt-5 block">
                    <span className="text-sm font-black">
                      {t("statementLabel")}
                    </span>
                    <textarea
                      rows={4}
                      disabled={locked}
                      value={statements[skill.userServiceId] ?? ""}
                      onChange={(event) =>
                        setStatements((current) => ({
                          ...current,
                          [skill.userServiceId]: event.target.value,
                        }))
                      }
                      className="klyx-input mt-2 resize-y"
                      placeholder={t("statementPlaceholder")}
                    />
                  </label>

                  <SkillRequirementsPanel
                    userServiceId={skill.userServiceId}
                    refreshKey={[
                      verification?.documents.length ?? 0,
                      years[skill.userServiceId] ?? 0,
                      verification?.status ?? "not_started",
                    ].join(":")}
                    onReadyChange={handleRequirementReady}
                  />

                  <div className="mt-5">
                    <p className="text-sm font-black">{t("proofsAdded")}</p>

                    {!verification || verification.documents.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("noProofs")}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {verification.documents.map((document) => (
                          <div
                            key={document.id}
                            className="flex items-center gap-3 rounded-xl border border-border p-3"
                          >
                            <FileText size={17} className="text-[#2563EB]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black">
                                {document.original_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {translateKlyxProviderSkillProofType(
                                  locale,
                                  document.proof_type
                                )}
                                {" · "}
                                {translateKlyxProviderSkillDocumentStatus(
                                  locale,
                                  document.status
                                )}
                              </p>
                            </div>
                            <FileCheck2
                              size={18}
                              className="text-muted-foreground"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {!locked && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm font-black">
                        {busy === skill.userServiceId ? (
                          <LoaderCircle size={17} className="animate-spin" />
                        ) : (
                          <Upload size={17} />
                        )}
                        {t("addProof")}
                        <input
                          type="file"
                          hidden
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          disabled={busy === skill.userServiceId}
                          onChange={(event) => void upload(skill, event)}
                        />
                      </label>

                      <button
                        type="button"
                        disabled={busy === skill.userServiceId}
                        onClick={() => void save(skill, false)}
                        className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-black"
                      >
                        {t("save")}
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy === skill.userServiceId ||
                          requirementsReady[skill.userServiceId] !== true
                        }
                        title={
                          requirementsReady[skill.userServiceId] === true
                            ? t("submitReadyTitle")
                            : t("submitBlockedTitle")
                        }
                        onClick={() => void save(skill, true)}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Send size={17} />
                        {t("submit")}
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