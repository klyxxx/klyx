export const KLYX_BATCH_7_LANGUAGE_OPTIONS = [
  { value: "ka", label: "ქართული", htmlLang: "ka", dir: "ltr" },
  { value: "hy", label: "Հայերեն", htmlLang: "hy", dir: "ltr" },
  { value: "kk", label: "Қазақша", htmlLang: "kk", dir: "ltr" },
  { value: "uz", label: "O‘zbekcha", htmlLang: "uz", dir: "ltr" },
] as const;

export const KLYX_BATCH_7_UI_MESSAGES: Record<string, Record<string, string>> = {
  ka: {
    skipToMain: "მთავარ შინაარსზე გადასვლა",
    "sidebar.providerTagline": "თქვენი პროფესიული საქმიანობა KLYX-ზე.",
    "sidebar.clientTagline": "თქვენი ყოველდღიური ყველა სერვისი.",
    "sidebar.loadingProfile": "პროფილი იტვირთება...",
    "sidebar.providerAccount": "მომსახურების მიმწოდებლის ანგარიში",
    "sidebar.clientAccount": "კლიენტის ანგარიში",
    "sidebar.searchPlaceholder": "KLYX-ში ძიება",
    "sidebar.noResults": "შედეგები ვერ მოიძებნა.",
    "sidebar.adminCenter": "KLYX ადმინისტრირების ცენტრი",
    "sidebar.loggingOut": "გასვლა...",
    "sidebar.logout": "გასვლა",
    "sidebar.openMenu": "მენიუს გახსნა",
    "sidebar.closeMenu": "მენიუს დახურვა"
  },
  hy: {
    skipToMain: "Անցնել հիմնական բովանդակությանը",
    "sidebar.providerTagline": "Ձեր մասնագիտական գործունեությունը KLYX-ում։",
    "sidebar.clientTagline": "Ձեր բոլոր առօրյա ծառայությունները։",
    "sidebar.loadingProfile": "Պրոֆիլը բեռնվում է...",
    "sidebar.providerAccount": "Ծառայություն մատուցողի հաշիվ",
    "sidebar.clientAccount": "Հաճախորդի հաշիվ",
    "sidebar.searchPlaceholder": "Որոնել KLYX-ում",
    "sidebar.noResults": "Արդյունքներ չկան։",
    "sidebar.adminCenter": "KLYX ադմինիստրացիայի կենտրոն",
    "sidebar.loggingOut": "Դուրս է գալիս...",
    "sidebar.logout": "Դուրս գալ",
    "sidebar.openMenu": "Բացել ընտրացանկը",
    "sidebar.closeMenu": "Փակել ընտրացանկը"
  },
  kk: {
    skipToMain: "Негізгі мазмұнға өту",
    "sidebar.providerTagline": "KLYX-тегі кәсіби қызметіңіз.",
    "sidebar.clientTagline": "Күнделікті барлық қызметтеріңіз.",
    "sidebar.loadingProfile": "Профиль жүктелуде...",
    "sidebar.providerAccount": "Қызмет көрсетуші тіркелгісі",
    "sidebar.clientAccount": "Клиент тіркелгісі",
    "sidebar.searchPlaceholder": "KLYX ішінде іздеу",
    "sidebar.noResults": "Нәтиже жоқ.",
    "sidebar.adminCenter": "KLYX әкімшілік орталығы",
    "sidebar.loggingOut": "Шығу...",
    "sidebar.logout": "Шығу",
    "sidebar.openMenu": "Мәзірді ашу",
    "sidebar.closeMenu": "Мәзірді жабу"
  },
  uz: {
    skipToMain: "Asosiy tarkibga o‘tish",
    "sidebar.providerTagline": "KLYX’dagi professional faoliyatingiz.",
    "sidebar.clientTagline": "Barcha kundalik xizmatlaringiz.",
    "sidebar.loadingProfile": "Profil yuklanmoqda...",
    "sidebar.providerAccount": "Xizmat ko‘rsatuvchi hisobi",
    "sidebar.clientAccount": "Mijoz hisobi",
    "sidebar.searchPlaceholder": "KLYX ichida qidirish",
    "sidebar.noResults": "Natijalar yo‘q.",
    "sidebar.adminCenter": "KLYX boshqaruv markazi",
    "sidebar.loggingOut": "Chiqilmoqda...",
    "sidebar.logout": "Chiqish",
    "sidebar.openMenu": "Menyuni ochish",
    "sidebar.closeMenu": "Menyuni yopish"
  },
};

const KLYX_BATCH_7_NAVIGATION_KEYS = ["Centre KLYX", "Vue d’ensemble", "Assistant KLYX", "KLYX Agent", "Ma mémoire KLYX", "Trouver un service", "Couverture locale", "Recherche par photo", "Mes réservations", "Messages", "Favoris", "Mes demandes", "Mes devis", "Notifications", "Centre de confiance", "Mon profil", "Paramètres", "Tableau professionnel", "Mon activité", "Assistant professionnel", "Réservations & missions", "Missions disponibles", "Demandes de devis", "Planning intelligent", "Zones d'intervention", "Messagerie clients", "Ajouter un métier", "Mes compétences", "Paiements", "Vérification", "Vérification prestataire", "Score et avis", "Confiance professionnelle", "Profil public", "Centre Admin KLYX", "Compétences prestataires", "Vérifications prestataires", "Litiges", "Services KLYX", "Audit financier", "Principal", "IA", "Services", "Réservations", "Communication", "Compte", "Confiance", "Prestataire", "Finance", "Administration"] as const;

function buildNavigation(values: readonly string[]) {
  if (values.length !== KLYX_BATCH_7_NAVIGATION_KEYS.length) {
    throw new Error("KLYX i18n batch 7 navigation catalog is incomplete.");
  }

  return Object.fromEntries(
    KLYX_BATCH_7_NAVIGATION_KEYS.map((key, index) => [key, values[index]])
  );
}

export const KLYX_BATCH_7_NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  ka: buildNavigation(["KLYX ცენტრი", "მიმოხილვა", "KLYX ასისტენტი", "KLYX აგენტი", "ჩემი KLYX მეხსიერება", "სერვისის პოვნა", "ადგილობრივი დაფარვა", "ფოტოთი ძიება", "ჩემი ჯავშნები", "მესიჯები", "რჩეულები", "ჩემი მოთხოვნები", "ჩემი შეთავაზებები", "შეტყობინებები", "ნდობის ცენტრი", "ჩემი პროფილი", "პარამეტრები", "პროფესიული დაფა", "ჩემი საქმიანობა", "პროფესიული ასისტენტი", "ჯავშნები და დავალებები", "ხელმისაწვდომი დავალებები", "შეთავაზების მოთხოვნები", "ჭკვიანი დაგეგმვა", "მომსახურების ზონები", "კლიენტებთან შეტყობინებები", "პროფესიის დამატება", "ჩემი უნარები", "გადახდები", "ვერიფიკაცია", "მიმწოდებლის ვერიფიკაცია", "ქულა და შეფასებები", "პროფესიული ნდობა", "საჯარო პროფილი", "KLYX ადმინისტრირების ცენტრი", "მიმწოდებლის უნარები", "მიმწოდებლის ვერიფიკაციები", "დავები", "KLYX სერვისები", "ფინანსური აუდიტი", "მთავარი", "AI", "სერვისები", "ჯავშნები", "კომუნიკაცია", "ანგარიში", "ნდობა", "მიმწოდებელი", "ფინანსები", "ადმინისტრირება"]),
  hy: buildNavigation(["KLYX կենտրոն", "Ընդհանուր ակնարկ", "KLYX օգնական", "KLYX գործակալ", "Իմ KLYX հիշողությունը", "Գտնել ծառայություն", "Տեղական ծածկույթ", "Որոնում լուսանկարով", "Իմ ամրագրումները", "Հաղորդագրություններ", "Ընտրյալներ", "Իմ հարցումները", "Իմ գնանշումները", "Ծանուցումներ", "Վստահության կենտրոն", "Իմ պրոֆիլը", "Կարգավորումներ", "Մասնագիտական վահանակ", "Իմ գործունեությունը", "Մասնագիտական օգնական", "Ամրագրումներ և առաջադրանքներ", "Հասանելի առաջադրանքներ", "Գնանշման հարցումներ", "Խելացի պլանավորում", "Սպասարկման գոտիներ", "Հաճախորդների հաղորդագրություններ", "Ավելացնել մասնագիտություն", "Իմ հմտությունները", "Վճարումներ", "Ստուգում", "Մատակարարի ստուգում", "Գնահատական և կարծիքներ", "Մասնագիտական վստահություն", "Հանրային պրոֆիլ", "KLYX ադմինիստրացիայի կենտրոն", "Մատակարարների հմտություններ", "Մատակարարների ստուգումներ", "Վեճեր", "KLYX ծառայություններ", "Ֆինանսական աուդիտ", "Գլխավոր", "AI", "Ծառայություններ", "Ամրագրումներ", "Հաղորդակցություն", "Հաշիվ", "Վստահություն", "Մատակարար", "Ֆինանսներ", "Ադմինիստրացիա"]),
  kk: buildNavigation(["KLYX орталығы", "Шолу", "KLYX көмекшісі", "KLYX агенті", "Менің KLYX жадым", "Қызмет табу", "Жергілікті қамту", "Фото арқылы іздеу", "Менің брондауларым", "Хабарламалар", "Таңдаулылар", "Менің сұрауларым", "Менің баға ұсыныстарым", "Хабарландырулар", "Сенім орталығы", "Менің профилім", "Параметрлер", "Кәсіби бақылау тақтасы", "Менің қызметім", "Кәсіби көмекші", "Брондаулар және тапсырмалар", "Қолжетімді тапсырмалар", "Баға ұсынысына сұраулар", "Ақылды жоспарлау", "Қызмет көрсету аймақтары", "Клиент хабарламалары", "Мамандық қосу", "Менің дағдыларым", "Төлемдер", "Тексеру", "Қызмет көрсетушіні тексеру", "Ұпай және пікірлер", "Кәсіби сенім", "Ашық профиль", "KLYX әкімшілік орталығы", "Қызмет көрсетуші дағдылары", "Қызмет көрсетуші тексерулері", "Даулар", "KLYX қызметтері", "Қаржылық аудит", "Негізгі", "AI", "Қызметтер", "Брондаулар", "Байланыс", "Тіркелгі", "Сенім", "Қызмет көрсетуші", "Қаржы", "Әкімшілік"]),
  uz: buildNavigation(["KLYX markazi", "Umumiy ko‘rinish", "KLYX yordamchisi", "KLYX agenti", "Mening KLYX xotiram", "Xizmat topish", "Mahalliy qamrov", "Rasm orqali qidirish", "Mening bronlarim", "Xabarlar", "Sevimlilar", "Mening so‘rovlarim", "Mening takliflarim", "Bildirishnomalar", "Ishonch markazi", "Mening profilim", "Sozlamalar", "Professional boshqaruv paneli", "Mening faoliyatim", "Professional yordamchi", "Bronlar va vazifalar", "Mavjud vazifalar", "Narx taklifi so‘rovlari", "Aqlli rejalashtirish", "Xizmat hududlari", "Mijoz xabarlari", "Kasb qo‘shish", "Mening ko‘nikmalarim", "To‘lovlar", "Tasdiqlash", "Xizmat ko‘rsatuvchini tasdiqlash", "Ball va sharhlar", "Professional ishonch", "Ommaviy profil", "KLYX boshqaruv markazi", "Xizmat ko‘rsatuvchi ko‘nikmalari", "Xizmat ko‘rsatuvchi tasdiqlovlari", "Nizolar", "KLYX xizmatlari", "Moliyaviy audit", "Asosiy", "AI", "Xizmatlar", "Bronlar", "Aloqa", "Hisob", "Ishonch", "Xizmat ko‘rsatuvchi", "Moliya", "Boshqaruv"]),
};
