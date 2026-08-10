import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCard,
  Headphones,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";
import { KLYX_PUBLIC_CONFIG } from "@/lib/klyx-public-config";

export const metadata: Metadata = {
  title: "Assistance",
  description: "Assistance et contact KLYX.",
};

export default function SupportPage() {
  const email = KLYX_PUBLIC_CONFIG.supportEmail;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/legal" className="text-sm font-bold text-violet-600">
          ← Informations KLYX
        </Link>

        <Headphones className="mt-10 text-violet-600" size={38} />
        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          Assistance KLYX
        </h1>
        <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">
          Pour une difficulté avec ton compte, une réservation, un paiement ou
          une demande de suppression, contacte l’assistance KLYX.
        </p>

        <a
          href={`mailto:${email}?subject=${encodeURIComponent(
            "Assistance KLYX"
          )}`}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-600 px-6 font-black text-white"
        >
          Contacter {email}
        </a>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card
            icon={<CreditCard />}
            title="Paiement"
            text="Indique l’identifiant de réservation, mais n’envoie jamais ton numéro complet de carte."
          />
          <Card
            icon={<ShieldAlert />}
            title="Sécurité"
            text="Signale immédiatement une utilisation suspecte ou un accès non autorisé."
          />
          <Card
            icon={<Trash2 />}
            title="Suppression"
            text="La page de suppression explique comment initier une demande depuis le web."
          />
        </div>
      </div>

      <KlyxPublicFooter />
    </main>
  );
}

function Card({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="text-violet-600">{icon}</div>
      <h2 className="mt-4 font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </section>
  );
}
