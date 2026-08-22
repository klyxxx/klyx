export const KLYX_BATCH_4_LANGUAGE_OPTIONS = [
  { value: "cs", label: "Čeština", htmlLang: "cs", dir: "ltr" },
  { value: "sk", label: "Slovenčina", htmlLang: "sk", dir: "ltr" },
  { value: "hu", label: "Magyar", htmlLang: "hu", dir: "ltr" },
  { value: "ro", label: "Română", htmlLang: "ro", dir: "ltr" },
  { value: "el", label: "Ελληνικά", htmlLang: "el", dir: "ltr" },
  { value: "bg", label: "Български", htmlLang: "bg", dir: "ltr" },
  { value: "hr", label: "Hrvatski", htmlLang: "hr", dir: "ltr" },
  { value: "sr", label: "Српски", htmlLang: "sr", dir: "ltr" },
] as const;

export const KLYX_BATCH_4_UI_MESSAGES: Record<string, Record<string, string>> = {
  cs: {
    skipToMain: "Přejít k hlavnímu obsahu",
    "sidebar.providerTagline": "Vaše profesionální činnost na KLYX.",
    "sidebar.clientTagline": "Všechny vaše každodenní služby.",
    "sidebar.loadingProfile": "Načítání profilu...",
    "sidebar.providerAccount": "Účet poskytovatele",
    "sidebar.clientAccount": "Účet klienta",
    "sidebar.searchPlaceholder": "Hledat v KLYX",
    "sidebar.noResults": "Žádné výsledky.",
    "sidebar.adminCenter": "Admin centrum KLYX",
    "sidebar.loggingOut": "Odhlašování...",
    "sidebar.logout": "Odhlásit se",
    "sidebar.openMenu": "Otevřít nabídku",
    "sidebar.closeMenu": "Zavřít nabídku"
  },
  sk: {
    skipToMain: "Prejsť na hlavný obsah",
    "sidebar.providerTagline": "Vaša profesionálna činnosť na KLYX.",
    "sidebar.clientTagline": "Všetky vaše každodenné služby.",
    "sidebar.loadingProfile": "Načítava sa profil...",
    "sidebar.providerAccount": "Účet poskytovateľa",
    "sidebar.clientAccount": "Účet klienta",
    "sidebar.searchPlaceholder": "Hľadať v KLYX",
    "sidebar.noResults": "Žiadne výsledky.",
    "sidebar.adminCenter": "Admin centrum KLYX",
    "sidebar.loggingOut": "Odhlasovanie...",
    "sidebar.logout": "Odhlásiť sa",
    "sidebar.openMenu": "Otvoriť ponuku",
    "sidebar.closeMenu": "Zavrieť ponuku"
  },
  hu: {
    skipToMain: "Ugrás a fő tartalomhoz",
    "sidebar.providerTagline": "Szakmai tevékenységed a KLYX-en.",
    "sidebar.clientTagline": "Minden hétköznapi szolgáltatásod.",
    "sidebar.loadingProfile": "Profil betöltése...",
    "sidebar.providerAccount": "Szolgáltatói fiók",
    "sidebar.clientAccount": "Ügyfélfiók",
    "sidebar.searchPlaceholder": "Keresés a KLYX-ben",
    "sidebar.noResults": "Nincs találat.",
    "sidebar.adminCenter": "KLYX adminisztrációs központ",
    "sidebar.loggingOut": "Kijelentkezés...",
    "sidebar.logout": "Kijelentkezés",
    "sidebar.openMenu": "Menü megnyitása",
    "sidebar.closeMenu": "Menü bezárása"
  },
  ro: {
    skipToMain: "Mergi la conținutul principal",
    "sidebar.providerTagline": "Activitatea ta profesională pe KLYX.",
    "sidebar.clientTagline": "Toate serviciile tale de zi cu zi.",
    "sidebar.loadingProfile": "Se încarcă profilul...",
    "sidebar.providerAccount": "Cont de prestator",
    "sidebar.clientAccount": "Cont de client",
    "sidebar.searchPlaceholder": "Caută în KLYX",
    "sidebar.noResults": "Niciun rezultat.",
    "sidebar.adminCenter": "Centrul Admin KLYX",
    "sidebar.loggingOut": "Se deconectează...",
    "sidebar.logout": "Deconectare",
    "sidebar.openMenu": "Deschide meniul",
    "sidebar.closeMenu": "Închide meniul"
  },
  el: {
    skipToMain: "Μετάβαση στο κύριο περιεχόμενο",
    "sidebar.providerTagline": "Η επαγγελματική σου δραστηριότητα στο KLYX.",
    "sidebar.clientTagline": "Όλες οι καθημερινές σου υπηρεσίες.",
    "sidebar.loadingProfile": "Φόρτωση προφίλ...",
    "sidebar.providerAccount": "Λογαριασμός παρόχου",
    "sidebar.clientAccount": "Λογαριασμός πελάτη",
    "sidebar.searchPlaceholder": "Αναζήτηση στο KLYX",
    "sidebar.noResults": "Δεν υπάρχουν αποτελέσματα.",
    "sidebar.adminCenter": "Κέντρο διαχείρισης KLYX",
    "sidebar.loggingOut": "Αποσύνδεση...",
    "sidebar.logout": "Αποσύνδεση",
    "sidebar.openMenu": "Άνοιγμα μενού",
    "sidebar.closeMenu": "Κλείσιμο μενού"
  },
  bg: {
    skipToMain: "Към основното съдържание",
    "sidebar.providerTagline": "Вашата професионална дейност в KLYX.",
    "sidebar.clientTagline": "Всички ваши ежедневни услуги.",
    "sidebar.loadingProfile": "Зареждане на профила...",
    "sidebar.providerAccount": "Акаунт на доставчик",
    "sidebar.clientAccount": "Клиентски акаунт",
    "sidebar.searchPlaceholder": "Търсене в KLYX",
    "sidebar.noResults": "Няма резултати.",
    "sidebar.adminCenter": "Админ център KLYX",
    "sidebar.loggingOut": "Излизане...",
    "sidebar.logout": "Изход",
    "sidebar.openMenu": "Отвори менюто",
    "sidebar.closeMenu": "Затвори менюто"
  },
  hr: {
    skipToMain: "Prijeđi na glavni sadržaj",
    "sidebar.providerTagline": "Tvoja profesionalna aktivnost na KLYX-u.",
    "sidebar.clientTagline": "Sve tvoje svakodnevne usluge.",
    "sidebar.loadingProfile": "Učitavanje profila...",
    "sidebar.providerAccount": "Račun pružatelja usluge",
    "sidebar.clientAccount": "Korisnički račun",
    "sidebar.searchPlaceholder": "Pretraži KLYX",
    "sidebar.noResults": "Nema rezultata.",
    "sidebar.adminCenter": "KLYX administracijski centar",
    "sidebar.loggingOut": "Odjava...",
    "sidebar.logout": "Odjavi se",
    "sidebar.openMenu": "Otvori izbornik",
    "sidebar.closeMenu": "Zatvori izbornik"
  },
  sr: {
    skipToMain: "Пређи на главни садржај",
    "sidebar.providerTagline": "Твоја професионална активност на KLYX-у.",
    "sidebar.clientTagline": "Све твоје свакодневне услуге.",
    "sidebar.loadingProfile": "Учитавање профила...",
    "sidebar.providerAccount": "Налог пружаоца услуге",
    "sidebar.clientAccount": "Налог клијента",
    "sidebar.searchPlaceholder": "Претражи KLYX",
    "sidebar.noResults": "Нема резултата.",
    "sidebar.adminCenter": "KLYX административни центар",
    "sidebar.loggingOut": "Одјављивање...",
    "sidebar.logout": "Одјави се",
    "sidebar.openMenu": "Отвори мени",
    "sidebar.closeMenu": "Затвори мени"
  },
};

const KLYX_BATCH_4_NAVIGATION_KEYS = ["Centre KLYX", "Vue d’ensemble", "Assistant KLYX", "KLYX Agent", "Ma mémoire KLYX", "Trouver un service", "Couverture locale", "Recherche par photo", "Mes réservations", "Messages", "Favoris", "Mes demandes", "Mes devis", "Notifications", "Centre de confiance", "Mon profil", "Paramètres", "Tableau professionnel", "Mon activité", "Assistant professionnel", "Réservations & missions", "Missions disponibles", "Demandes de devis", "Planning intelligent", "Zones d'intervention", "Messagerie clients", "Ajouter un métier", "Mes compétences", "Paiements", "Vérification", "Vérification prestataire", "Score et avis", "Confiance professionnelle", "Profil public", "Centre Admin KLYX", "Compétences prestataires", "Vérifications prestataires", "Litiges", "Services KLYX", "Audit financier", "Principal", "IA", "Services", "Réservations", "Communication", "Compte", "Confiance", "Prestataire", "Finance", "Administration"] as const;

function buildNavigation(values: readonly string[]) {
  if (values.length !== KLYX_BATCH_4_NAVIGATION_KEYS.length) {
    throw new Error("KLYX i18n batch 4 navigation catalog is incomplete.");
  }

  return Object.fromEntries(
    KLYX_BATCH_4_NAVIGATION_KEYS.map((key, index) => [key, values[index]])
  );
}

export const KLYX_BATCH_4_NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  cs: buildNavigation(["Centrum KLYX", "Přehled", "Asistent KLYX", "Agent KLYX", "Moje paměť KLYX", "Najít službu", "Místní pokrytí", "Hledat podle fotografie", "Moje rezervace", "Zprávy", "Oblíbené", "Moje požadavky", "Moje nabídky", "Oznámení", "Centrum důvěry", "Můj profil", "Nastavení", "Profesionální panel", "Moje činnost", "Profesionální asistent", "Rezervace a zakázky", "Dostupné zakázky", "Poptávky na nabídku", "Chytré plánování", "Oblasti působnosti", "Zprávy klientů", "Přidat profesi", "Moje dovednosti", "Platby", "Ověření", "Ověření poskytovatele", "Hodnocení a recenze", "Profesionální důvěra", "Veřejný profil", "Admin centrum KLYX", "Dovednosti poskytovatelů", "Ověření poskytovatelů", "Spory", "Služby KLYX", "Finanční audit", "Hlavní", "AI", "Služby", "Rezervace", "Komunikace", "Účet", "Důvěra", "Poskytovatel", "Finance", "Administrace"]),
  sk: buildNavigation(["Centrum KLYX", "Prehľad", "Asistent KLYX", "Agent KLYX", "Moja pamäť KLYX", "Nájsť službu", "Miestne pokrytie", "Hľadať podľa fotografie", "Moje rezervácie", "Správy", "Obľúbené", "Moje požiadavky", "Moje ponuky", "Upozornenia", "Centrum dôvery", "Môj profil", "Nastavenia", "Profesionálny panel", "Moja činnosť", "Profesionálny asistent", "Rezervácie a zákazky", "Dostupné zákazky", "Žiadosti o ponuku", "Inteligentné plánovanie", "Oblasti pôsobenia", "Správy klientov", "Pridať profesiu", "Moje zručnosti", "Platby", "Overenie", "Overenie poskytovateľa", "Hodnotenie a recenzie", "Profesionálna dôvera", "Verejný profil", "Admin centrum KLYX", "Zručnosti poskytovateľov", "Overenia poskytovateľov", "Spory", "Služby KLYX", "Finančný audit", "Hlavné", "AI", "Služby", "Rezervácie", "Komunikácia", "Účet", "Dôvera", "Poskytovateľ", "Financie", "Administrácia"]),
  hu: buildNavigation(["KLYX központ", "Áttekintés", "KLYX asszisztens", "KLYX ügynök", "KLYX memóriám", "Szolgáltatás keresése", "Helyi lefedettség", "Keresés fényképpel", "Foglalásaim", "Üzenetek", "Kedvencek", "Kéréseim", "Ajánlataim", "Értesítések", "Bizalmi központ", "Profilom", "Beállítások", "Szakmai irányítópult", "Tevékenységem", "Szakmai asszisztens", "Foglalások és munkák", "Elérhető munkák", "Árajánlatkérések", "Intelligens tervezés", "Szolgáltatási területek", "Ügyfélüzenetek", "Szakma hozzáadása", "Készségeim", "Fizetések", "Ellenőrzés", "Szolgáltató ellenőrzése", "Pontszám és értékelések", "Szakmai bizalom", "Nyilvános profil", "KLYX adminisztrációs központ", "Szolgáltatói készségek", "Szolgáltatói ellenőrzések", "Viták", "KLYX szolgáltatások", "Pénzügyi audit", "Főmenü", "MI", "Szolgáltatások", "Foglalások", "Kommunikáció", "Fiók", "Bizalom", "Szolgáltató", "Pénzügyek", "Adminisztráció"]),
  ro: buildNavigation(["Centru KLYX", "Prezentare generală", "Asistent KLYX", "Agent KLYX", "Memoria mea KLYX", "Găsește un serviciu", "Acoperire locală", "Căutare după fotografie", "Rezervările mele", "Mesaje", "Favorite", "Solicitările mele", "Ofertele mele", "Notificări", "Centrul de încredere", "Profilul meu", "Setări", "Panou profesional", "Activitatea mea", "Asistent profesional", "Rezervări și misiuni", "Misiuni disponibile", "Cereri de ofertă", "Planificare inteligentă", "Zone de intervenție", "Mesaje clienți", "Adaugă o profesie", "Competențele mele", "Plăți", "Verificare", "Verificarea prestatorului", "Scor și recenzii", "Încredere profesională", "Profil public", "Centrul Admin KLYX", "Competențe prestatori", "Verificări prestatori", "Litigii", "Servicii KLYX", "Audit financiar", "Principal", "IA", "Servicii", "Rezervări", "Comunicare", "Cont", "Încredere", "Prestator", "Finanțe", "Administrare"]),
  el: buildNavigation(["Κέντρο KLYX", "Επισκόπηση", "Βοηθός KLYX", "Πράκτορας KLYX", "Η μνήμη μου KLYX", "Εύρεση υπηρεσίας", "Τοπική κάλυψη", "Αναζήτηση με φωτογραφία", "Οι κρατήσεις μου", "Μηνύματα", "Αγαπημένα", "Τα αιτήματά μου", "Οι προσφορές μου", "Ειδοποιήσεις", "Κέντρο εμπιστοσύνης", "Το προφίλ μου", "Ρυθμίσεις", "Επαγγελματικός πίνακας", "Η δραστηριότητά μου", "Επαγγελματικός βοηθός", "Κρατήσεις και εργασίες", "Διαθέσιμες εργασίες", "Αιτήματα προσφοράς", "Έξυπνος προγραμματισμός", "Περιοχές εξυπηρέτησης", "Μηνύματα πελατών", "Προσθήκη επαγγέλματος", "Οι δεξιότητές μου", "Πληρωμές", "Επαλήθευση", "Επαλήθευση παρόχου", "Βαθμολογία και κριτικές", "Επαγγελματική εμπιστοσύνη", "Δημόσιο προφίλ", "Κέντρο διαχείρισης KLYX", "Δεξιότητες παρόχων", "Επαληθεύσεις παρόχων", "Διαφορές", "Υπηρεσίες KLYX", "Οικονομικός έλεγχος", "Κύριο", "ΤΝ", "Υπηρεσίες", "Κρατήσεις", "Επικοινωνία", "Λογαριασμός", "Εμπιστοσύνη", "Πάροχος", "Οικονομικά", "Διαχείριση"]),
  bg: buildNavigation(["Център KLYX", "Преглед", "Асистент KLYX", "Агент KLYX", "Моята KLYX памет", "Намери услуга", "Местно покритие", "Търсене по снимка", "Моите резервации", "Съобщения", "Любими", "Моите заявки", "Моите оферти", "Известия", "Център за доверие", "Моят профил", "Настройки", "Професионално табло", "Моята дейност", "Професионален асистент", "Резервации и задачи", "Налични задачи", "Заявки за оферта", "Интелигентно планиране", "Зони за обслужване", "Съобщения от клиенти", "Добави професия", "Моите умения", "Плащания", "Проверка", "Проверка на доставчик", "Оценка и отзиви", "Професионално доверие", "Публичен профил", "Админ център KLYX", "Умения на доставчици", "Проверки на доставчици", "Спорове", "Услуги KLYX", "Финансов одит", "Основно", "ИИ", "Услуги", "Резервации", "Комуникация", "Акаунт", "Доверие", "Доставчик", "Финанси", "Администрация"]),
  hr: buildNavigation(["KLYX centar", "Pregled", "KLYX asistent", "KLYX agent", "Moja KLYX memorija", "Pronađi uslugu", "Lokalna pokrivenost", "Pretraživanje fotografijom", "Moje rezervacije", "Poruke", "Favoriti", "Moji zahtjevi", "Moje ponude", "Obavijesti", "Centar povjerenja", "Moj profil", "Postavke", "Profesionalna nadzorna ploča", "Moja aktivnost", "Profesionalni asistent", "Rezervacije i poslovi", "Dostupni poslovi", "Zahtjevi za ponudu", "Pametno planiranje", "Područja usluge", "Poruke klijenata", "Dodaj zanimanje", "Moje vještine", "Plaćanja", "Provjera", "Provjera pružatelja usluge", "Ocjena i recenzije", "Profesionalno povjerenje", "Javni profil", "KLYX administracijski centar", "Vještine pružatelja", "Provjere pružatelja", "Sporovi", "KLYX usluge", "Financijska revizija", "Glavno", "AI", "Usluge", "Rezervacije", "Komunikacija", "Račun", "Povjerenje", "Pružatelj usluge", "Financije", "Administracija"]),
  sr: buildNavigation(["KLYX центар", "Преглед", "KLYX асистент", "KLYX агент", "Моја KLYX меморија", "Пронађи услугу", "Локална покривеност", "Претрага фотографијом", "Моје резервације", "Поруке", "Омиљено", "Моји захтеви", "Моје понуде", "Обавештења", "Центар поверења", "Мој профил", "Подешавања", "Професионална контролна табла", "Моја активност", "Професионални асистент", "Резервације и послови", "Доступни послови", "Захтеви за понуду", "Паметно планирање", "Подручја услуге", "Поруке клијената", "Додај занимање", "Моје вештине", "Плаћања", "Верификација", "Верификација пружаоца услуге", "Оцена и рецензије", "Професионално поверење", "Јавни профил", "KLYX административни центар", "Вештине пружалаца", "Верификације пружалаца", "Спорови", "KLYX услуге", "Финансијска ревизија", "Главно", "ВИ", "Услуге", "Резервације", "Комуникација", "Налог", "Поверење", "Пружалац услуге", "Финансије", "Администрација"]),
};
