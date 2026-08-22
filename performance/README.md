# KLYX Performance Certification

KLYX utilise **k6 comme outil principal de performance** et **ApacheBench (`ab`) comme outil rapide de diagnostic ponctuel**.

## Objectif

La certification doit détecter les régressions de latence, débit et stabilité avant production, tout en protégeant Stripe, les emails, les réservations et les données utilisateurs réelles.

## Règles de sécurité non négociables

- Les profils k6 `ci`, `load`, `stress`, `spike` et `soak` refusent toute cible non-loopback.
- Le workflow GitHub démarre un **Supabase local éphémère**, un compte de test dédié et un serveur Next.js local.
- Le scénario k6 officiel est **read-only** : pages publiques, recherche prestataire, fiche prestataire et lecture authentifiée des plans agent.
- Le wrapper ApacheBench officiel refuse toute URL autre que `localhost`, `127.0.0.1` ou `::1`.
- Ne jamais lancer stress/spike/soak contre Vercel Production, Supabase Production, Stripe réel, emails réels ou réservations réelles.
- Les parcours transactionnels restent prouvés par le Golden Path isolé. Le paiement Stripe réseau TEST reste un test contrôlé séparé, jamais un test de charge.

## Installation locale

### k6

Installer Grafana k6 puis vérifier :

```powershell
k6 version
```

### ApacheBench

Installer ApacheBench (`ab`) via Apache HTTP Server / apache2-utils selon l'environnement puis vérifier :

```powershell
ab -V
```

## Commandes k6

Démarrer KLYX localement puis utiliser :

```powershell
npm run perf:k6:smoke
npm run perf:k6:load
npm run perf:k6:stress
npm run perf:k6:spike
npm run perf:k6:soak
```

Le profil `ci` est réservé à GitHub Actions :

```powershell
npm run perf:k6:ci
```

La cible locale par défaut est `http://127.0.0.1:3000`.

Pour une autre cible **locale uniquement** :

```powershell
$env:KLYX_PERF_BASE_URL="http://127.0.0.1:3100"
npm run perf:k6:smoke
```

## Profils

| Profil | But | Charge par défaut |
| --- | --- | --- |
| `smoke` | Vérifier rapidement que les métriques et routes fonctionnent | 1 VU / 4 itérations |
| `ci` | Détecter une régression à chaque PR pertinente | jusqu'à 5 VUs / ~40 s |
| `load` | Charge normale soutenue | jusqu'à 20 VUs |
| `stress` | Chercher les limites d'une instance isolée | jusqu'à 60 VUs |
| `spike` | Pic brutal | jusqu'à 75 VUs |
| `soak` | Détecter dérives/fuites dans la durée | 10 VUs / 15 min par défaut |

Pour raccourcir/allonger un soak local :

```powershell
$env:KLYX_PERF_SOAK_DURATION="30m"
npm run perf:k6:soak
```

## Seuils de certification initiaux

Le test échoue si l'un des seuils suivants est dépassé :

- erreurs HTTP : `< 1 %` ;
- checks k6 : `> 99 %` ;
- latence globale : p50 `< 350 ms`, p95 `< 900 ms`, p99 `< 1600 ms` ;
- recherche prestataire : p95 `< 1000 ms`, p99 `< 1800 ms` ;
- lecture authentifiée : p95 `< 900 ms`, p99 `< 1600 ms` ;
- échec d'un parcours KLYX : `< 1 %`.

Ces valeurs sont des **budgets initiaux CI**, pas une promesse produit immuable. Elles doivent être resserrées à mesure que KLYX acquiert des mesures réelles et une infrastructure stable.

## ApacheBench

Benchmark rapide local :

```powershell
npm run perf:ab
```

Ou directement :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/performance/ab-local.ps1 `
  -Url "http://127.0.0.1:3000/login" `
  -Requests 500 `
  -Concurrency 20
```

`ab` sert à comparer rapidement une route avant/après optimisation. k6 reste la source officielle pour les parcours, percentiles, seuils et la certification CI.

## GitHub Actions

Le workflow `KLYX Performance Certification` :

1. crée Supabase local éphémère ;
2. crée des données KLYX de test dédiées ;
3. exécute tests, TypeScript et build ;
4. démarre le serveur production Next.js local ;
5. exécute k6 ;
6. exécute ApacheBench sur `/login` ;
7. publie les preuves (`k6-summary.json`, sortie ApacheBench, log serveur) pendant 30 jours ;
8. détruit l'environnement éphémère.

Sur Pull Request, le profil `ci` est automatique. Les profils `smoke`, `load`, `stress`, `spike` et `soak` peuvent être lancés manuellement, mais uniquement après confirmation explicite que la cible est isolée.

## Ce que KLYX ne doit jamais faire

Ne jamais utiliser cette suite pour générer en masse :

- des paiements ou PaymentIntents Stripe ;
- des réservations réelles ;
- des emails/SMS ;
- des uploads KYC ;
- des avis/messages utilisateurs ;
- des écritures sur Supabase Production.

Les opérations transactionnelles sont testées séparément avec données éphémères, faible volume et garde-fous explicites.
