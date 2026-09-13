# KLYX — Runbook du pilote réel Anneessens

Ce document décrit **l'exploitation** du pilote local déjà défini dans `KLYX_LOCAL_VALUE_PILOT.md`. Il ne change pas le périmètre économique et ne transforme pas le pilote en lancement général.

## Périmètre verrouillé

- Pays : Belgique
- Ville : Bruxelles
- Zone vérifiée manuellement : Anneessens
- Catégorie : Bricolage & réparation
- Service unique : Montage de meubles
- Maximum : 5 prestataires réels
- Maximum : 20 demandes réelles
- Acquisition payante : désactivée
- Transactions synthétiques : interdites
- Seuil minimal avant lecture économique forte : 10 missions réellement terminées et payées

Aucune deuxième zone, catégorie ou service n'est ouvert automatiquement. Le seuil de 10 autorise une **analyse**, pas une expansion.

## Source de vérité

La console `/founder/business/pilot` ne crée aucune preuve. Elle lit uniquement les données transactionnelles KLYX :

1. `business_pilot_requests` pour la cohorte explicitement vérifiée ;
2. `market_service_requests` pour les demandes réelles ;
3. `market_service_offers` pour les propositions réelles ;
4. `service_quotes` et `bookings` pour la réservation ;
5. `booking_financial_ledger` pour le paiement et les remboursements ;
6. `business_pilot_income_attempts` pour la disponibilité et l'objectif de revenu vérifiés du prestataire.

Les identifiants affichés dans la console sont des identifiants KLYX. La console n'a pas besoin de stocker une adresse précise ou des coordonnées de contact supplémentaires.

## Ordre d'exécution

La file opérateur applique l'ordre suivant :

1. **Revue financière** — une mission entièrement remboursée n'est pas comptée comme preuve économique réussie.
2. **Paiement** — une réservation sans paiement observé reste à sécuriser.
3. **Exécution** — un paiement observé ne suffit pas ; la mission doit réellement atteindre `completed`.
4. **Réservation** — une offre acceptée doit devenir une réservation canonique.
5. **Décision client** — une proposition non acceptée ne prouve pas la boucle.
6. **Proposition** — une demande sans proposition nécessite une vraie offre prestataire.
7. **Nouvelle demande réelle** — uniquement lorsque les demandes déjà enrôlées n'ont plus de blocage et que le plafond de 20 n'est pas atteint.

L'opérateur ne doit jamais modifier manuellement un statut transactionnel uniquement pour faire progresser la métrique.

## Première demande

Quand la cohorte est vide, la prochaine action est d'obtenir **organiquement** une vraie demande Anneessens de montage de meubles. Une fixture, un compte de démonstration ou une transaction interne ne compte pas.

Après création normale de la demande dans KLYX :

1. vérifier qu'il s'agit bien de Montage de meubles ;
2. vérifier explicitement que la mission est dans Anneessens ;
3. l'enrôler via `/founder/business` ;
4. laisser la console opérationnelle dériver la prochaine action à partir des données canoniques.

## Prestataires

Un prestataire n'entre dans le compteur opérationnel que lorsqu'un `business_pilot_income_attempts` vérifié pointe vers une **vraie offre** de la cohorte. La disponibilité et l'objectif de revenu doivent avoir été réellement déclarés et vérifiés.

Le sixième prestataire n'est pas accepté automatiquement. Si cinq prestataires distincts sont déjà suivis, le recrutement supplémentaire est verrouillé pour ce pilote.

## Paiement et remboursement

Une mission est une preuve opérationnelle `completed_paid` uniquement si :

- une réservation canonique existe ;
- son statut est `completed` ;
- un `payment_succeeded` réel avec un montant positif est observé dans le ledger ;
- elle n'est pas entièrement remboursée.

Si le total des `refund_succeeded` atteint ou dépasse le paiement observé, la mission passe en `financial_review`. Elle ne compte pas dans le seuil opérationnel de 10 tant que la situation n'est pas comprise.

## Conditions d'arrêt

### Succès minimal

À partir de 10 missions réellement terminées et payées, l'acquisition n'est pas automatiquement élargie. KLYX analyse :

- conversion demande → proposition ;
- conversion proposition → réservation ;
- réservation → mission terminée ;
- marge contributive et coûts réels ;
- remboursements, litiges et support ;
- boucle revenu prestataire.

### Plafond atteint sans preuve

Si 20 demandes réelles sont consommées avant d'obtenir 10 missions réellement terminées et payées, l'intake est verrouillé. La bonne action est **stop and review**, pas `maxRealRequests = 40`.

### Prestataires

À 5 prestataires distincts suivis, le recrutement supplémentaire est verrouillé. Le pilote doit apprendre à partir de cette offre disponible avant d'ajouter de la supply.

## Ce que la console ne prouve pas

- Elle ne prouve pas le virement bancaire final Stripe vers le prestataire ; le ledger KLYX prouve seulement le montant prestataire enregistré.
- Elle ne transforme pas une inscription, une recherche, un clic ou une conversation en GMV.
- Elle ne remplace pas les coûts réels manquants par `0 €`.
- Elle ne permet pas de conclure que KLYX a validé son marché avant le seuil et l'analyse économique.
