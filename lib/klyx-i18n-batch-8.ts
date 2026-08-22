export const KLYX_BATCH_8_LANGUAGE_OPTIONS = [
  { value: "ta", label: "தமிழ்", htmlLang: "ta", dir: "ltr" },
  { value: "te", label: "తెలుగు", htmlLang: "te", dir: "ltr" },
  { value: "mr", label: "मराठी", htmlLang: "mr", dir: "ltr" },
  { value: "ne", label: "नेपाली", htmlLang: "ne", dir: "ltr" },
] as const;

export const KLYX_BATCH_8_UI_MESSAGES: Record<string, Record<string, string>> = {
  ta: {
    skipToMain: "முக்கிய உள்ளடக்கத்திற்குச் செல்லவும்",
    "sidebar.providerTagline": "KLYX இல் உங்கள் தொழில்முறை செயல்பாடு.",
    "sidebar.clientTagline": "உங்கள் அனைத்து அன்றாட சேவைகளும்.",
    "sidebar.loadingProfile": "சுயவிவரம் ஏற்றப்படுகிறது...",
    "sidebar.providerAccount": "சேவை வழங்குநர் கணக்கு",
    "sidebar.clientAccount": "வாடிக்கையாளர் கணக்கு",
    "sidebar.searchPlaceholder": "KLYX இல் தேடவும்",
    "sidebar.noResults": "முடிவுகள் இல்லை.",
    "sidebar.adminCenter": "KLYX நிர்வாக மையம்",
    "sidebar.loggingOut": "வெளியேறுகிறது...",
    "sidebar.logout": "வெளியேறு",
    "sidebar.openMenu": "மெனுவைத் திற",
    "sidebar.closeMenu": "மெனுவை மூடு"
  },
  te: {
    skipToMain: "ప్రధాన కంటెంట్‌కు వెళ్లండి",
    "sidebar.providerTagline": "KLYXలో మీ వృత్తిపరమైన కార్యకలాపం.",
    "sidebar.clientTagline": "మీ అన్ని రోజువారీ సేవలు.",
    "sidebar.loadingProfile": "ప్రొఫైల్ లోడ్ అవుతోంది...",
    "sidebar.providerAccount": "సేవా ప్రదాత ఖాతా",
    "sidebar.clientAccount": "క్లయింట్ ఖాతా",
    "sidebar.searchPlaceholder": "KLYXలో శోధించండి",
    "sidebar.noResults": "ఫలితాలు లేవు.",
    "sidebar.adminCenter": "KLYX అడ్మిన్ కేంద్రం",
    "sidebar.loggingOut": "లాగ్ అవుట్ అవుతోంది...",
    "sidebar.logout": "లాగ్ అవుట్",
    "sidebar.openMenu": "మెనూను తెరవండి",
    "sidebar.closeMenu": "మెనూను మూసివేయండి"
  },
  mr: {
    skipToMain: "मुख्य सामग्रीवर जा",
    "sidebar.providerTagline": "KLYX वरील तुमची व्यावसायिक क्रियाकलाप.",
    "sidebar.clientTagline": "तुमच्या सर्व दैनंदिन सेवा.",
    "sidebar.loadingProfile": "प्रोफाइल लोड होत आहे...",
    "sidebar.providerAccount": "सेवा प्रदाता खाते",
    "sidebar.clientAccount": "ग्राहक खाते",
    "sidebar.searchPlaceholder": "KLYX मध्ये शोधा",
    "sidebar.noResults": "परिणाम नाहीत.",
    "sidebar.adminCenter": "KLYX प्रशासक केंद्र",
    "sidebar.loggingOut": "लॉग आउट होत आहे...",
    "sidebar.logout": "लॉग आउट",
    "sidebar.openMenu": "मेनू उघडा",
    "sidebar.closeMenu": "मेनू बंद करा"
  },
  ne: {
    skipToMain: "मुख्य सामग्रीमा जानुहोस्",
    "sidebar.providerTagline": "KLYX मा तपाईंको व्यावसायिक गतिविधि।",
    "sidebar.clientTagline": "तपाईंका सबै दैनिक सेवाहरू।",
    "sidebar.loadingProfile": "प्रोफाइल लोड हुँदैछ...",
    "sidebar.providerAccount": "सेवा प्रदायक खाता",
    "sidebar.clientAccount": "ग्राहक खाता",
    "sidebar.searchPlaceholder": "KLYX मा खोज्नुहोस्",
    "sidebar.noResults": "कुनै परिणाम छैन।",
    "sidebar.adminCenter": "KLYX प्रशासन केन्द्र",
    "sidebar.loggingOut": "लग आउट हुँदैछ...",
    "sidebar.logout": "लग आउट",
    "sidebar.openMenu": "मेनु खोल्नुहोस्",
    "sidebar.closeMenu": "मेनु बन्द गर्नुहोस्"
  },
};

const KLYX_BATCH_8_NAVIGATION_KEYS = ["Centre KLYX", "Vue d’ensemble", "Assistant KLYX", "KLYX Agent", "Ma mémoire KLYX", "Trouver un service", "Couverture locale", "Recherche par photo", "Mes réservations", "Messages", "Favoris", "Mes demandes", "Mes devis", "Notifications", "Centre de confiance", "Mon profil", "Paramètres", "Tableau professionnel", "Mon activité", "Assistant professionnel", "Réservations & missions", "Missions disponibles", "Demandes de devis", "Planning intelligent", "Zones d'intervention", "Messagerie clients", "Ajouter un métier", "Mes compétences", "Paiements", "Vérification", "Vérification prestataire", "Score et avis", "Confiance professionnelle", "Profil public", "Centre Admin KLYX", "Compétences prestataires", "Vérifications prestataires", "Litiges", "Services KLYX", "Audit financier", "Principal", "IA", "Services", "Réservations", "Communication", "Compte", "Confiance", "Prestataire", "Finance", "Administration"] as const;

function buildNavigation(values: readonly string[]) {
  if (values.length !== KLYX_BATCH_8_NAVIGATION_KEYS.length) {
    throw new Error("KLYX i18n batch 8 navigation catalog is incomplete.");
  }

  return Object.fromEntries(
    KLYX_BATCH_8_NAVIGATION_KEYS.map((key, index) => [key, values[index]])
  );
}

export const KLYX_BATCH_8_NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  ta: buildNavigation(["KLYX மையம்", "மேலோட்டம்", "KLYX உதவியாளர்", "KLYX முகவர்", "எனது KLYX நினைவகம்", "சேவையை கண்டறிய", "உள்ளூர் சேவைப் பகுதி", "புகைப்படம் மூலம் தேடல்", "எனது முன்பதிவுகள்", "செய்திகள்", "பிடித்தவை", "எனது கோரிக்கைகள்", "எனது விலைமதிப்பீடுகள்", "அறிவிப்புகள்", "நம்பிக்கை மையம்", "எனது சுயவிவரம்", "அமைப்புகள்", "தொழில்முறை டாஷ்போர்டு", "எனது செயல்பாடு", "தொழில்முறை உதவியாளர்", "முன்பதிவுகள் & பணிகள்", "கிடைக்கும் பணிகள்", "விலைமதிப்பீட்டு கோரிக்கைகள்", "புத்திசாலி திட்டமிடல்", "சேவைப் பகுதிகள்", "வாடிக்கையாளர் செய்திகள்", "தொழிலைச் சேர்க்க", "எனது திறன்கள்", "கட்டணங்கள்", "சரிபார்ப்பு", "சேவை வழங்குநர் சரிபார்ப்பு", "மதிப்பெண் மற்றும் மதிப்புரைகள்", "தொழில்முறை நம்பிக்கை", "பொது சுயவிவரம்", "KLYX நிர்வாக மையம்", "சேவை வழங்குநர் திறன்கள்", "சேவை வழங்குநர் சரிபார்ப்புகள்", "தகராறுகள்", "KLYX சேவைகள்", "நிதி தணிக்கை", "முதன்மை", "AI", "சேவைகள்", "முன்பதிவுகள்", "தொடர்பு", "கணக்கு", "நம்பிக்கை", "சேவை வழங்குநர்", "நிதி", "நிர்வாகம்"]),
  te: buildNavigation(["KLYX కేంద్రం", "అవలోకనం", "KLYX సహాయకుడు", "KLYX ఏజెంట్", "నా KLYX మెమరీ", "సేవను కనుగొనండి", "స్థానిక పరిధి", "ఫోటో ద్వారా శోధన", "నా బుకింగ్‌లు", "సందేశాలు", "ఇష్టమైనవి", "నా అభ్యర్థనలు", "నా కోట్‌లు", "నోటిఫికేషన్‌లు", "విశ్వాస కేంద్రం", "నా ప్రొఫైల్", "సెట్టింగ్‌లు", "వృత్తిపరమైన డ్యాష్‌బోర్డ్", "నా కార్యకలాపం", "వృత్తిపరమైన సహాయకుడు", "బుకింగ్‌లు & పనులు", "అందుబాటులో ఉన్న పనులు", "కోట్ అభ్యర్థనలు", "స్మార్ట్ ప్లానింగ్", "సేవా ప్రాంతాలు", "కస్టమర్ సందేశాలు", "వృత్తిని జోడించండి", "నా నైపుణ్యాలు", "చెల్లింపులు", "ధృవీకరణ", "సేవా ప్రదాత ధృవీకరణ", "స్కోర్ మరియు సమీక్షలు", "వృత్తిపరమైన విశ్వాసం", "పబ్లిక్ ప్రొఫైల్", "KLYX అడ్మిన్ కేంద్రం", "సేవా ప్రదాత నైపుణ్యాలు", "సేవా ప్రదాత ధృవీకరణలు", "వివాదాలు", "KLYX సేవలు", "ఆర్థిక ఆడిట్", "ప్రధానం", "AI", "సేవలు", "బుకింగ్‌లు", "కమ్యూనికేషన్", "ఖాతా", "విశ్వాసం", "సేవా ప్రదాత", "ఆర్థికం", "పరిపాలన"]),
  mr: buildNavigation(["KLYX केंद्र", "आढावा", "KLYX सहाय्यक", "KLYX एजंट", "माझी KLYX स्मृती", "सेवा शोधा", "स्थानिक कव्हरेज", "फोटोद्वारे शोध", "माझी बुकिंग", "संदेश", "आवडी", "माझ्या विनंत्या", "माझे कोट", "सूचना", "विश्वास केंद्र", "माझे प्रोफाइल", "सेटिंग्ज", "व्यावसायिक डॅशबोर्ड", "माझी क्रियाकलाप", "व्यावसायिक सहाय्यक", "बुकिंग आणि कामे", "उपलब्ध कामे", "कोट विनंत्या", "स्मार्ट नियोजन", "सेवा क्षेत्रे", "ग्राहक संदेश", "व्यवसाय जोडा", "माझी कौशल्ये", "देयके", "पडताळणी", "सेवा प्रदाता पडताळणी", "गुण आणि पुनरावलोकने", "व्यावसायिक विश्वास", "सार्वजनिक प्रोफाइल", "KLYX प्रशासक केंद्र", "सेवा प्रदाता कौशल्ये", "सेवा प्रदाता पडताळण्या", "विवाद", "KLYX सेवा", "आर्थिक लेखापरीक्षण", "मुख्य", "AI", "सेवा", "बुकिंग", "संवाद", "खाते", "विश्वास", "सेवा प्रदाता", "वित्त", "प्रशासन"]),
  ne: buildNavigation(["KLYX केन्द्र", "अवलोकन", "KLYX सहायक", "KLYX एजेन्ट", "मेरो KLYX स्मृति", "सेवा खोज्नुहोस्", "स्थानीय कभरेज", "फोटोबाट खोज", "मेरा बुकिङहरू", "सन्देशहरू", "मनपर्ने", "मेरा अनुरोधहरू", "मेरा कोटहरू", "सूचनाहरू", "विश्वास केन्द्र", "मेरो प्रोफाइल", "सेटिङहरू", "व्यावसायिक ड्यासबोर्ड", "मेरो गतिविधि", "व्यावसायिक सहायक", "बुकिङ र कामहरू", "उपलब्ध कामहरू", "कोट अनुरोधहरू", "स्मार्ट योजना", "सेवा क्षेत्रहरू", "ग्राहक सन्देशहरू", "पेशा थप्नुहोस्", "मेरा सीपहरू", "भुक्तानीहरू", "प्रमाणीकरण", "सेवा प्रदायक प्रमाणीकरण", "स्कोर र समीक्षाहरू", "व्यावसायिक विश्वास", "सार्वजनिक प्रोफाइल", "KLYX प्रशासन केन्द्र", "सेवा प्रदायक सीपहरू", "सेवा प्रदायक प्रमाणीकरणहरू", "विवादहरू", "KLYX सेवाहरू", "वित्तीय लेखापरीक्षण", "मुख्य", "AI", "सेवाहरू", "बुकिङहरू", "सञ्चार", "खाता", "विश्वास", "सेवा प्रदायक", "वित्त", "प्रशासन"]),
};
