export const KLYX_BATCH_6_LANGUAGE_OPTIONS = [
  { value: "ms", label: "Bahasa Melayu", htmlLang: "ms", dir: "ltr" },
  { value: "fil", label: "Filipino", htmlLang: "fil", dir: "ltr" },
  { value: "sw", label: "Kiswahili", htmlLang: "sw", dir: "ltr" },
  { value: "af", label: "Afrikaans", htmlLang: "af", dir: "ltr" },
] as const;

export const KLYX_BATCH_6_UI_MESSAGES: Record<string, Record<string, string>> = {
  ms: {
    skipToMain: "Pergi ke kandungan utama",
    "sidebar.providerTagline": "Aktiviti profesional anda di KLYX.",
    "sidebar.clientTagline": "Semua perkhidmatan harian anda.",
    "sidebar.loadingProfile": "Memuatkan profil...",
    "sidebar.providerAccount": "Akaun penyedia",
    "sidebar.clientAccount": "Akaun pelanggan",
    "sidebar.searchPlaceholder": "Cari dalam KLYX",
    "sidebar.noResults": "Tiada hasil.",
    "sidebar.adminCenter": "Pusat Pentadbir KLYX",
    "sidebar.loggingOut": "Sedang log keluar...",
    "sidebar.logout": "Log keluar",
    "sidebar.openMenu": "Buka menu",
    "sidebar.closeMenu": "Tutup menu"
  },
  fil: {
    skipToMain: "Pumunta sa pangunahing nilalaman",
    "sidebar.providerTagline": "Ang propesyonal mong aktibidad sa KLYX.",
    "sidebar.clientTagline": "Lahat ng pang-araw-araw mong serbisyo.",
    "sidebar.loadingProfile": "Nilo-load ang profile...",
    "sidebar.providerAccount": "Account ng provider",
    "sidebar.clientAccount": "Account ng kliyente",
    "sidebar.searchPlaceholder": "Maghanap sa KLYX",
    "sidebar.noResults": "Walang resulta.",
    "sidebar.adminCenter": "KLYX Admin Center",
    "sidebar.loggingOut": "Nagla-log out...",
    "sidebar.logout": "Mag-log out",
    "sidebar.openMenu": "Buksan ang menu",
    "sidebar.closeMenu": "Isara ang menu"
  },
  sw: {
    skipToMain: "Nenda kwenye maudhui makuu",
    "sidebar.providerTagline": "Shughuli yako ya kitaalamu kwenye KLYX.",
    "sidebar.clientTagline": "Huduma zako zote za kila siku.",
    "sidebar.loadingProfile": "Inapakia wasifu...",
    "sidebar.providerAccount": "Akaunti ya mtoa huduma",
    "sidebar.clientAccount": "Akaunti ya mteja",
    "sidebar.searchPlaceholder": "Tafuta katika KLYX",
    "sidebar.noResults": "Hakuna matokeo.",
    "sidebar.adminCenter": "Kituo cha Usimamizi cha KLYX",
    "sidebar.loggingOut": "Inaondoka...",
    "sidebar.logout": "Ondoka",
    "sidebar.openMenu": "Fungua menyu",
    "sidebar.closeMenu": "Funga menyu"
  },
  af: {
    skipToMain: "Gaan na hoofinhoud",
    "sidebar.providerTagline": "Jou professionele aktiwiteit op KLYX.",
    "sidebar.clientTagline": "Al jou alledaagse dienste.",
    "sidebar.loadingProfile": "Profiel laai...",
    "sidebar.providerAccount": "Diensverskafferrekening",
    "sidebar.clientAccount": "Kliëntrekening",
    "sidebar.searchPlaceholder": "Soek in KLYX",
    "sidebar.noResults": "Geen resultate nie.",
    "sidebar.adminCenter": "KLYX-administrasiesentrum",
    "sidebar.loggingOut": "Meld af...",
    "sidebar.logout": "Meld af",
    "sidebar.openMenu": "Maak kieslys oop",
    "sidebar.closeMenu": "Maak kieslys toe"
  },
};

const KLYX_BATCH_6_NAVIGATION_KEYS = ["Centre KLYX", "Vue d’ensemble", "Assistant KLYX", "KLYX Agent", "Ma mémoire KLYX", "Trouver un service", "Couverture locale", "Recherche par photo", "Mes réservations", "Messages", "Favoris", "Mes demandes", "Mes devis", "Notifications", "Centre de confiance", "Mon profil", "Paramètres", "Tableau professionnel", "Mon activité", "Assistant professionnel", "Réservations & missions", "Missions disponibles", "Demandes de devis", "Planning intelligent", "Zones d'intervention", "Messagerie clients", "Ajouter un métier", "Mes compétences", "Paiements", "Vérification", "Vérification prestataire", "Score et avis", "Confiance professionnelle", "Profil public", "Centre Admin KLYX", "Compétences prestataires", "Vérifications prestataires", "Litiges", "Services KLYX", "Audit financier", "Principal", "IA", "Services", "Réservations", "Communication", "Compte", "Confiance", "Prestataire", "Finance", "Administration"] as const;

function buildNavigation(values: readonly string[]) {
  if (values.length !== KLYX_BATCH_6_NAVIGATION_KEYS.length) {
    throw new Error("KLYX i18n batch 6 navigation catalog is incomplete.");
  }

  return Object.fromEntries(
    KLYX_BATCH_6_NAVIGATION_KEYS.map((key, index) => [key, values[index]])
  );
}

export const KLYX_BATCH_6_NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  ms: buildNavigation(["Pusat KLYX", "Gambaran keseluruhan", "Pembantu KLYX", "Ejen KLYX", "Memori KLYX saya", "Cari perkhidmatan", "Liputan tempatan", "Carian melalui foto", "Tempahan saya", "Mesej", "Kegemaran", "Permintaan saya", "Sebut harga saya", "Pemberitahuan", "Pusat kepercayaan", "Profil saya", "Tetapan", "Papan pemuka profesional", "Aktiviti saya", "Pembantu profesional", "Tempahan & tugasan", "Tugasan tersedia", "Permintaan sebut harga", "Perancangan pintar", "Kawasan perkhidmatan", "Mesej pelanggan", "Tambah profesion", "Kemahiran saya", "Pembayaran", "Pengesahan", "Pengesahan penyedia", "Skor dan ulasan", "Kepercayaan profesional", "Profil awam", "Pusat Pentadbir KLYX", "Kemahiran penyedia", "Pengesahan penyedia", "Pertikaian", "Perkhidmatan KLYX", "Audit kewangan", "Utama", "AI", "Perkhidmatan", "Tempahan", "Komunikasi", "Akaun", "Kepercayaan", "Penyedia", "Kewangan", "Pentadbiran"]),
  fil: buildNavigation(["KLYX Center", "Pangkalahatang-ideya", "KLYX Assistant", "KLYX Agent", "Aking KLYX memory", "Humanap ng serbisyo", "Lokal na saklaw", "Maghanap gamit ang larawan", "Aking mga booking", "Mga mensahe", "Mga paborito", "Aking mga request", "Aking mga quote", "Mga notification", "Trust Center", "Aking profile", "Mga setting", "Propesyonal na dashboard", "Aking aktibidad", "Propesyonal na assistant", "Mga booking at trabaho", "Mga available na trabaho", "Mga request ng quote", "Matalinong iskedyul", "Mga lugar ng serbisyo", "Mga mensahe ng kliyente", "Magdagdag ng propesyon", "Aking mga kasanayan", "Mga bayad", "Beripikasyon", "Beripikasyon ng provider", "Score at mga review", "Propesyonal na tiwala", "Pampublikong profile", "KLYX Admin Center", "Mga kasanayan ng provider", "Mga beripikasyon ng provider", "Mga dispute", "Mga serbisyo ng KLYX", "Audit sa pananalapi", "Pangunahin", "AI", "Mga serbisyo", "Mga booking", "Komunikasyon", "Account", "Tiwala", "Provider", "Pananalapi", "Administrasyon"]),
  sw: buildNavigation(["Kituo cha KLYX", "Muhtasari", "Msaidizi wa KLYX", "Wakala wa KLYX", "Kumbukumbu yangu ya KLYX", "Tafuta huduma", "Upatikanaji wa karibu", "Tafuta kwa picha", "Nafasi nilizohifadhi", "Ujumbe", "Vipendwa", "Maombi yangu", "Makadirio yangu", "Arifa", "Kituo cha uaminifu", "Wasifu wangu", "Mipangilio", "Dashibodi ya kitaalamu", "Shughuli yangu", "Msaidizi wa kitaalamu", "Nafasi na kazi", "Kazi zinazopatikana", "Maombi ya makadirio", "Ratiba mahiri", "Maeneo ya huduma", "Ujumbe wa wateja", "Ongeza taaluma", "Ujuzi wangu", "Malipo", "Uthibitishaji", "Uthibitishaji wa mtoa huduma", "Alama na maoni", "Uaminifu wa kitaalamu", "Wasifu wa umma", "Kituo cha Usimamizi cha KLYX", "Ujuzi wa watoa huduma", "Uthibitishaji wa watoa huduma", "Migogoro", "Huduma za KLYX", "Ukaguzi wa fedha", "Kuu", "AI", "Huduma", "Nafasi", "Mawasiliano", "Akaunti", "Uaminifu", "Mtoa huduma", "Fedha", "Usimamizi"]),
  af: buildNavigation(["KLYX-sentrum", "Oorsig", "KLYX-assistent", "KLYX-agent", "My KLYX-geheue", "Vind 'n diens", "Plaaslike dekking", "Soek met foto", "My besprekings", "Boodskappe", "Gunstelinge", "My versoeke", "My kwotasies", "Kennisgewings", "Vertrouensentrum", "My profiel", "Instellings", "Professionele dashboard", "My aktiwiteit", "Professionele assistent", "Besprekings en take", "Beskikbare take", "Kwotasieversoeke", "Slim beplanning", "Diensgebiede", "Kliëntboodskappe", "Voeg 'n beroep by", "My vaardighede", "Betalings", "Verifikasie", "Diensverskafferverifikasie", "Telling en resensies", "Professionele vertroue", "Openbare profiel", "KLYX-administrasiesentrum", "Diensverskaffervaardighede", "Diensverskafferverifikasies", "Geskille", "KLYX-dienste", "Finansiële oudit", "Hoof", "KI", "Dienste", "Besprekings", "Kommunikasie", "Rekening", "Vertroue", "Diensverskaffer", "Finansies", "Administrasie"]),
};
