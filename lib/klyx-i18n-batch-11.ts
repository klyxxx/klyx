export const KLYX_BATCH_11_LANGUAGE_OPTIONS = [
  { value: "sq", label: "Shqip", htmlLang: "sq", dir: "ltr" },
  { value: "mk", label: "Македонски", htmlLang: "mk", dir: "ltr" },
  { value: "is", label: "Íslenska", htmlLang: "is", dir: "ltr" },
  { value: "ga", label: "Gaeilge", htmlLang: "ga", dir: "ltr" },
] as const;

export const KLYX_BATCH_11_UI_MESSAGES: Record<string, Record<string, string>> = {
  sq: {
    skipToMain: "Shko te përmbajtja kryesore",
    "sidebar.providerTagline": "Aktiviteti yt profesional në KLYX.",
    "sidebar.clientTagline": "Të gjitha shërbimet e tua të përditshme.",
    "sidebar.loadingProfile": "Po ngarkohet profili...",
    "sidebar.providerAccount": "Llogaria e ofruesit",
    "sidebar.clientAccount": "Llogaria e klientit",
    "sidebar.searchPlaceholder": "Kërko në KLYX",
    "sidebar.noResults": "Nuk ka rezultate.",
    "sidebar.adminCenter": "Qendra e administrimit KLYX",
    "sidebar.loggingOut": "Po dilni...",
    "sidebar.logout": "Dil",
    "sidebar.openMenu": "Hap menunë",
    "sidebar.closeMenu": "Mbyll menunë"
  },
  mk: {
    skipToMain: "Оди до главната содржина",
    "sidebar.providerTagline": "Вашата професионална активност на KLYX.",
    "sidebar.clientTagline": "Сите ваши секојдневни услуги.",
    "sidebar.loadingProfile": "Се вчитува профилот...",
    "sidebar.providerAccount": "Сметка на давател",
    "sidebar.clientAccount": "Сметка на клиент",
    "sidebar.searchPlaceholder": "Пребарај во KLYX",
    "sidebar.noResults": "Нема резултати.",
    "sidebar.adminCenter": "Административен центар KLYX",
    "sidebar.loggingOut": "Се одјавувате...",
    "sidebar.logout": "Одјави се",
    "sidebar.openMenu": "Отвори мени",
    "sidebar.closeMenu": "Затвори мени"
  },
  is: {
    skipToMain: "Fara í aðalefni",
    "sidebar.providerTagline": "Atvinnustarfsemi þín á KLYX.",
    "sidebar.clientTagline": "Öll dagleg þjónusta þín.",
    "sidebar.loadingProfile": "Hleð prófíl...",
    "sidebar.providerAccount": "Reikningur þjónustuaðila",
    "sidebar.clientAccount": "Reikningur viðskiptavinar",
    "sidebar.searchPlaceholder": "Leita í KLYX",
    "sidebar.noResults": "Engar niðurstöður.",
    "sidebar.adminCenter": "Stjórnunarmiðstöð KLYX",
    "sidebar.loggingOut": "Skrái út...",
    "sidebar.logout": "Skrá út",
    "sidebar.openMenu": "Opna valmynd",
    "sidebar.closeMenu": "Loka valmynd"
  },
  ga: {
    skipToMain: "Téigh chuig an bpríomhábhar",
    "sidebar.providerTagline": "Do ghníomhaíocht ghairmiúil ar KLYX.",
    "sidebar.clientTagline": "Do sheirbhísí laethúla go léir.",
    "sidebar.loadingProfile": "Próifíl á lódáil...",
    "sidebar.providerAccount": "Cuntas soláthraí",
    "sidebar.clientAccount": "Cuntas cliaint",
    "sidebar.searchPlaceholder": "Cuardaigh in KLYX",
    "sidebar.noResults": "Gan torthaí.",
    "sidebar.adminCenter": "Ionad Riaracháin KLYX",
    "sidebar.loggingOut": "Ag síniú amach...",
    "sidebar.logout": "Sínigh amach",
    "sidebar.openMenu": "Oscail an roghchlár",
    "sidebar.closeMenu": "Dún an roghchlár"
  },
};

const KLYX_BATCH_11_NAVIGATION_KEYS = ["Centre KLYX", "Vue d’ensemble", "Assistant KLYX", "KLYX Agent", "Ma mémoire KLYX", "Trouver un service", "Couverture locale", "Recherche par photo", "Mes réservations", "Messages", "Favoris", "Mes demandes", "Mes devis", "Notifications", "Centre de confiance", "Mon profil", "Paramètres", "Tableau professionnel", "Mon activité", "Assistant professionnel", "Réservations & missions", "Missions disponibles", "Demandes de devis", "Planning intelligent", "Zones d'intervention", "Messagerie clients", "Ajouter un métier", "Mes compétences", "Paiements", "Vérification", "Vérification prestataire", "Score et avis", "Confiance professionnelle", "Profil public", "Centre Admin KLYX", "Compétences prestataires", "Vérifications prestataires", "Litiges", "Services KLYX", "Audit financier", "Principal", "IA", "Services", "Réservations", "Communication", "Compte", "Confiance", "Prestataire", "Finance", "Administration"] as const;

function buildNavigation(values: readonly string[]) {
  if (values.length !== KLYX_BATCH_11_NAVIGATION_KEYS.length) {
    throw new Error("KLYX i18n batch 11 navigation catalog is incomplete.");
  }
  return Object.fromEntries(KLYX_BATCH_11_NAVIGATION_KEYS.map((key, index) => [key, values[index]]));
}

export const KLYX_BATCH_11_NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  sq: buildNavigation(["Qendra KLYX","Përmbledhje","Asistenti KLYX","Agjenti KLYX","Kujtesa ime KLYX","Gjej një shërbim","Mbulimi lokal","Kërkim me foto","Rezervimet e mia","Mesazhet","Të preferuarat","Kërkesat e mia","Ofertat e mia","Njoftimet","Qendra e besimit","Profili im","Cilësimet","Paneli profesional","Aktiviteti im","Asistenti profesional","Rezervime dhe detyra","Detyrat e disponueshme","Kërkesat për ofertë","Planifikimi inteligjent","Zonat e shërbimit","Mesazhet e klientëve","Shto një profesion","Aftësitë e mia","Pagesat","Verifikimi","Verifikimi i ofruesit","Vlerësimi dhe komentet","Besimi profesional","Profili publik","Qendra e administrimit KLYX","Aftësitë e ofruesve","Verifikimet e ofruesve","Mosmarrëveshjet","Shërbimet KLYX","Auditimi financiar","Kryesore","AI","Shërbimet","Rezervimet","Komunikimi","Llogaria","Besimi","Ofruesi","Financat","Administrimi"]),
  mk: buildNavigation(["Центар KLYX","Преглед","Асистент KLYX","Агент KLYX","Мојата KLYX меморија","Најди услуга","Локална покриеност","Пребарување со фотографија","Моите резервации","Пораки","Омилени","Моите барања","Моите понуди","Известувања","Центар за доверба","Мој профил","Поставки","Професионална контролна табла","Моја активност","Професионален асистент","Резервации и задачи","Достапни задачи","Барања за понуда","Паметно планирање","Области на услуга","Пораки од клиенти","Додај професија","Мои вештини","Плаќања","Верификација","Верификација на давател","Оценка и рецензии","Професионална доверба","Јавен профил","Административен центар KLYX","Вештини на даватели","Верификации на даватели","Спорови","Услуги KLYX","Финансиска ревизија","Главно","AI","Услуги","Резервации","Комуникација","Сметка","Доверба","Давател","Финансии","Администрација"]),
  is: buildNavigation(["KLYX-miðstöð","Yfirlit","KLYX-aðstoðarmaður","KLYX-fulltrúi","KLYX-minnið mitt","Finna þjónustu","Staðbundin þjónustusvæði","Leita með mynd","Bókanirnar mínar","Skilaboð","Uppáhald","Beiðnirnar mínar","Tilboðin mín","Tilkynningar","Traustmiðstöð","Prófíllinn minn","Stillingar","Faglegt stjórnborð","Starfsemin mín","Faglegur aðstoðarmaður","Bókanir og verkefni","Laus verkefni","Tilboðsbeiðnir","Snjöll áætlanagerð","Þjónustusvæði","Skilaboð viðskiptavina","Bæta við starfsgrein","Færnin mín","Greiðslur","Staðfesting","Staðfesting þjónustuaðila","Einkunn og umsagnir","Faglegt traust","Opinber prófíll","Stjórnunarmiðstöð KLYX","Færni þjónustuaðila","Staðfestingar þjónustuaðila","Deilur","KLYX-þjónusta","Fjárhagsendurskoðun","Aðal","AI","Þjónusta","Bókanir","Samskipti","Reikningur","Traust","Þjónustuaðili","Fjármál","Stjórnun"]),
  ga: buildNavigation(["Ionad KLYX","Forbhreathnú","Cúntóir KLYX","Gníomhaire KLYX","Mo chuimhne KLYX","Aimsigh seirbhís","Clúdach áitiúil","Cuardach le grianghraf","Mo chuid áirithintí","Teachtaireachtaí","Ceanáin","Mo chuid iarratas","Mo chuid meastachán","Fógraí","Ionad iontaoibhe","Mo phróifíl","Socruithe","Painéal gairmiúil","Mo ghníomhaíocht","Cúntóir gairmiúil","Áirithintí agus tascanna","Tascanna ar fáil","Iarratais ar mheastachán","Pleanáil chliste","Limistéir seirbhíse","Teachtaireachtaí cliant","Cuir gairm leis","Mo scileanna","Íocaíochtaí","Fíorú","Fíorú soláthraí","Scór agus léirmheasanna","Iontaobhas gairmiúil","Próifíl phoiblí","Ionad Riaracháin KLYX","Scileanna soláthraithe","Fíoruithe soláthraithe","Díospóidí","Seirbhísí KLYX","Iniúchadh airgeadais","Príomhúil","AI","Seirbhísí","Áirithintí","Cumarsáid","Cuntas","Iontaobhas","Soláthraí","Airgeadas","Riarachán"]),
};
