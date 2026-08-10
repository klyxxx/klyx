import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Trash2 } from "lucide-react";
import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";
import { KLYX_PUBLIC_CONFIG } from "@/lib/klyx-public-config";

export const metadata: Metadata = {
  title: "Suppression du compte",
  description:
    "Demander la suppression d’un compte KLYX et des données associées.",
};

export default function DeleteAccountPage() {
  const email = KLYX_PUBLIC_CONFIG.supportEmail;
  const subject = encodeURIComponent("Demande de suppression de compte KLYX");
  const body = encodeURIComponent(
    [
      "Bonjour KLYX,",
      "",
      "Je souhaite demander la suppression de mon compte KLYX et des données associées.",
      "",
      "Adresse e-mail du compte : ",
      "",
      "Je comprends qu'une vérification de mon identité peut être nécessaire avant traitement.",
    ].join("\n")
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/legal" className="text-sm font-bold text-violet-600">
          ← Informations KLYX
        </Link>

        <Trash2 className="mt-10 text-rose-600" size={40} />
        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          Supprimer un compte KLYX
        </h1>
        <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">
          Cette page est accessible même sans l’application et permet
          d’initier une demande de suppression du compte et des données
          personnelles associées.
        </p>

        <section className="mt-9 rounded-3xl border border-border bg-card p-6">
          <h2 className="text-xl font-black">Depuis KLYX</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Si tu peux encore te connecter, ouvre Paramètres → Supprimer mon
            compte. Cette voie permet à KLYX de vérifier directement le compte.
          </p>
          <Link
            href="/settings"
            className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-violet-600 px-5 font-black text-white"
          >
            Ouvrir les paramètres
          </Link>
        </section>

        <section className="mt-5 rounded-3xl border border-rose-500/25 bg-rose-500/[0.05] p-6">
          <h2 className="text-xl font-black">Demande depuis le web</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Si tu n’as plus accès à l’application, envoie une demande à
            l’assistance. Utilise si possible l’adresse e-mail du compte.
            KLYX peut demander une vérification raisonnable afin d’éviter
            qu’une autre personne supprime ton compte.
          </p>

          <a
            href={`mailto:${email}?subject=${subject}&body=${body}`}
            className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-rose-600 px-5 font-black text-white"
          >
            Demander la suppression
          </a>

          <p className="mt-3 text-xs text-muted-foreground">
            Adresse de traitement : {email}
          </p>
        </section>

        <section className="mt-5 rounded-3xl border border-border bg-card p-6">
          <div className="flex gap-3">
            <ShieldCheck className="shrink-0 text-violet-600" />
            <div>
              <h2 className="font-black">Données conservées si nécessaire</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Les données personnelles qui ne sont plus nécessaires doivent
                être supprimées ou anonymisées. Certaines informations peuvent
                être conservées lorsqu’une obligation légale, la prévention de
                la fraude, la sécurité ou la gestion d’un litige l’exige.
              </p>
            </div>
          </div>
        </section>
      </article>

      <KlyxPublicFooter />
    </main>
  );
}
