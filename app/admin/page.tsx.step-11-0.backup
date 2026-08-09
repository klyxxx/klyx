"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  FileCheck2,
  Gavel,
  LoaderCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const AREAS = [
  {
    title: "Compétences prestataires",
    description:
      "Voir les preuves et les décisions métier par métier.",
    href: "/admin/skills",
    icon: BriefcaseBusiness,
  },
  {
    title: "Vérifications prestataires",
    description:
      "Suivre identité, adresse et documents généraux.",
    href: "/admin/verifications",
    icon: BadgeCheck,
  },
  {
    title: "Litiges",
    description:
      "Suivre les incidents et dossiers de confiance.",
    href: "/admin/disputes",
    icon: Gavel,
  },
  {
    title: "Services KLYX",
    description:
      "Voir le catalogue et les propositions de services.",
    href: "/admin/services",
    icon: FileCheck2,
  },
  {
    title: "Audit financier",
    description:
      "Contrôler paiements, remboursements et cohérence Stripe.",
    href: "/admin/finance",
    icon: Banknote,
  },
];

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Session manquante.");
        }

        const response = await fetch("/api/admin/access", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const body = (await response.json()) as {
          isAdmin?: boolean;
          error?: string;
        };

        if (!response.ok || !body.isAdmin) {
          throw new Error(
            body.error || "Accès administrateur refusé."
          );
        }

        if (!cancelled) setAllowed(true);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Accès refusé."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="klyx-page grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin" size={38} />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="klyx-page">
        <div className="mx-auto max-w-3xl">
          <section className="klyx-card p-8">
            <ShieldCheck size={34} className="text-rose-500" />
            <h1 className="mt-5 text-2xl font-black">
              Accès administrateur refusé
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {error}
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <ShieldCheck size={15} />
            Accès administrateur
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Centre Admin KLYX
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Ton accès est un accès de supervision. Tu vois les
            dossiers et les décisions, mais le moteur de
            vérification externe reste l’autorité de décision.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
          <div className="flex gap-3">
            <Search size={21} className="shrink-0 text-blue-600" />
            <div>
              <p className="font-black">
                Recherche globale disponible
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Utilise la barre de recherche du menu ou Ctrl+K
                pour retrouver rapidement une page KLYX.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {AREAS.map((area) => {
            const Icon = area.icon;

            return (
              <Link
                key={area.href}
                href={area.href}
                className="klyx-card group p-6 transition hover:-translate-y-0.5"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
                  <Icon size={22} />
                </span>

                <h2 className="mt-5 text-xl font-black">
                  {area.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {area.description}
                </p>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
