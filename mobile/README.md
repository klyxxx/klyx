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
- `user_notifications` en lecture/Reatime RLS et `/api/mobile/notifications/read` pour les mutations ;
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
- secrets Stripe, Sumsub, Twilio, Resend, OpenAI ou clé Supabase service-role.

Une décision affichée par le mobile reste une projection de la vérité serveur. Toute action sensible repart vers KLYX Core avec le JWT Supabase de l'utilisateur.

## Variables publiques

Copier `.env.example` vers `.env` et renseigner uniquement :

```text
EXPO_PUBLIC_KLYX_API_BASE_URL
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Ces valeurs sont des paramètres publics du client. Ne jamais ajouter de secret serveur dans une variable `EXPO_PUBLIC_*`.

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

## Validation

Le workflow `.github/workflows/klyx-mobile-ci.yml` valide automatiquement :

1. installation des dépendances mobile ;
2. synchronisation Tolgee ;
3. TypeScript ;
4. génération native Android Expo ;
5. contrat de frontière mobile côté tests KLYX.
