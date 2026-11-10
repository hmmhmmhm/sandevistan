const GOOGLE_TOPICS = Object.freeze([
  ["top", "rss"],
  ["world", "rss/headlines/section/topic/WORLD"],
  ["technology", "rss/headlines/section/topic/TECHNOLOGY"],
]);

const GOOGLE_EDITIONS = Object.freeze([
  ["ja", "ja", "JP", "JP:ja", ["トップニュース", "国際", "テクノロジー"]],
  ["zh-Hans", "zh-CN", "CN", "CN:zh-Hans", ["头条新闻", "国际", "科技"]],
  ["zh-Hant", "zh-TW", "TW", "TW:zh-Hant", ["焦點新聞", "國際", "科技"]],
  ["es", "es", "ES", "ES:es", ["Noticias destacadas", "Mundo", "Tecnología"]],
  ["fr", "fr", "FR", "FR:fr", ["À la une", "Monde", "Technologie"]],
  ["de", "de", "DE", "DE:de", ["Top-Nachrichten", "Welt", "Technologie"]],
  ["it", "it", "IT", "IT:it", ["Notizie principali", "Mondo", "Tecnologia"]],
  ["pt", "pt-BR", "BR", "BR:pt-419", ["Principais notícias", "Mundo", "Tecnologia"]],
  ["nl", "nl", "NL", "NL:nl", ["Topnieuws", "Wereld", "Technologie"]],
  ["pl", "pl", "PL", "PL:pl", ["Najważniejsze wiadomości", "Świat", "Technologia"]],
  ["ru", "ru", "RU", "RU:ru", ["Главные новости", "Мир", "Технологии"]],
  ["uk", "uk", "UA", "UA:uk", ["Головні новини", "Світ", "Технології"]],
  ["tr", "tr", "TR", "TR:tr", ["Öne çıkan haberler", "Dünya", "Teknoloji"]],
  ["ar", "ar", "SA", "SA:ar", ["أهم الأخبار", "العالم", "التكنولوجيا"]],
  ["he", "he", "IL", "IL:he", ["חדשות מובילות", "עולם", "טכנולוגיה"]],
  ["hi", "hi", "IN", "IN:hi", ["मुख्य समाचार", "विश्व", "प्रौद्योगिकी"]],
  ["bn", "bn", "BD", "BD:bn", ["শীর্ষ সংবাদ", "বিশ্ব", "প্রযুক্তি"]],
  ["id", "id", "ID", "ID:id", ["Berita utama", "Dunia", "Teknologi"]],
  ["vi", "vi", "VN", "VN:vi", ["Tin nổi bật", "Thế giới", "Công nghệ"]],
  ["th", "th", "TH", "TH:th", ["ข่าวเด่น", "โลก", "เทคโนโลยี"]],
  ["ms", "ms-MY", "MY", "MY:ms", ["Berita utama", "Dunia", "Teknologi"]],
  ["sv", "sv", "SE", "SE:sv", ["Toppnyheter", "Världen", "Teknik"]],
  ["no", "no", "NO", "NO:no", ["Toppnyheter", "Verden", "Teknologi"]],
  ["fi", "fi-FI", "FI", "FI:fi", ["Pääuutiset", "Maailma", "Teknologia"]],
  ["cs", "cs", "CZ", "CZ:cs", ["Hlavní zprávy", "Svět", "Technologie"]],
  ["ro", "ro", "RO", "RO:ro", ["Știri principale", "Lume", "Tehnologie"]],
]);

const GOOGLE_TOPIC_IDS = Object.freeze({
  ja: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtcGhHZ0pLVUNnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtcGhHZ0pLVUNnQVAB"],
  "zh-Hans": ["CAAqKggKIiRDQkFTRlFvSUwyMHZNRGx1YlY4U0JYcG9MVU5PR2dKRFRpZ0FQAQ", "CAAqKggKIiRDQkFTRlFvSUwyMHZNRGRqTVhZU0JYcG9MVU5PR2dKRFRpZ0FQAQ"],
  "zh-Hant": ["CAAqKggKIiRDQkFTRlFvSUwyMHZNRGx1YlY4U0JYcG9MVlJYR2dKVVZ5Z0FQAQ", "CAAqKggKIiRDQkFTRlFvSUwyMHZNRGRqTVhZU0JYcG9MVlJYR2dKVVZ5Z0FQAQ"],
  es: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnpHZ0pGVXlnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnpHZ0pGVXlnQVAB"],
  fr: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtWnlHZ0pHVWlnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtWnlHZ0pHVWlnQVAB"],
  de: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtUmxHZ0pFUlNnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtUmxHZ0pFUlNnQVAB"],
  it: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtbDBHZ0pKVkNnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtbDBHZ0pKVkNnQVAB"],
  pt: ["CAAqKggKIiRDQkFTRlFvSUwyMHZNRGx1YlY4U0JYQjBMVUpTR2dKQ1VpZ0FQAQ", "CAAqKggKIiRDQkFTRlFvSUwyMHZNRGRqTVhZU0JYQjBMVUpTR2dKQ1VpZ0FQAQ"],
  nl: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtNXNHZ0pPVENnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtNXNHZ0pPVENnQVAB"],
  pl: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuQnNHZ0pRVENnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuQnNHZ0pRVENnQVAB"],
  ru: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuSjFHZ0pTVlNnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuSjFHZ0pTVlNnQVAB"],
  uk: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuVnJHZ0pWUVNnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuVnJHZ0pWUVNnQVAB"],
  tr: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuUnlHZ0pVVWlnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuUnlHZ0pVVWlnQVAB"],
  ar: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtRnlHZ0pUUVNnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtRnlHZ0pUUVNnQVAB"],
  he: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtbDNHZ0pKVENnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtbDNHZ0pKVENnQVAB"],
  hi: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtaHBHZ0pKVGlnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtaHBHZ0pKVGlnQVAB"],
  bn: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtSnVHZ0pDUkNnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtSnVHZ0pDUkNnQVAB"],
  id: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtbGtHZ0pKUkNnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtbGtHZ0pKUkNnQVAB"],
  vi: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuWnBHZ0pXVGlnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuWnBHZ0pXVGlnQVAB"],
  th: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuUm9HZ0pVU0NnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuUm9HZ0pVU0NnQVAB"],
  ms: ["CAAqKggKIiRDQkFTRlFvSUwyMHZNRGx1YlY4U0JXMXpMVTFaR2dKTldTZ0FQAQ", "CAAqKggKIiRDQkFTRlFvSUwyMHZNRGRqTVhZU0JXMXpMVTFaR2dKTldTZ0FQAQ"],
  sv: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuTjJHZ0pUUlNnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuTjJHZ0pUUlNnQVAB"],
  no: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtNXZHZ0pPVHlnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtNXZHZ0pPVHlnQVAB"],
  fi: ["CAAqKggKIiRDQkFTRlFvSUwyMHZNRGx1YlY4U0JXWnBMVVpKR2dKR1NTZ0FQAQ", "CAAqKggKIiRDQkFTRlFvSUwyMHZNRGRqTVhZU0JXWnBMVVpKR2dKR1NTZ0FQAQ"],
  cs: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtTnpHZ0pEV2lnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtTnpHZ0pEV2lnQVAB"],
  ro: ["CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuSnZHZ0pTVHlnQVAB", "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuSnZHZ0pTVHlnQVAB"],
});

const GOOGLE_FEED_OVERRIDES = Object.freeze({
  "ms-technology": "https://news.google.com/rss/search?q=Teknologi&hl=ms-MY&gl=MY&ceid=MY:ms",
  "fi-technology": "https://news.google.com/rss/search?q=Teknologia&hl=fi-FI&gl=FI&ceid=FI:fi",
});

function googleNewsFeeds([locale, hl, gl, ceid, names]) {
  const query = new URLSearchParams({ hl, gl, ceid }).toString();
  const slug = locale.toLowerCase();
  return GOOGLE_TOPICS.map(([topic, path], index) => ({
    id: `${slug}-google-${topic}`,
    name: names[index],
    url: GOOGLE_FEED_OVERRIDES[`${locale}-${topic}`]
      ?? (index === 0
        ? `https://news.google.com/${path}?${query}`
        : `https://news.google.com/rss/topics/${
            GOOGLE_TOPIC_IDS[locale][index - 1]
          }?${query}`),
    locale,
  }));
}

const GOOGLE_FEEDS_BY_LOCALE = new Map(
  GOOGLE_EDITIONS.map((edition) => [edition[0], googleNewsFeeds(edition)]),
);

const FIXED_FEEDS_BY_LOCALE = new Map([
  ["ko", [
    {
      id: "sbs-latest",
      name: "SBS 최신뉴스",
      url: "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER",
      locale: "ko",
    },
    {
      id: "newsis-breaking",
      name: "뉴시스 속보",
      url: "https://www.newsis.com/RSS/sokbo.xml",
      locale: "ko",
    },
    {
      id: "ohmynews-latest",
      name: "오마이뉴스 최신기사",
      url: "https://rss.ohmynews.com/rss/ohmynews.xml",
      locale: "ko",
    },
  ]],
  ["en", [
    {
      id: "bbc-world",
      name: "BBC World",
      url: "https://feeds.bbci.co.uk/news/world/rss.xml",
      locale: "en",
    },
    {
      id: "guardian-world",
      name: "The Guardian World",
      url: "https://www.theguardian.com/world/rss",
      locale: "en",
    },
    {
      id: "lemonde-international",
      name: "Le Monde International",
      url: "https://www.lemonde.fr/en/international/rss_full.xml",
      locale: "en",
    },
  ]],
  ["fil", [
    {
      id: "gma-nation",
      name: "GMA Nation",
      url: "https://data.gmanetwork.com/gno/rss/news/nation/feed.xml",
      locale: "fil",
    },
    {
      id: "philstar-headlines",
      name: "Philstar Headlines",
      url: "https://www.philstar.com/rss/headlines",
      locale: "fil",
    },
    {
      id: "rappler-latest",
      name: "Rappler Latest",
      url: "https://www.rappler.com/feed/",
      locale: "fil",
    },
  ]],
  ["da", [
    {
      id: "dr-all",
      name: "DR Nyheder",
      url: "https://www.dr.dk/nyheder/service/feeds/allenyheder",
      locale: "da",
    },
    {
      id: "dr-denmark",
      name: "DR Indland",
      url: "https://www.dr.dk/nyheder/service/feeds/indland",
      locale: "da",
    },
    {
      id: "dr-world",
      name: "DR Udland",
      url: "https://www.dr.dk/nyheder/service/feeds/udland",
      locale: "da",
    },
  ]],
]);

const ADDITIONAL_FEED_LOCALES = Object.freeze([
  "ab",
  "ace",
  "ach",
  "aa",
  "af",
  "sq",
  "am",
  "hy",
  "as",
  "av",
  "awa",
  "ay",
  "az",
  "ban",
  "bal",
  "bm",
  "ba",
  "eu",
  "be",
  "bho",
  "bs",
  "br",
  "bg",
  "yue",
  "ca",
  "ceb",
  "ch",
  "ce",
  "ny",
  "cv",
  "co",
  "crh",
  "hr",
  "dv",
  "doi",
  "dz",
  "eo",
  "et",
  "ee",
  "fo",
  "fj",
  "fy",
  "ff",
  "gl",
  "ka",
  "el",
  "gn",
  "gu",
  "ht",
  "cnh",
  "ha",
  "haw",
  "hil",
  "hmn",
  "hu",
  "is",
  "ig",
  "ilo",
  "iu",
  "ga",
  "jam",
  "jw",
  "kl",
  "kn",
  "kr",
  "pam",
  "kk",
  "kha",
  "km",
  "rw",
  "kv",
  "gom",
  "kri",
  "ku",
  "ckb",
  "ky",
  "lo",
  "lv",
  "li",
  "ln",
  "lt",
  "lg",
  "lb",
  "mk",
  "mai",
  "mg",
  "ml",
  "mt",
  "gv",
  "mi",
  "mr",
  "min",
  "lus",
  "mn",
  "my",
  "new",
  "ne",
  "oc",
  "or",
  "om",
  "os",
  "pap",
  "ps",
  "fa",
  "pa",
  "qu",
  "rom",
  "rn",
  "sm",
  "sg",
  "sa",
  "sat",
  "gd",
  "nso",
  "sr",
  "st",
  "sn",
  "scn",
  "sd",
  "si",
  "sk",
  "sl",
  "so",
  "su",
  "sw",
  "ss",
  "tg",
  "ber",
  "ta",
  "tt",
  "te",
  "tet",
  "bo",
  "ti",
  "to",
  "ts",
  "tn",
  "tk",
  "ak",
  "ur",
  "ug",
  "uz",
  "war",
  "cy",
  "wo",
  "xh",
  "sah",
  "yi",
  "yo",
  "zu",
]);

const ADDITIONAL_GOOGLE_EDITIONS = new Map([
  ["bg", ["bg", "BG"]],
  ["el", ["el", "GR"]],
  ["hu", ["hu", "HU"]],
  ["lt", ["lt", "LT"]],
  ["lv", ["lv", "LV"]],
  ["ml", ["ml", "IN"]],
  ["mr", ["mr", "IN"]],
  ["sk", ["sk", "SK"]],
  ["sl", ["sl", "SI"]],
  ["sr", ["sr", "RS"]],
  ["ta", ["ta", "IN"]],
  ["te", ["te", "IN"]],
]);

function additionalGoogleFeeds(locale, [hl, gl]) {
  const common = { hl, gl, ceid: `${gl}:${hl}` };
  return [
    ["top", "Top stories", undefined],
    ["world", "World", "world"],
    ["technology", "Technology", "technology"],
  ].map(([topic, name, search]) => {
    const query = new URLSearchParams(
      search ? { q: search, ...common } : common,
    ).toString();
    return {
      id: `${locale}-google-${topic}`,
      name: `Google News · ${name}`,
      url: `https://news.google.com/rss${search ? "/search" : ""}?${query}`,
      locale,
    };
  });
}

function englishFallbackFeeds(locale) {
  return FIXED_FEEDS_BY_LOCALE.get("en").map((feed) => ({
    ...feed,
    id: `${locale}-fallback-${feed.id}`,
    name: `${feed.name} · English fallback`,
    locale,
    fallbackLocale: "en",
  }));
}

const ADDITIONAL_FEEDS_BY_LOCALE = new Map(
  ADDITIONAL_FEED_LOCALES.map((locale) => [
    locale,
    ADDITIONAL_GOOGLE_EDITIONS.has(locale)
      ? additionalGoogleFeeds(locale, ADDITIONAL_GOOGLE_EDITIONS.get(locale))
      : englishFallbackFeeds(locale),
  ]),
);

export const BUILT_IN_RSS_FEEDS = Object.freeze(
  [
    ...FIXED_FEEDS_BY_LOCALE.values(),
    ...GOOGLE_FEEDS_BY_LOCALE.values(),
    ...ADDITIONAL_FEEDS_BY_LOCALE.values(),
  ].flat().map((feed) => Object.freeze(feed)),
);

export const RETIRED_RSS_FEEDS = Object.freeze([
  Object.freeze({ id: "weekly-khan-latest", name: "주간경향 최신기사", replacement: "ohmynews-latest" }),
]);
