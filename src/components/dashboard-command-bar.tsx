'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowRight, Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DashboardFilters {
    fechaInicio?: string;
    fechaFin?: string;
    storeIds?: string[];
    metric?: string;
    search?: string;
}

export interface AvailableStore {
    IdTienda: number | string;
    Tienda: string;
}

interface DashboardCommandBarProps {
    currentFilters: any;
    availableStores?: AvailableStore[];
    availableMetrics?: string[];
    onApplyUpdates: (updates: any) => void;
    /** Placeholder personalizable. */
    placeholder?: string;
    /** Sugerencias rápidas que se muestran como chips cuando el input está vacío */
    suggestions?: string[];
    /** Tipo de dashboard activo */
    dashboardType?: 'clients' | 'margins' | 'comparison';
}

type CommandStatus = 'idle' | 'thinking' | 'applied' | 'noop' | 'error';

export function DashboardCommandBar({
    currentFilters,
    availableStores = [],
    availableMetrics = ['contado', 'credito', 'publico', 'notas'],
    onApplyUpdates,
    placeholder = 'Pregúntale al dashboard…',
    suggestions = [],
    dashboardType = 'clients'
}: DashboardCommandBarProps) {
    const [prompt, setPrompt] = useState('');
    const [status, setStatus] = useState<CommandStatus>('idle');
    const [feedback, setFeedback] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Atajo: '/' enfoca la barra de comando (excepto cuando ya hay un input activo)
        const handler = (e: KeyboardEvent) => {
            if (e.key === '/' && e.target instanceof Element) {
                const tag = e.target.tagName.toLowerCase();
                if (tag !== 'input' && tag !== 'textarea') {
                    e.preventDefault();
                    inputRef.current?.focus();
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const submit = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || status === 'thinking') return;

        setStatus('thinking');
        setFeedback('');

        try {
            const r = await fetch('/api/agent/page-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: trimmed,
                    currentFilters,
                    availableMetrics,
                    availableStores,
                    dashboardType
                })
            });
            const data = await r.json();

            if (!r.ok) {
                setStatus('error');
                setFeedback(data.error || 'Error al procesar la pregunta');
                return;
            }

            if (data.action === 'update_filters' && data.updates && Object.keys(data.updates).length > 0) {
                onApplyUpdates(data.updates);
                setStatus('applied');
                setFeedback(data.message || 'Filtros aplicados');
                setPrompt('');
                setTimeout(() => setStatus('idle'), 2500);
            } else {
                // No es un cambio de filtro → es analítica. Mandamos directo a Kesito.
                window.dispatchEvent(new CustomEvent('kesito:ask', { detail: { prompt: trimmed } }));
                setStatus('idle');
                setFeedback('');
                setPrompt('');
            }
        } catch (e: any) {
            setStatus('error');
            setFeedback(e?.message || 'Error de conexión');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const isBusy = status === 'thinking';
    const hasFeedback = status === 'applied' || status === 'noop' || status === 'error';

    return (
        <div className="w-full">
            <div className={cn(
                "relative bg-white border transition-all flex items-center gap-2 px-4 py-2.5 shadow-sm",
                status === 'applied' && 'border-emerald-300 ring-2 ring-emerald-100',
                status === 'noop' && 'border-amber-300 ring-2 ring-amber-100',
                status === 'error' && 'border-rose-300 ring-2 ring-rose-100',
                (status === 'idle' || isBusy) && 'border-slate-200 focus-within:border-[#4050B4] focus-within:ring-2 focus-within:ring-[#4050B4]/15'
            )}>
                <div className={cn(
                    "flex-shrink-0",
                    isBusy ? 'text-[#4050B4]' : status === 'applied' ? 'text-emerald-500' :
                    status === 'noop' ? 'text-amber-500' : status === 'error' ? 'text-rose-500' : 'text-slate-400'
                )}>
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> :
                        status === 'applied' ? <Check className="w-4 h-4" /> :
                        status === 'noop' ? <AlertCircle className="w-4 h-4" /> :
                        status === 'error' ? <AlertCircle className="w-4 h-4" /> :
                        <Sparkles className="w-4 h-4" />}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') submit(prompt);
                    }}
                    placeholder={placeholder}
                    disabled={isBusy}
                    className="flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-50"
                />
                <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded">/</kbd>
                <button
                    onClick={() => submit(prompt)}
                    disabled={!prompt.trim() || isBusy}
                    className="flex items-center gap-1 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white bg-[#4050B4] hover:bg-[#34439A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-none"
                >
                    Preguntar
                    <ArrowRight className="w-3 h-3" />
                </button>
            </div>

            {/* Feedback bar (sólo applied / error, los noop van directo a Kesito) */}
            {hasFeedback && feedback && (
                <div className={cn(
                    "mt-2 px-3 py-1.5 text-[11px] font-medium animate-in fade-in slide-in-from-top-1 duration-200",
                    status === 'applied' && 'text-emerald-700 bg-emerald-50 border border-emerald-200',
                    status === 'error' && 'text-rose-800 bg-rose-50 border border-rose-200'
                )}>
                    {feedback}
                </div>
            )}

            {/* Sugerencias rápidas cuando está idle y vacío */}
            {status === 'idle' && !prompt && suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestions.slice(0, 5).map((s, i) => (
                        <button
                            key={i}
                            onClick={() => submit(s)}
                            className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-[#4050B4] hover:text-[#4050B4] transition-all uppercase tracking-wider rounded-none"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
