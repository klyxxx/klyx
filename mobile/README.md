# KLYX Mobile

Client Android/iOS de KLYX. Il consomme le **KLYX Core existant** et ne réimplémente aucun moteur métier.

## Architecture

```text
                 KLYX Core
                    │
          orchestration / API
             ┌──────┴──────┐
             │             │
         Web Next.js    Mobile KLYX
```

Le mobile utilise :

- Supabase pour l'authentification, la session persistée et les lectures autorisées par RLS ;
- `/api/assistant/unified` pour l'assistant IA ;
- `/api/stripe/create-checkout-session` pour demander au serveur un Checkout Stripe ;
- `/api/provider/sumsub/token` + le MobileSDK Sumsub natif pour KYC ;
- `/api/provider/sumsub/status` pour l'état KYC ;
- `/api/provider/finance` pour la projection finance/ledger prestataire ;
- les APIs booking KLYX et la table `bookings` en lecture RLS ;
- `user_notifications` en lecture/Realtime RLS et `/api/mobile/notifications/read` pour les mutations ;
- APNs/FCM natifs pour les notifications système quand l'application est fermée ;
- les catalogues Tolgee versionnés dans `messages/tolgee` ;
- Twilio et Resend uniquement à travers les workflows serveur KLYX existants.

## Frontière de sécurité

Le mobile **n'est jamais une autorité** pour :

- calcul de prix, commission, taxe ou FX ;
- Economic Eligibility ;
- ledger ou settlement ;
- décision KYC/KYB ;
- création de Transfer, Refund, Reversal ou Payout ;
- envoi Twilio/Resend direct ;
- envoi APNs/FCM direct ;
- secrets Stripe, Sumsub, Twilio, Resend, OpenAI, APNs, FCM ou clé Supabase service-role.

Une décision affichée par le mobile reste une projection de la vérité serveur. Toute action sensible repart vers KLYX Core avec le JWT Supabase de l'utilisateur.

## Variables publiques

Copier `.env.example` vers `.env` et renseigner uniquement :

```text
EXPO_PUBLIC_KLYX_API_BASE_URL
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Ces valeurs sont des paramètres publics du client. Ne jamais ajouter de secret serveur dans une variable `EXPO_PUBLIC_*`.

Pour Android, `KLYX_GOOGLE_SERVICES_FILE` peut pointer vers le `google-services.json` utilisé pendant le build. Le fichier contient la configuration Firebase de l'application ; la **clé privée FCM serveur n'est jamais embarquée** dans le client.

## Développement

Node 22.13+ est requis.

```powershell
cd C:\Users\fenjo\Documents\klyx\mobile
npm install
npm run typecheck
npm run android
```

Pour iOS, utiliser EAS Build depuis Windows ou exécuter `npm run ios` sur macOS.

`npm install` synchronise automatiquement les snapshots Tolgee depuis `../messages/tolgee`.

## Sumsub

Le client utilise `@sumsub/react-native-mobilesdk-module`. Il faut donc un **development build** / binaire natif ; Expo Go ne suffit pas. Le token d'accès Sumsub est obtenu dynamiquement depuis KLYX Core et renouvelé depuis le même endpoint.

## Paiement

Le mobile ne contient pas Stripe Secret ni de logique de paiement. Pour une réservation payable :

```text
mobile
→ POST /api/stripe/create-checkout-session
→ risk + market + eligibility + settlement policy côté serveur
→ Stripe Checkout URL
→ ouverture de l'URL par le mobile
```

Le serveur reste responsable de l'idempotence, de la prévention du double paiement, du ledger, des webhooks et de la réconciliation.

## Push natif APNs + FCM

Le client utilise `expo-notifications` uniquement comme couche native pour demander la permission et obtenir le **device push token**. Il n'utilise pas Expo Push Service.

```text
user_notifications
→ trigger DB
→ mobile_push_outbox
→ wake-up immédiat pg_net
→ worker KLYX
→ FCM v1 (Android) / APNs HTTP2 (iOS)
→ appareil
```

Un cron minute sert de récupération si le wake-up immédiat échoue. Les claims expirés sont récupérables, chaque `(notification, installation)` est idempotent et les tokens invalidés par Apple/Google sont désactivés automatiquement.

Le contenu système est volontairement générique (`Nouvelle activité dans KLYX`). Le détail reste dans `user_notifications` et n'est récupéré qu'après authentification dans l'application.

### Secrets serveur requis pour l'activation

Ils restent exclusivement côté serveur :

```text
KLYX_FCM_PROJECT_ID
KLYX_FCM_CLIENT_EMAIL
KLYX_FCM_PRIVATE_KEY
KLYX_APNS_TEAM_ID
KLYX_APNS_KEY_ID
KLYX_APNS_PRIVATE_KEY
KLYX_APNS_BUNDLE_ID=app.klyx.mobile
KLYX_APNS_ENV=production
```

Le wake-up Supabase utilise un token distinct stocké dans **Supabase Vault** sous le nom `klyx_mobile_push_scheduler_token`. La table `ops_mobile_push_scheduler` ne conserve que son SHA-256 et reste `enabled=false` tant que l'environnement n'est pas explicitement certifié.

## Validation

Le workflow `.github/workflows/klyx-mobile-ci.yml` valide automatiquement :

1. installation des dépendances mobile ;
2. synchronisation Tolgee ;
3. TypeScript ;
4. génération native Android Expo ;
5. génération native iOS Expo ;
6. contrat de frontière mobile côté tests KLYX ;
7. contrat durable APNs/FCM côté KLYX Core.
