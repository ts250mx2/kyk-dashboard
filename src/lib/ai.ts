import OpenAI from 'openai';

// Mismo timeout que el cliente Anthropic, para que las respuestas del agente
// con modelos OpenAI (agente avanzado) no se corten antes. Default 30 min,
// configurable vía OPENAI_TIMEOUT_MS o ANTHROPIC_TIMEOUT_MS.
const OPENAI_TIMEOUT_MS =
    Number(process.env.OPENAI_TIMEOUT_MS) ||
    Number(process.env.ANTHROPIC_TIMEOUT_MS) ||
    1_800_000; // 30 min

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: OPENAI_TIMEOUT_MS,
});
