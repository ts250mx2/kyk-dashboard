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

// GLM (Zhipu AI / Z.ai) expone una API compatible con OpenAI, así que reusamos
// el mismo SDK apuntando a su baseURL. Default: gateway internacional Z.ai;
// configurable vía GLM_BASE_URL (p. ej. https://open.bigmodel.cn/api/paas/v4).
export const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://api.z.ai/api/paas/v4';
export const GLM_MODEL = process.env.GLM_MODEL || 'glm-4.6';

export const glm = new OpenAI({
    apiKey: process.env.GLM_API_KEY,
    baseURL: GLM_BASE_URL,
    timeout: OPENAI_TIMEOUT_MS,
});

// Kimi (Moonshot AI) también expone una API compatible con OpenAI. Default:
// gateway internacional; configurable vía KIMI_BASE_URL (China:
// https://api.moonshot.cn/v1).
export const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';
export const KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-k2-0711-preview';

export const kimi = new OpenAI({
    apiKey: process.env.KIMI_API_KEY,
    baseURL: KIMI_BASE_URL,
    timeout: OPENAI_TIMEOUT_MS,
});
