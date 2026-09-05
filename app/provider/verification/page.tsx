"use client";

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { getActiveProfileAccount } from "@/lib/account-switcher";
import {
  formatKlyxProviderVerificationFileSize,
  getKlyxProviderVerificationDocumentType,
  translateKlyxProviderVerification,
  translateKlyxProviderVerificationStatus,
  type KlyxProviderVerificationMessageKey,
} from "@/lib/klyx-provider-verification-i18n";
import { supabase } from "@/lib/supabase";

type DocumentType =
  | "identity"
  | "address"
  | "business"
  | "insurance"
  | "professional_certificate";

type Verification = {
  status: string;
  identity_status: string;
  address_status: string;
  business_status: string;
  insurance_status: string;
  professional_status: string;
  trust_level: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

type VerificationDocument = {
  id: string;
  document_type: DocumentType;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  rejection_reason: string | null;
  uploaded_at: string;
};

const TYPES: Array<{
  type: DocumentType;
  required: boolean;
}> = [
  { type: "identity", required: true },
  { type: "address", required: true },
  { type: "business", required: false },
  { type: "insurance", required: false },
  { type: "professional_certificate", required: false },
];

function safeFileName(name: string): string {
  const extension = name.includes(".")
    ? name.split(".").pop()?.toLowerCase() ?? "file"
    : "file";

  return `${crypto.randomUUID()}.${extension.replace(
    /[^a-z0-9]/g,
    ""
  )}`;
}

export default function ProviderVerificationPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderVerificationMessageKey) =>
    translateKlyxProviderVerification(locale, key);

  const [profileId, setProfileId] = useState("");
  const [verification, setVerification] =
    useState<Verification | null>(null);
  const [documents, setDocuments] = useState<
    VerificationDocument[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] =
    useState<DocumentType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function accessToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("KLYX_PROVIDER_VERIFICATION_SESSION_MISSING");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const profile = await getActiveProfileAccount();

      if (profile.accountType !== "provider") {
        throw new Error("KLYX_PROVIDER_VERIFICATION_PROVIDER_REQUIRED");
      }

      setProfileId(profile.id);

      const token = await accessToken();
      const response = await fetch(
        "/api/provider/verification",
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const body = (await response.json()) as {
        verification?: Verification;
        documents?: VerificationDocument[];
      };

      if (!response.ok || !body.verification) {
        setErrorMessage(t("loadError"));
        return;
      }

      setVerification(body.verification);
      setDocuments(body.documents ?? []);
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const requiredReady = useMemo(
    () =>
      documents.some(
        (document) => document.document_type === "identity"
      ) &&
      documents.some(
        (document) => document.document_type === "address"
      ),
    [documents]
  );

  async function upload(
    type: DocumentType,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !profileId) return;

    setBusyType(type);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage(t("fileTooLarge"));
        return;
      }

      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ].includes(file.type)
      ) {
        setErrorMessage(t("invalidFileType"));
        return;
      }

      const path =
        `${profileId}/${type}/${safeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from("provider-verification")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        setErrorMessage(t("uploadError"));
        return;
      }

      const token = await accessToken();
      const response = await fetch(
        "/api/provider/verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            documentType: type,
            storagePath: path,
            originalName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        }
      );

      await response.json();

      if (!response.ok) {
        await supabase.storage
          .from("provider-verification")
          .remove([path]);
        setErrorMessage(t("uploadError"));
        return;
      }

      setSuccessMessage(t("documentAdded"));
      await load();
    } catch {
      setErrorMessage(t("uploadError"));
    } finally {
      setBusyType(null);
    }
  }

  async function preview(documentId: string) {
    setErrorMessage("");

    try {
      const token = await accessToken();
      const response = await fetch(
        "/api/provider/verification/document",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ documentId }),
        }
      );

      const body = (await response.json()) as {
        url?: string;
      };

      if (!response.ok || !body.url) {
        setErrorMessage(t("previewError"));
        return;
      }

      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch {
      setErrorMessage(t("previewError"));
    }
  }

  async function remove(documentId: string) {
    if (!window.confirm(t("confirmDelete"))) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await accessToken();
      const response = await fetch(
        "/api/provider/verification/document",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ documentId }),
        }
      );

      await response.json();

      if (!response.ok) {
        setErrorMessage(t("deleteError"));
        return;
      }

      setSuccessMessage(t("documentDeleted"));
      await load();
    } catch {
      setErrorMessage(t("deleteError"));
    }
  }

  async function submitVerification() {
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await accessToken();
      const response = await fetch(
        "/api/provider/verification",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await response.json();

      if (!response.ok) {
        setErrorMessage(t("submitError"));
        return;
      }

      setSuccessMessage(t("dossierSubmitted"));
      await load();
    } catch {
      setErrorMessage(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle
          className="animate-spin text-[#2563EB]"
          size={38}
        />
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="klyx-card p-7 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2563EB]/20 bg-[#2563EB]/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[#2563EB]">
            <BadgeCheck size={15} />
            {t("providerOnly")}
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            {t("description")}
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-3 text-sm font-black text-[#2563EB]">
            <ShieldCheck size={18} />
            {t("statusPrefix")} {translateKlyxProviderVerificationStatus(
              locale,
              verification?.status ?? "not_started"
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <div className="flex gap-3">
            <LockKeyhole
              className="shrink-0 text-amber-600"
              size={21}
            />
            <div>
              <p className="font-black">
                {t("privacyTitle")}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("privacyText")}
              </p>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        <section className="mt-8 grid gap-5">
          {TYPES.map((item) => {
            const copy =
              getKlyxProviderVerificationDocumentType(
                locale,
                item.type
              );
            const itemDocuments = documents.filter(
              (document) =>
                document.document_type === item.type
            );
            const busy = busyType === item.type;
            const locked = [
              "submitted",
              "under_review",
              "approved",
            ].includes(verification?.status ?? "");

            return (
              <article
                key={item.type}
                className="klyx-card p-6"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
                      <FileText size={22} />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black">
                          {copy?.title ?? item.type}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                            item.required
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.required
                            ? t("required")
                            : t("optional")}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {copy?.description ?? ""}
                      </p>
                    </div>
                  </div>

                  {!locked && (
                    <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-black text-white">
                      {busy ? (
                        <LoaderCircle
                          className="animate-spin"
                          size={17}
                        />
                      ) : (
                        <Upload size={17} />
                      )}
                      {t("add")}
                      <input
                        type="file"
                        hidden
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        disabled={busy}
                        onChange={(event) =>
                          void upload(item.type, event)
                        }
                      />
                    </label>
                  )}
                </div>

                {itemDocuments.length > 0 && (
                  <div className="mt-5 space-y-3 border-t border-border pt-5">
                    {itemDocuments.map((document) => (
                      <div
                        key={document.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-black">
                            {document.original_name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatKlyxProviderVerificationFileSize(
                              locale,
                              document.size_bytes
                            )}{" "}
                            ·{" "}
                            {translateKlyxProviderVerificationStatus(
                              locale,
                              document.status
                            )}
                          </p>
                          {document.rejection_reason && (
                            <p className="mt-2 text-xs text-rose-600">
                              {document.rejection_reason}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void preview(document.id)
                            }
                            className="grid h-10 w-10 place-items-center rounded-xl border border-border"
                            aria-label={t("viewDocument")}
                          >
                            <Eye size={17} />
                          </button>

                          {!locked &&
                            document.status !== "approved" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void remove(document.id)
                                }
                                className="grid h-10 w-10 place-items-center rounded-xl border border-rose-500/25 text-rose-600"
                                aria-label={t("deleteDocument")}
                              >
                                <Trash2 size={17} />
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="klyx-card mt-8 p-6 sm:p-8">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              {requiredReady ? (
                <CheckCircle2 size={23} />
              ) : (
                <FileCheck2 size={23} />
              )}
            </div>

            <div>
              <h2 className="text-xl font-black">
                {t("submitTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("submitDescription")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void submitVerification()}
            disabled={
              submitting ||
              !requiredReady ||
              ["submitted", "under_review", "approved"].includes(
                verification?.status ?? ""
              )
            }
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-40"
          >
            {submitting ? (
              <LoaderCircle
                className="animate-spin"
                size={18}
              />
            ) : (
              <Send size={18} />
            )}
            {t("submitButton")}
          </button>
        </section>
      </div>
    </main>
  );
}
