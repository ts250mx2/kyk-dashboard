'use client';

import { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineMarkdown } from '@/components/inline-markdown';
import { getStoredModel } from '@/lib/chat-models';

export interface PageSummaryContext {
    pageContext: string;
    period: { fechaInicio: string; fechaFin: string };
    scope: string;
    kpis: Record<string, any>;
    highlights?: {
        topStores?: Array<{ name: string; value: number }>;
        topItems?: Array<{ name: string; value: number }>;
        anomalies?: string[];
    };
}

interface NarrativeSummaryProps {
    context: PageSummaryContext;
    /** Si true, regenera el resumen cuando context cambie. Default true (con debounce) */
    autoRefresh?: boolean;
}

interface SummaryResponse {
    summary: string;
    tone: 'positive' | 'attention' | 'neutral';
}

const TONE_STYLES: Record<SummaryResponse['tone'], { bar: string; icon: any; iconColor: string; label: string }> = {
    positive: { bar: 'bg-emerald-500', icon: TrendingUp, iconColor: 'text-emerald-500', label: 'Positivo' },
    attention: { bar: 'bg-amber-500', icon: AlertTriangle, iconColor: 'text-amber-500', label: 'Atención' },
    neutral: { bar: 'bg-[#4050B4]', icon: Sparkles, iconColor: 'text-[#4050B4]', label: 'Resumen' }
};

/**
 * Hash determinístico de un objeto, para detectar cambios en el context.
 * No es criptográfico, solo para invalidar cache.
 */
function hashContext(ctx: PageSummaryContext): string {
    const parts = [
        ctx.period.fechaInicio,
        ctx.period.fechaFin,
        ctx.scope,
        JSON.stringify(ctx.kpis)
    ];
    return parts.join('|');
}

export function NarrativeSummary({ context, autoRefresh = true }: NarrativeSummaryProps) {
    const [data, setData] = useState<SummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastHash, setLastHash] = useState<string>('');

    useEffect(() => {
        const currentHash = hashContext(context);
        // Skip si el contexto no cambió de verdad
        if (currentHash === lastHash) return;
        if (!autoRefresh && data) return;

        // Skip si no hay KPIs todavía (cargando)
        const hasKpis = Object.values(context.kpis || {}).some(v => typeof v === 'number' && v > 0);
        if (!hasKpis) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        // Debounce: 400ms para no martillar al endpoint si el usuario cambia filtros rápido
        const timeoutId = setTimeout(async () => {
            setLoading(true);
            try {
                const r = await fetch('/api/agent/page-summary', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Hereda el modelo elegido en el chat (lo lee fresco en cada fetch).
                    body: JSON.stringify({ ...context, model: getStoredModel() })
                });
                const json = await r.json();
                if (!cancelled && r.ok && json.summary) {
                    setData(json);
                    setLastHash(currentHash);
                }
            } catch (e) {
                console.error('Error cargando resumen narrativo:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [context, autoRefresh, lastHash, data]);

    const refresh = () => {
        setLastHash(''); // fuerza regenerar
    };

    if (loading && !data) {
        return (
            <div className="bg-white border border-slate-200 shadow-sm flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="w-1 h-8 bg-slate-200" />
                <div className="flex-1">
                    <div className="h-3 bg-slate-200 w-1/4 mb-1.5" />
                    <div className="h-3 bg-slate-100 w-full" />
                </div>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const style = TONE_STYLES[data.tone];
    const Icon = style.icon;

    return (
        <div className="relative bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", style.bar)} />
            <div className="pl-5 pr-4 py-3.5 flex items-start gap-3">
                <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", style.iconColor)} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", style.iconColor)}>
                            {style.label}
                        </span>
                        <span className="text-[9px] text-slate-300">·</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Generado por Kesito
                        </span>
                    </div>
                    <InlineMarkdown
                        text={data.summary}
                        className="text-[13px] leading-relaxed text-slate-700 font-medium"
                    />
                </div>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="flex-shrink-0 p-1.5 hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    title="Regenerar resumen"
                >
                    <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                </button>
            </div>
        </div>
    );
}
