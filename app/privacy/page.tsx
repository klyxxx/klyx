import type { Metadata } from "next";
import Link from "next/link";
import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";
import { KLYX_PUBLIC_CONFIG } from "@/lib/klyx-public-config";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de KLYX et informations sur le traitement des données.",
};

export default function PrivacyPage() {
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
          Politique de confidentialité
        </h1>

        <div className="mt-10 space-y-9 text-sm leading-7 text-muted-foreground sm:text-base">
          <Section title="1. Responsable">
            <p>
              KLYX est le service responsable des traitements décrits ici.
              L’éditeur public indiqué par la configuration de l’application est
              <strong className="text-foreground"> {config.legalName}</strong>.
            </p>
            {config.legalAddress && <p>Adresse : {config.legalAddress}</p>}
            {config.companyNumber && (
              <p>Numéro d’entreprise : {config.companyNumber}</p>
            )}
            <p>
              Contact confidentialité :{" "}
              <a
                className="font-bold text-violet-600"
                href={`mailto:${config.supportEmail}`}
              >
                {config.supportEmail}
              </a>
            </p>
          </Section>

          <Section title="2. Données pouvant être traitées">
            <p>
              Selon les fonctions utilisées, KLYX peut traiter des données de
              compte et de profil, coordonnées, informations de service,
              disponibilités et zones d’intervention, réservations, devis,
              messages, avis, préférences, notifications et données techniques
              nécessaires à la sécurité du service.
            </p>
            <p>
              Pour les paiements, KLYX conserve les identifiants et états
              nécessaires au suivi des transactions. Les données de carte sont
              traitées par le prestataire de paiement et ne sont pas destinées à
              être stockées directement par KLYX.
            </p>
            <p>
              Certaines fonctions facultatives peuvent traiter des images,
              informations de localisation saisies par l’utilisateur, éléments
              de vérification prestataire ou contenu envoyé à des fonctions
              d’assistance par intelligence artificielle.
            </p>
          </Section>

          <Section title="3. Finalités">
            <p>
              Ces données servent notamment à créer et sécuriser les comptes,
              mettre en relation clients et prestataires, fournir la recherche,
              les devis, la réservation et le suivi des missions, traiter les
              paiements et remboursements, prévenir la fraude, gérer la
              confiance et les avis, fournir l’assistance et améliorer le
              fonctionnement de KLYX.
            </p>
          </Section>

          <Section title="4. Prestataires techniques">
            <p>
              KLYX peut s’appuyer sur des prestataires techniques nécessaires à
              son fonctionnement, notamment pour l’hébergement, la base de
              données et l’authentification, les paiements, la vérification
              d’identité lorsque celle-ci est activée, la livraison de
              l’application et les fonctions d’intelligence artificielle.
              L’accès doit être limité à ce qui est nécessaire à leur mission.
            </p>
          </Section>

          <Section title="5. Conservation">
            <p>
              KLYX conserve les données pendant la durée nécessaire au service,
              à la sécurité, à la résolution des litiges et aux obligations
              légales applicables. Lors d’une suppression de compte, les données
              personnelles qui ne doivent plus être conservées doivent être
              supprimées ou anonymisées. Certaines informations liées à des
              transactions, à la fraude, à la sécurité ou à une obligation
              réglementaire peuvent devoir être conservées pendant une durée
              supplémentaire.
            </p>
          </Section>

          <Section title="6. Suppression et droits">
            <p>
              Un utilisateur connecté peut initier la suppression dans
              Paramètres. Une ressource web indépendante est également
              disponible sur{" "}
              <Link className="font-bold text-violet-600" href="/delete-account">
                /delete-account
              </Link>
              . Une vérification d’identité peut être demandée avant de traiter
              une demande externe afin d’éviter la suppression frauduleuse d’un
              compte.
            </p>
            <p>
              Pour demander l’accès, la rectification, l’effacement ou une autre
              action concernant tes données, contacte {config.supportEmail}.
            </p>
          </Section>

          <Section title="7. Sécurité">
            <p>
              KLYX utilise des contrôles d’accès, des mécanismes
              d’authentification et des protections côté serveur. Aucun système
              n’est toutefois exempt de risque ; les incidents doivent être
              analysés et traités conformément aux obligations applicables.
            </p>
          </Section>

          <Section title="8. Évolution de cette politique">
            <p>
              Cette politique peut évoluer avec KLYX. La date affichée en haut
              de cette page permet d’identifier la version publiée.
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
