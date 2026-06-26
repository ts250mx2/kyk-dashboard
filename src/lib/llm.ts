/**
 * Despachador de modelos compartido. Toma un id de modelo (el que el usuario
 * eligió en el chat o en el dropdown de un análisis) y enruta la llamada al
 * proveedor correcto, devolviendo el texto. Centraliza la lógica que vive en
 * /api/query para que TODOS los análisis de las páginas puedan elegir modelo.
 *
 * Proveedores: Claude → Anthropic, gpt/o → OpenAI, glm → Z.ai, kimi → Moonshot.
 */
import { anthropic, ANTHROPIC_MODEL } from './anthropic';
import { openai, glm, GLM_MODEL, kimi, KIMI_MODEL } from './ai';

export const ALLOWED_ANTHROPIC_MODELS = new Set([
    'claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
]);
export const ALLOWED_OPENAI_MODELS = new Set([
    'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-5', 'gpt-5-mini', 'gpt-5.5',
]);

export type CompatProvider = 'anthropic' | 'openai' | 'glm' | 'kimi';

export interface ResolvedModel {
    provider: CompatProvider;
    model: string;
}

/**
 * Resuelve un id pedido por el cliente a (proveedor, modelo real). Si el id no
 * se reconoce, cae al `fallback`. El fallback se resuelve también, con un
 * cortafuegos para no entrar en recursión infinita.
 */
export function resolveModel(requested?: string, fallback: string = ANTHROPIC_MODEL): ResolvedModel {
    const req = (requested || '').trim();
    const m = req.toLowerCase();

    if (req) {
        if (m.includes('glm')) return { provider: 'glm', model: m === 'glm' ? GLM_MODEL : req };
        if (m.includes('kimi') || m.includes('moonshot')) {
            return { provider: 'kimi', model: m === 'kimi' ? KIMI_MODEL : req };
        }
        if (m.includes('claude')) {
            return { provider: 'anthropic', model: ALLOWED_ANTHROPIC_MODELS.has(req) ? req : ANTHROPIC_MODEL };
        }
        if (ALLOWED_OPENAI_MODELS.has(req)) return { provider: 'openai', model: req };
    }

    // id vacío o desconocido → fallback (sin recursión infinita)
    if (!fallback || fallback === requested) return { provider: 'anthropic', model: ANTHROPIC_MODEL };
    return resolveModel(fallback, fallback);
}

export interface GenerateTextOpts {
    /** Modelo pedido por el cliente (puede venir undefined → usa fallback). */
    model?: string;
    /** Modelo por defecto si el pedido no se reconoce. */
    fallback?: string;
    system?: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
}

export interface GenerateTextResult {
    text: string;
    /** Modelo REAL que respondió (no necesariamente el pedido). */
    model: string;
    provider: CompatProvider;
}

/** ¿El modelo razona "consumiendo" tokens de salida? (necesita headroom). */
function isReasoningModel(provider: CompatProvider, model: string): boolean {
    if (provider === 'openai') return /^(gpt-5|o\d)/i.test(model);
    if (provider === 'glm') return /(^|[^a-z])glm-5/i.test(model); // glm-5, glm-5.2, …
    return false;
}

/**
 * Genera texto con el modelo elegido. Abstrae las diferencias entre proveedores
 * (Anthropic usa `system` aparte y `max_tokens`; los compatibles-OpenAI usan
 * mensajes con rol system; los de razonamiento necesitan headroom de tokens y,
 * en OpenAI, `max_completion_tokens` sin `temperature`).
 */
export async function generateText(opts: GenerateTextOpts): Promise<GenerateTextResult> {
    const { model, fallback = ANTHROPIC_MODEL, system, prompt, maxTokens = 2048, temperature } = opts;
    const { provider, model: resolved } = resolveModel(model, fallback);

    if (provider === 'anthropic') {
        const resp = await anthropic.messages.create({
            model: resolved,
            max_tokens: maxTokens,
            ...(system ? { system } : {}),
            messages: [{ role: 'user', content: prompt }],
        });
        const text = (resp.content.find((c: any) => c.type === 'text') as any)?.text || '';
        return { text, model: resolved, provider };
    }

    const client = provider === 'glm' ? glm : provider === 'kimi' ? kimi : openai;
    const reasoning = isReasoningModel(provider, resolved);
    const isOpenAIReasoning = provider === 'openai' && reasoning;
    // Los razonadores gastan tokens "pensando"; dejamos headroom para que la
    // respuesta real no salga vacía/truncada.
    const tokens = maxTokens + (reasoning ? 4000 : 0);

    const params: Record<string, any> = {
        model: resolved,
        messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt },
        ],
    };
    if (provider === 'openai') {
        params.max_completion_tokens = tokens;
        if (!isOpenAIReasoning && temperature !== undefined) params.temperature = temperature;
    } else {
        // glm / kimi: aceptan max_tokens y temperature normales
        params.max_tokens = tokens;
        if (temperature !== undefined) params.temperature = temperature;
    }

    const resp = await client.chat.completions.create(params as any);
    const text = resp.choices[0]?.message?.content || '';
    return { text, model: resolved, provider };
}
