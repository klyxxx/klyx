# KLYX Auth anti-abus — Supabase + Cloudflare Turnstile

KLYX utilise directement Supabase Auth depuis les formulaires publics de connexion, d'inscription et de demande de réinitialisation de mot de passe. La protection anti-bot doit donc être appliquée par Supabase Auth lui-même ; un simple middleware Next.js serait contournable par un client qui appelle directement GoTrue.

## Ce que le code KLYX prépare

Quand `NEXT_PUBLIC_TURNSTILE_SITE_KEY` est définie au build :

- `/login` affiche Cloudflare Turnstile ;
- la connexion transmet `options.captchaToken` à `signInWithPassword` ;
- la demande « mot de passe oublié » transmet `captchaToken` à `resetPasswordForEmail` ;
- `/signup` transmet `options.captchaToken` à `signUp` ;
- un token est exigé avant l'appel Auth puis réinitialisé après chaque tentative afin de ne pas être réutilisé.

La site key est publique par nature. La Secret key Cloudflare ne doit jamais être ajoutée au code client ni à une variable `NEXT_PUBLIC_*`.

## Activation obligatoire dans Supabase production

Le câblage frontend seul n'active pas la vérification serveur. Dans le projet Supabase production :

1. ouvrir **Settings > Authentication > Bot and Abuse Protection** ;
2. activer **Enable CAPTCHA protection** ;
3. choisir **Cloudflare Turnstile** ;
4. renseigner la **Secret key** Cloudflare ;
5. sauvegarder ;
6. configurer `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dans l'environnement Vercel de production puis reconstruire le déploiement ;
7. vérifier réellement signup, login et password reset sur le domaine KLYX autorisé par le widget Turnstile.

Tant que l'activation Supabase et le smoke-test production ne sont pas observés, **ne pas considérer la protection CAPTCHA comme active**. Les rate limits natifs de Supabase Auth restent une protection indépendante, mais ne remplacent pas cette preuve CAPTCHA.

## Développement et CI

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` reste volontairement optionnelle afin de ne pas envoyer les suites E2E locales vers Cloudflare. Sans cette variable, le composant ne charge aucun script externe et les tests Auth existants continuent d'utiliser l'environnement Supabase isolé.

Pour un test manuel dédié, utiliser une clé Turnstile de test ou une configuration Cloudflare autorisant explicitement le domaine de test ; ne jamais placer la Secret key dans le navigateur.
