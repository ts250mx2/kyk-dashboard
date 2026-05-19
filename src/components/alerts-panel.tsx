'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellRing, Plus, X, Trash2, Loader2, Power } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertEvent {
    id: string;
    alertId: string;
    observedValue: number | null;
    message: string | null;
    triggeredAt: string;
    read: boolean;
    alertName?: string;
}

interface AlertRule {
    id: string;
    name: string;
    description: string | null;
    sql: string;
    conditionType: string;
    conditionValue: number | null;
    targetColumn: string | null;
    frequency: string;
    active: boolean;
    createdAt: string;
    lastEvaluatedAt: string | null;
}

interface AlertsPanelProps {
    /** Cuando el usuario quiere crear una alerta desde el chat actual */
    onCreateFromChat?: () => CreateAlertDraft | null;
    /** Trigger externo para refrescar la lista (cuando se crea una alerta nueva) */
    refreshKey?: number;
    /** Mostrar solo el icono (sin label) — para headers compactos */
    compact?: boolean;
}

export interface CreateAlertDraft {
    name: string;
    description?: string;
    sql: string;
    conditionType: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'has_rows';
    conditionValue?: number;
    targetColumn?: string;
    frequency: 'hourly' | 'daily' | 'weekly';
}

function formatRelative(iso: string): string {
    try {
        const d = new Date(iso);
        const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
        if (diffMin < 1) return 'Ahora';
        if (diffMin < 60) return `Hace ${diffMin} min`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `Hace ${diffHr}h`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7) return `Hace ${diffDay}d`;
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    } catch { return ''; }
}

const CONDITION_LABELS: Record<string, string> = {
    gt: '>', gte: '≥', lt: '<', lte: '≤',
    eq: '=', neq: '≠', has_rows: 'tiene resultados'
};

const FREQUENCY_LABELS: Record<string, string> = {
    hourly: 'Cada hora', daily: 'Diario', weekly: 'Semanal'
};

export function AlertsPanel({ onCreateFromChat, refreshKey, compact = false }: AlertsPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [tab, setTab] = useState<'events' | 'rules'>('events');
    const [events, setEvents] = useState<AlertEvent[]>([]);
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [draft, setDraft] = useState<CreateAlertDraft | null>(null);
    const [saving, setSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const r = await fetch('/api/agent/alerts/events?unread=true&limit=1');
            const d = await r.json();
            // Pedimos solo 1 pero el endpoint nos da el array completo de no leídos
            // Para contar bien hacemos otra llamada cuando se abra el panel
            setUnreadCount(Array.isArray(d.events) ? d.events.length : 0);
        } catch { }
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [eventsRes, rulesRes] = await Promise.all([
                fetch('/api/agent/alerts/events?limit=20').then(r => r.json()),
                fetch('/api/agent/alerts').then(r => r.json())
            ]);
            if (Array.isArray(eventsRes.events)) {
                setEvents(eventsRes.events);
                setUnreadCount(eventsRes.events.filter((e: AlertEvent) => !e.read).length);
            }
            if (Array.isArray(rulesRes.alerts)) {
                setRules(rulesRes.alerts);
            }
        } catch (e) {
            console.error('Error cargando panel de alertas:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Cargar conteo al inicio y cada 60s
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 60000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    useEffect(() => {
        if (isOpen) fetchAll();
    }, [isOpen, fetchAll]);

    useEffect(() => {
        if (refreshKey && isOpen) fetchAll();
    }, [refreshKey, isOpen, fetchAll]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowCreateForm(false);
            }
        }
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const markAllRead = async () => {
        try {
            await fetch('/api/agent/alerts/events', { method: 'POST' });
            setEvents(prev => prev.map(e => ({ ...e, read: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error('Error marcando como leídas:', e);
        }
    };

    const toggleRule = async (id: string, active: boolean) => {
        try {
            await fetch(`/api/agent/alerts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !active })
            });
            setRules(prev => prev.map(r => r.id === id ? { ...r, active: !active } : r));
        } catch (e) {
            console.error('Error toggle alerta:', e);
        }
    };

    const deleteRule = async (id: string) => {
        if (!confirm('¿Eliminar esta alerta? No se puede deshacer.')) return;
        try {
            await fetch(`/api/agent/alerts/${id}`, { method: 'DELETE' });
            setRules(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            console.error('Error eliminando alerta:', e);
        }
    };

    const openCreateForm = () => {
        // Si tenemos contexto del chat actual, lo usamos
        const fromChat = onCreateFromChat?.() ?? null;
        setDraft(fromChat || {
            name: '',
            sql: 'SELECT COUNT(*) AS Total FROM Ventas WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)',
            conditionType: 'gt',
            conditionValue: 0,
            frequency: 'hourly'
        });
        setShowCreateForm(true);
    };

    const saveDraft = async () => {
        if (!draft || !draft.name.trim() || !draft.sql.trim()) {
            alert('Nombre y SQL son requeridos');
            return;
        }
        setSaving(true);
        try {
            const r = await fetch('/api/agent/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft)
            });
            const data = await r.json();
            if (r.ok) {
                setShowCreateForm(false);
                setDraft(null);
                await fetchAll();
            } else {
                alert(data.error || 'Error creando alerta');
            }
        } catch (e: any) {
            alert(e.message || 'Error creando alerta');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "relative flex items-center gap-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500",
                    compact ? "p-2" : "px-3 py-1.5"
                )}
                title="Alertas y bandeja"
            >
                {unreadCount > 0 ? (
                    <BellRing className="w-4 h-4 text-rose-500" />
                ) : (
                    <Bell className="w-4 h-4" />
                )}
                {!compact && <span className="text-[11px] font-semibold">Alertas</span>}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center bg-rose-500 text-white text-[9px] font-black rounded-full px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[420px] max-h-[600px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Tabs */}
                    <div className="flex items-center border-b border-slate-100">
                        <button
                            onClick={() => setTab('events')}
                            className={cn(
                                "flex-1 px-4 py-3 text-[11px] font-black uppercase tracking-[0.15em] transition-colors relative",
                                tab === 'events' ? 'text-indigo-700' : 'text-slate-400 hover:text-slate-600'
                            )}
                        >
                            Bandeja {unreadCount > 0 && <span className="ml-1 px-1.5 bg-rose-500 text-white rounded-full text-[9px]">{unreadCount}</span>}
                            {tab === 'events' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600" />}
                        </button>
                        <button
                            onClick={() => setTab('rules')}
                            className={cn(
                                "flex-1 px-4 py-3 text-[11px] font-black uppercase tracking-[0.15em] transition-colors relative",
                                tab === 'rules' ? 'text-indigo-700' : 'text-slate-400 hover:text-slate-600'
                            )}
                        >
                            Mis alertas
                            {tab === 'rules' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600" />}
                        </button>
                    </div>

                    {showCreateForm && draft ? (
                        <CreateAlertForm
                            draft={draft}
                            onChange={setDraft}
                            onCancel={() => { setShowCreateForm(false); setDraft(null); }}
                            onSave={saveDraft}
                            saving={saving}
                        />
                    ) : (
                        <div className="flex-1 overflow-y-auto">
                            {loading && events.length === 0 && rules.length === 0 ? (
                                <div className="p-8 flex flex-col items-center gap-2 text-slate-400">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="text-[11px] font-medium">Cargando...</span>
                                </div>
                            ) : tab === 'events' ? (
                                <EventsList events={events} onMarkAllRead={markAllRead} />
                            ) : (
                                <RulesList
                                    rules={rules}
                                    onToggle={toggleRule}
                                    onDelete={deleteRule}
                                    onNew={openCreateForm}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────

function EventsList({ events, onMarkAllRead }: { events: AlertEvent[]; onMarkAllRead: () => void }) {
    const unread = events.filter(e => !e.read);
    if (events.length === 0) {
        return (
            <div className="p-8 flex flex-col items-center gap-2 text-slate-400 text-center">
                <Bell className="w-8 h-8 opacity-40" />
                <span className="text-[12px] font-medium">No tienes alertas disparadas todavía.</span>
                <span className="text-[10px]">Cuando una de tus alertas se cumpla, aparecerá aquí.</span>
            </div>
        );
    }

    return (
        <div>
            {unread.length > 0 && (
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {unread.length} sin leer
                    </span>
                    <button
                        onClick={onMarkAllRead}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                    >
                        Marcar todas como leídas
                    </button>
                </div>
            )}
            <div className="py-1">
                {events.map(e => (
                    <div
                        key={e.id}
                        className={cn(
                            "px-3 py-2.5 flex items-start gap-3 border-b border-slate-50 last:border-b-0",
                            !e.read && "bg-rose-50/50"
                        )}
                    >
                        <div className={cn(
                            "flex-shrink-0 w-2 h-2 rounded-full mt-1.5",
                            !e.read ? "bg-rose-500" : "bg-slate-200"
                        )} />
                        <div className="flex-1 min-w-0">
                            {e.alertName && (
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                    {e.alertName}
                                </p>
                            )}
                            <p className="text-[13px] font-medium text-slate-700 leading-snug">
                                {e.message || 'Alerta disparada'}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                {formatRelative(e.triggeredAt)}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RulesList({ rules, onToggle, onDelete, onNew }: {
    rules: AlertRule[];
    onToggle: (id: string, active: boolean) => void;
    onDelete: (id: string) => void;
    onNew: () => void;
}) {
    return (
        <div>
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {rules.length} {rules.length === 1 ? 'alerta' : 'alertas'} configuradas
                </span>
                <button
                    onClick={onNew}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                    <Plus className="w-3 h-3" />
                    Nueva
                </button>
            </div>

            {rules.length === 0 ? (
                <div className="p-8 flex flex-col items-center gap-2 text-slate-400 text-center">
                    <Bell className="w-8 h-8 opacity-40" />
                    <span className="text-[12px] font-medium">No tienes alertas configuradas.</span>
                    <span className="text-[10px]">Crea una para que el sistema te avise cuando algo cambie.</span>
                </div>
            ) : (
                <div>
                    {rules.map(r => (
                        <div key={r.id} className="px-3 py-2.5 border-b border-slate-50 last:border-b-0 group">
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "text-[13px] font-bold truncate leading-snug",
                                        r.active ? "text-slate-800" : "text-slate-400 line-through"
                                    )}>
                                        {r.name}
                                    </p>
                                    {r.description && (
                                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{r.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            {FREQUENCY_LABELS[r.frequency] || r.frequency}
                                        </span>
                                        <span className="text-[9px] text-slate-300">·</span>
                                        <span className="text-[9px] font-mono text-slate-500">
                                            {r.targetColumn ? `${r.targetColumn} ` : ''}
                                            {CONDITION_LABELS[r.conditionType] || r.conditionType}
                                            {r.conditionValue !== null ? ` ${r.conditionValue}` : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onToggle(r.id, r.active)}
                                        className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            r.active ? "hover:bg-amber-100 text-amber-600" : "hover:bg-emerald-100 text-emerald-600"
                                        )}
                                        title={r.active ? "Desactivar" : "Activar"}
                                    >
                                        <Power className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(r.id)}
                                        className="p-1.5 hover:bg-rose-100 rounded-lg transition-colors text-rose-500"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CreateAlertForm({ draft, onChange, onCancel, onSave, saving }: {
    draft: CreateAlertDraft;
    onChange: (d: CreateAlertDraft) => void;
    onCancel: () => void;
    onSave: () => void;
    saving: boolean;
}) {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">Nueva alerta</span>
                <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
            </div>

            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nombre</label>
                <input
                    type="text"
                    value={draft.name}
                    onChange={e => onChange({ ...draft, name: e.target.value })}
                    placeholder="Ej: Cancelaciones del día > $5K"
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                />
            </div>

            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Consulta SQL (solo SELECT)</label>
                <textarea
                    value={draft.sql}
                    onChange={e => onChange({ ...draft, sql: e.target.value })}
                    rows={5}
                    className="w-full px-3 py-2 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 resize-y"
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Condición</label>
                    <select
                        value={draft.conditionType}
                        onChange={e => onChange({ ...draft, conditionType: e.target.value as any })}
                        className="w-full px-2 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    >
                        <option value="gt">Mayor a (&gt;)</option>
                        <option value="gte">Mayor o igual (&ge;)</option>
                        <option value="lt">Menor a (&lt;)</option>
                        <option value="lte">Menor o igual (&le;)</option>
                        <option value="eq">Igual (=)</option>
                        <option value="neq">Distinto (≠)</option>
                        <option value="has_rows">Tiene resultados</option>
                    </select>
                </div>
                {draft.conditionType !== 'has_rows' && (
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Valor</label>
                        <input
                            type="number"
                            value={draft.conditionValue ?? ''}
                            onChange={e => onChange({ ...draft, conditionValue: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Columna a evaluar</label>
                    <input
                        type="text"
                        value={draft.targetColumn || ''}
                        onChange={e => onChange({ ...draft, targetColumn: e.target.value })}
                        placeholder="Total (opcional)"
                        className="w-full px-3 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Frecuencia</label>
                    <select
                        value={draft.frequency}
                        onChange={e => onChange({ ...draft, frequency: e.target.value as any })}
                        className="w-full px-2 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    >
                        <option value="hourly">Cada hora</option>
                        <option value="daily">Diaria</option>
                        <option value="weekly">Semanal</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-2 pt-2">
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
                    Crear alerta
                </button>
            </div>
        </div>
    );
}
