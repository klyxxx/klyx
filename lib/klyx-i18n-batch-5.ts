export const KLYX_BATCH_5_LANGUAGE_OPTIONS = [
  { value: "lt", label: "Lietuvių", htmlLang: "lt", dir: "ltr" },
  { value: "lv", label: "Latviešu", htmlLang: "lv", dir: "ltr" },
  { value: "et", label: "Eesti", htmlLang: "et", dir: "ltr" },
  { value: "sl", label: "Slovenščina", htmlLang: "sl", dir: "ltr" },
] as const;

export const KLYX_BATCH_5_UI_MESSAGES: Record<string, Record<string, string>> = {
  lt: {
    skipToMain: "Pereiti prie pagrindinio turinio",
    "sidebar.providerTagline": "Jūsų profesinė veikla KLYX.",
    "sidebar.clientTagline": "Visos jūsų kasdienės paslaugos.",
    "sidebar.loadingProfile": "Įkeliamas profilis...",
    "sidebar.providerAccount": "Paslaugų teikėjo paskyra",
    "sidebar.clientAccount": "Kliento paskyra",
    "sidebar.searchPlaceholder": "Ieškoti KLYX",
    "sidebar.noResults": "Rezultatų nėra.",
    "sidebar.adminCenter": "KLYX administravimo centras",
    "sidebar.loggingOut": "Atsijungiama...",
    "sidebar.logout": "Atsijungti",
    "sidebar.openMenu": "Atidaryti meniu",
    "sidebar.closeMenu": "Uždaryti meniu"
  },
  lv: {
    skipToMain: "Pāriet uz galveno saturu",
    "sidebar.providerTagline": "Jūsu profesionālā darbība KLYX.",
    "sidebar.clientTagline": "Visi jūsu ikdienas pakalpojumi.",
    "sidebar.loadingProfile": "Ielādē profilu...",
    "sidebar.providerAccount": "Pakalpojumu sniedzēja konts",
    "sidebar.clientAccount": "Klienta konts",
    "sidebar.searchPlaceholder": "Meklēt KLYX",
    "sidebar.noResults": "Nav rezultātu.",
    "sidebar.adminCenter": "KLYX administrēšanas centrs",
    "sidebar.loggingOut": "Notiek izrakstīšanās...",
    "sidebar.logout": "Izrakstīties",
    "sidebar.openMenu": "Atvērt izvēlni",
    "sidebar.closeMenu": "Aizvērt izvēlni"
  },
  et: {
    skipToMain: "Liigu põhisisu juurde",
    "sidebar.providerTagline": "Sinu professionaalne tegevus KLYXis.",
    "sidebar.clientTagline": "Kõik sinu igapäevateenused.",
    "sidebar.loadingProfile": "Profiili laadimine...",
    "sidebar.providerAccount": "Teenusepakkuja konto",
    "sidebar.clientAccount": "Kliendikonto",
    "sidebar.searchPlaceholder": "Otsi KLYXist",
    "sidebar.noResults": "Tulemusi pole.",
    "sidebar.adminCenter": "KLYXi halduskeskus",
    "sidebar.loggingOut": "Väljalogimine...",
    "sidebar.logout": "Logi välja",
    "sidebar.openMenu": "Ava menüü",
    "sidebar.closeMenu": "Sulge menüü"
  },
  sl: {
    skipToMain: "Preskoči na glavno vsebino",
    "sidebar.providerTagline": "Tvoja profesionalna dejavnost na KLYX-u.",
    "sidebar.clientTagline": "Vse tvoje vsakodnevne storitve.",
    "sidebar.loadingProfile": "Nalaganje profila...",
    "sidebar.providerAccount": "Račun ponudnika",
    "sidebar.clientAccount": "Račun stranke",
    "sidebar.searchPlaceholder": "Išči v KLYX",
    "sidebar.noResults": "Ni rezultatov.",
    "sidebar.adminCenter": "Skrbniško središče KLYX",
    "sidebar.loggingOut": "Odjava...",
    "sidebar.logout": "Odjavi se",
    "sidebar.openMenu": "Odpri meni",
    "sidebar.closeMenu": "Zapri meni"
  },
};

const KLYX_BATCH_5_NAVIGATION_KEYS = ["Centre KLYX", "Vue d’ensemble", "Assistant KLYX", "KLYX Agent", "Ma mémoire KLYX", "Trouver un service", "Couverture locale", "Recherche par photo", "Mes réservations", "Messages", "Favoris", "Mes demandes", "Mes devis", "Notifications", "Centre de confiance", "Mon profil", "Paramètres", "Tableau professionnel", "Mon activité", "Assistant professionnel", "Réservations & missions", "Missions disponibles", "Demandes de devis", "Planning intelligent", "Zones d'intervention", "Messagerie clients", "Ajouter un métier", "Mes compétences", "Paiements", "Vérification", "Vérification prestataire", "Score et avis", "Confiance professionnelle", "Profil public", "Centre Admin KLYX", "Compétences prestataires", "Vérifications prestataires", "Litiges", "Services KLYX", "Audit financier", "Principal", "IA", "Services", "Réservations", "Communication", "Compte", "Confiance", "Prestataire", "Finance", "Administration"] as const;

function buildNavigation(values: readonly string[]) {
  if (values.length !== KLYX_BATCH_5_NAVIGATION_KEYS.length) {
    throw new Error("KLYX i18n batch 5 navigation catalog is incomplete.");
  }

  return Object.fromEntries(
    KLYX_BATCH_5_NAVIGATION_KEYS.map((key, index) => [key, values[index]])
  );
}

export const KLYX_BATCH_5_NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  lt: buildNavigation(["KLYX centras", "Apžvalga", "KLYX asistentas", "KLYX agentas", "Mano KLYX atmintis", "Rasti paslaugą", "Vietinė aprėptis", "Ieškoti pagal nuotrauką", "Mano rezervacijos", "Žinutės", "Mėgstamiausi", "Mano užklausos", "Mano pasiūlymai", "Pranešimai", "Pasitikėjimo centras", "Mano profilis", "Nustatymai", "Profesionalo skydelis", "Mano veikla", "Profesionalus asistentas", "Rezervacijos ir užduotys", "Galimos užduotys", "Pasiūlymų užklausos", "Išmanus planavimas", "Paslaugų zonos", "Klientų žinutės", "Pridėti profesiją", "Mano įgūdžiai", "Mokėjimai", "Patvirtinimas", "Paslaugų teikėjo patvirtinimas", "Įvertinimas ir atsiliepimai", "Profesinis pasitikėjimas", "Viešas profilis", "KLYX administravimo centras", "Teikėjų įgūdžiai", "Teikėjų patvirtinimai", "Ginčai", "KLYX paslaugos", "Finansinis auditas", "Pagrindinis", "DI", "Paslaugos", "Rezervacijos", "Bendravimas", "Paskyra", "Pasitikėjimas", "Paslaugų teikėjas", "Finansai", "Administravimas"]),
  lv: buildNavigation(["KLYX centrs", "Pārskats", "KLYX asistents", "KLYX aģents", "Mana KLYX atmiņa", "Atrast pakalpojumu", "Vietējais pārklājums", "Meklēt pēc fotoattēla", "Manas rezervācijas", "Ziņojumi", "Izlase", "Mani pieprasījumi", "Mani piedāvājumi", "Paziņojumi", "Uzticības centrs", "Mans profils", "Iestatījumi", "Profesionālais panelis", "Mana darbība", "Profesionālais asistents", "Rezervācijas un uzdevumi", "Pieejamie uzdevumi", "Piedāvājumu pieprasījumi", "Viedā plānošana", "Pakalpojumu zonas", "Klientu ziņojumi", "Pievienot profesiju", "Manas prasmes", "Maksājumi", "Verifikācija", "Pakalpojumu sniedzēja verifikācija", "Vērtējums un atsauksmes", "Profesionālā uzticība", "Publiskais profils", "KLYX administrēšanas centrs", "Pakalpojumu sniedzēju prasmes", "Pakalpojumu sniedzēju verifikācijas", "Strīdi", "KLYX pakalpojumi", "Finanšu audits", "Galvenais", "MI", "Pakalpojumi", "Rezervācijas", "Saziņa", "Konts", "Uzticība", "Pakalpojumu sniedzējs", "Finanses", "Administrēšana"]),
  et: buildNavigation(["KLYXi keskus", "Ülevaade", "KLYXi assistent", "KLYXi agent", "Minu KLYXi mälu", "Leia teenus", "Kohalik katvus", "Otsi foto järgi", "Minu broneeringud", "Sõnumid", "Lemmikud", "Minu päringud", "Minu pakkumised", "Teavitused", "Usalduskeskus", "Minu profiil", "Seaded", "Professionaalne töölaud", "Minu tegevus", "Professionaalne assistent", "Broneeringud ja tööd", "Saadaolevad tööd", "Pakkumistaotlused", "Nutikas planeerimine", "Teeninduspiirkonnad", "Kliendisõnumid", "Lisa amet", "Minu oskused", "Maksed", "Kinnitamine", "Teenusepakkuja kinnitamine", "Hinnang ja arvustused", "Professionaalne usaldus", "Avalik profiil", "KLYXi halduskeskus", "Teenusepakkujate oskused", "Teenusepakkujate kinnitamised", "Vaidlused", "KLYXi teenused", "Finantsaudit", "Peamine", "TI", "Teenused", "Broneeringud", "Suhtlus", "Konto", "Usaldus", "Teenusepakkuja", "Finants", "Haldus"]),
  sl: buildNavigation(["Središče KLYX", "Pregled", "Pomočnik KLYX", "Agent KLYX", "Moj spomin KLYX", "Poišči storitev", "Lokalna pokritost", "Iskanje s fotografijo", "Moje rezervacije", "Sporočila", "Priljubljeno", "Moje zahteve", "Moje ponudbe", "Obvestila", "Središče zaupanja", "Moj profil", "Nastavitve", "Profesionalna nadzorna plošča", "Moja dejavnost", "Profesionalni pomočnik", "Rezervacije in naloge", "Razpoložljive naloge", "Zahteve za ponudbo", "Pametno načrtovanje", "Območja storitev", "Sporočila strank", "Dodaj poklic", "Moje spretnosti", "Plačila", "Preverjanje", "Preverjanje ponudnika", "Ocena in mnenja", "Profesionalno zaupanje", "Javni profil", "Skrbniško središče KLYX", "Spretnosti ponudnikov", "Preverjanja ponudnikov", "Spori", "Storitve KLYX", "Finančna revizija", "Glavno", "UI", "Storitve", "Rezervacije", "Komunikacija", "Račun", "Zaupanje", "Ponudnik", "Finance", "Administracija"]),
};
