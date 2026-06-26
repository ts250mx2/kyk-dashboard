/**
 * Catálogo único de modelos seleccionables en la app (chat de Kesito y todos
 * los análisis profundos de las páginas). El backend (lib/llm.ts) enruta cada
 * id a su proveedor: Claude → Anthropic, gpt/o → OpenAI, glm → Z.ai, kimi →
 * Moonshot. La preferencia se persiste en localStorage 'ai_query_model'.
 */
export const CHAT_MODELS: Array<{ id: string; label: string }> = [
    { id: 'claude-opus-4-8', label: 'Opus 4.8' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-5.5', label: 'GPT-5.5' },
    { id: 'glm-5.2', label: 'GLM-5.2' },
    { id: 'kimi-k2-0711-preview', label: 'Kimi K2' },
];

export const DEFAULT_CHAT_MODEL = 'claude-opus-4-8';

export const AI_MODEL_STORAGE_KEY = 'ai_query_model';

/**
 * Devuelve el modelo elegido por el usuario en el chat (persistido en
 * localStorage). Es lo que heredan por defecto los análisis de las páginas.
 * En SSR o si no hay uno válido, regresa el default.
 */
export function getStoredModel(): string {
    if (typeof window === 'undefined') return DEFAULT_CHAT_MODEL;
    try {
        const v = localStorage.getItem(AI_MODEL_STORAGE_KEY);
        return v && CHAT_MODELS.some(m => m.id === v) ? v : DEFAULT_CHAT_MODEL;
    } catch {
        return DEFAULT_CHAT_MODEL;
    }
}

/** Etiqueta legible de un id de modelo (para badges en la UI). */
export function modelLabel(id?: string): string {
    if (!id) return '';
    return CHAT_MODELS.find(m => m.id === id)?.label || id;
}
