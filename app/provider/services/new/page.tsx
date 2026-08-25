"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import KlyxSelect from "@/app/components/KlyxSelect";
import {
  getKlyxProviderServiceProposalCategoryLabel,
  KLYX_PROVIDER_SERVICE_PROPOSAL_CATEGORIES,
  translateKlyxProviderServiceProposals,
  translateKlyxProviderServiceProposalStatus,
  type KlyxProviderServiceProposalsMessageKey,
} from "@/lib/klyx-provider-service-proposals-i18n";

type ProposalStatus = "pending" | "approved" | "rejected";

type Proposal = {
  id: string;
  proposedName: string;
  category: string;
  description: string;
  experienceDetails: string | null;
  status: ProposalStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

const statusConfig: Record<
  ProposalStatus,
  { icon: typeof Clock3; className: string }
> = {
  pending: {
    icon: Clock3,
    className:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  approved: {
    icon: CheckCircle2,
    className:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    icon: XCircle,
    className:
      "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

export default function NewProviderServicePage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderServiceProposalsMessageKey) =>
    translateKlyxProviderServiceProposals(locale, key);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposedName, setProposedName] = useState("");
  const [category, setCategory] = useState<string>(
    KLYX_PROVIDER_SERVICE_PROPOSAL_CATEGORIES[0]
  );
  const [description, setDescription] = useState("");
  const [experienceDetails, setExperienceDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProposals() {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch("/api/provider/service-proposals", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          proposals?: Proposal[];
        };

        if (!response.ok) {
          throw new Error("KLYX_PROVIDER_SERVICE_PROPOSALS_LOAD_FAILED");
        }

        if (!cancelled) {
          setProposals(result.proposals ?? []);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage(t("loadError"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProposals();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/provider/service-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposedName,
          category,
          description,
          experienceDetails,
        }),
      });

      const result = (await response.json()) as {
        proposal?: Proposal;
      };

      if (!response.ok || !result.proposal) {
        throw new Error("KLYX_PROVIDER_SERVICE_PROPOSAL_SUBMIT_FAILED");
      }

      setProposals((current) => [result.proposal!, ...current]);
      setProposedName("");
      setDescription("");
      setExperienceDetails("");
      setMessage(t("submitSuccess"));
    } catch {
      setErrorMessage(t("submitError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="klyx-page">
      <Link
        href="/provider"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={17} />
        {t("backToProvider")}
      </Link>

      <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#2b1452_52%,#111827_100%)] p-7 text-white shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />

        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
            <BriefcaseBusiness size={15} />
            {t("eyebrow")}
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            {t("description")}
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="klyx-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Send size={21} />
            </div>
            <div>
              <p className="klyx-eyebrow">{t("newProfession")}</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                {t("sendProposal")}
              </h2>
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <form onSubmit={submitProposal} className="mt-7 space-y-5">
            <Field label={t("professionName")} htmlFor="proposedName">
              <input
                id="proposedName"
                value={proposedName}
                onChange={(event) => setProposedName(event.target.value)}
                className="klyx-input"
                placeholder={t("professionNamePlaceholder")}
                maxLength={100}
                required
              />
            </Field>

            <Field label={t("category")} htmlFor="category">
              <KlyxSelect
                value={category}
                onChange={setCategory}
                options={KLYX_PROVIDER_SERVICE_PROPOSAL_CATEGORIES.map(
                  (canonicalCategory) => ({
                    value: canonicalCategory,
                    label: getKlyxProviderServiceProposalCategoryLabel(
                      locale,
                      canonicalCategory
                    ),
                  })
                )}
                ariaLabel={t("category")}
              />
            </Field>

            <Field
              label={t("serviceDescription")}
              htmlFor="description"
              hint={`${description.length}/800`}
            >
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="klyx-input min-h-36 resize-y py-4"
                placeholder={t("serviceDescriptionPlaceholder")}
                maxLength={800}
                required
              />
            </Field>

            <Field
              label={t("experience")}
              htmlFor="experienceDetails"
              hint={t("optional")}
            >
              <textarea
                id="experienceDetails"
                value={experienceDetails}
                onChange={(event) => setExperienceDetails(event.target.value)}
                className="klyx-input min-h-28 resize-y py-4"
                placeholder={t("experiencePlaceholder")}
                maxLength={500}
              />
            </Field>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={18} />
              {sending ? t("sending") : t("proposeProfession")}
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <article className="klyx-card p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 text-violet-600 dark:text-violet-400" />
              <div>
                <h2 className="font-black">{t("validationTitle")}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("validationDescription")}
                </p>
              </div>
            </div>
          </article>

          <article className="klyx-card p-6">
            <div className="flex items-center gap-3">
              <BadgeCheck className="text-violet-600 dark:text-violet-400" />
              <h2 className="text-lg font-black">{t("myProposals")}</h2>
            </div>

            {loading ? (
              <p className="mt-5 text-sm text-muted-foreground">
                {t("loading")}
              </p>
            ) : proposals.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {proposals.map((proposal) => {
                  const config = statusConfig[proposal.status];
                  const Icon = config.icon;

                  return (
                    <div
                      key={proposal.id}
                      className="rounded-2xl border border-border bg-background/55 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{proposal.proposedName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {getKlyxProviderServiceProposalCategoryLabel(
                              locale,
                              proposal.category
                            )}
                          </p>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${config.className}`}
                        >
                          <Icon size={14} />
                          {translateKlyxProviderServiceProposalStatus(
                            locale,
                            proposal.status
                          )}
                        </span>
                      </div>

                      {proposal.adminNote && (
                        <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
                          {proposal.adminNote}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-bold">
          {label}
        </label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
