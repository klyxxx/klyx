import Link from "next/link";
import {
  FileText,
  Headphones,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";

const cards = [
  {
    href: "/privacy",
    title: "Politique de confidentialité",
    description:
      "Données collectées, finalités, prestataires, conservation et droits.",
    icon: ShieldCheck,
  },
  {
    href: "/terms",
    title: "Conditions d’utilisation",
    description:
      "Règles d’utilisation de KLYX pour les clients et les prestataires.",
    icon: FileText,
  },
  {
    href: "/support",
    title: "Assistance",
    description:
      "Contacter KLYX pour un problème de compte, paiement ou réservation.",
    icon: Headphones,
  },
  {
    href: "/delete-account",
    title: "Suppression du compte",
    description:
      "Demander la suppression de ton compte et de tes données associées.",
    icon: Trash2,
  },
];

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm font-bold text-violet-600">
          ← KLYX
        </Link>

        <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-violet-600">
          Informations KLYX
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          Légal, confidentialité et assistance
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          Les informations essentielles pour comprendre tes droits et utiliser
          KLYX en toute transparence.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-3xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <Icon className="text-violet-600" size={26} />
                <h2 className="mt-5 text-xl font-black">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {card.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <KlyxPublicFooter />
    </main>
  );
}
