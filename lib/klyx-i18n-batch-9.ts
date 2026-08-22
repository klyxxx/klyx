export const KLYX_BATCH_9_LANGUAGE_OPTIONS = [
  { value: "si", label: "සිංහල", htmlLang: "si", dir: "ltr" },
  { value: "pa", label: "ਪੰਜਾਬੀ", htmlLang: "pa", dir: "ltr" },
  { value: "gu", label: "ગુજરાતી", htmlLang: "gu", dir: "ltr" },
  { value: "kn", label: "ಕನ್ನಡ", htmlLang: "kn", dir: "ltr" },
] as const;

export const KLYX_BATCH_9_UI_MESSAGES: Record<string, Record<string, string>> = {
  si: {
    skipToMain: "ප්‍රධාන අන්තර්ගතයට යන්න",
    "sidebar.providerTagline": "KLYX හි ඔබගේ වෘත්තීය ක්‍රියාකාරකම්.",
    "sidebar.clientTagline": "ඔබගේ සියලු දෛනික සේවා.",
    "sidebar.loadingProfile": "පැතිකඩ පූරණය වෙමින්...",
    "sidebar.providerAccount": "සේවා සපයන්නාගේ ගිණුම",
    "sidebar.clientAccount": "ගනුදෙනුකරුගේ ගිණුම",
    "sidebar.searchPlaceholder": "KLYX තුළ සොයන්න",
    "sidebar.noResults": "ප්‍රතිඵල නැත.",
    "sidebar.adminCenter": "KLYX පරිපාලන මධ්‍යස්ථානය",
    "sidebar.loggingOut": "ඉවත් වෙමින්...",
    "sidebar.logout": "ඉවත් වන්න",
    "sidebar.openMenu": "මෙනුව විවෘත කරන්න",
    "sidebar.closeMenu": "මෙනුව වසන්න"
  },
  pa: {
    skipToMain: "ਮੁੱਖ ਸਮੱਗਰੀ ਤੇ ਜਾਓ",
    "sidebar.providerTagline": "KLYX 'ਤੇ ਤੁਹਾਡੀ ਪੇਸ਼ਾਵਰ ਸਰਗਰਮੀ.",
    "sidebar.clientTagline": "ਤੁਹਾਡੀਆਂ ਸਾਰੀਆਂ ਰੋਜ਼ਾਨਾ ਸੇਵਾਵਾਂ.",
    "sidebar.loadingProfile": "ਪ੍ਰੋਫ਼ਾਈਲ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...",
    "sidebar.providerAccount": "ਸੇਵਾ ਪ੍ਰਦਾਤਾ ਖਾਤਾ",
    "sidebar.clientAccount": "ਗਾਹਕ ਖਾਤਾ",
    "sidebar.searchPlaceholder": "KLYX ਵਿੱਚ ਖੋਜੋ",
    "sidebar.noResults": "ਕੋਈ ਨਤੀਜੇ ਨਹੀਂ.",
    "sidebar.adminCenter": "KLYX ਪ੍ਰਸ਼ਾਸਨ ਕੇਂਦਰ",
    "sidebar.loggingOut": "ਲੌਗ ਆਉਟ ਹੋ ਰਿਹਾ ਹੈ...",
    "sidebar.logout": "ਲੌਗ ਆਉਟ",
    "sidebar.openMenu": "ਮੀਨੂ ਖੋਲ੍ਹੋ",
    "sidebar.closeMenu": "ਮੀਨੂ ਬੰਦ ਕਰੋ"
  },
  gu: {
    skipToMain: "મુખ્ય સામગ્રી પર જાઓ",
    "sidebar.providerTagline": "KLYX પર તમારી વ્યાવસાયિક પ્રવૃત્તિ.",
    "sidebar.clientTagline": "તમારી બધી દૈનિક સેવાઓ.",
    "sidebar.loadingProfile": "પ્રોફાઇલ લોડ થઈ રહી છે...",
    "sidebar.providerAccount": "સેવા પ્રદાતા ખાતું",
    "sidebar.clientAccount": "ગ્રાહક ખાતું",
    "sidebar.searchPlaceholder": "KLYX માં શોધો",
    "sidebar.noResults": "કોઈ પરિણામ નથી.",
    "sidebar.adminCenter": "KLYX એડમિન કેન્દ્ર",
    "sidebar.loggingOut": "લોગ આઉટ થઈ રહ્યું છે...",
    "sidebar.logout": "લોગ આઉટ",
    "sidebar.openMenu": "મેનૂ ખોલો",
    "sidebar.closeMenu": "મેનૂ બંધ કરો"
  },
  kn: {
    skipToMain: "ಮುಖ್ಯ ವಿಷಯಕ್ಕೆ ಹೋಗಿ",
    "sidebar.providerTagline": "KLYX ನಲ್ಲಿ ನಿಮ್ಮ ವೃತ್ತಿಪರ ಚಟುವಟಿಕೆ.",
    "sidebar.clientTagline": "ನಿಮ್ಮ ಎಲ್ಲಾ ದೈನಂದಿನ ಸೇವೆಗಳು.",
    "sidebar.loadingProfile": "ಪ್ರೊಫೈಲ್ ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    "sidebar.providerAccount": "ಸೇವಾ ಪೂರೈಕೆದಾರ ಖಾತೆ",
    "sidebar.clientAccount": "ಗ್ರಾಹಕ ಖಾತೆ",
    "sidebar.searchPlaceholder": "KLYX ನಲ್ಲಿ ಹುಡುಕಿ",
    "sidebar.noResults": "ಯಾವುದೇ ಫಲಿತಾಂಶಗಳಿಲ್ಲ.",
    "sidebar.adminCenter": "KLYX ನಿರ್ವಹಣಾ ಕೇಂದ್ರ",
    "sidebar.loggingOut": "ಲಾಗ್ ಔಟ್ ಆಗುತ್ತಿದೆ...",
    "sidebar.logout": "ಲಾಗ್ ಔಟ್",
    "sidebar.openMenu": "ಮೆನು ತೆರೆಯಿರಿ",
    "sidebar.closeMenu": "ಮೆನು ಮುಚ್ಚಿ"
  },
};

const KLYX_BATCH_9_NAVIGATION_KEYS = ["Centre KLYX", "Vue d’ensemble", "Assistant KLYX", "KLYX Agent", "Ma mémoire KLYX", "Trouver un service", "Couverture locale", "Recherche par photo", "Mes réservations", "Messages", "Favoris", "Mes demandes", "Mes devis", "Notifications", "Centre de confiance", "Mon profil", "Paramètres", "Tableau professionnel", "Mon activité", "Assistant professionnel", "Réservations & missions", "Missions disponibles", "Demandes de devis", "Planning intelligent", "Zones d'intervention", "Messagerie clients", "Ajouter un métier", "Mes compétences", "Paiements", "Vérification", "Vérification prestataire", "Score et avis", "Confiance professionnelle", "Profil public", "Centre Admin KLYX", "Compétences prestataires", "Vérifications prestataires", "Litiges", "Services KLYX", "Audit financier", "Principal", "IA", "Services", "Réservations", "Communication", "Compte", "Confiance", "Prestataire", "Finance", "Administration"] as const;

function buildNavigation(values: readonly string[]) {
  if (values.length !== KLYX_BATCH_9_NAVIGATION_KEYS.length) {
    throw new Error("KLYX i18n batch 9 navigation catalog is incomplete.");
  }
  return Object.fromEntries(KLYX_BATCH_9_NAVIGATION_KEYS.map((key, index) => [key, values[index]]));
}

export const KLYX_BATCH_9_NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  si: buildNavigation(["KLYX මධ්‍යස්ථානය","දළ විශ්ලේෂණය","KLYX සහායකයා","KLYX නියෝජිතයා","මගේ KLYX මතකය","සේවාවක් සොයන්න","දේශීය ආවරණය","ඡායාරූපයෙන් සොයන්න","මගේ වෙන්කිරීම්","පණිවිඩ","ප්‍රියතම","මගේ ඉල්ලීම්","මගේ මිල ගණන්","දැනුම්දීම්","විශ්වාස මධ්‍යස්ථානය","මගේ පැතිකඩ","සැකසුම්","වෘත්තීය උපකරණ පුවරුව","මගේ ක්‍රියාකාරකම","වෘත්තීය සහායකයා","වෙන්කිරීම් සහ කාර්යයන්","ලබාගත හැකි කාර්යයන්","මිල ගණන් ඉල්ලීම්","බුද්ධිමත් සැලසුම්කරණය","සේවා ප්‍රදේශ","ගනුදෙනුකරුවන්ගේ පණිවිඩ","වෘත්තියක් එක් කරන්න","මගේ කුසලතා","ගෙවීම්","සත්‍යාපනය","සේවා සපයන්නා සත්‍යාපනය","ලකුණු සහ සමාලෝචන","වෘත්තීය විශ්වාසය","පොදු පැතිකඩ","KLYX පරිපාලන මධ්‍යස්ථානය","සේවා සපයන්නන්ගේ කුසලතා","සේවා සපයන්නන්ගේ සත්‍යාපන","ආරවුල්","KLYX සේවා","මූල්‍ය විගණනය","ප්‍රධාන","AI","සේවා","වෙන්කිරීම්","සන්නිවේදනය","ගිණුම","විශ්වාසය","සේවා සපයන්නා","මූල්‍ය","පරිපාලනය"]),
  pa: buildNavigation(["KLYX ਕੇਂਦਰ","ਝਲਕ","KLYX ਸਹਾਇਕ","KLYX ਏਜੰਟ","ਮੇਰੀ KLYX ਯਾਦ","ਸੇਵਾ ਲੱਭੋ","ਸਥਾਨਕ ਕਵਰੇਜ","ਫੋਟੋ ਰਾਹੀਂ ਖੋਜ","ਮੇਰੀਆਂ ਬੁਕਿੰਗਾਂ","ਸੁਨੇਹੇ","ਮਨਪਸੰਦ","ਮੇਰੀਆਂ ਬੇਨਤੀਆਂ","ਮੇਰੇ ਕੋਟ","ਸੂਚਨਾਵਾਂ","ਭਰੋਸਾ ਕੇਂਦਰ","ਮੇਰੀ ਪ੍ਰੋਫ਼ਾਈਲ","ਸੈਟਿੰਗਾਂ","ਪੇਸ਼ਾਵਰ ਡੈਸ਼ਬੋਰਡ","ਮੇਰੀ ਸਰਗਰਮੀ","ਪੇਸ਼ਾਵਰ ਸਹਾਇਕ","ਬੁਕਿੰਗਾਂ ਅਤੇ ਕੰਮ","ਉਪਲਬਧ ਕੰਮ","ਕੋਟ ਬੇਨਤੀਆਂ","ਸਮਾਰਟ ਯੋਜਨਾ","ਸੇਵਾ ਖੇਤਰ","ਗਾਹਕ ਸੁਨੇਹੇ","ਪੇਸ਼ਾ ਸ਼ਾਮਲ ਕਰੋ","ਮੇਰੀਆਂ ਹੁਨਰਾਂ","ਭੁਗਤਾਨ","ਤਸਦੀਕ","ਸੇਵਾ ਪ੍ਰਦਾਤਾ ਤਸਦੀਕ","ਸਕੋਰ ਅਤੇ ਸਮੀਖਿਆਵਾਂ","ਪੇਸ਼ਾਵਰ ਭਰੋਸਾ","ਜਨਤਕ ਪ੍ਰੋਫ਼ਾਈਲ","KLYX ਪ੍ਰਸ਼ਾਸਨ ਕੇਂਦਰ","ਸੇਵਾ ਪ੍ਰਦਾਤਾ ਹੁਨਰ","ਸੇਵਾ ਪ੍ਰਦਾਤਾ ਤਸਦੀਕਾਂ","ਵਿਵਾਦ","KLYX ਸੇਵਾਵਾਂ","ਵਿੱਤੀ ਆਡਿਟ","ਮੁੱਖ","AI","ਸੇਵਾਵਾਂ","ਬੁਕਿੰਗਾਂ","ਸੰਚਾਰ","ਖਾਤਾ","ਭਰੋਸਾ","ਸੇਵਾ ਪ੍ਰਦਾਤਾ","ਵਿੱਤ","ਪ੍ਰਸ਼ਾਸਨ"]),
  gu: buildNavigation(["KLYX કેન્દ્ર","ઝાંખી","KLYX સહાયક","KLYX એજન્ટ","મારી KLYX સ્મૃતિ","સેવા શોધો","સ્થાનિક આવરણ","ફોટાથી શોધ","મારી બુકિંગ્સ","સંદેશાઓ","મનપસંદ","મારી વિનંતીઓ","મારા કોટ્સ","સૂચનાઓ","વિશ્વાસ કેન્દ્ર","મારી પ્રોફાઇલ","સેટિંગ્સ","વ્યાવસાયિક ડૅશબોર્ડ","મારી પ્રવૃત્તિ","વ્યાવસાયિક સહાયક","બુકિંગ્સ અને કામ","ઉપલબ્ધ કામ","કોટ વિનંતીઓ","સ્માર્ટ આયોજન","સેવા વિસ્તારો","ગ્રાહક સંદેશાઓ","વ્યવસાય ઉમેરો","મારી કુશળતાઓ","ચુકવણીઓ","ચકાસણી","સેવા પ્રદાતા ચકાસણી","સ્કોર અને સમીક્ષાઓ","વ્યાવસાયિક વિશ્વાસ","જાહેર પ્રોફાઇલ","KLYX એડમિન કેન્દ્ર","સેવા પ્રદાતા કુશળતાઓ","સેવા પ્રદાતા ચકાસણીઓ","વિવાદો","KLYX સેવાઓ","નાણાકીય ઓડિટ","મુખ્ય","AI","સેવાઓ","બુકિંગ્સ","સંચાર","ખાતું","વિશ્વાસ","સેવા પ્રદાતા","નાણાં","પ્રશાસન"]),
  kn: buildNavigation(["KLYX ಕೇಂದ್ರ","ಅವಲೋಕನ","KLYX ಸಹಾಯಕ","KLYX ಏಜೆಂಟ್","ನನ್ನ KLYX ಸ್ಮೃತಿ","ಸೇವೆ ಹುಡುಕಿ","ಸ್ಥಳೀಯ ವ್ಯಾಪ್ತಿ","ಫೋಟೋ ಮೂಲಕ ಹುಡುಕಿ","ನನ್ನ ಬುಕಿಂಗ್‌ಗಳು","ಸಂದೇಶಗಳು","ಮೆಚ್ಚಿನವುಗಳು","ನನ್ನ ವಿನಂತಿಗಳು","ನನ್ನ ಕೊಟ್‌ಗಳು","ಅಧಿಸೂಚನೆಗಳು","ವಿಶ್ವಾಸ ಕೇಂದ್ರ","ನನ್ನ ಪ್ರೊಫೈಲ್","ಸೆಟ್ಟಿಂಗ್‌ಗಳು","ವೃತ್ತಿಪರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್","ನನ್ನ ಚಟುವಟಿಕೆ","ವೃತ್ತಿಪರ ಸಹಾಯಕ","ಬುಕಿಂಗ್‌ಗಳು ಮತ್ತು ಕೆಲಸಗಳು","ಲಭ್ಯ ಕೆಲಸಗಳು","ಕೊಟ್ ವಿನಂತಿಗಳು","ಸ್ಮಾರ್ಟ್ ಯೋಜನೆ","ಸೇವಾ ಪ್ರದೇಶಗಳು","ಗ್ರಾಹಕ ಸಂದೇಶಗಳು","ವೃತ್ತಿ ಸೇರಿಸಿ","ನನ್ನ ಕೌಶಲ್ಯಗಳು","ಪಾವತಿಗಳು","ಪರಿಶೀಲನೆ","ಸೇವಾ ಪೂರೈಕೆದಾರ ಪರಿಶೀಲನೆ","ಸ್ಕೋರ್ ಮತ್ತು ವಿಮರ್ಶೆಗಳು","ವೃತ್ತಿಪರ ವಿಶ್ವಾಸ","ಸಾರ್ವಜನಿಕ ಪ್ರೊಫೈಲ್","KLYX ನಿರ್ವಹಣಾ ಕೇಂದ್ರ","ಸೇವಾ ಪೂರೈಕೆದಾರ ಕೌಶಲ್ಯಗಳು","ಸೇವಾ ಪೂರೈಕೆದಾರ ಪರಿಶೀಲನೆಗಳು","ವಿವಾದಗಳು","KLYX ಸೇವೆಗಳು","ಹಣಕಾಸು ಲೆಕ್ಕಪರಿಶೋಧನೆ","ಮುಖ್ಯ","AI","ಸೇವೆಗಳು","ಬುಕಿಂಗ್‌ಗಳು","ಸಂವಹನ","ಖಾತೆ","ವಿಶ್ವಾಸ","ಸೇವಾ ಪೂರೈಕೆದಾರ","ಹಣಕಾಸು","ನಿರ್ವಹಣೆ"]),
};
