'use client';

import { useEffect, useState } from 'react';
import {
    X, Loader2, Sparkles, TrendingUp, Lightbulb, AlertTriangle, Target, FileText, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineMarkdown } from '@/components/inline-markdown';
import type { PageSummaryContext } from '@/components/narrative-summary';

interface DeepSummaryModalProps {
    open: boolean;
    onClose: () => void;
    context: PageSummaryContext;
}

interface DeepSummary {
    executiveSummary: string;
    keyInsights: string[];
    opportunities: string[];
    risks: string[];
    recommendedActions: string[];
}

export function DeepSummaryModal({ open, onClose, context }: DeepSummaryModalProps) {
    const [data, setData] = useState<DeepSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await fetch('/api/agent/deep-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(context)
            });
            const json = await r.json();
            if (!r.ok) throw new Error(json.error || 'Error generando análisis');
            setData(json);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && !data && !loading) {
            load();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Cerrar con ESC
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#4050B4]/5 via-white to-white flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#4050B4]/10 text-[#4050B4] flex items-center justify-center shrink-0">
                            <Sparkles size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900">Análisis Profundo IA</h2>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                {context.pageContext} · {context.scope} · {context.period.fechaInicio} → {context.period.fechaFin}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={load}
                            disabled={loading}
                            className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40"
                            title="Regenerar análisis"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                            title="Cerrar (ESC)"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {loading && !data && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Loader2 className="w-7 h-7 animate-spin text-[#4050B4] mb-3" />
                            <span className="text-xs font-bold uppercase tracking-wider">Generando análisis profundo...</span>
                            <span className="text-[10px] text-slate-400 mt-1">Esto puede tardar 5-10 segundos</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-md">
                            Error: {error}
                        </div>
                    )}

                    {data && (
                        <div className="space-y-5">
                            {/* Executive Summary */}
                            {data.executiveSummary && (
                                <Section
                                    icon={<FileText size={14} />}
                                    title="Resumen Ejecutivo"
                                    accent="slate"
                                >
                                    <p className="text-sm text-slate-700 leading-relaxed">
                                        <InlineMarkdown text={data.executiveSummary} />
                                    </p>
                                </Section>
                            )}

                            {/* Key Insights */}
                            {data.keyInsights.length > 0 && (
                                <Section
                                    icon={<Lightbulb size={14} />}
                                    title="Hallazgos Clave"
                                    accent="amber"
                                >
                                    <BulletList items={data.keyInsights} bulletColor="bg-amber-400" />
                                </Section>
                            )}

                            {/* Opportunities */}
                            {data.opportunities.length > 0 && (
                                <Section
                                    icon={<TrendingUp size={14} />}
                                    title="Oportunidades"
                                    accent="emerald"
                                >
                                    <BulletList items={data.opportunities} bulletColor="bg-emerald-500" />
                                </Section>
                            )}

                            {/* Risks */}
                            {data.risks.length > 0 && (
                                <Section
                                    icon={<AlertTriangle size={14} />}
                                    title="Riesgos / Alertas"
                                    accent="rose"
                                >
                                    <BulletList items={data.risks} bulletColor="bg-rose-500" />
                                </Section>
                            )}

                            {/* Recommended Actions */}
                            {data.recommendedActions.length > 0 && (
                                <Section
                                    icon={<Target size={14} />}
                                    title="Acciones Recomendadas"
                                    accent="indigo"
                                >
                                    <BulletList items={data.recommendedActions} bulletColor="bg-[#4050B4]" />
                                </Section>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 font-medium flex items-center justify-between">
                    <span>Generado por Kesito IA</span>
                    <button
                        onClick={onClose}
                        className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

function Section({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: 'slate' | 'amber' | 'emerald' | 'rose' | 'indigo'; children: React.ReactNode }) {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
        slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
        amber: { bg: 'bg-amber-50/60', text: 'text-amber-700', border: 'border-amber-200' },
        emerald: { bg: 'bg-emerald-50/60', text: 'text-emerald-700', border: 'border-emerald-200' },
        rose: { bg: 'bg-rose-50/60', text: 'text-rose-700', border: 'border-rose-200' },
        indigo: { bg: 'bg-[#4050B4]/5', text: 'text-[#4050B4]', border: 'border-[#4050B4]/20' }
    };
    return (
        <div className={cn('border rounded-lg p-4', colors[accent].bg, colors[accent].border)}>
            <h3 className={cn('text-[11px] font-black uppercase tracking-widest flex items-center gap-2 mb-3', colors[accent].text)}>
                {icon}
                {title}
            </h3>
            {children}
        </div>
    );
}

function BulletList({ items, bulletColor }: { items: string[]; bulletColor: string }) {
    return (
        <ul className="space-y-2">
            {items.map((item, i) => (
                <li key={i} className="text-sm text-slate-700 leading-relaxed flex items-start gap-2.5">
                    <span className={cn('inline-block w-1.5 h-1.5 rounded-full mt-2 shrink-0', bulletColor)} />
                    <span><InlineMarkdown text={item} /></span>
                </li>
            ))}
        </ul>
    );
}
