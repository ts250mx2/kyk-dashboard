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
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
export const ANTHROPIC_MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || 'claude-sonnet-4-6';
export const ANTHROPIC_MODEL_CHEAP = process.env.ANTHROPIC_MODEL_CHEAP || 'claude-haiku-4-5-20251001';
