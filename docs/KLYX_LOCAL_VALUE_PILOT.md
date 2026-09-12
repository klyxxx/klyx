# KLYX — pilote local de valeur économique

## But

Ce pilote n'est **pas un lancement général**. Il sert à vérifier, avec des transactions réelles et auditables, que KLYX peut créer de la valeur économique pour le client, le prestataire et la plateforme.

Deux boucles doivent être observées de bout en bout :

1. **Besoin → solution → paiement → mission réussie**
2. **Disponibilité + objectif de revenu → proposition → acceptation → mission réussie → paiement**

Aucune étape ne doit être simulée pour améliorer un taux.

## Périmètre initial strict

- Pays : Belgique.
- Ville : Bruxelles.
- Zone pilote : Anneessens.
- Une seule catégorie : **Bricolage & réparation**.
- Un seul service : **Montage de meubles** (`montage-de-meubles`).
- Devise : EUR.
- Maximum **5 prestataires** suivis dans la boucle revenu.
- Maximum **20 demandes réelles** dans la cohorte pilote.
- Acquisition payante : **désactivée** au démarrage.
- Transactions synthétiques, fixtures et scénarios de démonstration : **exclus des métriques pilote**.

La base `market_service_requests.city = Bruxelles` ne permet pas de prouver le quartier. Une demande n'entre donc dans la cohorte qu'après vérification explicite de sa zone. La table de cohorte ne conserve pas l'adresse précise.

## Source de vérité

Les résultats aval sont dérivés des tables métier existantes :

- demandes : `market_service_requests` ;
- propositions : `market_service_offers` ;
- lien demande/devis : `service_quotes.market_request_id` ;
- réservation et mission : `bookings` ;
- paiement, commission et remboursement : `booking_financial_ledger` ;
- frais Stripe : vraie `BalanceTransaction` Stripe synchronisée côté Founder ;
- coûts support, fraude/litiges et acquisition : `business_cost_events`, uniquement lorsqu'un coût réel ou explicitement valorisé existe.

`business_pilot_requests` et `business_pilot_income_attempts` ne remplacent pas ces sources : elles servent seulement à définir une cohorte réelle vérifiée lorsque la donnée de départ n'est pas inférable de façon fiable.

Chaque coût manuel doit avoir une **référence unique** afin qu'un double envoi ne puisse pas compter deux fois le même coût. Les frais Stripe ne peuvent pas être saisis manuellement : ils viennent uniquement de la synchronisation d'une vraie `Stripe BalanceTransaction`.

## Définitions des métriques

### Finance par catégorie

- **Valeur brute des missions (GMV)** : somme des paiements `payment_succeeded` réussis.
- **Commission KLYX** : somme de `platform_fee_cents` du ledger.
- **Remboursements** : somme des `refund_succeeded` réussis.
- **Commission conservée après remboursement** : estimation proportionnelle au montant remboursé par réservation. Un remboursement intégral ramène la commission conservée estimée à zéro.
- **Frais Stripe** : frais réels issus de `Stripe BalanceTransaction.fee`, pas un pourcentage estimé.
- **Coût support** : coût réellement engagé ou temps support explicitement valorisé et saisi.
- **Coût fraude/litiges** : perte ou coût effectivement constaté ; un simple signalement ne crée aucun coût fictif.
- **Coût acquisition** : `indisponible` tant qu'aucune acquisition payante attribuable n'existe pour la catégorie considérée.
- **Marge contributive estimée** : commission conservée − frais Stripe − support − fraude/litiges.
- **Marge nette estimée** : marge contributive − coût acquisition. Elle reste `inconnue` si le CAC de la catégorie est indisponible.

La marge nette estimée est une lecture économique unitaire/contributive du flux KLYX, **pas un bénéfice comptable complet**. Les impôts, la TVA, les frais fixes, la paie, l'infrastructure et tout autre coût non attribué ne sont jamais supposés égaux à zéro : ils restent simplement hors de cette mesure tant qu'ils ne sont pas suivis de façon fiable.

La couverture des frais Stripe est également fail-closed : tant qu'au moins une réservation payée de la catégorie n'a pas son vrai frais Stripe synchronisé et attribué à cette réservation, les **frais Stripe**, la **marge contributive** et la **marge nette estimée** restent `inconnus`. Une absence de donnée ne devient jamais artificiellement `0 €`.

La lecture des remboursements est elle aussi fail-closed. Si, dans une fenêtre temporelle, un **remboursement apparaît sans le paiement d'origine** de la même réservation, KLYX publie le remboursement mais garde la commission conservée et les marges `inconnues` au lieu de fabriquer un résultat à partir d'un contexte financier incomplet.

Aucune valeur monétaire n'est agrégée entre devises différentes.

### Funnel par cohorte

- **Demande → proposition** : demandes ayant reçu au moins une proposition / demandes de la cohorte.
- **Proposition → réservation** : réservations issues de la cohorte / nombre total de propositions réelles.
- **Réservation → mission terminée** : réservations ayant atteint `completed` / réservations de la cohorte.
- **Repeat rate** : clients ayant au moins deux missions `completed` dans la catégorie sur la fenêtre / clients ayant au moins une mission `completed` dans cette catégorie sur la fenêtre.

Le repeat rate est descriptif tant que suffisamment de temps n'a pas passé. Il ne doit pas être présenté comme une preuve de rétention précoce.

## Seuil de lecture

Avant **10 missions réellement terminées et payées** dans le pilote, KLYX ne doit pas tirer de conclusion économique forte. Le seuil n'est pas un objectif à fabriquer : il sert uniquement à empêcher une interprétation prématurée.

Même après 10 missions, l'échantillon reste petit. Les résultats servent à décider s'il faut poursuivre l'expérience, pas à extrapoler une économie nationale ou mondiale.

## Conditions de preuve des deux boucles

### Boucle client

Une boucle complète exige, pour une vraie demande enrôlée :

1. demande réelle vérifiée dans la zone et le service pilote ;
2. au moins une vraie proposition ;
3. réservation reliée à la demande ;
4. paiement réussi dans le ledger ;
5. mission `completed`.

### Boucle prestataire

Une boucle complète exige :

1. disponibilité réelle et objectif de revenu explicitement vérifiés ;
2. vraie `market_service_offer` déjà envoyée ;
3. proposition acceptée ;
4. réservation réelle ;
5. mission `completed` ;
6. paiement KLYX réussi avec `provider_amount_cents > 0`.

Ce dernier point prouve qu'un montant prestataire a été enregistré dans le flux financier KLYX. Il ne prétend pas, à lui seul, prouver le virement bancaire Stripe final vers le compte du prestataire.

## Conditions d'arrêt

Le pilote est suspendu ou ne doit pas être élargi si l'un des points suivants apparaît :

- incohérence de paiement ou de remboursement ;
- frais essentiels non traçables ;
- problème de sécurité, fraude ou confiance non maîtrisé ;
- qualité de mission insuffisante ou missions non terminées ;
- offre prestataire insuffisante pour répondre aux besoins réels ;
- marge contributive négative persistante après coûts réels ;
- besoin de contourner les règles pour faire monter les taux.

## Règle d'expansion

Aucune expansion n'est déclenchée par :

- le nombre d'inscriptions ;
- les recherches ;
- les impressions ;
- les demandes seules ;
- un taux isolé sans paiements et missions terminées.

Après preuve suffisante des deux boucles, KLYX peut tester **un seul élargissement à la fois** : soit une zone voisine, soit un service voisin. Il ne faut pas ouvrir plusieurs catégories simultanément, car cela détruirait la capacité à savoir ce qui crée réellement la valeur.
