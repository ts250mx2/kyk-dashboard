'use client';

import { useState, useEffect, useRef } from 'react';
import { BookMarked, Plus, Play, Trash2, Loader2, X, Edit2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlaybookStep {
    prompt: string;
    label?: string;
}

export interface PlaybookSummary {
    id: string;
    name: string;
    description: string | null;
    steps: PlaybookStep[];
    createdAt: string;
    lastUsedAt: string | null;
    runCount: number;
}

interface PlaybooksPanelProps {
    /** Returns lista de prompts del chat actual para el modal de "guardar como playbook" */
    getCurrentChatPrompts?: () => string[];
    /** Cuando el usuario quiere ejecutar un playbook desde el chat */
    onRunPlaybook?: (playbook: PlaybookSummary) => void;
    /** Trigger externo de refresh (cuando se crea uno nuevo desde el chat) */
    refreshKey?: number;
    /** Mostrar solo el icono (sin label) — para headers compactos */
    compact?: boolean;
}

function formatRelative(iso: string): string {
    try {
        const d = new Date(iso);
        const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
        if (diffMin < 1) return 'Ahora';
        if (diffMin < 60) return `Hace ${diffMin}m`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `Hace ${diffHr}h`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7) return `Hace ${diffDay}d`;
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    } catch { return ''; }
}

export function PlaybooksPanel({ getCurrentChatPrompts, onRunPlaybook, refreshKey, compact = false }: PlaybooksPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [draft, setDraft] = useState<{ name: string; description: string; steps: string[] } | null>(null);
    const [saving, setSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchList = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/agent/playbooks');
            const data = await r.json();
            if (Array.isArray(data.playbooks)) setPlaybooks(data.playbooks);
        } catch (e) {
            console.error('Error cargando playbooks:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (isOpen) fetchList(); }, [isOpen]);
    useEffect(() => { if (refreshKey && isOpen) fetchList(); }, [refreshKey, isOpen]);

    useEffect(() => {
        function handleOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowCreate(false);
            }
        }
        if (isOpen) document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isOpen]);

    const startCreateFromChat = () => {
        const prompts = getCurrentChatPrompts?.() || [];
        setDraft({
            name: '',
            description: '',
            steps: prompts.length > 0 ? prompts.slice(0, 10) : ['']
        });
        setShowCreate(true);
    };

    const saveDraft = async () => {
        if (!draft) return;
        const validSteps = draft.steps.filter(s => s.trim());
        if (!draft.name.trim() || validSteps.length === 0) {
            alert('Nombre y al menos un paso son requeridos');
            return;
        }
        setSaving(true);
        try {
            const r = await fetch('/api/agent/playbooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: draft.name,
                    description: draft.description || null,
                    steps: validSteps.map(s => ({ prompt: s }))
                })
            });
            const data = await r.json();
            if (r.ok) {
                setShowCreate(false);
                setDraft(null);
                await fetchList();
            } else {
                alert(data.error || 'Error creando playbook');
            }
        } catch (e: any) {
            alert(e?.message || 'Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    const deletePb = async (id: string) => {
        if (!confirm('¿Eliminar este playbook?')) return;
        try {
            await fetch(`/api/agent/playbooks/${id}`, { method: 'DELETE' });
            setPlaybooks(prev => prev.filter(p => p.id !== id));
        } catch (e) {
            console.error('Error eliminando:', e);
        }
    };

    const runPb = async (pb: PlaybookSummary) => {
        setIsOpen(false);
        try {
            await fetch(`/api/agent/playbooks/${pb.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'record-run' })
            });
        } catch { }
        onRunPlaybook?.(pb);
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500",
                    compact ? "p-2" : "px-3 py-1.5"
                )}
                title="Playbooks guardados"
            >
                <BookMarked className="w-4 h-4" />
                {!compact && <span className="text-[11px] font-semibold">Playbooks</span>}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[400px] max-h-[560px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                    {showCreate && draft ? (
                        <CreateForm
                            draft={draft}
                            onChange={setDraft}
                            onCancel={() => { setShowCreate(false); setDraft(null); }}
                            onSave={saveDraft}
                            saving={saving}
                        />
                    ) : (
                        <>
                            <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    Tus Playbooks · {playbooks.length}
                                </span>
                                <button
                                    onClick={startCreateFromChat}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    <Plus className="w-3 h-3" />
                                    Nuevo
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {loading && playbooks.length === 0 ? (
                                    <div className="p-8 flex flex-col items-center gap-2 text-slate-400">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span className="text-[11px] font-medium">Cargando...</span>
                                    </div>
                                ) : playbooks.length === 0 ? (
                                    <div className="p-8 flex flex-col items-center gap-2 text-slate-400 text-center">
                                        <BookMarked className="w-8 h-8 opacity-40" />
                                        <span className="text-[12px] font-medium">No tienes playbooks todavía.</span>
                                        <span className="text-[10px]">
                                            Después de hacer varias preguntas, guárdalas como playbook
                                            para repetir el análisis con un solo click.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="py-1">
                                        {playbooks.map(pb => (
                                            <div key={pb.id} className="px-3 py-2.5 border-b border-slate-50 last:border-b-0 group hover:bg-slate-50/50">
                                                <div className="flex items-start gap-2">
                                                    <button
                                                        onClick={() => runPb(pb)}
                                                        className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors"
                                                        title="Ejecutar playbook"
                                                    >
                                                        <Play className="w-3.5 h-3.5" />
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-bold text-slate-800 leading-snug">
                                                            {pb.name}
                                                        </p>
                                                        {pb.description && (
                                                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                                                {pb.description}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                                {pb.steps.length} paso{pb.steps.length === 1 ? '' : 's'}
                                                            </span>
                                                            <span className="text-[9px] text-slate-300">·</span>
                                                            <span className="text-[9px] text-slate-400">
                                                                {pb.runCount} ejecuc.
                                                            </span>
                                                            {pb.lastUsedAt && (
                                                                <>
                                                                    <span className="text-[9px] text-slate-300">·</span>
                                                                    <span className="text-[9px] text-slate-400">
                                                                        {formatRelative(pb.lastUsedAt)}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => deletePb(pb.id)}
                                                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-100 rounded-lg transition-all text-rose-500"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function CreateForm({
    draft, onChange, onCancel, onSave, saving
}: {
    draft: { name: string; description: string; steps: string[] };
    onChange: (d: typeof draft) => void;
    onCancel: () => void;
    onSave: () => void;
    saving: boolean;
}) {
    const updateStep = (i: number, val: string) => {
        const next = [...draft.steps];
        next[i] = val;
        onChange({ ...draft, steps: next });
    };
    const addStep = () => onChange({ ...draft, steps: [...draft.steps, ''] });
    const removeStep = (i: number) => {
        if (draft.steps.length === 1) return;
        onChange({ ...draft, steps: draft.steps.filter((_, idx) => idx !== i) });
    };

    return (
        <div className="flex flex-col h-full max-h-[560px]">
            <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Nuevo Playbook
                </span>
                <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Nombre
                    </label>
                    <input
                        type="text"
                        value={draft.name}
                        onChange={e => onChange({ ...draft, name: e.target.value })}
                        placeholder="Ej: Revisión matutina"
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Descripción (opcional)
                    </label>
                    <input
                        type="text"
                        value={draft.description}
                        onChange={e => onChange({ ...draft, description: e.target.value })}
                        placeholder="Análisis que reviso cada mañana"
                        className="w-full px-3 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Pasos ({draft.steps.filter(s => s.trim()).length})
                        </label>
                        <button
                            onClick={addStep}
                            disabled={draft.steps.length >= 20}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-40"
                        >
                            <Plus className="w-3 h-3" /> Agregar paso
                        </button>
                    </div>
                    <div className="space-y-2">
                        {draft.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <span className="flex-shrink-0 mt-2.5 w-5 h-5 rounded bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center">
                                    {i + 1}
                                </span>
                                <textarea
                                    value={step}
                                    onChange={e => updateStep(i, e.target.value)}
                                    placeholder={`Pregunta ${i + 1}…`}
                                    rows={2}
                                    className="flex-1 px-2.5 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 resize-y"
                                />
                                {draft.steps.length > 1 && (
                                    <button
                                        onClick={() => removeStep(i)}
                                        className="flex-shrink-0 mt-2 p-1 hover:bg-rose-50 text-rose-500 rounded"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="px-3 py-2.5 border-t border-slate-100 flex gap-2">
                <button
                    onClick={onCancel}
                    className="flex-1 px-3 py-2 text-[12px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="flex-1 px-3 py-2 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Guardar
                </button>
            </div>
        </div>
    );
}
