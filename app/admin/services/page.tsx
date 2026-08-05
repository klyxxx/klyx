"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  LoaderCircle,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type ProposalStatus = "pending" | "approved" | "rejected";

type Proposal = {
  id: string;
  proposed_name: string;
  category: string;
  description: string;
  experience_details: string | null;
  status: ProposalStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles:
    | { first_name: string; last_name: string; city: string }
    | { first_name: string; last_name: string; city: string }[]
    | null;
};

export default function AdminServicesPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState<"all" | ProposalStatus>("pending");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/service-proposals", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          proposals?: Proposal[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "Chargement impossible.");
        }

        setProposals(result.proposals ?? []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger les propositions."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const visibleProposals = useMemo(() => {
    const q = query.trim().toLowerCase();

    return proposals.filter((proposal) => {
      const provider = Array.isArray(proposal.profiles)
        ? proposal.profiles[0]
        : proposal.profiles;

      return (
        (filter === "all" || proposal.status === filter) &&
        (!q ||
          proposal.proposed_name.toLowerCase().includes(q) ||
          proposal.category.toLowerCase().includes(q) ||
          `${provider?.first_name ?? ""} ${provider?.last_name ?? ""}`
            .toLowerCase()
            .includes(q))
      );
    });
  }, [filter, proposals, query]);

  async function review(
    proposal: Proposal,
    action: "approve" | "reject"
  ) {
    if (
      !window.confirm(
        `${action === "approve" ? "Approuver" : "Refuser"} « ${
          proposal.proposed_name
        } » ?`
      )
    ) {
      return;
    }

    setReviewingId(proposal.id);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/service-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
          action,
          adminNote: notes[proposal.id] ?? "",
        }),
      });

      const result = (await response.json()) as {
        review?: {
          status: ProposalStatus;
          admin_note: string | null;
          reviewed_at: string;
        };
        service?: { name: string } | null;
        error?: string;
      };

      if (!response.ok || !result.review) {
        throw new Error(result.error ?? "Action impossible.");
      }

      setProposals((current) =>
        current.map((item) =>
          item.id === proposal.id
            ? {
                ...item,
                status: result.review!.status,
                admin_note: result.review!.admin_note,
                reviewed_at: result.review!.reviewed_at,
              }
            : item
        )
      );

      setMessage(
        action === "approve"
          ? `Métier ajouté au catalogue : ${
              result.service?.name ?? proposal.proposed_name
            }.`
          : "Proposition refusée."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Action impossible."
      );
    } finally {
      setReviewingId("");
    }
  }

  return (
    <main className="klyx-page">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
      >
        <ArrowLeft size={17} />
        Tableau de bord
      </Link>

      <section className="mt-6 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#30135c_52%,#111827)] p-8 text-white">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em]">
          <ShieldCheck size={15} />
          Administration KLYX
        </div>
        <h1 className="mt-5 text-3xl font-black sm:text-5xl">
          Validation des nouveaux métiers
        </h1>
      </section>

      {message && (
        <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}

      <section className="klyx-card mt-8 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["pending", "approved", "rejected", "all"] as const).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold ${
                    filter === value
                      ? "bg-violet-600 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {value === "pending"
                    ? "En attente"
                    : value === "approved"
                      ? "Approuvés"
                      : value === "rejected"
                        ? "Refusés"
                        : "Tous"}
                </button>
              )
            )}
          </div>

          <label className="relative block w-full lg:max-w-sm">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="klyx-input pl-11"
              placeholder="Rechercher"
            />
          </label>
        </div>
      </section>

      <section className="mt-6 space-y-5">
        {loading ? (
          <div className="klyx-card grid min-h-48 place-items-center">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : visibleProposals.length === 0 ? (
          <div className="klyx-card p-8 text-center">
            <Clock3 className="mx-auto" />
            <p className="mt-3 font-black">Aucune proposition</p>
          </div>
        ) : (
          visibleProposals.map((proposal) => {
            const provider = Array.isArray(proposal.profiles)
              ? proposal.profiles[0]
              : proposal.profiles;

            return (
              <article key={proposal.id} className="klyx-card p-6">
                <h2 className="text-2xl font-black">
                  {proposal.proposed_name}
                </h2>
                <p className="mt-1 text-sm font-bold text-violet-600">
                  {proposal.category}
                </p>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {proposal.description}
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  {provider?.first_name} {provider?.last_name}
                  {provider?.city ? ` · ${provider.city}` : ""}
                </p>

                {proposal.status === "pending" ? (
                  <div className="mt-5">
                    <textarea
                      value={notes[proposal.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [proposal.id]: event.target.value,
                        }))
                      }
                      className="klyx-input min-h-24 py-4"
                      placeholder="Note administrateur"
                    />
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        disabled={reviewingId === proposal.id}
                        onClick={() => review(proposal, "approve")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white"
                      >
                        <Check size={17} />
                        Approuver
                      </button>
                      <button
                        type="button"
                        disabled={reviewingId === proposal.id}
                        onClick={() => review(proposal, "reject")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white"
                      >
                        <X size={17} />
                        Refuser
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 text-sm font-bold">
                    Statut : {proposal.status}
                  </p>
                )}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
