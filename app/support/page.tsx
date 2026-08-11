import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCard,
  Headphones,
  Mail,
  ShieldAlert,
} from "lucide-react";
import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";
import { KLYX_PUBLIC_CONFIG } from "@/lib/klyx-public-config";

export const metadata: Metadata = {
  title: "Assistance",
  description: "Assistance et contact KLYX.",
};

function supportHref(subject: string, body: string) {
  return `mailto:${KLYX_PUBLIC_CONFIG.supportEmail}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

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
          Choisis le sujet de ta demande. KLYX ouvre ton application e-mail
          avec l’adresse, le sujet et un message déjà préparés.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={supportHref(
              "Assistance KLYX",
              "Bonjour KLYX,\n\nJ’ai besoin d’aide concernant :\n\n"
            )}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-600 px-6 font-black text-white transition hover:bg-violet-700"
          >
            <Mail size={18} />
            Contacter le support
          </a>

          <a
            href={`mailto:${email}`}
            className="inline-flex min-h-12 items-center rounded-2xl border border-border bg-card px-6 font-black"
          >
            {email}
          </a>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <SupportCard
            icon={<CreditCard />}
            title="Paiement"
            text="Réservation, débit, remboursement ou paiement prestataire."
            href={supportHref(
              "KLYX — problème de paiement",
              "Bonjour KLYX,\n\nIdentifiant de réservation :\nProblème rencontré :\n\nJe n’envoie aucune donnée complète de carte bancaire."
            )}
          />
          <SupportCard
            icon={<ShieldAlert />}
            title="Sécurité"
            text="Compte suspect, accès non autorisé ou problème de confiance."
            href={supportHref(
              "KLYX — sécurité du compte",
              "Bonjour KLYX,\n\nAdresse e-mail du compte :\nProblème de sécurité rencontré :\n\n"
            )}
          />
        </div>

        <p className="mt-8 text-sm leading-6 text-muted-foreground">
          Si aucun logiciel de messagerie n’est configuré sur ton appareil,
          copie directement l’adresse{" "}
          <strong className="text-foreground">{email}</strong> dans Gmail,
          Outlook ou ton application e-mail.
        </p>
      </div>

      <KlyxPublicFooter />
    </main>
  );
}

function SupportCard({
  icon,
  title,
  text,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded-3xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="text-violet-600">{icon}</div>
      <h2 className="mt-4 font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      <span className="mt-4 inline-block text-sm font-black text-violet-600">
        Ouvrir →
      </span>
    </a>
  );
}
