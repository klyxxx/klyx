# KLYX External Cost Control

Date d'audit : 2026-09-26.

## Invariant

> Aucune facture externe incontrôlée.

Le développement et la certification doivent rester possibles avec **0 € disponible**.

L'External Cost Control Plane est une couche de décision/comptage. Il ne devient pas une nouvelle autorité opérationnelle : `ops_capability_controls` reste le kill switch canonique et les autorités Stripe/ledger/eligibility restent inchangées.

## Mode 0 € par défaut

- `KLYX_EXTERNAL_COST_CONTROL_ENABLED` : actif sauf valeur explicite `0`.
- `KLYX_OPENAI_MONTHLY_BUDGET_USD=0` par défaut.
- `KLYX_TWILIO_MONTHLY_BUDGET_USD=0` par défaut.
- `KLYX_SUMSUB_MONTHLY_BUDGET_USD=0` par défaut.
- `KLYX_ELMAH_MONTHLY_BUDGET_USD=0` par défaut.
- Resend : plafond interne mensuel `2700` emails, sous le quota observé de `3000`.
- Les tests Vitest utilisent leurs mocks sans consommer de budget externe. Les tests qui veulent certifier le contrôle de coût mettent `KLYX_EXTERNAL_COST_CONTROL_TEST_MODE=enforce`.

## Routage IA

```text
question déterministe KLYX
→ réponse locale
→ 0 appel OpenAI

question non déterministe
→ OpenAI seulement si :
   KLYX_OPENAI_ENABLED=1
   + clé disponible
   + budget mensuel > 0
   + réservation durable de coût réussie
sinon
→ fallback local
```

Le coût maximum réservé par appel est configurable avec `KLYX_OPENAI_MAX_CALL_USD` (défaut prudent : `0.01`). Pour un futur mode payant minimal, utiliser le modèle le moins cher qui satisfait les tests KLYX, actuellement la famille Luna, et conserver le modèle haut de gamme uniquement pour les cas explicitement justifiés.

## Audit fournisseurs

| Fournisseur | Situation KLYX actuelle | Gratuit / coût public pertinent | Appels nécessaires | Appels à éviter | Fallback 0 € | Cache / batching | Remplaçable | Seuil KLYX avant payant |
|---|---|---|---|---|---|---|---|---|
| OpenAI | API payante désactivable ; fallback déterministe existant | API facturée aux tokens, pas de free tier permanent garanti | uniquement raisonnement réellement non déterministe | salutations, cadrage budget, états KLYX, calculs/règles déterministes | moteur local déterministe | cache des réponses déterministes et contexte compact ; batch uniquement hors temps réel | oui | **0 $/mois** actuellement ; activation explicite seulement |
| Supabase | DB/Auth/Storage canonique | Free : quotas DB/Auth/Storage/egress ; API requests non facturées à l'unité | auth, vérité DB, RLS, workflows | polling, gros SELECT, duplications de données | Supabase local en dev/CI | cache lecture ; requêtes groupées ; pagination | oui, mais migration coûteuse | rester Free jusqu'à proximité durable de 80 % d'un quota critique |
| Stripe | TEST intensif ; LIVE séparément verrouillé | TEST gratuit ; LIVE facturé sur transactions / Connect selon configuration | paiement réel uniquement après confirmation | polling, création de sessions doublons, LIVE pour tests | Stripe TEST + fake adapters | idempotency ; webhooks au lieu de polling | partiellement | **aucun LIVE** tant que readiness + budget/business ne l'exigent |
| Sumsub | KYC intégré | essai limité ; production facturée par vérification avec minimum commercial selon offre | seulement au moment où KYC/KYB est réellement requis | token KYC trop tôt, re-vérifications inutiles | fixtures KYC locales en dev/test | réutiliser état vérifié ; webhook plutôt que polling | oui | **0 $/mois** : initiation bloquée actuellement |
| Twilio Verify | OTP téléphone intégré | facturation par vérification + canal/SMS | uniquement preuve téléphone réellement requise | OTP de confort, resend agressif | OTP mock uniquement en dev/test, jamais bypass production | cooldown/déduplication | oui | **0 $/mois** : envoi bloqué actuellement |
| Resend | email transactionnel + déduplication | quota observé : 100/jour, 3000/mois | emails transactionnels importants / alertes critiques | duplications, emails remplaçables par notification in-app | notification in-app + logs | idempotency déjà présent ; batch pour non urgent | oui | plafond interne **2700/mois** ; passer payant seulement après besoin durable |
| Tolgee | gestion de traductions ; runtime sur JSON commités | plan gratuit disponible avec plafond de clés/sièges | synchronisation traduction pendant développement | appel Tolgee à chaque rendu | catalogues JSON commités | cache total au build | oui | runtime externe = **0 appel** |
| Cloudflare | Turnstile auth | Turnstile gratuit, challenges sans coût à l'unité | challenge auth anti-bot | ajouter Workers/services payants sans besoin | rate limits KLYX | script navigateur cacheable | oui | rester Turnstile Free |
| elmah.io | télémétrie production fail-open | pas de free tier permanent après essai selon offre publique | seulement erreurs serveur réellement utiles | heartbeat/bruit haute fréquence si abonnement non justifié | Vercel logs + logs serveur | déduplication/agrégation d'erreurs | oui | **0 $ de nouveau budget** ; service non critique |
| Vercel | hébergement KLYX ; déploiement Git auto déjà désactivé | Hobby gratuit avec quotas, mais usage commercial permanent nécessite plan adapté aux conditions Vercel | production/preview voulus | déploiement à chaque commit, fonctions non cachées | Next.js local | CDN/cache ; regrouper déploiements | oui | développement local d'abord ; payant seulement avant usage commercial nécessitant le plan |
| GitHub | repo public + Actions standard | repo public : runners standard Actions gratuits ; larger runners facturés | CI/certification | artifacts longs, workflows redondants, larger runners | git local | cache npm ; regrouper matrices | oui | runners standard uniquement ; rétention courte |

## Appels réellement nécessaires

1. **Supabase** : source de vérité applicative et auth ; conserver.
2. **Stripe TEST** : certification financière ; conserver. LIVE reste une autorité séparée.
3. **Cloudflare Turnstile** : anti-abus auth gratuit ; conserver.
4. **GitHub standard runners** : CI du repo public ; conserver.
5. **Vercel** : seulement pour les déploiements voulus ; pas de déploiement Git automatique.
6. **Resend** : uniquement transactionnel/critique dans le quota interne.
7. **OpenAI/Twilio/Sumsub** : zéro appel externe tant que leurs budgets sont à 0.
8. **Tolgee** : zéro appel runtime ; synchronisation manuelle/CI seulement.
9. **elmah.io** : non critique ; logs locaux/Vercel sont le fallback.

## Réservation durable

`external_provider_usage_monthly` conserve, par fournisseur et mois :

- unités réservées ;
- coût maximal réservé en micro-USD ;
- dernière action ;
- timestamp.

`klyx_reserve_external_provider_usage(...)` verrouille atomiquement la ligne avant l'appel externe. Si la limite d'unités ou le budget serait dépassé : **aucun appel n'est effectué**.

À 80 % du quota/budget, KLYX émet `KLYX_EXTERNAL_COST_ALERT`. Au dépassement, `KLYX_EXTERNAL_COST_CIRCUIT_OPEN` est émis et la fonction non critique bascule vers son fallback.

## Fallbacks de développement

- IA : déterministe local.
- DB/Auth : Supabase local éphémère.
- Stripe : TEST / fake adapter.
- KYC : fixtures locales, jamais considérées comme KYC production.
- OTP : mock test uniquement, jamais accepté en production.
- Email : notification in-app/log.
- traductions : catalogues commités.
- observabilité : console/Vercel logs.
- hébergement : `npm run dev` / `npm run start` local.

## Règle d'activation payante

Un fournisseur payant n'est réactivé que si les quatre conditions sont vraies :

1. besoin produit non remplaçable par le chemin gratuit ;
2. budget mensuel explicite non nul ;
3. limite d'unités explicite ;
4. preuve de monitoring + fallback/circuit breaker.

Une clé API présente ne constitue jamais une autorisation de dépense.
