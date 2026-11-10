import { translatePhone } from "./phone-i18n";
import { releaseTranslation } from "./release-i18n";
import type { SupportedLocale } from "./i18n/locale-registry";
import type { AiHudSnapshot } from "./ai-hud-state";
import { ADDITIONAL_AI_TRANSLATIONS } from "./i18n/additional-ai-translations";

export type AiHudStrings = Readonly<{
  you: string;
  assistant: string;
  ready: string;
  connecting: string;
  listening: string;
  thinking: string;
  displaying: string;
  error: string;
  live: string;
  history: string;
  listeningPrompt: string;
  scrollTranscript: string;
  doubleTapBack: string;
}>;

export type AiHudActivityStrings = Readonly<{
  toolTime: string;
  toolLocation: string;
  toolWebSearch: string;
  toolMcp: string;
  toolGeneric: string;
  tapReveal: string;
}>;

export type AiHudStringKey = keyof AiHudStrings | keyof AiHudActivityStrings;

const additionalHudTranslations = Object.fromEntries(
  Object.entries(ADDITIONAL_AI_TRANSLATIONS)
    .map(([locale, strings]) => [locale, strings.hud]),
) as Record<keyof typeof ADDITIONAL_AI_TRANSLATIONS, AiHudStrings>;

const additionalActivityTranslations = Object.fromEntries(
  Object.entries(ADDITIONAL_AI_TRANSLATIONS)
    .map(([locale, strings]) => [locale, strings.activity]),
) as Record<keyof typeof ADDITIONAL_AI_TRANSLATIONS, AiHudActivityStrings>;

export const AI_HUD_TRANSLATIONS = {
  en: { you: "YOU", assistant: "AI", ready: "READY", connecting: "CONNECTING…", listening: "LISTENING…", thinking: "THINKING…", displaying: "DISPLAYING RESPONSE…", error: "ERROR", live: "LIVE", history: "HISTORY", listeningPrompt: "Listening… Speak naturally.", scrollTranscript: "SCROLL // TRANSCRIPT", doubleTapBack: "DOUBLE TAP // BACK" },
  ko: { you: "사용자", assistant: "AI", ready: "준비됨", connecting: "연결 중…", listening: "듣는 중…", thinking: "생각하는 중…", displaying: "답변 표시 중…", error: "오류", live: "실시간", history: "대화 기록", listeningPrompt: "듣고 있습니다… 자연스럽게 말씀하세요.", scrollTranscript: "스크롤 // 대화 기록", doubleTapBack: "두 번 탭 // 뒤로" },
  ja: { you: "あなた", assistant: "AI", ready: "準備完了", connecting: "接続中…", listening: "聞いています…", thinking: "考えています…", displaying: "回答を表示中…", error: "エラー", live: "ライブ", history: "履歴", listeningPrompt: "聞いています… 自然に話してください。", scrollTranscript: "スクロール // 会話履歴", doubleTapBack: "ダブルタップ // 戻る" },
  "zh-Hans": { you: "你", assistant: "AI", ready: "已就绪", connecting: "正在连接…", listening: "正在聆听…", thinking: "正在思考…", displaying: "正在显示回答…", error: "错误", live: "实时", history: "历史", listeningPrompt: "正在聆听… 请自然说话。", scrollTranscript: "滚动 // 对话记录", doubleTapBack: "双击 // 返回" },
  "zh-Hant": { you: "你", assistant: "AI", ready: "已就緒", connecting: "正在連線…", listening: "正在聆聽…", thinking: "正在思考…", displaying: "正在顯示回答…", error: "錯誤", live: "即時", history: "記錄", listeningPrompt: "正在聆聽… 請自然說話。", scrollTranscript: "捲動 // 對話記錄", doubleTapBack: "點兩下 // 返回" },
  es: { you: "TÚ", assistant: "IA", ready: "LISTO", connecting: "CONECTANDO…", listening: "ESCUCHANDO…", thinking: "PENSANDO…", displaying: "MOSTRANDO RESPUESTA…", error: "ERROR", live: "EN VIVO", history: "HISTORIAL", listeningPrompt: "Escuchando… Habla con naturalidad.", scrollTranscript: "DESLIZA // CONVERSACIÓN", doubleTapBack: "DOBLE TOQUE // VOLVER" },
  fr: { you: "VOUS", assistant: "IA", ready: "PRÊT", connecting: "CONNEXION…", listening: "ÉCOUTE…", thinking: "RÉFLEXION…", displaying: "AFFICHAGE DE LA RÉPONSE…", error: "ERREUR", live: "DIRECT", history: "HISTORIQUE", listeningPrompt: "J’écoute… Parlez naturellement.", scrollTranscript: "DÉFILER // CONVERSATION", doubleTapBack: "DOUBLE TAP // RETOUR" },
  de: { you: "DU", assistant: "KI", ready: "BEREIT", connecting: "VERBINDEN…", listening: "HÖRT ZU…", thinking: "DENKT NACH…", displaying: "ANTWORT WIRD ANGEZEIGT…", error: "FEHLER", live: "LIVE", history: "VERLAUF", listeningPrompt: "Ich höre zu… Sprich ganz natürlich.", scrollTranscript: "SCROLLEN // GESPRÄCH", doubleTapBack: "DOPPELTIPP // ZURÜCK" },
  it: { you: "TU", assistant: "IA", ready: "PRONTO", connecting: "CONNESSIONE…", listening: "IN ASCOLTO…", thinking: "ELABORAZIONE…", displaying: "RISPOSTA IN CORSO…", error: "ERRORE", live: "DAL VIVO", history: "CRONOLOGIA", listeningPrompt: "Ti ascolto… Parla naturalmente.", scrollTranscript: "SCORRI // CONVERSAZIONE", doubleTapBack: "DOPPIO TOCCO // INDIETRO" },
  pt: { you: "VOCÊ", assistant: "IA", ready: "PRONTO", connecting: "CONECTANDO…", listening: "OUVINDO…", thinking: "PENSANDO…", displaying: "EXIBINDO RESPOSTA…", error: "ERRO", live: "AO VIVO", history: "HISTÓRICO", listeningPrompt: "Ouvindo… Fale naturalmente.", scrollTranscript: "ROLAR // CONVERSA", doubleTapBack: "TOQUE DUPLO // VOLTAR" },
  nl: { you: "JIJ", assistant: "AI", ready: "GEREED", connecting: "VERBINDEN…", listening: "LUISTERT…", thinking: "DENKT NA…", displaying: "ANTWOORD WEERGEVEN…", error: "FOUT", live: "LIVE", history: "GESCHIEDENIS", listeningPrompt: "Ik luister… Spreek op natuurlijke wijze.", scrollTranscript: "SCROLL // GESPREK", doubleTapBack: "DUBBELTIK // TERUG" },
  pl: { you: "TY", assistant: "AI", ready: "GOTOWE", connecting: "ŁĄCZENIE…", listening: "SŁUCHAM…", thinking: "MYŚLĘ…", displaying: "WYŚWIETLANIE ODPOWIEDZI…", error: "BŁĄD", live: "NA ŻYWO", history: "HISTORIA", listeningPrompt: "Słucham… Mów naturalnie.", scrollTranscript: "PRZEWIŃ // ROZMOWA", doubleTapBack: "PODWÓJNE DOTKNIĘCIE // WSTECZ" },
  ru: { you: "ВЫ", assistant: "ИИ", ready: "ГОТОВО", connecting: "ПОДКЛЮЧЕНИЕ…", listening: "СЛУШАЮ…", thinking: "ДУМАЮ…", displaying: "ПОКАЗ ОТВЕТА…", error: "ОШИБКА", live: "СЕЙЧАС", history: "ИСТОРИЯ", listeningPrompt: "Слушаю… Говорите естественно.", scrollTranscript: "ПРОКРУТКА // ДИАЛОГ", doubleTapBack: "ДВОЙНОЕ КАСАНИЕ // НАЗАД" },
  uk: { you: "ВИ", assistant: "ШІ", ready: "ГОТОВО", connecting: "ПІДКЛЮЧЕННЯ…", listening: "СЛУХАЮ…", thinking: "ДУМАЮ…", displaying: "ПОКАЗ ВІДПОВІДІ…", error: "ПОМИЛКА", live: "НАЖИВО", history: "ІСТОРІЯ", listeningPrompt: "Слухаю… Говоріть природно.", scrollTranscript: "ПРОКРУТКА // РОЗМОВА", doubleTapBack: "ПОДВІЙНИЙ ДОТИК // НАЗАД" },
  tr: { you: "SEN", assistant: "AI", ready: "HAZIR", connecting: "BAĞLANIYOR…", listening: "DİNLİYOR…", thinking: "DÜŞÜNÜYOR…", displaying: "YANIT GÖSTERİLİYOR…", error: "HATA", live: "CANLI", history: "GEÇMİŞ", listeningPrompt: "Dinliyorum… Doğal biçimde konuşun.", scrollTranscript: "KAYDIR // KONUŞMA", doubleTapBack: "ÇİFT DOKUN // GERİ" },
  ar: { you: "أنت", assistant: "الذكاء", ready: "جاهز", connecting: "جارٍ الاتصال…", listening: "أستمع…", thinking: "أفكر…", displaying: "جارٍ عرض الرد…", error: "خطأ", live: "مباشر", history: "السجل", listeningPrompt: "أستمع… تحدث بصورة طبيعية.", scrollTranscript: "مرّر // المحادثة", doubleTapBack: "نقرتان // رجوع" },
  he: { you: "אתה", assistant: "AI", ready: "מוכן", connecting: "מתחבר…", listening: "מקשיב…", thinking: "חושב…", displaying: "מציג תשובה…", error: "שגיאה", live: "חי", history: "היסטוריה", listeningPrompt: "מקשיב… דברו בטבעיות.", scrollTranscript: "גלילה // שיחה", doubleTapBack: "הקשה כפולה // חזרה" },
  hi: { you: "आप", assistant: "AI", ready: "तैयार", connecting: "कनेक्ट हो रहा है…", listening: "सुन रहा है…", thinking: "सोच रहा है…", displaying: "उत्तर दिख रहा है…", error: "त्रुटि", live: "लाइव", history: "इतिहास", listeningPrompt: "सुन रहा हूँ… स्वाभाविक रूप से बोलें।", scrollTranscript: "स्क्रॉल // बातचीत", doubleTapBack: "दो बार टैप // वापस" },
  bn: { you: "আপনি", assistant: "AI", ready: "প্রস্তুত", connecting: "সংযোগ হচ্ছে…", listening: "শুনছি…", thinking: "ভাবছি…", displaying: "উত্তর দেখানো হচ্ছে…", error: "ত্রুটি", live: "লাইভ", history: "ইতিহাস", listeningPrompt: "শুনছি… স্বাভাবিকভাবে বলুন।", scrollTranscript: "স্ক্রল // কথোপকথন", doubleTapBack: "দুইবার ট্যাপ // ফিরে যান" },
  id: { you: "ANDA", assistant: "AI", ready: "SIAP", connecting: "MENGHUBUNGKAN…", listening: "MENDENGARKAN…", thinking: "BERPIKIR…", displaying: "MENAMPILKAN JAWABAN…", error: "GALAT", live: "LANGSUNG", history: "RIWAYAT", listeningPrompt: "Mendengarkan… Bicaralah dengan alami.", scrollTranscript: "GULIR // PERCAKAPAN", doubleTapBack: "KETUK DUA KALI // KEMBALI" },
  vi: { you: "BẠN", assistant: "AI", ready: "SẴN SÀNG", connecting: "ĐANG KẾT NỐI…", listening: "ĐANG NGHE…", thinking: "ĐANG SUY NGHĨ…", displaying: "ĐANG HIỂN THỊ TRẢ LỜI…", error: "LỖI", live: "TRỰC TIẾP", history: "LỊCH SỬ", listeningPrompt: "Đang nghe… Hãy nói tự nhiên.", scrollTranscript: "CUỘN // HỘI THOẠI", doubleTapBack: "CHẠM ĐÔI // QUAY LẠI" },
  th: { you: "คุณ", assistant: "AI", ready: "พร้อม", connecting: "กำลังเชื่อมต่อ…", listening: "กำลังฟัง…", thinking: "กำลังคิด…", displaying: "กำลังแสดงคำตอบ…", error: "ข้อผิดพลาด", live: "สด", history: "ประวัติ", listeningPrompt: "กำลังฟัง… พูดได้อย่างเป็นธรรมชาติ", scrollTranscript: "เลื่อน // บทสนทนา", doubleTapBack: "แตะสองครั้ง // กลับ" },
  ms: { you: "ANDA", assistant: "AI", ready: "SEDIA", connecting: "MENYAMBUNG…", listening: "MENDENGAR…", thinking: "BERFIKIR…", displaying: "MEMAPARKAN JAWAPAN…", error: "RALAT", live: "LANGSUNG", history: "SEJARAH", listeningPrompt: "Sedang mendengar… Bercakap secara semula jadi.", scrollTranscript: "TATAL // PERBUALAN", doubleTapBack: "KETIK DUA KALI // KEMBALI" },
  fil: { you: "IKAW", assistant: "AI", ready: "HANDA", connecting: "KUMOKONEKTA…", listening: "NAKIKINIG…", thinking: "NAG-IISIP…", displaying: "IPINAPAKITA ANG SAGOT…", error: "ERROR", live: "LIVE", history: "KASAYSAYAN", listeningPrompt: "Nakikinig… Magsalita nang natural.", scrollTranscript: "MAG-SCROLL // USAPAN", doubleTapBack: "DOBLENG TAP // BUMALIK" },
  sv: { you: "DU", assistant: "AI", ready: "REDO", connecting: "ANSLUTER…", listening: "LYSSNAR…", thinking: "TÄNKER…", displaying: "VISAR SVAR…", error: "FEL", live: "LIVE", history: "HISTORIK", listeningPrompt: "Jag lyssnar… Tala naturligt.", scrollTranscript: "RULLA // SAMTAL", doubleTapBack: "DUBBELTRYCK // TILLBAKA" },
  no: { you: "DU", assistant: "AI", ready: "KLAR", connecting: "KOBLER TIL…", listening: "LYTTER…", thinking: "TENKER…", displaying: "VISER SVAR…", error: "FEIL", live: "DIREKTE", history: "HISTORIKK", listeningPrompt: "Jeg lytter… Snakk naturlig.", scrollTranscript: "RULL // SAMTALE", doubleTapBack: "DOBBELTRYKK // TILBAKE" },
  da: { you: "DIG", assistant: "AI", ready: "KLAR", connecting: "FORBINDER…", listening: "LYTTER…", thinking: "TÆNKER…", displaying: "VISER SVAR…", error: "FEJL", live: "LIVE", history: "HISTORIK", listeningPrompt: "Jeg lytter… Tal naturligt.", scrollTranscript: "RUL // SAMTALE", doubleTapBack: "DOBBELTTRYK // TILBAGE" },
  fi: { you: "SINÄ", assistant: "AI", ready: "VALMIS", connecting: "YHDISTETÄÄN…", listening: "KUUNTELEE…", thinking: "AJATTELEE…", displaying: "NÄYTTÄÄ VASTAUSTA…", error: "VIRHE", live: "LIVE", history: "HISTORIA", listeningPrompt: "Kuuntelen… Puhu luonnollisesti.", scrollTranscript: "VIERITÄ // KESKUSTELU", doubleTapBack: "KAKSOISNAPAUTUS // TAKAISIN" },
  cs: { you: "VY", assistant: "AI", ready: "PŘIPRAVENO", connecting: "PŘIPOJOVÁNÍ…", listening: "POSLOUCHÁM…", thinking: "PŘEMÝŠLÍM…", displaying: "ZOBRAZUJI ODPOVĚĎ…", error: "CHYBA", live: "ŽIVĚ", history: "HISTORIE", listeningPrompt: "Poslouchám… Mluvte přirozeně.", scrollTranscript: "POSUN // KONVERZACE", doubleTapBack: "DVOJITÉ KLEPNUTÍ // ZPĚT" },
  ro: { you: "TU", assistant: "AI", ready: "PREGĂTIT", connecting: "CONECTARE…", listening: "ASCULT…", thinking: "GÂNDESC…", displaying: "AFIȘEZ RĂSPUNSUL…", error: "EROARE", live: "LIVE", history: "ISTORIC", listeningPrompt: "Ascult… Vorbiți natural.", scrollTranscript: "DERULARE // CONVERSAȚIE", doubleTapBack: "ATINGERE DUBLĂ // ÎNAPOI" },
  ...additionalHudTranslations,
} as const satisfies Readonly<Record<SupportedLocale, AiHudStrings>>;

export const AI_HUD_ACTIVITY_TRANSLATIONS = {
  en: { toolTime: "CHECKING TIME…", toolLocation: "CHECKING LOCATION…", toolWebSearch: "SEARCHING WEB…", toolMcp: "USING MCP", toolGeneric: "USING TOOL…", tapReveal: "TAP TO REVEAL FULL ANSWER" },
  ko: { toolTime: "현재 시간 확인 중…", toolLocation: "현재 위치 확인 중…", toolWebSearch: "웹 검색 중…", toolMcp: "MCP 사용 중", toolGeneric: "도구 사용 중…", tapReveal: "탭하여 전체 답변 바로 보기" },
  ja: { toolTime: "時刻を確認中…", toolLocation: "現在地を確認中…", toolWebSearch: "ウェブを検索中…", toolMcp: "MCPを使用中", toolGeneric: "ツールを使用中…", tapReveal: "タップして回答をすべて表示" },
  "zh-Hans": { toolTime: "正在查询时间…", toolLocation: "正在查询位置…", toolWebSearch: "正在搜索网页…", toolMcp: "正在使用 MCP", toolGeneric: "正在使用工具…", tapReveal: "点击立即显示完整回答" },
  "zh-Hant": { toolTime: "正在查詢時間…", toolLocation: "正在查詢位置…", toolWebSearch: "正在搜尋網頁…", toolMcp: "正在使用 MCP", toolGeneric: "正在使用工具…", tapReveal: "點一下立即顯示完整回答" },
  es: { toolTime: "CONSULTANDO HORA…", toolLocation: "CONSULTANDO UBICACIÓN…", toolWebSearch: "BUSCANDO EN LA WEB…", toolMcp: "USANDO MCP", toolGeneric: "USANDO HERRAMIENTA…", tapReveal: "TOCA PARA VER LA RESPUESTA COMPLETA" },
  fr: { toolTime: "VÉRIFICATION DE L’HEURE…", toolLocation: "VÉRIFICATION DU LIEU…", toolWebSearch: "RECHERCHE SUR LE WEB…", toolMcp: "UTILISATION DE MCP", toolGeneric: "UTILISATION D’UN OUTIL…", tapReveal: "TOUCHEZ POUR AFFICHER TOUTE LA RÉPONSE" },
  de: { toolTime: "UHRZEIT WIRD GEPRÜFT…", toolLocation: "STANDORT WIRD GEPRÜFT…", toolWebSearch: "WEB-SUCHE…", toolMcp: "MCP WIRD VERWENDET", toolGeneric: "TOOL WIRD VERWENDET…", tapReveal: "TIPPEN FÜR DIE VOLLSTÄNDIGE ANTWORT" },
  it: { toolTime: "CONTROLLO DELL’ORA…", toolLocation: "CONTROLLO POSIZIONE…", toolWebSearch: "RICERCA SUL WEB…", toolMcp: "UTILIZZO DI MCP", toolGeneric: "UTILIZZO STRUMENTO…", tapReveal: "TOCCA PER MOSTRARE LA RISPOSTA COMPLETA" },
  pt: { toolTime: "VERIFICANDO A HORA…", toolLocation: "VERIFICANDO LOCALIZAÇÃO…", toolWebSearch: "PESQUISANDO NA WEB…", toolMcp: "USANDO MCP", toolGeneric: "USANDO FERRAMENTA…", tapReveal: "TOQUE PARA EXIBIR A RESPOSTA COMPLETA" },
  nl: { toolTime: "TIJD CONTROLEREN…", toolLocation: "LOCATIE CONTROLEREN…", toolWebSearch: "ZOEKEN OP HET WEB…", toolMcp: "MCP GEBRUIKEN", toolGeneric: "HULPMIDDEL GEBRUIKEN…", tapReveal: "TIK OM HET VOLLEDIGE ANTWOORD TE TONEN" },
  pl: { toolTime: "SPRAWDZANIE CZASU…", toolLocation: "SPRAWDZANIE LOKALIZACJI…", toolWebSearch: "WYSZUKIWANIE W SIECI…", toolMcp: "UŻYWANIE MCP", toolGeneric: "UŻYWANIE NARZĘDZIA…", tapReveal: "DOTKNIJ, ABY POKAZAĆ CAŁĄ ODPOWIEDŹ" },
  ru: { toolTime: "ПРОВЕРКА ВРЕМЕНИ…", toolLocation: "ПРОВЕРКА МЕСТОПОЛОЖЕНИЯ…", toolWebSearch: "ПОИСК В ИНТЕРНЕТЕ…", toolMcp: "ИСПОЛЬЗУЕТСЯ MCP", toolGeneric: "ИСПОЛЬЗУЕТСЯ ИНСТРУМЕНТ…", tapReveal: "КОСНИТЕСЬ, ЧТОБЫ ПОКАЗАТЬ ВЕСЬ ОТВЕТ" },
  uk: { toolTime: "ПЕРЕВІРКА ЧАСУ…", toolLocation: "ПЕРЕВІРКА МІСЦЯ…", toolWebSearch: "ПОШУК В ІНТЕРНЕТІ…", toolMcp: "ВИКОРИСТАННЯ MCP", toolGeneric: "ВИКОРИСТАННЯ ІНСТРУМЕНТА…", tapReveal: "ТОРКНІТЬСЯ, ЩОБ ПОКАЗАТИ ВСЮ ВІДПОВІДЬ" },
  tr: { toolTime: "SAAT KONTROL EDİLİYOR…", toolLocation: "KONUM KONTROL EDİLİYOR…", toolWebSearch: "WEB’DE ARANIYOR…", toolMcp: "MCP KULLANILIYOR", toolGeneric: "ARAÇ KULLANILIYOR…", tapReveal: "TÜM YANITI GÖRMEK İÇİN DOKUN" },
  ar: { toolTime: "جارٍ التحقق من الوقت…", toolLocation: "جارٍ التحقق من الموقع…", toolWebSearch: "جارٍ البحث في الويب…", toolMcp: "جارٍ استخدام MCP", toolGeneric: "جارٍ استخدام أداة…", tapReveal: "انقر لإظهار الرد الكامل" },
  he: { toolTime: "בודק את השעה…", toolLocation: "בודק את המיקום…", toolWebSearch: "מחפש באינטרנט…", toolMcp: "משתמש ב-MCP", toolGeneric: "משתמש בכלי…", tapReveal: "הקש להצגת התשובה המלאה" },
  hi: { toolTime: "समय जाँचा जा रहा है…", toolLocation: "स्थान जाँचा जा रहा है…", toolWebSearch: "वेब पर खोज जारी…", toolMcp: "MCP का उपयोग जारी", toolGeneric: "टूल का उपयोग जारी…", tapReveal: "पूरा उत्तर तुरंत देखने के लिए टैप करें" },
  bn: { toolTime: "সময় দেখা হচ্ছে…", toolLocation: "অবস্থান দেখা হচ্ছে…", toolWebSearch: "ওয়েবে খোঁজা হচ্ছে…", toolMcp: "MCP ব্যবহার হচ্ছে", toolGeneric: "টুল ব্যবহার হচ্ছে…", tapReveal: "সম্পূর্ণ উত্তর দেখতে ট্যাপ করুন" },
  id: { toolTime: "MEMERIKSA WAKTU…", toolLocation: "MEMERIKSA LOKASI…", toolWebSearch: "MENCARI DI WEB…", toolMcp: "MENGGUNAKAN MCP", toolGeneric: "MENGGUNAKAN ALAT…", tapReveal: "KETUK UNTUK MELIHAT JAWABAN LENGKAP" },
  vi: { toolTime: "ĐANG KIỂM TRA GIỜ…", toolLocation: "ĐANG KIỂM TRA VỊ TRÍ…", toolWebSearch: "ĐANG TÌM TRÊN WEB…", toolMcp: "ĐANG DÙNG MCP", toolGeneric: "ĐANG DÙNG CÔNG CỤ…", tapReveal: "CHẠM ĐỂ HIỆN TOÀN BỘ CÂU TRẢ LỜI" },
  th: { toolTime: "กำลังตรวจสอบเวลา…", toolLocation: "กำลังตรวจสอบตำแหน่ง…", toolWebSearch: "กำลังค้นหาเว็บ…", toolMcp: "กำลังใช้ MCP", toolGeneric: "กำลังใช้เครื่องมือ…", tapReveal: "แตะเพื่อแสดงคำตอบทั้งหมด" },
  ms: { toolTime: "MENYEMAK MASA…", toolLocation: "MENYEMAK LOKASI…", toolWebSearch: "MENCARI DI WEB…", toolMcp: "MENGGUNAKAN MCP", toolGeneric: "MENGGUNAKAN ALAT…", tapReveal: "KETIK UNTUK PAPARKAN JAWAPAN PENUH" },
  fil: { toolTime: "TINITINGNAN ANG ORAS…", toolLocation: "TINITINGNAN ANG LOKASYON…", toolWebSearch: "NAGHAHANAP SA WEB…", toolMcp: "GINAGAMIT ANG MCP", toolGeneric: "GUMAGAMIT NG TOOL…", tapReveal: "I-TAP PARA IPAKITA ANG BUONG SAGOT" },
  sv: { toolTime: "KONTROLLERAR TIDEN…", toolLocation: "KONTROLLERAR PLATSEN…", toolWebSearch: "SÖKER PÅ WEBBEN…", toolMcp: "ANVÄNDER MCP", toolGeneric: "ANVÄNDER VERKTYG…", tapReveal: "TRYCK FÖR ATT VISA HELA SVARET" },
  no: { toolTime: "SJEKKER TIDEN…", toolLocation: "SJEKKER POSISJONEN…", toolWebSearch: "SØKER PÅ NETTET…", toolMcp: "BRUKER MCP", toolGeneric: "BRUKER VERKTØY…", tapReveal: "TRYKK FOR Å VISE HELE SVARET" },
  da: { toolTime: "KONTROLLERER TIDEN…", toolLocation: "KONTROLLERER PLACERINGEN…", toolWebSearch: "SØGER PÅ NETTET…", toolMcp: "BRUGER MCP", toolGeneric: "BRUGER VÆRKTØJ…", tapReveal: "TRYK FOR AT VISE HELE SVARET" },
  fi: { toolTime: "TARKISTETAAN AIKAA…", toolLocation: "TARKISTETAAN SIJAINTIA…", toolWebSearch: "HAETAAN VERKOSTA…", toolMcp: "KÄYTETÄÄN MCP:TÄ", toolGeneric: "KÄYTETÄÄN TYÖKALUA…", tapReveal: "NAPAUTA NÄYTTÄÄKSESI KOKO VASTAUKSEN" },
  cs: { toolTime: "KONTROLA ČASU…", toolLocation: "KONTROLA POLOHY…", toolWebSearch: "VYHLEDÁVÁNÍ NA WEBU…", toolMcp: "POUŽÍVÁ SE MCP", toolGeneric: "POUŽÍVÁ SE NÁSTROJ…", tapReveal: "KLEPNUTÍM ZOBRAZÍTE CELOU ODPOVĚĎ" },
  ro: { toolTime: "SE VERIFICĂ ORA…", toolLocation: "SE VERIFICĂ LOCAȚIA…", toolWebSearch: "SE CAUTĂ PE WEB…", toolMcp: "SE FOLOSEȘTE MCP", toolGeneric: "SE FOLOSEȘTE INSTRUMENTUL…", tapReveal: "ATINGE PENTRU A AFIȘA RĂSPUNSUL COMPLET" },
  ...additionalActivityTranslations,
} as const satisfies Readonly<Record<SupportedLocale, AiHudActivityStrings>>;

export function translateAiHud(
  locale: SupportedLocale,
  key: AiHudStringKey,
): string {
  const translated = releaseTranslation(locale, "hud", key);
  if (translated !== undefined) return translated;
  if (key in AI_HUD_TRANSLATIONS[locale]) {
    return AI_HUD_TRANSLATIONS[locale][key as keyof AiHudStrings];
  }
  return AI_HUD_ACTIVITY_TRANSLATIONS[locale][key as keyof AiHudActivityStrings];
}

export function aiHudStatusLabel(
  snapshot: AiHudSnapshot,
  locale: SupportedLocale,
): string {
  if (!snapshot.configured) return translateAiHud(locale, "ready");
  const tool = snapshot.activeTool;
  if (tool) {
    if (tool.kind === "weather") return `${translatePhone(locale, "weather")}…`;
    if (tool.kind === "time") return translateAiHud(locale, "toolTime");
    if (tool.kind === "location") return translateAiHud(locale, "toolLocation");
    if (tool.kind === "web-search") return translateAiHud(locale, "toolWebSearch");
    if (tool.kind === "mcp") {
      const label = translateAiHud(locale, "toolMcp");
      return tool.displayName ? `${label} // ${tool.displayName}` : label;
    }
    return translateAiHud(locale, "toolGeneric");
  }
  switch (snapshot.phase) {
    case "connecting": return translateAiHud(locale, "connecting");
    case "listening": return translateAiHud(locale, "listening");
    case "thinking": return translateAiHud(locale, "thinking");
    case "displaying": return translateAiHud(locale, "displaying");
    case "error": return translateAiHud(locale, "error");
    default: return translateAiHud(locale, "ready");
  }
}

type AiApprovalStrings = Readonly<{
  title: string;
  approve: string;
  reject: string;
}>;

const additionalApprovalTranslations = Object.fromEntries(
  Object.entries(ADDITIONAL_AI_TRANSLATIONS)
    .map(([locale, strings]) => [locale, strings.approval]),
) as Record<keyof typeof ADDITIONAL_AI_TRANSLATIONS, AiApprovalStrings>;

const AI_APPROVAL_TRANSLATIONS = {
  en: { title: "APPROVE MCP TOOL", approve: "TAP // APPROVE", reject: "DOUBLE TAP // REJECT AND EXIT" },
  ko: { title: "MCP 도구 승인", approve: "한 번 탭 // 승인", reject: "두 번 탭 // 거절하고 나가기" },
  ja: { title: "MCPツールを承認", approve: "タップ // 承認", reject: "ダブルタップ // 拒否して終了" },
  "zh-Hans": { title: "批准 MCP 工具", approve: "单击 // 批准", reject: "双击 // 拒绝并退出" },
  "zh-Hant": { title: "核准 MCP 工具", approve: "點一下 // 核准", reject: "點兩下 // 拒絕並離開" },
  es: { title: "APROBAR HERRAMIENTA MCP", approve: "TOQUE // APROBAR", reject: "DOBLE TOQUE // RECHAZAR Y SALIR" },
  fr: { title: "APPROUVER L’OUTIL MCP", approve: "TAP // APPROUVER", reject: "DOUBLE TAP // REFUSER ET QUITTER" },
  de: { title: "MCP-TOOL GENEHMIGEN", approve: "TIPP // GENEHMIGEN", reject: "DOPPELTIPP // ABLEHNEN UND BEENDEN" },
  it: { title: "APPROVA STRUMENTO MCP", approve: "TOCCO // APPROVA", reject: "DOPPIO TOCCO // RIFIUTA ED ESCI" },
  pt: { title: "APROVAR FERRAMENTA MCP", approve: "TOQUE // APROVAR", reject: "TOQUE DUPLO // RECUSAR E SAIR" },
  nl: { title: "MCP-TOOL GOEDKEUREN", approve: "TIK // GOEDKEUREN", reject: "DUBBELTIK // WEIGEREN EN SLUITEN" },
  pl: { title: "ZATWIERDŹ NARZĘDZIE MCP", approve: "DOTKNIJ // ZATWIERDŹ", reject: "PODWÓJNIE // ODRZUĆ I WYJDŹ" },
  ru: { title: "РАЗРЕШИТЬ ИНСТРУМЕНТ MCP", approve: "КАСАНИЕ // РАЗРЕШИТЬ", reject: "ДВОЙНОЕ // ОТКЛОНИТЬ И ВЫЙТИ" },
  uk: { title: "ДОЗВОЛИТИ ІНСТРУМЕНТ MCP", approve: "ДОТИК // ДОЗВОЛИТИ", reject: "ПОДВІЙНИЙ // ВІДХИЛИТИ Й ВИЙТИ" },
  tr: { title: "MCP ARACINI ONAYLA", approve: "DOKUN // ONAYLA", reject: "ÇİFT DOKUN // REDDET VE ÇIK" },
  ar: { title: "الموافقة على أداة MCP", approve: "نقرة // موافقة", reject: "نقرتان // رفض وخروج" },
  he: { title: "אישור כלי MCP", approve: "הקשה // אישור", reject: "הקשה כפולה // דחייה ויציאה" },
  hi: { title: "MCP टूल स्वीकृत करें", approve: "टैप // स्वीकृत", reject: "दो बार टैप // अस्वीकार और बाहर" },
  bn: { title: "MCP টুল অনুমোদন", approve: "ট্যাপ // অনুমোদন", reject: "দুইবার ট্যাপ // বাতিল ও প্রস্থান" },
  id: { title: "SETUJUI ALAT MCP", approve: "KETUK // SETUJUI", reject: "KETUK DUA KALI // TOLAK DAN KELUAR" },
  vi: { title: "PHÊ DUYỆT CÔNG CỤ MCP", approve: "CHẠM // PHÊ DUYỆT", reject: "CHẠM ĐÔI // TỪ CHỐI VÀ THOÁT" },
  th: { title: "อนุมัติเครื่องมือ MCP", approve: "แตะ // อนุมัติ", reject: "แตะสองครั้ง // ปฏิเสธและออก" },
  ms: { title: "LULUSKAN ALAT MCP", approve: "KETIK // LULUSKAN", reject: "KETIK DUA KALI // TOLAK DAN KELUAR" },
  fil: { title: "APRUBAHAN ANG MCP TOOL", approve: "TAP // APRUBAHAN", reject: "DOBLENG TAP // TANGGIHAN AT LUMABAS" },
  sv: { title: "GODKÄNN MCP-VERKTYG", approve: "TRYCK // GODKÄNN", reject: "DUBBELTRYCK // NEKA OCH AVSLUTA" },
  no: { title: "GODKJENN MCP-VERKTØY", approve: "TRYKK // GODKJENN", reject: "DOBBELTRYKK // AVVIS OG AVSLUTT" },
  da: { title: "GODKEND MCP-VÆRKTØJ", approve: "TRYK // GODKEND", reject: "DOBBELTTRYK // AFVIS OG AFSLUT" },
  fi: { title: "HYVÄKSY MCP-TYÖKALU", approve: "NAPAUTA // HYVÄKSY", reject: "KAKSOISNAPAUTUS // HYLKÄÄ JA POISTU" },
  cs: { title: "SCHVÁLIT NÁSTROJ MCP", approve: "KLEPNOUT // SCHVÁLIT", reject: "DVOJITĚ // ODMÍTNOUT A ODEJÍT" },
  ro: { title: "APROBĂ INSTRUMENTUL MCP", approve: "ATINGE // APROBĂ", reject: "ATINGE DUBLU // REFUZĂ ȘI IEȘI" },
  ...additionalApprovalTranslations,
} as const satisfies Readonly<Record<SupportedLocale, AiApprovalStrings>>;

export function translateAiApproval(locale: SupportedLocale): AiApprovalStrings {
  const base = AI_APPROVAL_TRANSLATIONS[locale];
  return {
    title: releaseTranslation(locale, "approval", "title") ?? base.title,
    approve: releaseTranslation(locale, "approval", "approve") ?? base.approve,
    reject: releaseTranslation(locale, "approval", "reject") ?? base.reject,
  };
}

export function localizeAiTranscriptLines(
  lines: readonly string[],
  locale: SupportedLocale,
): readonly string[] {
  const strings = { you: translateAiHud(locale, "you"), assistant: translateAiHud(locale, "assistant") };
  return lines.map((line) => {
    if (line.startsWith("YOU // ")) {
      return `${strings.you} // ${line.slice("YOU // ".length)}`;
    }
    if (line.startsWith("AI // ")) {
      return `${strings.assistant} // ${line.slice("AI // ".length)}`;
    }
    return line;
  });
}
