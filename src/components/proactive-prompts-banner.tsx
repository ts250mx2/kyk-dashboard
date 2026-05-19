'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, X, Search, AlertCircle, TrendingUp, Sparkles, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProactivePromptSummary {
    id: string;
    message: string;
    context: string | null;
    suggestedAction: string;
    severity: 'critical' | 'opportunity' | 'info';
}

interface ProactivePromptsBannerProps {
    /** Cuando el usuario acepta investigar, lanza el chat con esta pregunta */
    onInvestigate: (suggestedAction: string) => void;
    /** Trigger externo para refrescar (después de generar nuevos prompts) */
    refreshKey?: number;
    /** Si true, muestra el banner. Default true (chat embedded) o false (widget) */
    enabled?: boolean;
}

const SEVERITY_STYLES: Record<ProactivePromptSummary['severity'], {
    bar: string;
    icon: any;
    iconColor: string;
    chip: string;
    label: string;
}> = {
    critical: {
        bar: 'bg-rose-500',
        icon: AlertCircle,
        iconColor: 'text-rose-500',
        chip: 'bg-rose-50 text-rose-700 border-rose-200',
        label: 'Crítico'
    },
    opportunity: {
        bar: 'bg-emerald-500',
        icon: TrendingUp,
        iconColor: 'text-emerald-500',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        label: 'Oportunidad'
    },
    info: {
        bar: 'bg-indigo-400',
        icon: Sparkles,
        iconColor: 'text-indigo-500',
        chip: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        label: 'Insight'
    }
};

export function ProactivePromptsBanner({ onInvestigate, refreshKey, enabled = true }: ProactivePromptsBannerProps) {
    const [prompts, setPrompts] = useState<ProactivePromptSummary[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [resolving, setResolving] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    const fetchPrompts = useCallback(async () => {
        try {
            const r = await fetch('/api/agent/proactive-prompts');
            const data = await r.json();
            if (Array.isArray(data.prompts)) {
                setPrompts(data.prompts);
                setCurrentIdx(0);
            }
        } catch (e) {
            console.error('Error cargando prompts proactivos:', e);
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        fetchPrompts();
    }, [enabled, fetchPrompts]);

    useEffect(() => {
        if (refreshKey && enabled) fetchPrompts();
    }, [refreshKey, enabled, fetchPrompts]);

    const resolveCurrent = async (status: 'accepted' | 'dismissed') => {
        const current = prompts[currentIdx];
        if (!current) return;

        setResolving(current.id);
        try {
            await fetch('/api/agent/proactive-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resolve', id: current.id, status })
            });

            // Remover de la lista local
            const remaining = prompts.filter(p => p.id !== current.id);
            setPrompts(remaining);
            setCurrentIdx(Math.min(currentIdx, remaining.length - 1));

            if (status === 'accepted') {
                onInvestigate(current.suggestedAction);
            }
        } catch (e) {
            console.error('Error resolviendo prompt:', e);
        } finally {
            setResolving(null);
        }
    };

    if (!enabled || !loaded || prompts.length === 0) return null;

    const current = prompts[currentIdx];
    if (!current) return null;

    const style = SEVERITY_STYLES[current.severity];
    const Icon = style.icon;

    return (
        <div className="relative bg-white border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", style.bar)} />

            <div className="pl-5 pr-3 py-3.5">
                {/* Top row: ícono + chip + paginación */}
                <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <MessageCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Kesito te quiere preguntar
                        </span>
                        <span className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border rounded-none",
                            style.chip
                        )}>
                            <Icon className={cn("w-2.5 h-2.5", style.iconColor)} />
                            {style.label}
                        </span>
                    </div>
                    {prompts.length > 1 && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                                onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                                disabled={currentIdx === 0}
                                className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded text-slate-400"
                            >
                                <ChevronLeft className="w-3 h-3" />
                            </button>
                            <span className="text-[9px] font-bold text-slate-400 tabular-nums">
                                {currentIdx + 1}/{prompts.length}
                            </span>
                            <button
                                onClick={() => setCurrentIdx(Math.min(prompts.length - 1, currentIdx + 1))}
                                disabled={currentIdx >= prompts.length - 1}
                                className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded text-slate-400"
                            >
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Mensaje */}
                <p className="text-[13.5px] leading-relaxed text-slate-700 font-medium mb-1">
                    {current.message}
                </p>

                {/* Contexto opcional */}
                {current.context && (
                    <p className="text-[12px] leading-relaxed text-slate-500 mb-2">
                        {current.context}
                    </p>
                )}

                {/* Acciones */}
                <div className="flex items-center gap-2 mt-3">
                    <button
                        onClick={() => resolveCurrent('accepted')}
                        disabled={resolving === current.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-none bg-[#4050B4] hover:bg-[#34439A] text-white transition-colors active:scale-95 disabled:opacity-50"
                    >
                        {resolving === current.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Search className="w-3 h-3" />
                        )}
                        Investigar
                    </button>
                    <button
                        onClick={() => resolveCurrent('dismissed')}
                        disabled={resolving === current.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-none bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50"
                    >
                        <X className="w-3 h-3" />
                        Descartar
                    </button>
                </div>
            </div>
        </div>
    );
}
