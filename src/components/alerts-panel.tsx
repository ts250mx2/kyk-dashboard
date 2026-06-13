'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellRing, Plus, X, Trash2, Loader2, Power, MessageCircle, Sparkles, ChevronDown, ArrowLeft, Code2, CheckCircle2, Pencil, Lock, Send, Clock } from 'lucide-react';
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
    telefono?: string | null;
    clave?: string | null;
    horaEnvio?: string | null;
    createdAt: string;
    lastEvaluatedAt: string | null;
}

/** '19:30' → '7:30 PM' (para mostrar la hora de envío). */
function formatHora12(hora: string | null | undefined): string {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hora || '');
    if (!m) return '';
    const h = Number(m[1]);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m[2]} ${suffix}`;
}

/** Separa "+52...,+52..." en números individuales (frontend). */
function splitPhones(raw: string | null | undefined): string[] {
    return (raw || '').split(',').map(s => s.trim()).filter(Boolean);
}

/** Normaliza a +52 por default (mismo criterio que el backend). */
function normalizePhoneLocal(raw: string): string {
    const t = (raw || '').trim();
    const hadPlus = t.startsWith('+');
    const digits = t.replace(/\D/g, '');
    if (!digits) return '';
    if (hadPlus) return '+' + digits;
    if (digits.length === 10) return '+52' + digits;
    if (digits.length === 12 && digits.startsWith('52')) return '+' + digits;
    return '+' + digits;
}

interface AlertsPanelProps {
    /** @deprecated Ya no se auto-aplica: toda alerta nueva arranca en el modo "describe". */
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
    frequency: '5min' | 'hourly' | 'daily' | 'weekly';
    /** Si se captura, la alerta también se envía por WhatsApp al dispararse. */
    telefono?: string;
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

const CONDITION_WORDS: Record<string, string> = {
    gt: 'pase de', gte: 'llegue a', lt: 'baje de', lte: 'baje a',
    eq: 'sea igual a', neq: 'sea distinto de'
};

/** "Te aviso si Total pasa de $5,000" — la condición en palabras, sin símbolos. */
function humanCondition(r: { conditionType: string; conditionValue: number | null; targetColumn: string | null }): string {
    if (r.conditionType === 'has_rows') return 'Te aviso cuando la consulta encuentre resultados';
    const col = r.targetColumn || 'el valor';
    const val = r.conditionValue !== null ? r.conditionValue.toLocaleString('es-MX') : '—';
    return `Te aviso cuando ${col} ${CONDITION_WORDS[r.conditionType] || r.conditionType} ${val}`;
}

const FREQUENCY_LABELS: Record<string, string> = {
    '5min': 'Cada 5 min', hourly: 'Cada hora', daily: 'Diario', weekly: 'Semanal'
};

export function AlertsPanel({ refreshKey, compact = false }: AlertsPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [tab, setTab] = useState<'events' | 'rules'>('events');
    const [events, setEvents] = useState<AlertEvent[]>([]);
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [draft, setDraft] = useState<CreateAlertDraft | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [alertModel, setAlertModel] = useState<string>('');
    const [models, setModels] = useState<Array<{ id: string; label: string }>>([]);
    const [editingModel, setEditingModel] = useState(false);
    const [editingPhonesRule, setEditingPhonesRule] = useState<AlertRule | null>(null);
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
            const [eventsRes, rulesRes, recipientsRes] = await Promise.all([
                fetch('/api/agent/alerts/events?limit=20').then(r => r.json()),
                fetch('/api/agent/alerts').then(r => r.json()),
                fetch('/api/agent/alerts/recipients').then(r => r.json()).catch(() => ({ phones: [] }))
            ]);
            if (Array.isArray(eventsRes.events)) {
                setEvents(eventsRes.events);
                setUnreadCount(eventsRes.events.filter((e: AlertEvent) => !e.read).length);
            }
            if (Array.isArray(rulesRes.alerts)) {
                setRules(rulesRes.alerts);
            }
            setAlertModel(recipientsRes.model || '');
            if (Array.isArray(recipientsRes.models)) {
                setModels(recipientsRes.models);
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
                setEditingModel(false);
                setEditingPhonesRule(null);
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
        // Toda alerta nueva arranca en el modo "describe" (conversacional).
        setEditingId(null);
        setDraft({
            name: '',
            sql: '',
            conditionType: 'gt',
            conditionValue: 0,
            frequency: 'daily'
        });
        setShowCreateForm(true);
    };

    const openEditForm = (rule: AlertRule) => {
        // Las alertas de sistema solo permiten editar SUS números de WhatsApp.
        if (rule.clave) {
            setEditingPhonesRule(rule);
            return;
        }
        setEditingId(rule.id);
        setDraft({
            name: rule.name,
            description: rule.description ?? undefined,
            sql: rule.sql,
            conditionType: rule.conditionType as CreateAlertDraft['conditionType'],
            conditionValue: rule.conditionValue ?? undefined,
            targetColumn: rule.targetColumn ?? undefined,
            frequency: rule.frequency as CreateAlertDraft['frequency'],
            telefono: rule.telefono ?? undefined,
        });
        setShowCreateForm(true);
    };

    const saveDraft = async () => {
        if (!draft) return;
        if (!draft.name.trim()) {
            alert('Ponle un nombre a la alerta antes de guardarla.');
            return;
        }
        if (!draft.sql.trim()) {
            alert('Falta la consulta SQL. Genera la alerta describiéndola, o escríbela en el modo avanzado.');
            return;
        }
        setSaving(true);
        try {
            const r = await fetch(
                editingId ? `/api/agent/alerts/${editingId}` : '/api/agent/alerts',
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(draft)
                }
            );
            const data = await r.json();
            if (r.ok) {
                setShowCreateForm(false);
                setDraft(null);
                setEditingId(null);
                await fetchAll();
            } else {
                alert(data.error || (editingId ? 'Error actualizando alerta' : 'Error creando alerta'));
            }
        } catch (e: any) {
            alert(e.message || (editingId ? 'Error actualizando alerta' : 'Error creando alerta'));
        } finally {
            setSaving(false);
        }
    };

    const [sendingId, setSendingId] = useState<string | null>(null);

    const sendNow = async (rule: AlertRule) => {
        const phones = splitPhones(rule.telefono);
        if (phones.length === 0) {
            alert('Esta alerta no tiene números de WhatsApp. Edítala y agrega al menos uno para poder enviarla.');
            return;
        }
        // Solo los resúmenes de sistema: entre 00:00 y 4:00 el envío manual
        // reporta el día que acaba de cerrar.
        const earlyMorning = !!rule.clave && new Date().getHours() < 4;
        const periodNote = earlyMorning ? '\n\nPor la hora, se enviará el resumen del DÍA ANTERIOR.' : '';
        if (!confirm(`¿Enviar "${rule.name}" ahora por WhatsApp a ${phones.length} número(s)?${periodNote}`)) return;
        setSendingId(rule.id);
        try {
            const r = await fetch(`/api/agent/alerts/${rule.id}/send`, { method: 'POST' });
            const data = await r.json();
            if (r.ok) {
                alert(`Enviado a ${data.sent} de ${data.recipients} número(s)${data.period === 'ayer' ? ' (datos del día anterior)' : ''}.`);
            } else {
                alert(data.error || 'Error enviando la alerta');
            }
        } catch (e: any) {
            alert(e.message || 'Error enviando la alerta');
        } finally {
            setSendingId(null);
        }
    };

    const saveModel = async (model: string) => {
        setSaving(true);
        try {
            const r = await fetch('/api/agent/alerts/recipients', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model || null })
            });
            const data = await r.json();
            if (r.ok) {
                setAlertModel(data.model || '');
                setEditingModel(false);
            } else {
                alert(data.error || 'Error guardando el modelo');
            }
        } catch (e: any) {
            alert(e.message || 'Error guardando el modelo');
        } finally {
            setSaving(false);
        }
    };

    const savePhones = async (ruleId: string, phones: string[], horaEnvio?: string) => {
        setSaving(true);
        try {
            const r = await fetch(`/api/agent/alerts/${ruleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefono: phones.join(','),
                    ...(horaEnvio ? { horaEnvio } : {})
                })
            });
            const data = await r.json();
            if (r.ok) {
                const telefono = typeof data.telefono === 'string' ? data.telefono : phones.join(',');
                setRules(prev => prev.map(x => x.id === ruleId
                    ? { ...x, telefono, ...(data.horaEnvio ? { horaEnvio: data.horaEnvio } : {}) }
                    : x));
                setEditingPhonesRule(null);
            } else {
                alert(data.error || 'Error guardando cambios');
            }
        } catch (e: any) {
            alert(e.message || 'Error guardando cambios');
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
                            onCancel={() => { setShowCreateForm(false); setDraft(null); setEditingId(null); }}
                            onSave={saveDraft}
                            saving={saving}
                            isEditing={!!editingId}
                        />
                    ) : editingPhonesRule ? (
                        <AlertPhonesEditor
                            rule={editingPhonesRule}
                            saving={saving}
                            onSave={savePhones}
                            onCancel={() => setEditingPhonesRule(null)}
                        />
                    ) : editingModel ? (
                        <ModelEditor
                            model={alertModel}
                            models={models}
                            saving={saving}
                            onSave={saveModel}
                            onCancel={() => setEditingModel(false)}
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
                                    onEdit={openEditForm}
                                    onEditModel={() => setEditingModel(true)}
                                    onSendNow={sendNow}
                                    sendingId={sendingId}
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

function RulesList({ rules, onToggle, onDelete, onNew, onEdit, onEditModel, onSendNow, sendingId }: {
    rules: AlertRule[];
    onToggle: (id: string, active: boolean) => void;
    onDelete: (id: string) => void;
    onNew: () => void;
    onEdit: (rule: AlertRule) => void;
    onEditModel: () => void;
    onSendNow: (rule: AlertRule) => void;
    sendingId: string | null;
}) {
    const systemRules = rules.filter(r => r.clave);
    const userRules = rules.filter(r => !r.clave);

    return (
        <div>
            {/* ── Alertas automáticas (de sistema) ── */}
            {systemRules.length > 0 && (
                <div className="bg-indigo-50/40 border-b border-indigo-100">
                    <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Automáticas
                        </span>
                        <button
                            onClick={onEditModel}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-bold rounded-lg bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        >
                            <Sparkles className="w-3 h-3" />
                            Modelo de IA
                        </button>
                    </div>
                    <div>
                        {systemRules.map(r => {
                            const phones = splitPhones(r.telefono);
                            return (
                                <div key={r.id} className="px-3 py-2 flex items-start gap-2 border-t border-indigo-100/60">
                                    <Lock className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12.5px] font-bold text-slate-800 leading-snug">{r.name}</p>
                                        {r.description && (
                                            <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">{r.description}</p>
                                        )}
                                        <span className="inline-flex items-center gap-2 mt-1">
                                            {r.horaEnvio && (
                                                <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-indigo-600" title="Hora de envío (edítala con el lápiz)">
                                                    <Clock className="w-3 h-3" />
                                                    {formatHora12(r.horaEnvio)}
                                                </span>
                                            )}
                                            {phones.length > 0 ? (
                                                <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-emerald-600" title={phones.join(', ')}>
                                                    <MessageCircle className="w-3 h-3" />
                                                    {phones.length} número{phones.length > 1 ? 's' : ''}
                                                </span>
                                            ) : (
                                                <span className="text-[9.5px] font-bold text-amber-600">
                                                    Sin números — no se enviará
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-1">
                                        <button
                                            onClick={() => onEdit(r)}
                                            className="p-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                            title="Editar números de WhatsApp de esta alerta"
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        {r.clave !== 'inicio_operaciones' && (
                                            <button
                                                onClick={() => onSendNow(r)}
                                                disabled={sendingId !== null}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-bold rounded-lg bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                                                title="Enviar ahora por WhatsApp. De 12 AM a 4 AM se envía el resumen del día anterior."
                                            >
                                                {sendingId === r.id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : <Send className="w-3 h-3" />}
                                                Enviar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Tus alertas ── */}
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {userRules.length} {userRules.length === 1 ? 'alerta tuya' : 'alertas tuyas'}
                </span>
                <button
                    onClick={onNew}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                    <Plus className="w-3 h-3" />
                    Nueva
                </button>
            </div>

            {userRules.length === 0 ? (
                <div className="p-8 flex flex-col items-center gap-2 text-slate-400 text-center">
                    <Bell className="w-8 h-8 opacity-40" />
                    <span className="text-[12px] font-medium">No tienes alertas propias.</span>
                    <span className="text-[10px]">Crea una para que el sistema te avise cuando algo cambie.</span>
                </div>
            ) : (
                <div>
                    {userRules.map(r => (
                        <div key={r.id} className="px-3 py-2.5 border-b border-slate-50 last:border-b-0">
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
                                    <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                                        {humanCondition(r)} <span className="text-slate-400">· se revisa {(FREQUENCY_LABELS[r.frequency] || r.frequency).toLowerCase()}</span>
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {splitPhones(r.telefono).length > 0 ? (
                                            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-emerald-600" title={`Avisa por WhatsApp a ${splitPhones(r.telefono).join(', ')}`}>
                                                <MessageCircle className="w-3 h-3" />
                                                {splitPhones(r.telefono).length} número{splitPhones(r.telefono).length > 1 ? 's' : ''} de WhatsApp
                                            </span>
                                        ) : (
                                            <span className="text-[9.5px] font-medium text-slate-400">
                                                Sin WhatsApp — solo avisa aquí en la bandeja
                                            </span>
                                        )}
                                        {!r.active && (
                                            <span className="text-[9.5px] font-bold text-amber-600">Pausada</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onSendNow(r)}
                                        disabled={sendingId !== null}
                                        className="p-1.5 rounded-lg transition-colors hover:bg-indigo-100 text-indigo-600 disabled:opacity-50"
                                        title="Enviar ahora por WhatsApp el estado actual de esta alerta"
                                    >
                                        {sendingId === r.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <Send className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                        onClick={() => onEdit(r)}
                                        className="p-1.5 rounded-lg transition-colors hover:bg-indigo-100 text-indigo-600"
                                        title="Editar esta alerta"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onToggle(r.id, r.active)}
                                        className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            r.active ? "hover:bg-amber-100 text-amber-600" : "hover:bg-emerald-100 text-emerald-600"
                                        )}
                                        title={r.active ? "Pausar (deja de revisarse)" : "Reactivar"}
                                    >
                                        <Power className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(r.id)}
                                        className="p-1.5 hover:bg-rose-100 rounded-lg transition-colors text-rose-500"
                                        title="Eliminar esta alerta"
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

// ─── Editor de lista de números (chips, +52 por default) ──────────────────
function PhoneListEditor({ phones, onChange }: { phones: string[]; onChange: (p: string[]) => void }) {
    const [input, setInput] = useState('');
    const add = () => {
        const v = normalizePhoneLocal(input);
        if (v && !phones.includes(v)) onChange([...phones, v]);
        setInput('');
    };
    return (
        <div>
            {phones.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {phones.map(p => (
                        <span key={p} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                            <MessageCircle className="w-3 h-3" />
                            {p}
                            <button onClick={() => onChange(phones.filter(x => x !== p))} className="hover:text-rose-600">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-2">
                <input
                    type="tel"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
                    placeholder="+52 81 1234 5678"
                    className="flex-1 px-3 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                />
                <button
                    onClick={add}
                    disabled={!input.trim()}
                    className="px-3 py-2 text-[12px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-40"
                >
                    Agregar
                </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                Se guardan con lada +52 automáticamente. Enter o coma para agregar otro.
            </p>
        </div>
    );
}

// ─── Editor por alerta de sistema: números + hora de envío ────────────────
function AlertPhonesEditor({ rule, saving, onSave, onCancel }: {
    rule: AlertRule;
    saving: boolean;
    onSave: (ruleId: string, phones: string[], horaEnvio?: string) => void;
    onCancel: () => void;
}) {
    const [list, setList] = useState<string[]>(splitPhones(rule.telefono));
    const [hora, setHora] = useState<string>(rule.horaEnvio || '');
    const canEditHora = !!rule.horaEnvio; // solo las alertas de hora fija la traen
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 inline-flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-indigo-500" /> Destinatarios
                </span>
                <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
            </div>
            <p className="text-[12px] text-slate-500 leading-snug">
                Estos números reciben por WhatsApp <span className="font-bold text-slate-700">{rule.name}</span>.
            </p>

            <PhoneListEditor phones={list} onChange={setList} />

            {canEditHora && (
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Hora de envío
                    </label>
                    <input
                        type="time"
                        value={hora}
                        onChange={e => setHora(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                        Hora local de Monterrey. El resumen sale en la primera pasada del sistema a partir de esa hora.
                    </p>
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <button
                    onClick={onCancel}
                    className="flex-1 px-3 py-2 text-[12px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={() => onSave(rule.id, list, canEditHora && hora ? hora : undefined)}
                    disabled={saving || (canEditHora && !hora)}
                    className="flex-1 px-3 py-2 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Guardar
                </button>
            </div>
        </div>
    );
}

// ─── Editor del MODELO de IA (compartido por las alertas automáticas) ─────
function ModelEditor({ model, models, saving, onSave, onCancel }: {
    model: string;
    models: Array<{ id: string; label: string }>;
    saving: boolean;
    onSave: (model: string) => void;
    onCancel: () => void;
}) {
    const [selectedModel, setSelectedModel] = useState<string>(model);
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Modelo de IA
                </span>
                <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
            </div>
            <p className="text-[12px] text-slate-500 leading-snug">
                Con este modelo se redactan el resumen y los hallazgos del día.
            </p>

            <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="w-full px-2 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
            >
                <option value="">Default del servidor</option>
                {models.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                ))}
            </select>

            <div className="flex gap-2 pt-1">
                <button
                    onClick={onCancel}
                    className="flex-1 px-3 py-2 text-[12px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={() => onSave(selectedModel)}
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

interface AlertPreview {
    ok: boolean;
    observedValue: number | null;
    wouldTriggerNow: boolean;
    error?: string;
}

const ALERT_EXAMPLES = [
    'Avísame si las cancelaciones de hoy pasan de $5,000',
    'Dime cuando un retiro supere $10,000',
    'Avísame si las ventas del día bajan de $20,000',
    'Cuando haya una cancelación mayor a $1,000',
];

function fallbackSummary(d: CreateAlertDraft): string {
    const freq = (FREQUENCY_LABELS[d.frequency] || d.frequency).toLowerCase();
    if (d.conditionType === 'has_rows') {
        return `Reviso ${freq} y te aviso cuando la consulta encuentre resultados.`;
    }
    const col = d.targetColumn || 'el valor';
    const val = d.conditionValue !== undefined && d.conditionValue !== null
        ? d.conditionValue.toLocaleString('es-MX') : '—';
    return `Reviso ${freq} y te aviso cuando ${col} ${CONDITION_WORDS[d.conditionType] || d.conditionType} ${val}.`;
}

function CreateAlertForm({ draft, onChange, onCancel, onSave, saving, isEditing = false }: {
    draft: CreateAlertDraft;
    onChange: (d: CreateAlertDraft) => void;
    onCancel: () => void;
    onSave: () => void;
    saving: boolean;
    isEditing?: boolean;
}) {
    const saveLabel = isEditing ? 'Guardar cambios' : 'Crear alerta';
    // Editar o venir armado (desde el chat) arranca en revisión; si no, a describir.
    const initialView: 'describe' | 'review' | 'advanced' = (draft.name?.trim() && draft.sql?.trim()) ? 'review' : 'describe';
    const [view, setView] = useState<'describe' | 'review' | 'advanced'>(initialView);
    const [nlText, setNlText] = useState('');
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);
    const [summary, setSummary] = useState('');
    const [preview, setPreview] = useState<AlertPreview | null>(null);
    const [showSql, setShowSql] = useState(false);

    const generate = async () => {
        const prompt = nlText.trim();
        if (!prompt) return;
        setGenerating(true);
        setGenError(null);
        try {
            const r = await fetch('/api/agent/alerts/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const d = await r.json();
            if (!r.ok) { setGenError(d.error || 'No pude generar la alerta.'); return; }
            const g = d.draft;
            onChange({
                ...draft,
                name: g.name || '',
                description: g.description || undefined,
                sql: g.sql || '',
                conditionType: g.conditionType,
                conditionValue: g.conditionValue,
                targetColumn: g.targetColumn || undefined,
                frequency: g.frequency,
            });
            setSummary(g.summary || '');
            setPreview(d.preview || null);
            setView('review');
        } catch {
            setGenError('Error de conexión. Intenta de nuevo.');
        } finally {
            setGenerating(false);
        }
    };

    const goAdvanced = () => {
        if (!draft.sql?.trim()) {
            onChange({ ...draft, sql: 'SELECT COUNT(*) AS Total FROM Ventas WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)' });
        }
        setView('advanced');
    };

    // ─── Vista: DESCRIBE (conversacional, por defecto) ──────────────────────
    if (view === 'describe') {
        return (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 inline-flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Nueva alerta
                    </span>
                    <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
                        <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                </div>

                <p className="text-[12px] text-slate-500 leading-snug">
                    Describe en tus palabras qué quieres que vigilemos. Yo armo la alerta por ti.
                </p>

                <textarea
                    value={nlText}
                    onChange={e => setNlText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); }}
                    rows={3}
                    autoFocus
                    placeholder="Ej: avísame si las cancelaciones de hoy pasan de $5,000"
                    className="w-full px-3 py-2.5 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 resize-y"
                />

                <div className="flex flex-wrap gap-1.5">
                    {ALERT_EXAMPLES.map(ex => (
                        <button
                            key={ex}
                            onClick={() => setNlText(ex)}
                            className="px-2.5 py-1 rounded-full text-[10.5px] bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        >
                            {ex}
                        </button>
                    ))}
                </div>

                {genError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-lg p-2.5 text-[11px]">{genError}</div>
                )}

                <button
                    onClick={generate}
                    disabled={generating || !nlText.trim()}
                    className="w-full px-3 py-2.5 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? 'Armando tu alerta…' : 'Generar alerta'}
                </button>

                <div className="flex items-center justify-between pt-1">
                    <button onClick={goAdvanced} className="text-[10.5px] font-bold text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
                        <Code2 className="w-3 h-3" /> Prefiero escribir el SQL yo
                    </button>
                    <button onClick={onCancel} className="text-[10.5px] font-bold text-slate-400 hover:text-slate-600">Cancelar</button>
                </div>
            </div>
        );
    }

    // ─── Vista: REVIEW (resumen claro + ajustes simples) ────────────────────
    if (view === 'review') {
        const text = summary || fallbackSummary(draft);
        return (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">{isEditing ? 'Editar alerta' : 'Revisa tu alerta'}</span>
                    <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
                        <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                </div>

                <p className="text-[12px] text-slate-500 leading-snug">
                    {isEditing
                        ? 'Cambia lo que necesites y guarda. Así funciona hoy:'
                        : 'Así quedó tu alerta. Ajusta lo que quieras antes de guardarla.'}
                </p>

                {/* Resumen en lenguaje claro */}
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                        <p className="text-[13px] text-slate-700 leading-snug font-medium">{text}</p>
                    </div>
                    {preview && (
                        <div className="mt-2 pt-2 border-t border-indigo-100/80 text-[11px] leading-snug">
                            {preview.ok ? (
                                <span className="text-slate-600">
                                    {draft.conditionType === 'has_rows'
                                        ? `Ahorita hay ${preview.observedValue ?? 0} coincidencia(s). `
                                        : `Valor actual: ${preview.observedValue !== null ? preview.observedValue.toLocaleString('es-MX') : '—'}. `}
                                    {preview.wouldTriggerNow
                                        ? <span className="font-bold text-rose-600">Con esto se dispararía ahora mismo.</span>
                                        : <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No se dispararía todavía.</span>}
                                </span>
                            ) : (
                                <span className="text-amber-600">No pude probar la consulta ahorita, pero puedes guardarla igual.</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Nombre */}
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nombre de la alerta</label>
                    <input
                        type="text"
                        value={draft.name}
                        onChange={e => onChange({ ...draft, name: e.target.value })}
                        placeholder="Ej: Cancelaciones del día > $5K"
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                </div>

                {/* Ajustes simples: umbral + frecuencia */}
                <div className="grid grid-cols-2 gap-2">
                    {draft.conditionType !== 'has_rows' && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                Avísame cuando {CONDITION_WORDS[draft.conditionType] || 'llegue a'}
                            </label>
                            <input
                                type="number"
                                value={draft.conditionValue ?? ''}
                                onChange={e => onChange({ ...draft, conditionValue: parseFloat(e.target.value) })}
                                placeholder="Ej: 5000"
                                className="w-full px-3 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                            />
                        </div>
                    )}
                    <div className={draft.conditionType === 'has_rows' ? 'col-span-2' : ''}>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">¿Cada cuánto reviso?</label>
                        <select
                            value={draft.frequency}
                            onChange={e => onChange({ ...draft, frequency: e.target.value as any })}
                            className="w-full px-2 py-2 text-[12px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                        >
                            <option value="5min">Cada 5 minutos</option>
                            <option value="hourly">Cada hora</option>
                            <option value="daily">Una vez al día</option>
                            <option value="weekly">Una vez por semana</option>
                        </select>
                    </div>
                </div>

                {/* WhatsApp opcional (uno o varios números) */}
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Avisar por WhatsApp <span className="text-slate-300 normal-case font-medium tracking-normal">(opcional)</span>
                    </label>
                    <p className="text-[10.5px] text-slate-400 mb-1.5 leading-snug">
                        Si no agregas números, la alerta solo te avisa aquí en la bandeja.
                    </p>
                    <PhoneListEditor
                        phones={splitPhones(draft.telefono)}
                        onChange={list => onChange({ ...draft, telefono: list.join(',') })}
                    />
                </div>

                {/* Detalles técnicos (colapsable) */}
                <div className="border-t border-slate-100 pt-2">
                    <button
                        onClick={() => setShowSql(s => !s)}
                        className="w-full flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                    >
                        <span className="inline-flex items-center gap-1"><Code2 className="w-3 h-3" /> Detalles técnicos</span>
                        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showSql && 'rotate-180')} />
                    </button>
                    {showSql && (
                        <div className="mt-2 space-y-2">
                            <pre className="px-3 py-2 text-[10.5px] font-mono bg-slate-50 border border-slate-200 rounded-lg whitespace-pre-wrap break-words text-slate-600 max-h-32 overflow-y-auto">{draft.sql}</pre>
                            <button onClick={() => setView('advanced')} className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-700">
                                Editar a detalle →
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 pt-1">
                    <button
                        onClick={() => { setView('describe'); setGenError(null); }}
                        className="px-3 py-2 text-[12px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Describir
                    </button>
                    <button
                        onClick={onSave}
                        disabled={saving || !draft.name.trim()}
                        className="flex-1 px-3 py-2 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                        {saveLabel}
                    </button>
                </div>
            </div>
        );
    }

    // ─── Vista: ADVANCED (SQL crudo — para usuarios técnicos) ───────────────
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 inline-flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-slate-400" /> Modo avanzado
                </span>
                <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
            </div>

            <p className="text-[12px] text-slate-500 leading-snug">
                Aquí editas la consulta y la condición a detalle. Si prefieres algo más sencillo, usa el botón Volver.
            </p>

            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nombre de la alerta</label>
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
                        <option value="5min">Cada 5 minutos</option>
                        <option value="hourly">Cada hora</option>
                        <option value="daily">Diaria</option>
                        <option value="weekly">Semanal</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    WhatsApp <span className="text-slate-300 normal-case font-medium tracking-normal">(opcional, uno o varios)</span>
                </label>
                <PhoneListEditor
                    phones={splitPhones(draft.telefono)}
                    onChange={list => onChange({ ...draft, telefono: list.join(',') })}
                />
            </div>

            <div className="flex gap-2 pt-2">
                <button
                    onClick={() => setView(initialView)}
                    className="px-3 py-2 text-[12px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Volver
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="flex-1 px-3 py-2 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    {saveLabel}
                </button>
            </div>
        </div>
    );
}
