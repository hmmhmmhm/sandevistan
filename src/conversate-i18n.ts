import { releaseTranslation } from "./release-i18n";
import type { PhoneLocale } from "./phone-types";

const EN = {
  conversate: "Conversate", ready: "Ready", live: "Listening", keyRequired: "OpenAI key required",
  transcription: "Transcription", translation: "Translation", inform: "Inform",
  prepNote: "Prep Note", prepNoteHelp: "Context used before Inform is generated.",
  spokenLanguages: "Expected spoken languages", spokenLanguagesHelp: "Language codes, for example: ko, en",
  transcriptionKeywords: "Transcription keywords", transcriptionKeywordsHelp: "Names, acronyms, and specialist terms, separated by commas.",
  copilot: "Copilot", goal: "Conversation goal", goalHelp: "Leave blank to infer from context.",
  hideAfter: "AI cue auto-hide", seconds: "seconds", history: "Conversation history",
  noHistory: "No conversations yet", clearHistory: "Clear conversation history",
  original: "Original", pronunciation: "Pronunciation", meaning: "Meaning",
  listening: "Listening…", informHistory: "Previous Inform", noInform: "No Inform yet",
  disabled: "Disabled", enabled: "Enabled",
  secondsShort: "s", untilHidden: "until hidden", directory: "Records", directoryHelp: "scroll: select · tap: open",
  noCues: "No cues yet", previous: "History", latest: "Latest", scrollRows: "scroll: one line",
  tapLive: "tap: live", tapRecords: "tap: records",
} as const;

const KO: Record<keyof typeof EN, string> = {
  conversate: "Conversate", ready: "준비됨", live: "듣는 중", keyRequired: "OpenAI 키가 필요합니다",
  transcription: "전사", translation: "번역", inform: "Inform",
  prepNote: "Prep Note", prepNoteHelp: "Inform 생성 전에 참고할 사전 지식입니다.",
  spokenLanguages: "예상 대화 언어", spokenLanguagesHelp: "언어 코드를 입력하세요. 예: ko, en",
  transcriptionKeywords: "전사 키워드", transcriptionKeywordsHelp: "이름, 약어, 전문용어를 쉼표로 구분하세요.",
  copilot: "Copilot", goal: "대화 목표", goalHelp: "비워두면 최근 대화에서 목표를 추론합니다.",
  hideAfter: "팁 자동 숨김", seconds: "초", history: "대화 기록",
  noHistory: "아직 대화 기록이 없습니다", clearHistory: "대화 기록 지우기",
  original: "원문", pronunciation: "발음", meaning: "뜻",
  listening: "듣는 중…", informHistory: "이전 Inform", noInform: "이전 Inform이 없습니다",
  disabled: "끔", enabled: "켬",
  secondsShort: "초", untilHidden: "후 숨김", directory: "기록", directoryHelp: "스크롤: 선택 · 클릭: 열기",
  noCues: "아직 팁 기록이 없습니다", previous: "이전 기록", latest: "최신", scrollRows: "스크롤: 한 줄씩",
  tapLive: "클릭: 실시간", tapRecords: "클릭: 기록",
};

export type ConversateStringKey = keyof typeof EN;

export function isConversateStringKey(value: string): value is ConversateStringKey {
  return value in EN;
}

export function translateConversate(locale: PhoneLocale, key: ConversateStringKey): string {
  const translated = releaseTranslation(locale, "conversate", key);
  if (translated !== undefined) return translated;
  return (locale === "ko" ? KO : EN)[key];
}
