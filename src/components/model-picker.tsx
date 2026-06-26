'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHAT_MODELS } from '@/lib/chat-models';

/**
 * Selector de modelo compacto y reutilizable. Se usa en el header de cada modal
 * de análisis para sobreescribir, solo en ese análisis, el modelo heredado del
 * chat. El estado lo maneja el padre (que lo inicializa con getStoredModel()).
 */
export function ModelPicker({
    value,
    onChange,
    disabled,
    className,
    title = 'Modelo de IA para este análisis',
}: {
    value: string;
    onChange: (model: string) => void;
    disabled?: boolean;
    className?: string;
    title?: string;
}) {
    return (
        <div className={cn('inline-flex items-center gap-1', className)}>
            <Sparkles size={12} className="text-[#4050B4] shrink-0" />
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                title={title}
                className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1 outline-none hover:bg-slate-100 focus:border-[#4050B4]/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {CHAT_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                ))}
            </select>
        </div>
    );
}
