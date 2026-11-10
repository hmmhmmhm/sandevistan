import { DEFAULT_OPENAI_MODELS } from "./openai-models";
import { BUILTIN_AI_TOOLS } from "./ai-tools";
import {
  projectRealtimeMcpTools,
  type McpServerConfig,
} from "./mcp-servers";
import type { PhoneLocale } from "./phone-types";

function languageInstruction(locale: PhoneLocale): string {
  const names: Partial<Record<PhoneLocale, string>> = {
    en: "English",
    ko: "Korean",
    ja: "Japanese",
    "zh-Hans": "Simplified Chinese",
    "zh-Hant": "Traditional Chinese",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ar: "Arabic",
    hi: "Hindi",
    he: "Hebrew",
  };
  return names[locale] ?? `the user's selected language (${locale})`;
}

export function createRealtimeSessionUpdate(
  locale: PhoneLocale,
  mcpServers: readonly McpServerConfig[] = [],
  model = DEFAULT_OPENAI_MODELS.realtime,
  transcriptionModel = DEFAULT_OPENAI_MODELS.refinement,
  holdToTalk = false,
) {
  return {
    type: "session.update" as const,
    session: {
      type: "realtime" as const,
      model,
      output_modalities: ["text"] as const,
      tools: [...BUILTIN_AI_TOOLS, ...projectRealtimeMcpTools(mcpServers)],
      tool_choice: "auto" as const,
      instructions: "You are a concise, helpful assistant for smart glasses. "
        + `Reply in ${languageInstruction(locale)} unless the user asks otherwise. `
        + "Use short paragraphs that are easy to read on a heads-up display. "
        + "Never guess the current time or exact location: call the matching tool. "
        + "Use get_weather for current weather or today's forecast; named cities do not require the user's GPS. "
        + "Use the resolved city, provider timestamp, temperature and rain probability from its output, with a numbered source. Distinguish current modeled precipitation/weather code from future rain probability; a high probability does not mean rain is falling now. "
        + "Never claim you cannot access weather or current information before trying the available matching tool. "
        + "Use web search for other current information and cite its numbered sources. "
        + "Call get_current_location only when location is relevant to the request.",
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24_000 },
          noise_reduction: { type: "far_field" },
          transcription: {
            model: transcriptionModel,
            prompt: "Live human conversation. Transcribe faithfully in the languages spoken. Preserve code-switching, names, numbers, and dates. Do not translate.",
          },
          turn_detection: holdToTalk ? null : {
            type: "semantic_vad",
            eagerness: "auto",
            create_response: false,
            interrupt_response: true,
          },
        },
      },
    },
  };
}
