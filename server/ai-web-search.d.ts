export const OPENAI_SEARCH_MODEL: string;
export const CONVERSATE_MODEL: string;
export const CONVERSATE_CUE_CONTEXT_TURNS: number;
export const CONVERSATE_TRANSLATION_CONTEXT_TURNS: number;
export type PartialConversateAnalysis = { language?: string; translation?: string | null; inform?: string | null };
type Dependencies = { onPartial?: (value: PartialConversateAnalysis) => void; fetchImpl?: typeof fetch; logWarn?: (message: string) => void };
export function handleAiWebSearchRequest(request: Request, env: unknown, dependencies?: Dependencies): Promise<Response>;
export function handleConversateRequest(request: Request, env: unknown, dependencies?: Dependencies): Promise<Response>;
