import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_LOGIN_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de", "es"] as const;

type KlyxLoginPageLocale =
  (typeof KLYX_LOGIN_PAGE_TRANSLATED_LOCALES)[number];

export type KlyxLoginMessageKey =
  | "captchaRequired"
  | "credentialsRequired"
  | "captchaFailed"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "loginFailed"
  | "resetEmailRequired"
  | "resetSent"
  | "resetFailed"
  | "checkingSession"
  | "connectionBadge"
  | "headline"
  | "description"
  | "benefitProfiles"
  | "benefitSpaces"
  | "benefitPassword"
  | "secureSession"
  | "protectedPassword"
  | "welcome"
  | "loginTitle"
  | "loginSubtitle"
  | "emailLabel"
  | "emailPlaceholder"
  | "passwordLabel"
  | "passwordPlaceholder"
  | "hidePassword"
  | "showPassword"
  | "forgotPassword"
  | "loggingIn"
  | "signIn"
  | "switchNotice"
  | "newToKlyx"
  | "createAccount";

const LOGIN_MESSAGES: Record<
  KlyxLoginPageLocale,
  Record<KlyxLoginMessageKey, string>
> = {
  fr: {
    captchaRequired: "Valide d’abord la vérification anti-robot.",
    credentialsRequired: "Renseigne ton adresse e-mail et ton mot de passe.",
    captchaFailed: "La vérification anti-robot a expiré ou a échoué. Réessaie.",
    invalidCredentials: "Adresse e-mail ou mot de passe incorrect.",
    emailNotConfirmed: "Confirme d’abord ton adresse e-mail.",
    loginFailed: "Impossible de se connecter.",
    resetEmailRequired: "Entre ton adresse e-mail avant de réinitialiser le mot de passe.",
    resetSent: "Si cette adresse est associée à un compte KLYX, un e-mail de réinitialisation vient d’être envoyé.",
    resetFailed: "Impossible d’envoyer l’e-mail.",
    checkingSession: "Vérification de la session",
    connectionBadge: "Une connexion. Tous tes espaces KLYX.",
    headline: "Retrouve ton quotidien et ton activité au même endroit.",
    description: "Connecte-toi une seule fois. Si plusieurs profils KLYX sont liés à ton compte, tu peux ensuite passer de l’un à l’autre sans ressaisir ton mot de passe.",
    benefitProfiles: "Plusieurs profils KLYX peuvent être associés à la même connexion.",
    benefitSpaces: "Client et prestataire gardent leurs espaces et parcours séparés.",
    benefitPassword: "Le changement de profil ne nécessite pas de stocker ton mot de passe.",
    secureSession: "Session sécurisée",
    protectedPassword: "Mot de passe protégé",
    welcome: "Bienvenue",
    loginTitle: "Connexion à KLYX",
    loginSubtitle: "Une connexion suffit pour retrouver les profils KLYX associés à ton compte.",
    emailLabel: "Adresse e-mail",
    emailPlaceholder: "vous@exemple.com",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Votre mot de passe",
    hidePassword: "Masquer le mot de passe",
    showPassword: "Afficher le mot de passe",
    forgotPassword: "Mot de passe oublié ?",
    loggingIn: "Connexion...",
    signIn: "Se connecter",
    switchNotice: "Après connexion, tu peux changer entre tes profils KLYX liés sans que KLYX ait besoin de conserver ton mot de passe dans le navigateur.",
    newToKlyx: "Nouveau sur KLYX ?",
    createAccount: "Créer un compte",
  },
  en: {
    captchaRequired: "Complete the anti-bot verification first.",
    credentialsRequired: "Enter your email address and password.",
    captchaFailed: "The anti-bot verification expired or failed. Try again.",
    invalidCredentials: "Incorrect email address or password.",
    emailNotConfirmed: "Confirm your email address first.",
    loginFailed: "Unable to sign in.",
    resetEmailRequired: "Enter your email address before resetting your password.",
    resetSent: "If this address is linked to a KLYX account, a password reset email has just been sent.",
    resetFailed: "Unable to send the email.",
    checkingSession: "Checking session",
    connectionBadge: "One sign-in. All your KLYX spaces.",
    headline: "Your daily life and your activity in one place.",
    description: "Sign in once. If several KLYX profiles are linked to your account, you can then switch between them without entering your password again.",
    benefitProfiles: "Several KLYX profiles can be linked to the same sign-in.",
    benefitSpaces: "Client and provider profiles keep their own separate spaces and journeys.",
    benefitPassword: "Switching profiles never requires KLYX to store your password.",
    secureSession: "Secure session",
    protectedPassword: "Protected password",
    welcome: "Welcome",
    loginTitle: "Sign in to KLYX",
    loginSubtitle: "One sign-in is enough to access the KLYX profiles linked to your account.",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Your password",
    hidePassword: "Hide password",
    showPassword: "Show password",
    forgotPassword: "Forgot password?",
    loggingIn: "Signing in...",
    signIn: "Sign in",
    switchNotice: "After signing in, you can switch between your linked KLYX profiles without KLYX needing to store your password in the browser.",
    newToKlyx: "New to KLYX?",
    createAccount: "Create an account",
  },
  nl: {
    captchaRequired: "Voltooi eerst de anti-robotcontrole.",
    credentialsRequired: "Vul je e-mailadres en wachtwoord in.",
    captchaFailed: "De anti-robotcontrole is verlopen of mislukt. Probeer opnieuw.",
    invalidCredentials: "E-mailadres of wachtwoord is onjuist.",
    emailNotConfirmed: "Bevestig eerst je e-mailadres.",
    loginFailed: "Aanmelden is niet gelukt.",
    resetEmailRequired: "Vul je e-mailadres in voordat je je wachtwoord opnieuw instelt.",
    resetSent: "Als dit adres aan een KLYX-account is gekoppeld, is zojuist een e-mail voor het opnieuw instellen verzonden.",
    resetFailed: "De e-mail kon niet worden verzonden.",
    checkingSession: "Sessie controleren",
    connectionBadge: "Eén aanmelding. Al je KLYX-profielen.",
    headline: "Je dagelijks leven en je activiteit op één plek.",
    description: "Meld je één keer aan. Als meerdere KLYX-profielen aan je account zijn gekoppeld, kun je daarna wisselen zonder je wachtwoord opnieuw in te voeren.",
    benefitProfiles: "Meerdere KLYX-profielen kunnen aan dezelfde aanmelding worden gekoppeld.",
    benefitSpaces: "Klant- en dienstverlenerprofielen behouden hun eigen aparte omgevingen en trajecten.",
    benefitPassword: "Voor het wisselen van profiel hoeft KLYX je wachtwoord niet op te slaan.",
    secureSession: "Beveiligde sessie",
    protectedPassword: "Beveiligd wachtwoord",
    welcome: "Welkom",
    loginTitle: "Aanmelden bij KLYX",
    loginSubtitle: "Eén aanmelding volstaat om de KLYX-profielen van je account terug te vinden.",
    emailLabel: "E-mailadres",
    emailPlaceholder: "jij@voorbeeld.be",
    passwordLabel: "Wachtwoord",
    passwordPlaceholder: "Je wachtwoord",
    hidePassword: "Wachtwoord verbergen",
    showPassword: "Wachtwoord tonen",
    forgotPassword: "Wachtwoord vergeten?",
    loggingIn: "Aanmelden...",
    signIn: "Aanmelden",
    switchNotice: "Na het aanmelden kun je tussen je gekoppelde KLYX-profielen wisselen zonder dat KLYX je wachtwoord in de browser hoeft te bewaren.",
    newToKlyx: "Nieuw bij KLYX?",
    createAccount: "Account aanmaken",
  },
  de: {
    captchaRequired: "Schließe zuerst die Anti-Bot-Prüfung ab.",
    credentialsRequired: "Gib deine E-Mail-Adresse und dein Passwort ein.",
    captchaFailed: "Die Anti-Bot-Prüfung ist abgelaufen oder fehlgeschlagen. Versuche es erneut.",
    invalidCredentials: "E-Mail-Adresse oder Passwort ist falsch.",
    emailNotConfirmed: "Bestätige zuerst deine E-Mail-Adresse.",
    loginFailed: "Anmeldung nicht möglich.",
    resetEmailRequired: "Gib deine E-Mail-Adresse ein, bevor du dein Passwort zurücksetzt.",
    resetSent: "Wenn diese Adresse mit einem KLYX-Konto verknüpft ist, wurde gerade eine E-Mail zum Zurücksetzen des Passworts gesendet.",
    resetFailed: "Die E-Mail konnte nicht gesendet werden.",
    checkingSession: "Sitzung wird geprüft",
    connectionBadge: "Eine Anmeldung. Alle deine KLYX-Bereiche.",
    headline: "Dein Alltag und deine Tätigkeit an einem Ort.",
    description: "Melde dich einmal an. Wenn mehrere KLYX-Profile mit deinem Konto verknüpft sind, kannst du danach zwischen ihnen wechseln, ohne dein Passwort erneut einzugeben.",
    benefitProfiles: "Mehrere KLYX-Profile können mit derselben Anmeldung verknüpft werden.",
    benefitSpaces: "Kunden- und Anbieterprofile behalten ihre getrennten Bereiche und Abläufe.",
    benefitPassword: "Beim Profilwechsel muss KLYX dein Passwort nicht speichern.",
    secureSession: "Sichere Sitzung",
    protectedPassword: "Geschütztes Passwort",
    welcome: "Willkommen",
    loginTitle: "Bei KLYX anmelden",
    loginSubtitle: "Eine Anmeldung genügt, um auf die mit deinem Konto verknüpften KLYX-Profile zuzugreifen.",
    emailLabel: "E-Mail-Adresse",
    emailPlaceholder: "du@beispiel.de",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Dein Passwort",
    hidePassword: "Passwort ausblenden",
    showPassword: "Passwort anzeigen",
    forgotPassword: "Passwort vergessen?",
    loggingIn: "Anmeldung...",
    signIn: "Anmelden",
    switchNotice: "Nach der Anmeldung kannst du zwischen deinen verknüpften KLYX-Profilen wechseln, ohne dass KLYX dein Passwort im Browser speichern muss.",
    newToKlyx: "Neu bei KLYX?",
    createAccount: "Konto erstellen",
  },
  es: {
    captchaRequired: "Completa primero la verificación antirobot.",
    credentialsRequired: "Introduce tu dirección de correo electrónico y tu contraseña.",
    captchaFailed: "La verificación antirobot ha caducado o ha fallado. Inténtalo de nuevo.",
    invalidCredentials: "La dirección de correo electrónico o la contraseña son incorrectas.",
    emailNotConfirmed: "Confirma primero tu dirección de correo electrónico.",
    loginFailed: "No se ha podido iniciar sesión.",
    resetEmailRequired: "Introduce tu dirección de correo electrónico antes de restablecer la contraseña.",
    resetSent: "Si esta dirección está asociada a una cuenta KLYX, se acaba de enviar un correo para restablecer la contraseña.",
    resetFailed: "No se ha podido enviar el correo electrónico.",
    checkingSession: "Comprobando la sesión",
    connectionBadge: "Un inicio de sesión. Todos tus espacios KLYX.",
    headline: "Tu día a día y tu actividad, en un mismo lugar.",
    description: "Inicia sesión una sola vez. Si hay varios perfiles KLYX vinculados a tu cuenta, podrás cambiar de uno a otro sin volver a introducir tu contraseña.",
    benefitProfiles: "Puedes vincular varios perfiles KLYX al mismo inicio de sesión.",
    benefitSpaces: "Los perfiles de cliente y proveedor mantienen sus espacios y recorridos separados.",
    benefitPassword: "Para cambiar de perfil, KLYX no necesita guardar tu contraseña.",
    secureSession: "Sesión segura",
    protectedPassword: "Contraseña protegida",
    welcome: "Bienvenido",
    loginTitle: "Iniciar sesión en KLYX",
    loginSubtitle: "Un solo inicio de sesión basta para acceder a los perfiles KLYX vinculados a tu cuenta.",
    emailLabel: "Dirección de correo electrónico",
    emailPlaceholder: "tu@ejemplo.com",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Tu contraseña",
    hidePassword: "Ocultar contraseña",
    showPassword: "Mostrar contraseña",
    forgotPassword: "¿Has olvidado tu contraseña?",
    loggingIn: "Iniciando sesión...",
    signIn: "Iniciar sesión",
    switchNotice: "Después de iniciar sesión, puedes cambiar entre tus perfiles KLYX vinculados sin que KLYX tenga que guardar tu contraseña en el navegador.",
    newToKlyx: "¿Eres nuevo en KLYX?",
    createAccount: "Crear una cuenta",
  },
};

export function resolveKlyxLoginPageLocale(locale: KlyxLocale): KlyxLoginPageLocale {
  return (KLYX_LOGIN_PAGE_TRANSLATED_LOCALES as readonly string[]).includes(locale)
    ? (locale as KlyxLoginPageLocale)
    : "fr";
}

export function hasKlyxLoginPageTranslation(locale: KlyxLocale) {
  return (KLYX_LOGIN_PAGE_TRANSLATED_LOCALES as readonly string[]).includes(locale);
}

export function translateKlyxLogin(
  locale: KlyxLocale,
  key: KlyxLoginMessageKey
) {
  return LOGIN_MESSAGES[resolveKlyxLoginPageLocale(locale)][key];
}

export function getKlyxLoginDictionary(locale: KlyxLocale) {
  return LOGIN_MESSAGES[resolveKlyxLoginPageLocale(locale)];
}
