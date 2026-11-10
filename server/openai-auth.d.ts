export const OPENAI_KEY_HEADER: string;
export const DEFAULT_OPENAI_MODELS: Readonly<{
  analysis: string; search: string; realtime: string; transcription: string; refinement: string;
}>;
export function validOpenAiKey(value: unknown): boolean;
export function openAiError(code: string, message: string, status: number): Response;
export function allowedOpenAiModel(role: string, model: unknown): boolean;
export function selectOpenAiModels(ids: readonly unknown[]): typeof DEFAULT_OPENAI_MODELS;
