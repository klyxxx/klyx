# KLYX — système email transactionnel

## Identité officielle

- Domaine : `klyx.be`
- Expéditeur applicatif : `KLYX <support@klyx.be>`
- Support humain : `support@klyx.be`
- Site utilisé dans les emails : `https://klyx.be`
- Fournisseur d’envoi applicatif : Resend
- Secret serveur : `RESEND_API_KEY`

`RESEND_API_KEY` doit rester exclusivement côté serveur. Aucune variable `NEXT_PUBLIC_RESEND_*` ne doit être créée.

## Principes de sécurité et de produit

1. Une opération KLYX réussie ne doit jamais échouer parce qu’un email ne part pas.
2. Les emails sont envoyés uniquement après la persistance de l’action métier, via `after()` quand la route le permet.
3. L’email est un rappel ; KLYX reste la source de vérité pour les prix, disponibilités, réservations, paiements et remboursements.
4. Aucun prix, aucune disponibilité et aucun statut ne sont inventés dans un email.
5. Le destinataire est résolu depuis le profil KLYX puis Supabase Auth côté serveur.
6. Les valeurs dynamiques sont échappées avant leur insertion dans le HTML.
7. Chaque message possède une version HTML et une version texte brut.
8. Les emails transactionnels n’utilisent ni tracking marketing, ni promesse commerciale, ni contenu promotionnel.

## Design email KLYX

Le shell commun est volontairement simple et compatible avec les clients mail :

- fond neutre ;
- carte blanche ;
- mot-symbole texte `KLYX` sans dépendance à une image distante ;
- noir/blanc + bleu KLYX `#2563EB` ;
- un titre clair ;
- un seul bouton principal ;
- détails secondaires dans un bloc discret ;
- support `support@klyx.be` et `klyx.be` dans le pied de page ;
- rappel de sécurité : KLYX ne demande jamais un mot de passe par email.

## Catalogue transactionnel

### Actif dans le code applicatif

| Événement | Destinataire | Action principale |
| --- | --- | --- |
| Nouvelle demande de devis | Prestataire | Voir la demande |
| Devis envoyé | Client | Consulter le devis |
| Devis accepté | Prestataire | Voir le devis |
| Devis refusé | Prestataire | Voir mes devis |
| Demande de devis annulée | Prestataire | Voir mes devis |
| Nouvelle demande de réservation | Prestataire | Voir la demande |
| Réservation acceptée | Client | Voir la réservation |
| Réservation refusée | Client | Voir la demande |
| Réservation annulée | Autre participant | Voir la réservation |
| Remboursement lancé après annulation | Client | Voir la réservation |
| Remboursement confirmé immédiatement | Client | Voir la réservation |

### Préparé dans le catalogue, mais volontairement non branché dans ce chantier

- paiement réussi ;
- paiement échoué.

Les templates sont prêts, mais leur branchement doit se faire sur la source de vérité du webhook paiement existant. Ce chantier email ne modifie pas la logique Stripe.

### À traiter uniquement lorsqu’un hook métier fiable existe

- nouveau message direct : ne pas envoyer un email par message sans stratégie anti-spam/digest ;
- rappel d’avis ;
- litige/support ;
- réservation de groupe ;
- rappels calendaires.

## Supabase Auth

Les emails de connexion, vérification d’adresse et réinitialisation de mot de passe restent gérés par Supabase Auth. Ils ne doivent pas être détournés vers les routes transactionnelles KLYX.

Pour harmoniser leur apparence dans le tableau de bord Supabase :

- conserver les variables/liens de confirmation générés par Supabase ;
- utiliser la même identité `KLYX`, le même bleu `#2563EB`, le même support et le même ton ;
- ne jamais recopier un token ou un secret dans le template ;
- tester vérification d’adresse et réinitialisation de mot de passe séparément avant production.

## Configuration production obligatoire

Le code fonctionne en mode fail-open : si la clé n’est pas définie, l’action métier continue et l’email est ignoré.

Pour activer réellement l’envoi en production :

1. créer une clé API Resend dédiée à l’application KLYX avec uniquement les droits d’envoi nécessaires ;
2. ajouter cette clé dans Vercel sous le nom exact `RESEND_API_KEY` pour l’environnement Production ;
3. l’ajouter aussi à Preview uniquement si les previews doivent envoyer de vrais emails ;
4. redéployer après ajout/modification du secret ;
5. faire un test de bout en bout avec un devis et une réservation de test ;
6. ne jamais mettre la clé dans GitHub, un screenshot, un ticket, un log ou une variable `NEXT_PUBLIC_*`.

## Vérification après déploiement

- créer une demande de devis et vérifier l’email prestataire ;
- envoyer le devis et vérifier l’email client ;
- accepter/refuser/annuler sur des cas de test ;
- créer puis accepter/refuser une réservation ;
- tester une annulation remboursable uniquement dans le scénario de test déjà autorisé par KLYX ;
- vérifier que les liens mènent bien à `klyx.be` ;
- vérifier Gmail, Outlook et mobile au minimum ;
- vérifier Resend Logs en cas de `delivered`, `bounced` ou `complained` ;
- confirmer qu’une panne/absence Resend n’empêche jamais l’action KLYX.
