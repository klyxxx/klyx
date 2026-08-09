# KLYX — Étape 7.7 — Cycle production complet

Cette étape ne réécrit pas les fonctions déjà validées. Elle sert de **porte de sortie de l'étape 7**.

## Règle de validation

L'étape 7 est terminée seulement si un cycle neuf fonctionne de bout en bout :

1. Nouveau compte prestataire.
2. Onboarding prestataire terminé.
3. Métier actif.
4. Profil professionnel publié.
5. Service disponible avec tarif.
6. Zone active.
7. Nouveau compte client.
8. Recherche du prestataire.
9. Demande de réservation.
10. Prestataire accepte.
11. Client peut atteindre l'étape de paiement.
12. Après paiement de test confirmé : suivi de mission disponible.
13. Prestataire : En route → Arrivé → Prestation commencée.
14. Prestataire déclare la mission terminée.
15. Client confirme la fin.
16. Réservation devient `completed`.
17. Client reçoit la demande d'avis.

## Contrôles négatifs obligatoires

A. Retirer toutes les zones actives du métier :
- le prestataire ne doit plus apparaître dans `/search`;
- une nouvelle réservation directe doit être refusée;
- une nouvelle demande de devis directe doit être refusée.

B. Dépublier le profil :
- une nouvelle demande de devis doit être refusée.

C. Réservation déjà payée :
- KLYX ne doit pas créer un second paiement.

D. Mission non payée :
- le suivi ne doit pas pouvoir commencer.

## Ce que le code actuel garantit déjà

`/api/bookings/status`
- seul le prestataire peut accepter/refuser;
- contrôle des conflits de créneaux;
- annulation payée déclenche le remboursement;
- prestation déjà commencée => litige plutôt que remboursement automatique.

`/api/bookings/tracking`
- réservation obligatoirement acceptée;
- paiement obligatoirement `paid`;
- transitions de mission contrôlées;
- fin prestataire puis confirmation client;
- création de la notification d'avis.

`/api/stripe/create-checkout-session`
- réservation obligatoirement acceptée;
- blocage si déjà payée;
- verrou de paiement;
- réutilisation d'une session Checkout ouverte;
- Stripe Connect si le prestataire est prêt;
- commission KLYX configurable.

## Validation

Après les tests, coche chaque ligne dans `docs/STEP-7-7-PRODUCTION-CYCLE.md`.

Quand les 17 étapes + A/B/C/D passent :
**ÉTAPE 7 TERMINÉE**.

La prochaine phase est l'ÉTAPE 8 : paiements production, comptabilité transactionnelle, commissions, remboursements et audit Stripe.
