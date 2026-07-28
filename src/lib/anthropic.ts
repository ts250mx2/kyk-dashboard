import Anthropic from '@anthropic-ai/sdk';

// Timeout de las respuestas del agente (ms). El SDK por defecto usa 10 min y
// puede recortar antes en respuestas largas; lo subimos para análisis profundos
// y reportes largos. Configurable vía ANTHROPIC_TIMEOUT_MS.
export const ANTHROPIC_TIMEOUT_MS = Number(process.env.ANTHROPIC_TIMEOUT_MS) || 1_800_000; // 30 min

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: ANTHROPIC_TIMEOUT_MS,
});

// Modelos configurables vía .env (con defaults sensatos).
// ANTHROPIC_MODEL        -> agente principal (/api/query, compras)
// ANTHROPIC_MODEL_FAST   -> WhatsApp (prioriza velocidad/costo)
// ANTHROPIC_MODEL_CHEAP  -> tareas internas (razonador causal, prompts proactivos)
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
export const ANTHROPIC_MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || 'claude-sonnet-5';
export const ANTHROPIC_MODEL_CHEAP = process.env.ANTHROPIC_MODEL_CHEAP || 'claude-haiku-4-5-20251001';

/**
 * Extrae el TEXTO de una respuesta de Anthropic de forma robusta.
 *
 * Los modelos con "extended thinking" (Opus 5, etc.) devuelven un bloque de tipo
 * `thinking` ANTES del `text`, así que `content[0].text` viene VACÍO y rompía la
 * narración (salía "No pude generar los hallazgos", respuestas vacías, etc.).
 * Busca el primer bloque de tipo 'text' en lugar de asumir la posición 0.
 */
export function anthropicText(response: { content?: Array<{ type?: string; text?: string }> } | null | undefined): string {
    const block = response?.content?.find((c) => c?.type === 'text');
    return block?.text ?? '';
}

/**
 * Para tareas rápidas (narración de WhatsApp, hallazgos, correcciones de SQL) no
 * necesitamos el razonamiento extendido: agrega latencia y costo, y mete un
 * bloque `thinking` en la respuesta. Se pasa como parte de los params de
 * messages.create. Cast a any porque los tipos del SDK varían entre versiones.
 */
export const NO_THINKING = { thinking: { type: 'disabled' } } as any;
