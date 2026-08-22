export const KLYX_BATCH_3_LANGUAGE_OPTIONS = [
  { value: "sv", label: "Svenska", htmlLang: "sv", dir: "ltr" },
  { value: "da", label: "Dansk", htmlLang: "da", dir: "ltr" },
  { value: "no", label: "Norsk", htmlLang: "no", dir: "ltr" },
  { value: "fi", label: "Suomi", htmlLang: "fi", dir: "ltr" },
] as const;

export const KLYX_BATCH_3_UI_MESSAGES: Record<string, Record<string, string>> = {
  sv: {
    skipToMain: "Hoppa till huvudinnehållet",
    "sidebar.providerTagline": "Din professionella verksamhet på KLYX.",
    "sidebar.clientTagline": "Alla dina vardagstjänster.",
    "sidebar.loadingProfile": "Laddar profil...",
    "sidebar.providerAccount": "Utförarkonto",
    "sidebar.clientAccount": "Kundkonto",
    "sidebar.searchPlaceholder": "Sök i KLYX",
    "sidebar.noResults": "Inga resultat.",
    "sidebar.adminCenter": "KLYX administrationscenter",
    "sidebar.loggingOut": "Loggar ut...",
    "sidebar.logout": "Logga ut",
    "sidebar.openMenu": "Öppna meny",
    "sidebar.closeMenu": "Stäng meny"
  },
  da: {
    skipToMain: "Gå til hovedindhold",
    "sidebar.providerTagline": "Din professionelle aktivitet på KLYX.",
    "sidebar.clientTagline": "Alle dine hverdagstjenester.",
    "sidebar.loadingProfile": "Indlæser profil...",
    "sidebar.providerAccount": "Udbyderkonto",
    "sidebar.clientAccount": "Kundekonto",
    "sidebar.searchPlaceholder": "Søg i KLYX",
    "sidebar.noResults": "Ingen resultater.",
    "sidebar.adminCenter": "KLYX administrationscenter",
    "sidebar.loggingOut": "Logger ud...",
    "sidebar.logout": "Log ud",
    "sidebar.openMenu": "Åbn menu",
    "sidebar.closeMenu": "Luk menu"
  },
  no: {
    skipToMain: "Gå til hovedinnhold",
    "sidebar.providerTagline": "Din profesjonelle aktivitet på KLYX.",
    "sidebar.clientTagline": "Alle hverdagstjenestene dine.",
    "sidebar.loadingProfile": "Laster profil...",
    "sidebar.providerAccount": "Tilbyderkonto",
    "sidebar.clientAccount": "Kundekonto",
    "sidebar.searchPlaceholder": "Søk i KLYX",
    "sidebar.noResults": "Ingen resultater.",
    "sidebar.adminCenter": "KLYX administrasjonssenter",
    "sidebar.loggingOut": "Logger ut...",
    "sidebar.logout": "Logg ut",
    "sidebar.openMenu": "Åpne meny",
    "sidebar.closeMenu": "Lukk meny"
  },
  fi: {
    skipToMain: "Siirry pääsisältöön",
    "sidebar.providerTagline": "Ammatillinen toimintasi KLYXissä.",
    "sidebar.clientTagline": "Kaikki arjen palvelusi.",
    "sidebar.loadingProfile": "Ladataan profiilia...",
    "sidebar.providerAccount": "Palveluntarjoajan tili",
    "sidebar.clientAccount": "Asiakastili",
    "sidebar.searchPlaceholder": "Hae KLYXistä",
    "sidebar.noResults": "Ei tuloksia.",
    "sidebar.adminCenter": "KLYX-ylläpitokeskus",
    "sidebar.loggingOut": "Kirjaudutaan ulos...",
    "sidebar.logout": "Kirjaudu ulos",
    "sidebar.openMenu": "Avaa valikko",
    "sidebar.closeMenu": "Sulje valikko"
  },
};

const KLYX_BATCH_3_NAVIGATION_KEYS = ["Centre KLYX", "Vue d’ensemble", "Assistant KLYX", "KLYX Agent", "Ma mémoire KLYX", "Trouver un service", "Couverture locale", "Recherche par photo", "Mes réservations", "Messages", "Favoris", "Mes demandes", "Mes devis", "Notifications", "Centre de confiance", "Mon profil", "Paramètres", "Tableau professionnel", "Mon activité", "Assistant professionnel", "Réservations & missions", "Missions disponibles", "Demandes de devis", "Planning intelligent", "Zones d'intervention", "Messagerie clients", "Ajouter un métier", "Mes compétences", "Paiements", "Vérification", "Vérification prestataire", "Score et avis", "Confiance professionnelle", "Profil public", "Centre Admin KLYX", "Compétences prestataires", "Vérifications prestataires", "Litiges", "Services KLYX", "Audit financier", "Principal", "IA", "Services", "Réservations", "Communication", "Compte", "Confiance", "Prestataire", "Finance", "Administration"] as const;

function buildNavigation(values: readonly string[]) {
  if (values.length !== KLYX_BATCH_3_NAVIGATION_KEYS.length) {
    throw new Error("KLYX i18n batch 3 navigation catalog is incomplete.");
  }

  return Object.fromEntries(
    KLYX_BATCH_3_NAVIGATION_KEYS.map((key, index) => [key, values[index]])
  );
}

export const KLYX_BATCH_3_NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  sv: buildNavigation(["KLYX-center", "Översikt", "KLYX-assistent", "KLYX-agent", "Mitt KLYX-minne", "Hitta en tjänst", "Lokal täckning", "Sök med foto", "Mina bokningar", "Meddelanden", "Favoriter", "Mina förfrågningar", "Mina offerter", "Aviseringar", "Trygghetscenter", "Min profil", "Inställningar", "Professionell översikt", "Min verksamhet", "Professionell assistent", "Bokningar och uppdrag", "Tillgängliga uppdrag", "Offertförfrågningar", "Smart planering", "Serviceområden", "Kundmeddelanden", "Lägg till ett yrke", "Mina kompetenser", "Betalningar", "Verifiering", "Verifiering av utförare", "Betyg och omdömen", "Professionell trygghet", "Offentlig profil", "KLYX administrationscenter", "Utförarkompetenser", "Verifieringar av utförare", "Tvister", "KLYX-tjänster", "Finansiell revision", "Huvudmeny", "AI", "Tjänster", "Bokningar", "Kommunikation", "Konto", "Trygghet", "Utförare", "Ekonomi", "Administration"]),
  da: buildNavigation(["KLYX-center", "Oversigt", "KLYX-assistent", "KLYX-agent", "Min KLYX-hukommelse", "Find en tjeneste", "Lokal dækning", "Søg med foto", "Mine bookinger", "Beskeder", "Favoritter", "Mine forespørgsler", "Mine tilbud", "Notifikationer", "Tillidscenter", "Min profil", "Indstillinger", "Professionelt dashboard", "Min aktivitet", "Professionel assistent", "Bookinger og opgaver", "Tilgængelige opgaver", "Tilbudsforespørgsler", "Smart planlægning", "Serviceområder", "Kundebeskeder", "Tilføj et fag", "Mine kompetencer", "Betalinger", "Verifikation", "Verifikation af udbyder", "Score og anmeldelser", "Professionel tillid", "Offentlig profil", "KLYX administrationscenter", "Udbyderkompetencer", "Udbyderverifikationer", "Tvister", "KLYX-tjenester", "Finansiel revision", "Hovedmenu", "AI", "Tjenester", "Bookinger", "Kommunikation", "Konto", "Tillid", "Udbyder", "Finans", "Administration"]),
  no: buildNavigation(["KLYX-senter", "Oversikt", "KLYX-assistent", "KLYX-agent", "Mitt KLYX-minne", "Finn en tjeneste", "Lokal dekning", "Søk med bilde", "Mine bestillinger", "Meldinger", "Favoritter", "Mine forespørsler", "Mine tilbud", "Varsler", "Tillitsenter", "Min profil", "Innstillinger", "Profesjonelt dashbord", "Min aktivitet", "Profesjonell assistent", "Bestillinger og oppdrag", "Tilgjengelige oppdrag", "Tilbudsforespørsler", "Smart planlegging", "Tjenesteområder", "Kundemeldinger", "Legg til et yrke", "Mine ferdigheter", "Betalinger", "Verifisering", "Verifisering av tilbyder", "Poeng og anmeldelser", "Profesjonell tillit", "Offentlig profil", "KLYX administrasjonssenter", "Tilbyderferdigheter", "Tilbyderverifiseringer", "Tvister", "KLYX-tjenester", "Finansiell revisjon", "Hovedmeny", "AI", "Tjenester", "Bestillinger", "Kommunikasjon", "Konto", "Tillit", "Tilbyder", "Finans", "Administrasjon"]),
  fi: buildNavigation(["KLYX-keskus", "Yleiskatsaus", "KLYX-avustaja", "KLYX-agentti", "KLYX-muistini", "Etsi palvelu", "Paikallinen kattavuus", "Hae kuvalla", "Varaukseni", "Viestit", "Suosikit", "Pyyntöni", "Tarjoukseni", "Ilmoitukset", "Luottamuskeskus", "Profiilini", "Asetukset", "Ammattilaisen hallintapaneeli", "Toimintani", "Ammattilaisavustaja", "Varaukset ja tehtävät", "Saatavilla olevat tehtävät", "Tarjouspyynnöt", "Älykäs suunnittelu", "Palvelualueet", "Asiakasviestit", "Lisää ammatti", "Osaamiseni", "Maksut", "Vahvistus", "Palveluntarjoajan vahvistus", "Pisteet ja arvostelut", "Ammatillinen luottamus", "Julkinen profiili", "KLYX-ylläpitokeskus", "Palveluntarjoajien osaaminen", "Palveluntarjoajien vahvistukset", "Riitatilanteet", "KLYX-palvelut", "Taloudellinen tarkastus", "Päävalikko", "Tekoäly", "Palvelut", "Varaukset", "Viestintä", "Tili", "Luottamus", "Palveluntarjoaja", "Talous", "Ylläpito"]),
};
