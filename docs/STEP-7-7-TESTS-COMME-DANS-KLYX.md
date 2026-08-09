# KLYX — ÉTAPE 7.7
# TEST EXACTEMENT COMME C'EST ÉCRIT DANS L'APPLICATION

IMPORTANT :
Ce document utilise les noms visibles dans KLYX.
Pas de noms techniques d'API à chercher.

---

## AVANT LE TEST

Utilise deux NOUVEAUX comptes :
- un nouveau CLIENT
- un nouveau PRESTATAIRE

Ne valide pas seulement avec les anciens comptes de développement.

---

# A — NOUVEAU PRESTATAIRE

## 1. Inscription

Sur la page d'inscription :

- choisis **Prestataire**
- termine l'inscription
- ouvre **Première configuration**

Attendu :
- le parcours indique **Parcours prestataire**

## 2. Premier profil

Si KLYX affiche :

**Créons ton premier profil KLYX**

remplis :
- Prénom
- Nom
- Ville
- Prestataire
- Premier métier

Puis clique :

**Créer mon espace prestataire**

Attendu :
- KLYX ouvre l'onboarding prestataire.

## 3. Onboarding

Dans **Prépare ton activité**, vérifie les cartes :

- **Premier métier**
- **Zone d’intervention**
- **Vérification**
- **Paiements**

Le bouton :

**Actualiser**

doit mettre à jour la progression.

## 4. Activité professionnelle

Clique :

**Ouvrir mon activité**

Dans `/provider`, vérifie :

**Statut de visibilité**

Attendu :
les éléments de configuration sont visibles.

Le profil doit avoir :
- un métier actif
- un service complet
- une zone active
- le profil professionnel publié

---

# B — NOUVEAU CLIENT

## 5. Inscription

Crée un second nouveau compte.

Choisis :

**Client**

Après connexion, ouvre :

**Première configuration**

Attendu :
- **Parcours client**

Si KLYX affiche :

**Créons ton premier profil KLYX**

remplis le formulaire puis clique :

**Créer mon espace client**

---

# C — RECHERCHE

## 6. Trouver le prestataire

Depuis le compte client, ouvre :

**Recherche**

Cherche :
- le métier créé
- la ville / zone configurée

Attendu :
le nouveau prestataire apparaît.

IMPORTANT :
si aucune zone active n'existe, le prestataire ne doit PAS apparaître.

---

# D — RÉSERVATION

## 7. Envoyer une demande

Depuis la fiche prestataire, crée une réservation.

Après création, KLYX doit afficher :

**Demande envoyée**

et le message :

**Demande envoyée. Le prestataire vient d’être averti.**

---

# E — PRESTATAIRE ACCEPTE

## 8. Ouvrir la réservation

Passe sur le profil prestataire.

Ouvre :

**Réservations & missions**

Puis ouvre la nouvelle réservation.

Dans la partie :

**Actions**

tu dois voir :

**Accepter**
**Refuser**

Clique :

**Accepter**

Attendu :
le statut devient :

**Réservation acceptée**

---

# F — CLIENT PAIE

## 9. Paiement

Repasse sur le profil client.

Ouvre :

**Réservations**

Puis la réservation acceptée.

Dans :

**Actions**

le bouton doit être :

**Payer la réservation**

Clique dessus.

Après paiement test réussi, KLYX doit afficher :

**Paiement effectué avec succès**

Puis le bouton :

**Suivre la prestation**

doit apparaître.

IMPORTANT :
si tu réessaies de payer la même réservation, KLYX ne doit pas créer un second paiement.

---

# G — SUIVI DE LA MISSION

## 10. Ouvrir le suivi

Avec le prestataire, ouvre la réservation puis clique :

**Suivre la prestation**

La page affiche :

**État de la mission**

et les étapes :

- **Prestation planifiée**
- **Prestataire en route**
- **Prestataire arrivé**
- **Prestation en cours**
- **Mission confirmée**

## 11. Prestataire en route

Clique :

**Je suis en route**

Attendu :
**Prestataire en route**

## 12. Prestataire arrivé

Clique :

**Je suis arrivé**

Attendu :
**Prestataire arrivé**

## 13. Commencer

Clique :

**Commencer la prestation**

Attendu :
**Prestation en cours**

## 14. Terminer côté prestataire

Clique :

**Déclarer la mission terminée**

Attendu :
KLYX affiche :

**Confirmation du client attendue**

---

# H — CLIENT CONFIRME

## 15. Confirmation finale

Passe sur le profil client.

Ouvre la même réservation.

Clique :

**Suivre la prestation**

Puis :

**Confirmer la fin de mission**

Attendu :
la dernière étape devient :

**Mission confirmée**

et la réservation doit afficher :

**Prestation terminée**

---

# I — AVIS

## 16. Avis

Après confirmation de la mission, le client doit recevoir une demande d'avis.

Ouvre la notification correspondante puis vérifie que le parcours d'avis est disponible.

---

# J — TESTS DE PROTECTION

## 17. Sans zone active

Avec le prestataire :
- retire toutes les zones actives du métier.

Avec le client :
- ouvre **Recherche**

Attendu :
le prestataire ne doit plus apparaître.

Une nouvelle demande directe de réservation ou de devis doit aussi être refusée.

Réactive ensuite la zone pour continuer les futurs tests.

---

# VALIDATION DE L'ÉTAPE 7

L'ÉTAPE 7 EST TERMINÉE seulement si :

[ ] Nouveau prestataire créé
[ ] Premier profil prestataire créé
[ ] Premier métier configuré
[ ] Zone active configurée
[ ] Profil professionnel publié
[ ] Nouveau client créé
[ ] Prestataire visible dans Recherche
[ ] Demande envoyée
[ ] Prestataire clique Accepter
[ ] Client voit Payer la réservation
[ ] Paiement test réussi
[ ] Suivre la prestation disponible
[ ] Je suis en route fonctionne
[ ] Je suis arrivé fonctionne
[ ] Commencer la prestation fonctionne
[ ] Déclarer la mission terminée fonctionne
[ ] Confirmer la fin de mission fonctionne
[ ] Mission confirmée
[ ] Avis disponible
[ ] Pas de double paiement
[ ] Sans zone active : prestataire masqué

Quand tout est coché :
ÉTAPE 7 TERMINÉE.
