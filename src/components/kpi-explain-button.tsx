'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Loader2, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineMarkdown } from '@/components/inline-markdown';
import { ModelPicker } from '@/components/model-picker';
import { getStoredModel } from '@/lib/chat-models';

export interface ExplainKpiContext {
    kpiName: string;
    value: number;
    format?: 'currency' | 'number' | 'percent';
    period: { fechaInicio: string; fechaFin: string };
    filters?: { storeIds?: string[]; storeNames?: string[] };
    comparison?: { label: string; previousValue: number; deltaPct: number };
    pageContext?: string;
    relatedKpis?: Record<string, number>;
}

interface ExplainResult {
    explanation: string;
    bullets?: string[];
    followUpQuestions?: string[];
    enrichedWithQuery?: boolean;
}

interface KpiExplainButtonProps {
    context: ExplainKpiContext;
    variant?: 'subtle' | 'pill';
}

/**
 * Botón "Explícame" para KPIs.
 * El popup se renderiza con Portal a document.body para evitar problemas
 * cuando el botón está dentro de otro <button> (caso común en cards clickeables).
 */
export function KpiExplainButton({ context, variant = 'subtle' }: KpiExplainButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ExplainResult | null>(null);
    const [model, setModel] = useState(getStoredModel());
    const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Calcular posición del popup cuando se abre
    useLayoutEffect(() => {
        if (!isOpen || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const popupWidth = 360;
        const popupHeight = 400; // estimación máxima
        const padding = 12;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = rect.left;
        let top = rect.bottom + 8;

        // Ajustar si se sale por la derecha
        if (left + popupWidth > viewportWidth - padding) {
            left = Math.max(padding, viewportWidth - popupWidth - padding);
        }
        // Si se sale por abajo, ponerlo arriba
        if (top + popupHeight > viewportHeight - padding) {
            top = Math.max(padding, rect.top - popupHeight - 8);
        }

        setPopupPos({ top, left });
    }, [isOpen]);

    // Cerrar al hacer click fuera
    useEffect(() => {
        if (!isOpen) return;
        function handleOutside(e: MouseEvent) {
            if (
                popupRef.current && !popupRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        }
        function handleEsc(e: KeyboardEvent) {
            if (e.key === 'Escape') setIsOpen(false);
        }
        // Delay para evitar que el mismo click que abre cierre el popup
        const t = setTimeout(() => {
            document.addEventListener('mousedown', handleOutside);
            document.addEventListener('keydown', handleEsc);
        }, 50);
        return () => {
            clearTimeout(t);
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen]);

    const runExplain = async (useModel: string) => {
        setLoading(true);
        setError(null);
        try {
            const r = await fetch('/api/agent/explain-kpi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...context, model: useModel })
            });
            const data = await r.json();
            if (!r.ok) {
                setError(data.error || 'Error generando explicación');
                return;
            }
            setResult(data);
        } catch (e: any) {
            setError(e?.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleTriggerClick = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        if (isOpen) {
            setIsOpen(false);
            return;
        }
        setIsOpen(true);
        if (result) return;
        // Hereda el modelo del chat al abrir.
        const m = getStoredModel();
        setModel(m);
        runExplain(m);
    };

    /** Cambia el modelo solo para esta explicación y la regenera. */
    const handleModelChange = (m: string) => {
        setModel(m);
        setResult(null);
        runExplain(m);
    };

    return (
        <>
            <span
                ref={triggerRef}
                role="button"
                tabIndex={0}
                onClick={handleTriggerClick}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTriggerClick(e);
                    }
                }}
                className={cn(
                    "cursor-pointer select-none",
                    variant === 'subtle'
                        ? "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-[#4050B4] transition-colors"
                        : "inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#4050B4] bg-[#4050B4]/5 hover:bg-[#4050B4]/15 transition-colors"
                )}
                title="Explica este KPI con análisis del agente"
            >
                <Sparkles className="w-3 h-3" />
                Explícame
            </span>

            {/* Popup renderizado en body via Portal para evitar problemas de nested buttons */}
            {mounted && isOpen && popupPos && createPortal(
                <div
                    ref={popupRef}
                    style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, width: 360 }}
                    className="z-[9999] bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-[#4050B4]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                                {context.kpiName}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <ModelPicker value={model} onChange={handleModelChange} disabled={loading} />
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-0.5 hover:bg-slate-200 transition-colors text-slate-400"
                                aria-label="Cerrar"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 max-h-[400px] overflow-y-auto">
                        {loading && (
                            <div className="flex items-center gap-2 text-slate-500 py-2">
                                <Loader2 className="w-4 h-4 animate-spin text-[#4050B4]" />
                                <span className="text-xs font-medium">Analizando este KPI…</span>
                            </div>
                        )}

                        {error && !loading && (
                            <div className="flex items-start gap-2 text-rose-600 py-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span className="text-xs">{error}</span>
                            </div>
                        )}

                        {result && !loading && (
                            <div className="space-y-3">
                                <InlineMarkdown
                                    text={result.explanation}
                                    className="text-[13px] leading-relaxed text-slate-700"
                                />

                                {result.bullets && result.bullets.length > 0 && (
                                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                        {result.bullets.map((b, i) => (
                                            <div key={i} className="flex items-start gap-2 text-[12px] leading-snug">
                                                <span className="text-[#4050B4] mt-1 flex-shrink-0">•</span>
                                                <InlineMarkdown text={b} className="text-slate-600" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {result.enrichedWithQuery && (
                                    <div className="pt-2 border-t border-slate-100">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            ✓ Análisis enriquecido con datos en vivo
                                        </span>
                                    </div>
                                )}

                                {result.followUpQuestions && result.followUpQuestions.length > 0 && (
                                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                            Profundizar:
                                        </span>
                                        <div className="flex flex-col gap-1">
                                            {result.followUpQuestions.map((q, i) => (
                                                <a
                                                    key={i}
                                                    href={`/dashboard/chat?prompt=${encodeURIComponent(q)}`}
                                                    className="text-left text-[11px] font-medium text-[#4050B4] hover:text-[#34439A] hover:underline"
                                                >
                                                    → {q}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
