import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Modelos configurables vía .env (con defaults sensatos).
// ANTHROPIC_MODEL        -> agente principal (/api/query, compras)
// ANTHROPIC_MODEL_FAST   -> WhatsApp (prioriza velocidad/costo)
// ANTHROPIC_MODEL_CHEAP  -> tareas internas (razonador causal, prompts proactivos)
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
export const ANTHROPIC_MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || 'claude-sonnet-4-6';
export const ANTHROPIC_MODEL_CHEAP = process.env.ANTHROPIC_MODEL_CHEAP || 'claude-haiku-4-5-20251001';
