import type { Metadata } from "next";
import Link from "next/link";
import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";
import { KLYX_PUBLIC_CONFIG } from "@/lib/klyx-public-config";

export const metadata: Metadata = {
  title: "Conditions d’utilisation",
  description: "Conditions d’utilisation de la plateforme KLYX.",
};

export default function TermsPage() {
  const config = KLYX_PUBLIC_CONFIG;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/legal" className="text-sm font-bold text-violet-600">
          ← Informations KLYX
        </Link>

        <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-violet-600">
          Dernière mise à jour : 10 août 2026
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          Conditions d’utilisation
        </h1>

        <div className="mt-10 space-y-9 text-sm leading-7 text-muted-foreground sm:text-base">
          <Section title="1. Objet">
            <p>
              KLYX est une plateforme permettant notamment de rechercher des
              services, consulter des prestataires, demander des devis,
              réserver, communiquer, payer et suivre une mission.
            </p>
          </Section>

          <Section title="2. Comptes">
            <p>
              L’utilisateur doit fournir des informations exactes, protéger ses
              accès et ne pas utiliser le compte d’une autre personne sans
              autorisation. KLYX peut appliquer des vérifications supplémentaires
              aux prestataires avant la publication de certains métiers.
            </p>
          </Section>

          <Section title="3. Prestataires">
            <p>
              Sauf indication contraire, les prestataires présents sur KLYX
              fournissent leurs services sous leur propre responsabilité. Ils
              doivent décrire honnêtement leurs compétences, prix,
              disponibilités et zones d’intervention et respecter les règles
              professionnelles applicables à leur activité.
            </p>
          </Section>

          <Section title="4. Réservations, prix et paiement">
            <p>
              Le prix et le mode de tarification applicables sont présentés au
              moment du parcours de réservation ou dans un devis accepté. Le
              paiement peut être traité par un prestataire de paiement externe.
              Une réservation ne doit pas être considérée comme payée tant que
              KLYX n’a pas reçu la confirmation correspondante.
            </p>
          </Section>

          <Section title="5. Annulations et remboursements">
            <p>
              Les possibilités d’annulation dépendent de l’état de la
              réservation et de la mission. Lorsqu’un paiement doit être
              remboursé, le traitement peut dépendre du prestataire de paiement.
              Une prestation déjà commencée peut nécessiter une procédure de
              litige plutôt qu’une annulation automatique.
            </p>
          </Section>

          <Section title="6. Avis et confiance">
            <p>
              KLYX peut limiter les avis aux missions réellement terminées.
              Les scores, badges et vérifications constituent des indicateurs de
              confiance et ne remplacent pas le jugement de l’utilisateur ni une
              garantie absolue sur l’exécution future d’un service.
            </p>
          </Section>

          <Section title="7. Utilisations interdites">
            <p>
              Il est interdit d’utiliser KLYX pour frauder, usurper une identité,
              contourner les mécanismes de paiement ou de sécurité, publier des
              informations trompeuses, harceler un utilisateur ou proposer une
              activité illégale.
            </p>
          </Section>

          <Section title="8. Disponibilité">
            <p>
              KLYX cherche à maintenir le service disponible et fiable, mais des
              opérations de maintenance, défaillances externes ou événements
              techniques peuvent entraîner des interruptions.
            </p>
          </Section>

          <Section title="9. Données personnelles">
            <p>
              Le traitement des données personnelles est décrit dans la{" "}
              <Link className="font-bold text-violet-600" href="/privacy">
                politique de confidentialité
              </Link>
              .
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Pour une question relative à ces conditions :{" "}
              <a
                href={`mailto:${config.supportEmail}`}
                className="font-bold text-violet-600"
              >
                {config.supportEmail}
              </a>
              .
            </p>
          </Section>
        </div>
      </article>

      <KlyxPublicFooter />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-black text-foreground">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
