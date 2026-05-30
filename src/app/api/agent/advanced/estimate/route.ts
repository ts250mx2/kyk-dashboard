import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import {
    ADVANCED_TOOLS,
    buildAdvancedSystemPrompt,
    getAdvancedSchemaString,
} from '@/lib/advanced-reports/tools';
import { getModel } from '@/lib/advanced-reports/models';
import { estimatePipelineCost, USD_MXN_RATE } from '@/lib/pricing';

export const runtime = 'nodejs';

interface Turn {
    role: 'user' | 'assistant';
    content: string;
}

function buildMessages(prompt: string, history: unknown): Array<{ role: 'user' | 'assistant'; content: string }> {
    const cleaned = (Array.isArray(history) ? (history as Turn[]) : [])
        .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
        .map((t) => ({ role: t.role, content: t.content.length > 4000 ? t.content.slice(0, 4000) + '…' : t.content }));
    while (cleaned.length > 0 && cleaned[0].role !== 'user') cleaned.shift();
    return [...cleaned, { role: 'user' as const, content: prompt }];
}

/**
 * POST /api/agent/advanced/estimate
 * Estima el costo del pipeline para el MODELO elegido. En Anthropic cuenta los
 * tokens de entrada exactos (countTokens); en OpenAI usa heurística (~4 chars/token).
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const prompt = String(body?.prompt || '').trim();
        if (!prompt) return NextResponse.json({ error: 'Falta el prompt' }, { status: 400 });

        const model = getModel(body?.model);
        const messages = buildMessages(prompt, body?.history);
        const system = buildAdvancedSystemPrompt(getAdvancedSchemaString());

        let inputBase = 0;
        if (model.provider === 'anthropic') {
            try {
                const counted = await anthropic.messages.countTokens({
                    model: model.id,
                    system,
                    messages: messages as any,
                    tools: ADVANCED_TOOLS as any,
                });
                inputBase = counted.input_tokens;
            } catch {
                const approxChars = system.length + messages.reduce((a, m) => a + m.content.length, 0);
                inputBase = Math.round(approxChars / 4);
            }
        } else {
            // OpenAI: no hay countTokens en este SDK → heurística ~4 caracteres/token
            const approxChars = system.length + messages.reduce((a, m) => a + m.content.length, 0);
            inputBase = Math.round(approxChars / 4);
        }

        const est = estimatePipelineCost(inputBase, model.inputUsdPerMTok, model.outputUsdPerMTok);
        return NextResponse.json({
            model: model.id,
            modelLabel: model.label,
            provider: model.provider,
            inputBaseTokens: inputBase,
            estTokensInput: est.inputTokens,
            estTokensOutput: est.outputTokens,
            estCostUsd: est.costUsd,
            estCostMxn: est.costMxn,
            usdMxnRate: USD_MXN_RATE,
            turns: est.turns,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Error estimando costo' }, { status: 500 });
    }
}
