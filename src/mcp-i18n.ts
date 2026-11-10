import { releaseTranslation } from "./release-i18n";
import type { SupportedLocale } from "./i18n/locale-registry";
import { ADDITIONAL_AI_TRANSLATIONS } from "./i18n/additional-ai-translations";

export type McpPhoneStringKey =
  | "mcpServers"
  | "mcpHelp"
  | "mcpServerName"
  | "mcpServerUrl"
  | "mcpBearerToken"
  | "mcpAllowedTools"
  | "noMcpServers";

type Strings = Readonly<Record<McpPhoneStringKey, string>>;
const common = (servers: string, help: string, name: string, url: string,
  token: string, tools: string, empty: string): Strings => ({
  mcpServers: servers,
  mcpHelp: help,
  mcpServerName: name,
  mcpServerUrl: url,
  mcpBearerToken: token,
  mcpAllowedTools: tools,
  noMcpServers: empty,
});

const additionalMcpTranslations = Object.fromEntries(
  Object.entries(ADDITIONAL_AI_TRANSLATIONS)
    .map(([locale, value]) => [locale, value.mcp]),
) as Record<keyof typeof ADDITIONAL_AI_TRANSLATIONS, Strings>;

const strings = {
  en: common("MCP servers", "Every call requires approval on the glasses.", "Server name", "HTTPS server URL", "Bearer token (optional)", "Allowed tools (comma-separated)", "No MCP servers added"),
  ko: common("MCP 서버", "모든 호출은 안경에서 승인이 필요합니다.", "서버 이름", "HTTPS 서버 URL", "Bearer 토큰(선택)", "허용 도구(쉼표로 구분)", "추가된 MCP 서버 없음"),
  ja: common("MCPサーバー", "すべての呼び出しはメガネでの承認が必要です。", "サーバー名", "HTTPSサーバーURL", "Bearerトークン（任意）", "許可するツール（カンマ区切り）", "MCPサーバーは未追加です"),
  "zh-Hans": common("MCP 服务器", "每次调用都需要在眼镜上批准。", "服务器名称", "HTTPS 服务器 URL", "Bearer 令牌（可选）", "允许的工具（逗号分隔）", "尚未添加 MCP 服务器"),
  "zh-Hant": common("MCP 伺服器", "每次呼叫都需要在眼鏡上核准。", "伺服器名稱", "HTTPS 伺服器 URL", "Bearer 權杖（選填）", "允許的工具（逗號分隔）", "尚未新增 MCP 伺服器"),
  es: common("Servidores MCP", "Cada llamada requiere aprobación en las gafas.", "Nombre del servidor", "URL HTTPS del servidor", "Token Bearer (opcional)", "Herramientas permitidas (separadas por comas)", "No hay servidores MCP"),
  fr: common("Serveurs MCP", "Chaque appel doit être approuvé sur les lunettes.", "Nom du serveur", "URL HTTPS du serveur", "Jeton Bearer (facultatif)", "Outils autorisés (séparés par des virgules)", "Aucun serveur MCP"),
  de: common("MCP-Server", "Jeder Aufruf muss auf der Brille genehmigt werden.", "Servername", "HTTPS-Server-URL", "Bearer-Token (optional)", "Erlaubte Tools (kommagetrennt)", "Keine MCP-Server hinzugefügt"),
  it: common("Server MCP", "Ogni chiamata richiede l’approvazione sugli occhiali.", "Nome server", "URL HTTPS del server", "Token Bearer (opzionale)", "Strumenti consentiti (separati da virgole)", "Nessun server MCP"),
  pt: common("Servidores MCP", "Cada chamada requer aprovação nos óculos.", "Nome do servidor", "URL HTTPS do servidor", "Token Bearer (opcional)", "Ferramentas permitidas (separadas por vírgulas)", "Nenhum servidor MCP"),
  nl: common("MCP-servers", "Elke aanroep vereist goedkeuring op de bril.", "Servernaam", "HTTPS-server-URL", "Bearer-token (optioneel)", "Toegestane tools (komma-gescheiden)", "Geen MCP-servers toegevoegd"),
  pl: common("Serwery MCP", "Każde wywołanie wymaga zatwierdzenia na okularach.", "Nazwa serwera", "Adres HTTPS serwera", "Token Bearer (opcjonalny)", "Dozwolone narzędzia (po przecinku)", "Nie dodano serwerów MCP"),
  ru: common("Серверы MCP", "Каждый вызов требует подтверждения на очках.", "Имя сервера", "HTTPS-адрес сервера", "Токен Bearer (необязательно)", "Разрешённые инструменты (через запятую)", "Серверы MCP не добавлены"),
  uk: common("Сервери MCP", "Кожен виклик потребує підтвердження на окулярах.", "Назва сервера", "HTTPS-адреса сервера", "Токен Bearer (необов’язково)", "Дозволені інструменти (через кому)", "Сервери MCP не додано"),
  tr: common("MCP sunucuları", "Her çağrı gözlükte onay gerektirir.", "Sunucu adı", "HTTPS sunucu URL’si", "Bearer belirteci (isteğe bağlı)", "İzin verilen araçlar (virgülle ayrılmış)", "MCP sunucusu eklenmedi"),
  ar: common("خوادم MCP", "تتطلب كل مكالمة موافقة على النظارة.", "اسم الخادم", "رابط خادم HTTPS", "رمز Bearer (اختياري)", "الأدوات المسموح بها (مفصولة بفواصل)", "لم تتم إضافة خوادم MCP"),
  he: common("שרתי MCP", "כל קריאה דורשת אישור במשקפיים.", "שם השרת", "כתובת HTTPS של השרת", "אסימון Bearer (אופציונלי)", "כלים מותרים (מופרדים בפסיקים)", "לא נוספו שרתי MCP"),
  hi: common("MCP सर्वर", "हर कॉल के लिए चश्मे पर स्वीकृति आवश्यक है।", "सर्वर नाम", "HTTPS सर्वर URL", "Bearer टोकन (वैकल्पिक)", "अनुमत टूल (कॉमा से अलग)", "कोई MCP सर्वर नहीं जोड़ा गया"),
  bn: common("MCP সার্ভার", "প্রতিটি কলে চশমায় অনুমোদন প্রয়োজন।", "সার্ভারের নাম", "HTTPS সার্ভার URL", "Bearer টোকেন (ঐচ্ছিক)", "অনুমোদিত টুল (কমা দিয়ে আলাদা)", "কোনো MCP সার্ভার যোগ করা হয়নি"),
  id: common("Server MCP", "Setiap panggilan memerlukan persetujuan di kacamata.", "Nama server", "URL server HTTPS", "Token Bearer (opsional)", "Alat yang diizinkan (pisahkan koma)", "Belum ada server MCP"),
  vi: common("Máy chủ MCP", "Mỗi lệnh gọi cần được phê duyệt trên kính.", "Tên máy chủ", "URL máy chủ HTTPS", "Mã Bearer (tùy chọn)", "Công cụ được phép (phân cách bằng dấu phẩy)", "Chưa thêm máy chủ MCP"),
  th: common("เซิร์ฟเวอร์ MCP", "ทุกการเรียกต้องอนุมัติบนแว่นตา", "ชื่อเซิร์ฟเวอร์", "URL เซิร์ฟเวอร์ HTTPS", "โทเค็น Bearer (ไม่บังคับ)", "เครื่องมือที่อนุญาต (คั่นด้วยจุลภาค)", "ยังไม่ได้เพิ่มเซิร์ฟเวอร์ MCP"),
  ms: common("Pelayan MCP", "Setiap panggilan memerlukan kelulusan pada cermin mata.", "Nama pelayan", "URL pelayan HTTPS", "Token Bearer (pilihan)", "Alat dibenarkan (dipisah koma)", "Tiada pelayan MCP ditambah"),
  fil: common("Mga MCP server", "Bawat tawag ay kailangang aprubahan sa salamin.", "Pangalan ng server", "HTTPS server URL", "Bearer token (opsyonal)", "Pinapayagang tool (paghiwalayin ng kuwit)", "Walang idinagdag na MCP server"),
  sv: common("MCP-servrar", "Varje anrop måste godkännas på glasögonen.", "Servernamn", "HTTPS-server-URL", "Bearer-token (valfri)", "Tillåtna verktyg (kommaseparerade)", "Inga MCP-servrar tillagda"),
  no: common("MCP-servere", "Hvert kall må godkjennes på brillene.", "Servernavn", "HTTPS-server-URL", "Bearer-token (valgfritt)", "Tillatte verktøy (kommadelt)", "Ingen MCP-servere lagt til"),
  da: common("MCP-servere", "Hvert kald skal godkendes på brillerne.", "Servernavn", "HTTPS-server-URL", "Bearer-token (valgfrit)", "Tilladte værktøjer (kommasepareret)", "Ingen MCP-servere tilføjet"),
  fi: common("MCP-palvelimet", "Jokainen kutsu vaatii hyväksynnän laseissa.", "Palvelimen nimi", "HTTPS-palvelimen URL", "Bearer-tunnus (valinnainen)", "Sallitut työkalut (pilkuin eroteltuna)", "MCP-palvelimia ei ole lisätty"),
  cs: common("Servery MCP", "Každé volání vyžaduje schválení na brýlích.", "Název serveru", "HTTPS URL serveru", "Bearer token (volitelné)", "Povolené nástroje (oddělené čárkou)", "Nebyly přidány žádné servery MCP"),
  ro: common("Servere MCP", "Fiecare apel necesită aprobare pe ochelari.", "Numele serverului", "URL HTTPS al serverului", "Token Bearer (opțional)", "Instrumente permise (separate prin virgulă)", "Nu sunt adăugate servere MCP"),
  ...additionalMcpTranslations,
} as const satisfies Readonly<Record<SupportedLocale, Strings>>;

export function isMcpPhoneStringKey(key: string): key is McpPhoneStringKey {
  return key in strings.en;
}

export function translateMcpPhone(
  locale: SupportedLocale,
  key: McpPhoneStringKey,
): string {
  const translated = releaseTranslation(locale, "mcp", key);
  if (translated !== undefined) return translated;
  return strings[locale][key];
}
