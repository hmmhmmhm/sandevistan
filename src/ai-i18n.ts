import type { SupportedLocale } from "./i18n/locale-registry";
import { ADDITIONAL_AI_TRANSLATIONS } from "./i18n/additional-ai-translations";

type AiPhoneBaseStringKey =
  | "ai"
  | "openAiKey"
  | "byokKeys"
  | "dashboardMap"
  | "estimatedCost"
  | "thisWeek"
  | "thisMonth"
  | "recentConversations"
  | "noConversations"
  | "clearAiData"
  | "aiKeyRequired";

export type AiPhoneControlStrings = Readonly<{
  responseSpeed: string;
  millisecondsPerCharacter: string;
  unpricedUsage: string;
}>;

export type AiPhoneStringKey = AiPhoneBaseStringKey
  | keyof AiPhoneControlStrings;

type AiStrings = Readonly<Record<AiPhoneBaseStringKey, string>>;
const english: AiStrings = {
  ai: "Ask AI",
  openAiKey: "OpenAI API key",
  byokKeys: "BYOK Keys",
  dashboardMap: "Map on dashboard",
  estimatedCost: "Estimated AI cost",
  thisWeek: "This week",
  thisMonth: "This month",
  recentConversations: "Recent conversations",
  noConversations: "No conversations yet",
  clearAiData: "Clear AI history and usage",
  aiKeyRequired: "OpenAI key required",
};

const additionalPhoneTranslations = Object.fromEntries(
  Object.entries(ADDITIONAL_AI_TRANSLATIONS)
    .map(([locale, strings]) => [locale, strings.phone]),
) as Record<keyof typeof ADDITIONAL_AI_TRANSLATIONS, AiStrings>;

const localized: Partial<Record<SupportedLocale, Partial<AiStrings>>> = {
  ar: {
    ai: "اسأل الذكاء الاصطناعي", openAiKey: "مفتاح OpenAI API",
    estimatedCost: "تكلفة الوقت الفعلي المقدرة", thisWeek: "هذا الأسبوع",
    thisMonth: "هذا الشهر", recentConversations: "المحادثات الأخيرة",
    noConversations: "لا توجد محادثات بعد", clearAiData: "مسح سجل وبيانات الذكاء الاصطناعي",
    aiKeyRequired: "مفتاح OpenAI مطلوب",
  },
  bn: {
    ai: "AI-কে জিজ্ঞাসা করুন", openAiKey: "OpenAI API কী",
    estimatedCost: "আনুমানিক রিয়েলটাইম খরচ", thisWeek: "এই সপ্তাহ",
    thisMonth: "এই মাস", recentConversations: "সাম্প্রতিক কথোপকথন",
    noConversations: "এখনও কোনো কথোপকথন নেই", clearAiData: "AI ইতিহাস ও ব্যবহার মুছুন",
    aiKeyRequired: "OpenAI কী প্রয়োজন",
  },
  cs: { ai: "Zeptat se AI", openAiKey: "Klíč OpenAI API", estimatedCost: "Odhadované náklady Realtime", thisWeek: "Tento týden", thisMonth: "Tento měsíc", recentConversations: "Nedávné konverzace", noConversations: "Zatím žádné konverzace", clearAiData: "Vymazat historii a využití AI", aiKeyRequired: "Je vyžadován klíč OpenAI" },
  da: { ai: "Spørg AI", openAiKey: "OpenAI API-nøgle", estimatedCost: "Anslået Realtime-pris", thisWeek: "Denne uge", thisMonth: "Denne måned", recentConversations: "Seneste samtaler", noConversations: "Ingen samtaler endnu", clearAiData: "Ryd AI-historik og forbrug", aiKeyRequired: "OpenAI-nøgle påkrævet" },
  de: { ai: "AI fragen", openAiKey: "OpenAI-API-Schlüssel", estimatedCost: "Geschätzte Realtime-Kosten", thisWeek: "Diese Woche", thisMonth: "Dieser Monat", recentConversations: "Letzte Gespräche", noConversations: "Noch keine Gespräche", clearAiData: "AI-Verlauf und Nutzung löschen", aiKeyRequired: "OpenAI-Schlüssel erforderlich" },
  es: { ai: "Preguntar a la IA", openAiKey: "Clave de API de OpenAI", estimatedCost: "Coste Realtime estimado", thisWeek: "Esta semana", thisMonth: "Este mes", recentConversations: "Conversaciones recientes", noConversations: "Aún no hay conversaciones", clearAiData: "Borrar historial y uso de IA", aiKeyRequired: "Se requiere una clave de OpenAI" },
  fi: { ai: "Kysy tekoälyltä", openAiKey: "OpenAI API -avain", estimatedCost: "Arvioitu Realtime-hinta", thisWeek: "Tämä viikko", thisMonth: "Tämä kuukausi", recentConversations: "Viimeisimmät keskustelut", noConversations: "Ei keskusteluja vielä", clearAiData: "Tyhjennä AI-historia ja käyttö", aiKeyRequired: "OpenAI-avain vaaditaan" },
  fil: { ai: "Magtanong sa AI", openAiKey: "OpenAI API key", estimatedCost: "Tinatayang gastos sa Realtime", thisWeek: "Ngayong linggo", thisMonth: "Ngayong buwan", recentConversations: "Mga kamakailang usapan", noConversations: "Wala pang usapan", clearAiData: "Burahin ang history at paggamit ng AI", aiKeyRequired: "Kailangan ang OpenAI key" },
  fr: { ai: "Demander à l’IA", openAiKey: "Clé API OpenAI", estimatedCost: "Coût Realtime estimé", thisWeek: "Cette semaine", thisMonth: "Ce mois-ci", recentConversations: "Conversations récentes", noConversations: "Aucune conversation", clearAiData: "Effacer l’historique et l’utilisation IA", aiKeyRequired: "Clé OpenAI requise" },
  he: { ai: "שאל את ה-AI", openAiKey: "מפתח OpenAI API", estimatedCost: "עלות Realtime משוערת", thisWeek: "השבוע", thisMonth: "החודש", recentConversations: "שיחות אחרונות", noConversations: "אין עדיין שיחות", clearAiData: "ניקוי היסטוריה ושימוש ב-AI", aiKeyRequired: "נדרש מפתח OpenAI" },
  hi: { ai: "AI से पूछें", openAiKey: "OpenAI API कुंजी", estimatedCost: "अनुमानित Realtime लागत", thisWeek: "इस सप्ताह", thisMonth: "इस महीने", recentConversations: "हाल की बातचीत", noConversations: "अभी कोई बातचीत नहीं", clearAiData: "AI इतिहास और उपयोग मिटाएँ", aiKeyRequired: "OpenAI कुंजी आवश्यक है" },
  id: { ai: "Tanya AI", openAiKey: "Kunci API OpenAI", estimatedCost: "Perkiraan biaya Realtime", thisWeek: "Minggu ini", thisMonth: "Bulan ini", recentConversations: "Percakapan terbaru", noConversations: "Belum ada percakapan", clearAiData: "Hapus riwayat dan penggunaan AI", aiKeyRequired: "Kunci OpenAI diperlukan" },
  it: { ai: "Chiedi all’AI", openAiKey: "Chiave API OpenAI", estimatedCost: "Costo Realtime stimato", thisWeek: "Questa settimana", thisMonth: "Questo mese", recentConversations: "Conversazioni recenti", noConversations: "Nessuna conversazione", clearAiData: "Cancella cronologia e utilizzo AI", aiKeyRequired: "Chiave OpenAI richiesta" },
  ja: { ai: "AIに質問", openAiKey: "OpenAI APIキー", estimatedCost: "推定Realtime料金", thisWeek: "今週", thisMonth: "今月", recentConversations: "最近の会話", noConversations: "会話はまだありません", clearAiData: "AI履歴と使用量を消去", aiKeyRequired: "OpenAIキーが必要です" },
  ko: { ai: "AI에게 묻기", openAiKey: "OpenAI API 키", byokKeys: "BYOK 키", dashboardMap: "대시보드 지도", estimatedCost: "예상 Realtime 비용", thisWeek: "이번 주", thisMonth: "이번 달", recentConversations: "최근 대화", noConversations: "아직 대화가 없습니다", clearAiData: "AI 기록 및 사용량 지우기", aiKeyRequired: "OpenAI 키 필요" },
  ms: { ai: "Tanya AI", openAiKey: "Kunci API OpenAI", estimatedCost: "Anggaran kos Realtime", thisWeek: "Minggu ini", thisMonth: "Bulan ini", recentConversations: "Perbualan terkini", noConversations: "Belum ada perbualan", clearAiData: "Kosongkan sejarah dan penggunaan AI", aiKeyRequired: "Kunci OpenAI diperlukan" },
  nl: { ai: "Vraag AI", openAiKey: "OpenAI API-sleutel", estimatedCost: "Geschatte Realtime-kosten", thisWeek: "Deze week", thisMonth: "Deze maand", recentConversations: "Recente gesprekken", noConversations: "Nog geen gesprekken", clearAiData: "AI-geschiedenis en gebruik wissen", aiKeyRequired: "OpenAI-sleutel vereist" },
  no: { ai: "Spør AI", openAiKey: "OpenAI API-nøkkel", estimatedCost: "Anslått Realtime-kostnad", thisWeek: "Denne uken", thisMonth: "Denne måneden", recentConversations: "Nylige samtaler", noConversations: "Ingen samtaler ennå", clearAiData: "Tøm AI-historikk og bruk", aiKeyRequired: "OpenAI-nøkkel kreves" },
  pl: { ai: "Zapytaj AI", openAiKey: "Klucz API OpenAI", estimatedCost: "Szacowany koszt Realtime", thisWeek: "Ten tydzień", thisMonth: "Ten miesiąc", recentConversations: "Ostatnie rozmowy", noConversations: "Brak rozmów", clearAiData: "Wyczyść historię i użycie AI", aiKeyRequired: "Wymagany klucz OpenAI" },
  pt: { ai: "Perguntar à IA", openAiKey: "Chave da API OpenAI", estimatedCost: "Custo Realtime estimado", thisWeek: "Esta semana", thisMonth: "Este mês", recentConversations: "Conversas recentes", noConversations: "Ainda sem conversas", clearAiData: "Limpar histórico e uso de IA", aiKeyRequired: "Chave OpenAI necessária" },
  ro: { ai: "Întreabă AI", openAiKey: "Cheie API OpenAI", estimatedCost: "Cost Realtime estimat", thisWeek: "Săptămâna aceasta", thisMonth: "Luna aceasta", recentConversations: "Conversații recente", noConversations: "Nicio conversație", clearAiData: "Șterge istoricul și utilizarea AI", aiKeyRequired: "Este necesară cheia OpenAI" },
  ru: { ai: "Спросить ИИ", openAiKey: "Ключ OpenAI API", estimatedCost: "Расчётная стоимость Realtime", thisWeek: "На этой неделе", thisMonth: "В этом месяце", recentConversations: "Недавние разговоры", noConversations: "Разговоров пока нет", clearAiData: "Очистить историю и расход ИИ", aiKeyRequired: "Требуется ключ OpenAI" },
  sv: { ai: "Fråga AI", openAiKey: "OpenAI API-nyckel", estimatedCost: "Uppskattad Realtime-kostnad", thisWeek: "Denna vecka", thisMonth: "Denna månad", recentConversations: "Senaste samtal", noConversations: "Inga samtal ännu", clearAiData: "Rensa AI-historik och användning", aiKeyRequired: "OpenAI-nyckel krävs" },
  th: { ai: "ถาม AI", openAiKey: "คีย์ OpenAI API", estimatedCost: "ค่า Realtime โดยประมาณ", thisWeek: "สัปดาห์นี้", thisMonth: "เดือนนี้", recentConversations: "การสนทนาล่าสุด", noConversations: "ยังไม่มีการสนทนา", clearAiData: "ล้างประวัติและการใช้ AI", aiKeyRequired: "ต้องใช้คีย์ OpenAI" },
  tr: { ai: "AI'ya sor", openAiKey: "OpenAI API anahtarı", estimatedCost: "Tahmini Realtime maliyeti", thisWeek: "Bu hafta", thisMonth: "Bu ay", recentConversations: "Son konuşmalar", noConversations: "Henüz konuşma yok", clearAiData: "AI geçmişini ve kullanımı temizle", aiKeyRequired: "OpenAI anahtarı gerekli" },
  uk: { ai: "Запитати ШІ", openAiKey: "Ключ OpenAI API", estimatedCost: "Орієнтовна вартість Realtime", thisWeek: "Цього тижня", thisMonth: "Цього місяця", recentConversations: "Останні розмови", noConversations: "Розмов ще немає", clearAiData: "Очистити історію та використання ШІ", aiKeyRequired: "Потрібен ключ OpenAI" },
  vi: { ai: "Hỏi AI", openAiKey: "Khóa API OpenAI", estimatedCost: "Chi phí Realtime ước tính", thisWeek: "Tuần này", thisMonth: "Tháng này", recentConversations: "Cuộc trò chuyện gần đây", noConversations: "Chưa có cuộc trò chuyện", clearAiData: "Xóa lịch sử và mức dùng AI", aiKeyRequired: "Cần khóa OpenAI" },
  "zh-Hans": { ai: "询问 AI", openAiKey: "OpenAI API 密钥", estimatedCost: "预计 Realtime 费用", thisWeek: "本周", thisMonth: "本月", recentConversations: "最近对话", noConversations: "暂无对话", clearAiData: "清除 AI 历史和用量", aiKeyRequired: "需要 OpenAI 密钥" },
  "zh-Hant": { ai: "詢問 AI", openAiKey: "OpenAI API 金鑰", estimatedCost: "預估 Realtime 費用", thisWeek: "本週", thisMonth: "本月", recentConversations: "最近對話", noConversations: "尚無對話", clearAiData: "清除 AI 歷史與用量", aiKeyRequired: "需要 OpenAI 金鑰" },
  ...additionalPhoneTranslations,
};

const additionalControlTranslations = Object.fromEntries(
  Object.entries(ADDITIONAL_AI_TRANSLATIONS)
    .map(([locale, strings]) => [locale, strings.control]),
) as Record<keyof typeof ADDITIONAL_AI_TRANSLATIONS, AiPhoneControlStrings>;

export const AI_PHONE_CONTROL_TRANSLATIONS = {
  en: { responseSpeed: "Response display speed", millisecondsPerCharacter: "ms per character", unpricedUsage: "Some usage could not be priced." },
  ko: { responseSpeed: "답변 표시 속도", millisecondsPerCharacter: "ms / 글자", unpricedUsage: "가격을 계산할 수 없는 사용량이 있습니다." },
  ja: { responseSpeed: "回答の表示速度", millisecondsPerCharacter: "ミリ秒 / 文字", unpricedUsage: "料金を計算できない利用があります。" },
  "zh-Hans": { responseSpeed: "回答显示速度", millisecondsPerCharacter: "毫秒/字", unpricedUsage: "部分用量无法估价。" },
  "zh-Hant": { responseSpeed: "回答顯示速度", millisecondsPerCharacter: "毫秒/字", unpricedUsage: "部分用量無法估價。" },
  es: { responseSpeed: "Velocidad de visualización", millisecondsPerCharacter: "ms por carácter", unpricedUsage: "No se pudo calcular parte del uso." },
  fr: { responseSpeed: "Vitesse d’affichage", millisecondsPerCharacter: "ms par caractère", unpricedUsage: "Une partie de l’utilisation n’a pas pu être tarifée." },
  de: { responseSpeed: "Anzeigegeschwindigkeit", millisecondsPerCharacter: "ms pro Zeichen", unpricedUsage: "Ein Teil der Nutzung konnte nicht bepreist werden." },
  it: { responseSpeed: "Velocità di visualizzazione", millisecondsPerCharacter: "ms per carattere", unpricedUsage: "Non è stato possibile calcolare parte dell’utilizzo." },
  pt: { responseSpeed: "Velocidade de exibição", millisecondsPerCharacter: "ms por caractere", unpricedUsage: "Não foi possível calcular parte do uso." },
  nl: { responseSpeed: "Weergavesnelheid", millisecondsPerCharacter: "ms per teken", unpricedUsage: "Een deel van het gebruik kon niet worden geprijsd." },
  pl: { responseSpeed: "Szybkość wyświetlania", millisecondsPerCharacter: "ms na znak", unpricedUsage: "Nie udało się wycenić części użycia." },
  ru: { responseSpeed: "Скорость показа ответа", millisecondsPerCharacter: "мс на символ", unpricedUsage: "Часть использования не удалось оценить." },
  uk: { responseSpeed: "Швидкість показу відповіді", millisecondsPerCharacter: "мс на символ", unpricedUsage: "Частину використання не вдалося оцінити." },
  tr: { responseSpeed: "Yanıt gösterim hızı", millisecondsPerCharacter: "karakter başına ms", unpricedUsage: "Bazı kullanımlar fiyatlandırılamadı." },
  ar: { responseSpeed: "سرعة عرض الرد", millisecondsPerCharacter: "مللي ثانية لكل حرف", unpricedUsage: "تعذر تسعير بعض الاستخدام." },
  he: { responseSpeed: "מהירות הצגת התשובה", millisecondsPerCharacter: "מ״ש לתו", unpricedUsage: "לא ניתן היה לתמחר חלק מהשימוש." },
  hi: { responseSpeed: "उत्तर दिखाने की गति", millisecondsPerCharacter: "मि.से. प्रति अक्षर", unpricedUsage: "कुछ उपयोग की कीमत नहीं निकाली जा सकी।" },
  bn: { responseSpeed: "উত্তর দেখানোর গতি", millisecondsPerCharacter: "মিলিসেকেন্ড প্রতি অক্ষর", unpricedUsage: "কিছু ব্যবহারের মূল্য নির্ধারণ করা যায়নি।" },
  id: { responseSpeed: "Kecepatan tampilan jawaban", millisecondsPerCharacter: "md per karakter", unpricedUsage: "Sebagian penggunaan tidak dapat dihitung biayanya." },
  vi: { responseSpeed: "Tốc độ hiển thị câu trả lời", millisecondsPerCharacter: "ms mỗi ký tự", unpricedUsage: "Không thể tính giá một phần mức dùng." },
  th: { responseSpeed: "ความเร็วการแสดงคำตอบ", millisecondsPerCharacter: "มิลลิวินาทีต่อตัวอักษร", unpricedUsage: "ไม่สามารถคำนวณราคาการใช้งานบางส่วนได้" },
  ms: { responseSpeed: "Kelajuan paparan jawapan", millisecondsPerCharacter: "ms setiap aksara", unpricedUsage: "Sebahagian penggunaan tidak dapat ditentukan harganya." },
  fil: { responseSpeed: "Bilis ng pagpapakita ng sagot", millisecondsPerCharacter: "ms bawat character", unpricedUsage: "Hindi nakuwenta ang presyo ng ilang paggamit." },
  sv: { responseSpeed: "Svarens visningshastighet", millisecondsPerCharacter: "ms per tecken", unpricedUsage: "En del användning kunde inte prissättas." },
  no: { responseSpeed: "Visningshastighet for svar", millisecondsPerCharacter: "ms per tegn", unpricedUsage: "Noe bruk kunne ikke prises." },
  da: { responseSpeed: "Svarvisningshastighed", millisecondsPerCharacter: "ms pr. tegn", unpricedUsage: "Noget brug kunne ikke prissættes." },
  fi: { responseSpeed: "Vastauksen näyttönopeus", millisecondsPerCharacter: "ms merkkiä kohti", unpricedUsage: "Osaa käytöstä ei voitu hinnoitella." },
  cs: { responseSpeed: "Rychlost zobrazení odpovědi", millisecondsPerCharacter: "ms na znak", unpricedUsage: "Část využití nebylo možné ocenit." },
  ro: { responseSpeed: "Viteza de afișare a răspunsului", millisecondsPerCharacter: "ms per caracter", unpricedUsage: "O parte din utilizare nu a putut fi evaluată." },
  ...additionalControlTranslations,
} as const satisfies Readonly<Record<SupportedLocale, AiPhoneControlStrings>>;

export function translateAiPhone(
  locale: SupportedLocale,
  key: AiPhoneStringKey,
): string {
  if (key in AI_PHONE_CONTROL_TRANSLATIONS[locale]) {
    return AI_PHONE_CONTROL_TRANSLATIONS[locale][
      key as keyof AiPhoneControlStrings
    ];
  }
  const baseKey = key as keyof AiStrings;
  return localized[locale]?.[baseKey] ?? english[baseKey];
}
