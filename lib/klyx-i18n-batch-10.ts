export const KLYX_BATCH_10_LANGUAGE_OPTIONS = [
  { value: "my", label: "မြန်မာ", htmlLang: "my", dir: "ltr" },
  { value: "km", label: "ខ្មែរ", htmlLang: "km", dir: "ltr" },
  { value: "lo", label: "ລາວ", htmlLang: "lo", dir: "ltr" },
  { value: "mn", label: "Монгол", htmlLang: "mn", dir: "ltr" },
] as const;

export const KLYX_BATCH_10_UI_MESSAGES: Record<string, Record<string, string>> = {
  my: {
    skipToMain: "အဓိကအကြောင်းအရာသို့ သွားရန်",
    "sidebar.providerTagline": "KLYX ပေါ်ရှိ သင့်ပရော်ဖက်ရှင်နယ် လုပ်ငန်း.",
    "sidebar.clientTagline": "သင့်နေ့စဉ်ဝန်ဆောင်မှုများအားလုံး.",
    "sidebar.loadingProfile": "ပရိုဖိုင်ကို ဖွင့်နေသည်...",
    "sidebar.providerAccount": "ဝန်ဆောင်မှုပေးသူ အကောင့်",
    "sidebar.clientAccount": "ဖောက်သည် အကောင့်",
    "sidebar.searchPlaceholder": "KLYX တွင် ရှာရန်",
    "sidebar.noResults": "ရလဒ်မရှိပါ.",
    "sidebar.adminCenter": "KLYX စီမံခန့်ခွဲမှုစင်တာ",
    "sidebar.loggingOut": "ထွက်နေသည်...",
    "sidebar.logout": "ထွက်ရန်",
    "sidebar.openMenu": "မီနူးဖွင့်ရန်",
    "sidebar.closeMenu": "မီနူးပိတ်ရန်"
  },
  km: {
    skipToMain: "ទៅ​មាតិកា​សំខាន់",
    "sidebar.providerTagline": "សកម្មភាពវិជ្ជាជីវៈរបស់អ្នកនៅលើ KLYX។",
    "sidebar.clientTagline": "សេវាប្រចាំថ្ងៃរបស់អ្នកទាំងអស់។",
    "sidebar.loadingProfile": "កំពុងផ្ទុកប្រវត្តិរូប...",
    "sidebar.providerAccount": "គណនីអ្នកផ្តល់សេវា",
    "sidebar.clientAccount": "គណនីអតិថិជន",
    "sidebar.searchPlaceholder": "ស្វែងរកក្នុង KLYX",
    "sidebar.noResults": "គ្មានលទ្ធផល។",
    "sidebar.adminCenter": "មជ្ឈមណ្ឌលគ្រប់គ្រង KLYX",
    "sidebar.loggingOut": "កំពុងចាកចេញ...",
    "sidebar.logout": "ចាកចេញ",
    "sidebar.openMenu": "បើកម៉ឺនុយ",
    "sidebar.closeMenu": "បិទម៉ឺនុយ"
  },
  lo: {
    skipToMain: "ໄປຫາເນື້ອຫາຫຼັກ",
    "sidebar.providerTagline": "ກິດຈະກຳວິຊາຊີບຂອງທ່ານໃນ KLYX.",
    "sidebar.clientTagline": "ບໍລິການປະຈຳວັນທັງໝົດຂອງທ່ານ.",
    "sidebar.loadingProfile": "ກຳລັງໂຫຼດໂປຣໄຟລ໌...",
    "sidebar.providerAccount": "ບັນຊີຜູ້ໃຫ້ບໍລິການ",
    "sidebar.clientAccount": "ບັນຊີລູກຄ້າ",
    "sidebar.searchPlaceholder": "ຄົ້ນຫາໃນ KLYX",
    "sidebar.noResults": "ບໍ່ມີຜົນລັບ.",
    "sidebar.adminCenter": "ສູນບໍລິຫານ KLYX",
    "sidebar.loggingOut": "ກຳລັງອອກ...",
    "sidebar.logout": "ອອກ",
    "sidebar.openMenu": "ເປີດເມນູ",
    "sidebar.closeMenu": "ປິດເມນູ"
  },
  mn: {
    skipToMain: "Үндсэн агуулга руу очих",
    "sidebar.providerTagline": "KLYX дээрх таны мэргэжлийн үйл ажиллагаа.",
    "sidebar.clientTagline": "Таны өдөр тутмын бүх үйлчилгээ.",
    "sidebar.loadingProfile": "Профайл ачаалж байна...",
    "sidebar.providerAccount": "Үйлчилгээ үзүүлэгчийн бүртгэл",
    "sidebar.clientAccount": "Үйлчлүүлэгчийн бүртгэл",
    "sidebar.searchPlaceholder": "KLYX-ээс хайх",
    "sidebar.noResults": "Илэрц алга.",
    "sidebar.adminCenter": "KLYX удирдлагын төв",
    "sidebar.loggingOut": "Гарч байна...",
    "sidebar.logout": "Гарах",
    "sidebar.openMenu": "Цэс нээх",
    "sidebar.closeMenu": "Цэс хаах"
  },
};

const KLYX_BATCH_10_NAVIGATION_KEYS = ["Centre KLYX", "Vue d’ensemble", "Assistant KLYX", "KLYX Agent", "Ma mémoire KLYX", "Trouver un service", "Couverture locale", "Recherche par photo", "Mes réservations", "Messages", "Favoris", "Mes demandes", "Mes devis", "Notifications", "Centre de confiance", "Mon profil", "Paramètres", "Tableau professionnel", "Mon activité", "Assistant professionnel", "Réservations & missions", "Missions disponibles", "Demandes de devis", "Planning intelligent", "Zones d'intervention", "Messagerie clients", "Ajouter un métier", "Mes compétences", "Paiements", "Vérification", "Vérification prestataire", "Score et avis", "Confiance professionnelle", "Profil public", "Centre Admin KLYX", "Compétences prestataires", "Vérifications prestataires", "Litiges", "Services KLYX", "Audit financier", "Principal", "IA", "Services", "Réservations", "Communication", "Compte", "Confiance", "Prestataire", "Finance", "Administration"] as const;

function buildNavigation(values: readonly string[]) {
  if (values.length !== KLYX_BATCH_10_NAVIGATION_KEYS.length) {
    throw new Error("KLYX i18n batch 10 navigation catalog is incomplete.");
  }
  return Object.fromEntries(KLYX_BATCH_10_NAVIGATION_KEYS.map((key, index) => [key, values[index]]));
}

export const KLYX_BATCH_10_NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  my: buildNavigation(["KLYX စင်တာ","ခြုံငုံသုံးသပ်ချက်","KLYX အကူ","KLYX ကိုယ်စားလှယ်","ကျွန်ုပ်၏ KLYX မှတ်ဉာဏ်","ဝန်ဆောင်မှုရှာရန်","ဒေသတွင်း လွှမ်းခြုံမှု","ဓာတ်ပုံဖြင့် ရှာရန်","ကျွန်ုပ်၏ ဘွတ်ကင်များ","စာတိုများ","အနှစ်သက်ဆုံးများ","ကျွန်ုပ်၏ တောင်းဆိုချက်များ","ကျွန်ုပ်၏ ကိုးကားဈေးများ","အသိပေးချက်များ","ယုံကြည်မှုစင်တာ","ကျွန်ုပ်၏ ပရိုဖိုင်","ဆက်တင်များ","ပရော်ဖက်ရှင်နယ် ဒက်ရှ်ဘုတ်","ကျွန်ုပ်၏ လှုပ်ရှားမှု","ပရော်ဖက်ရှင်နယ် အကူ","ဘွတ်ကင်များနှင့် အလုပ်များ","ရရှိနိုင်သော အလုပ်များ","ကိုးကားဈေး တောင်းဆိုချက်များ","စမတ် စီမံကိန်း","ဝန်ဆောင်မှု ဧရိယာများ","ဖောက်သည် စာတိုများ","အလုပ်အကိုင် ထည့်ရန်","ကျွန်ုပ်၏ ကျွမ်းကျင်မှုများ","ငွေပေးချေမှုများ","အတည်ပြုခြင်း","ဝန်ဆောင်မှုပေးသူ အတည်ပြုခြင်း","အမှတ်နှင့် သုံးသပ်ချက်များ","ပရော်ဖက်ရှင်နယ် ယုံကြည်မှု","အများမြင် ပရိုဖိုင်","KLYX စီမံခန့်ခွဲမှုစင်တာ","ဝန်ဆောင်မှုပေးသူ ကျွမ်းကျင်မှုများ","ဝန်ဆောင်မှုပေးသူ အတည်ပြုမှုများ","အငြင်းပွားမှုများ","KLYX ဝန်ဆောင်မှုများ","ဘဏ္ဍာရေး စာရင်းစစ်","အဓိက","AI","ဝန်ဆောင်မှုများ","ဘွတ်ကင်များ","ဆက်သွယ်ရေး","အကောင့်","ယုံကြည်မှု","ဝန်ဆောင်မှုပေးသူ","ဘဏ္ဍာရေး","စီမံခန့်ခွဲမှု"]),
  km: buildNavigation(["មជ្ឈមណ្ឌល KLYX","ទិដ្ឋភាពទូទៅ","ជំនួយការ KLYX","ភ្នាក់ងារ KLYX","អង្គចងចាំ KLYX របស់ខ្ញុំ","ស្វែងរកសេវា","ការគ្របដណ្តប់ក្នុងតំបន់","ស្វែងរកតាមរូបថត","ការកក់របស់ខ្ញុំ","សារ","ចំណូលចិត្ត","សំណើរបស់ខ្ញុំ","សម្រង់តម្លៃរបស់ខ្ញុំ","ការជូនដំណឹង","មជ្ឈមណ្ឌលទំនុកចិត្ត","ប្រវត្តិរូបរបស់ខ្ញុំ","ការកំណត់","ផ្ទាំងគ្រប់គ្រងវិជ្ជាជីវៈ","សកម្មភាពរបស់ខ្ញុំ","ជំនួយការវិជ្ជាជីវៈ","ការកក់ និងភារកិច្ច","ភារកិច្ចដែលមាន","សំណើសម្រង់តម្លៃ","ការធ្វើផែនការឆ្លាតវៃ","តំបន់សេវា","សារអតិថិជន","បន្ថែមមុខរបរ","ជំនាញរបស់ខ្ញុំ","ការទូទាត់","ការផ្ទៀងផ្ទាត់","ការផ្ទៀងផ្ទាត់អ្នកផ្តល់សេវា","ពិន្ទុ និងការវាយតម្លៃ","ទំនុកចិត្តវិជ្ជាជីវៈ","ប្រវត្តិរូបសាធារណៈ","មជ្ឈមណ្ឌលគ្រប់គ្រង KLYX","ជំនាញអ្នកផ្តល់សេវា","ការផ្ទៀងផ្ទាត់អ្នកផ្តល់សេវា","វិវាទ","សេវា KLYX","សវនកម្មហិរញ្ញវត្ថុ","ចម្បង","AI","សេវា","ការកក់","ទំនាក់ទំនង","គណនី","ទំនុកចិត្ត","អ្នកផ្តល់សេវា","ហិរញ្ញវត្ថុ","រដ្ឋបាល"]),
  lo: buildNavigation(["ສູນ KLYX","ພາບລວມ","ຜູ້ຊ່ວຍ KLYX","ຕົວແທນ KLYX","ຄວາມຈຳ KLYX ຂອງຂ້ອຍ","ຊອກຫາບໍລິການ","ການຄຸ້ມຄອງທ້ອງຖິ່ນ","ຄົ້ນຫາດ້ວຍຮູບ","ການຈອງຂອງຂ້ອຍ","ຂໍ້ຄວາມ","ລາຍການທີ່ມັກ","ຄຳຮ້ອງຂອງຂ້ອຍ","ລາຄາສະເໜີຂອງຂ້ອຍ","ແຈ້ງເຕືອນ","ສູນຄວາມໄວ້ວາງໃຈ","ໂປຣໄຟລ໌ຂອງຂ້ອຍ","ການຕັ້ງຄ່າ","ແດຊບອດວິຊາຊີບ","ກິດຈະກຳຂອງຂ້ອຍ","ຜູ້ຊ່ວຍວິຊາຊີບ","ການຈອງ ແລະ ວຽກ","ວຽກທີ່ມີ","ຄຳຮ້ອງລາຄາສະເໜີ","ການວາງແຜນອັດສະລິຍະ","ເຂດບໍລິການ","ຂໍ້ຄວາມລູກຄ້າ","ເພີ່ມອາຊີບ","ທັກສະຂອງຂ້ອຍ","ການຊຳລະ","ການຢືນຢັນ","ການຢືນຢັນຜູ້ໃຫ້ບໍລິການ","ຄະແນນ ແລະ ຄຳວິຈານ","ຄວາມໄວ້ວາງໃຈວິຊາຊີບ","ໂປຣໄຟລ໌ສາທາລະນະ","ສູນບໍລິຫານ KLYX","ທັກສະຜູ້ໃຫ້ບໍລິການ","ການຢືນຢັນຜູ້ໃຫ້ບໍລິການ","ຂໍ້ຂັດແຍ່ງ","ບໍລິການ KLYX","ການກວດສອບການເງິນ","ຫຼັກ","AI","ບໍລິການ","ການຈອງ","ການສື່ສານ","ບັນຊີ","ຄວາມໄວ້ວາງໃຈ","ຜູ້ໃຫ້ບໍລິການ","ການເງິນ","ການບໍລິຫານ"]),
  mn: buildNavigation(["KLYX төв","Тойм","KLYX туслах","KLYX агент","Миний KLYX санах ой","Үйлчилгээ хайх","Орон нутгийн хамрах хүрээ","Зургаар хайх","Миний захиалгууд","Зурвасууд","Дуртай","Миний хүсэлтүүд","Миний үнийн санал","Мэдэгдлүүд","Итгэлцлийн төв","Миний профайл","Тохиргоо","Мэргэжлийн хяналтын самбар","Миний үйл ажиллагаа","Мэргэжлийн туслах","Захиалга ба ажил","Боломжтой ажлууд","Үнийн саналын хүсэлтүүд","Ухаалаг төлөвлөлт","Үйлчилгээний бүсүүд","Үйлчлүүлэгчийн зурвасууд","Мэргэжил нэмэх","Миний ур чадвар","Төлбөрүүд","Баталгаажуулалт","Үйлчилгээ үзүүлэгчийн баталгаажуулалт","Оноо ба үнэлгээ","Мэргэжлийн итгэлцэл","Нийтийн профайл","KLYX удирдлагын төв","Үйлчилгээ үзүүлэгчийн ур чадвар","Үйлчилгээ үзүүлэгчийн баталгаажуулалтууд","Маргаан","KLYX үйлчилгээ","Санхүүгийн аудит","Үндсэн","AI","Үйлчилгээ","Захиалгууд","Харилцаа","Бүртгэл","Итгэлцэл","Үйлчилгээ үзүүлэгч","Санхүү","Удирдлага"]),
};
