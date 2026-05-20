'use client';

import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2, MessageSquare, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface Stats {
    totals: { up: number; down: number; total: number };
    ratingPct: number;
    last7Days: { date: string; up: number; down: number }[];
    recentDown: Array<{
        id: string;
        createdAt: string;
        reason: string | null;
        prompt: string | null;
        response: string | null;
        sql: string | null;
        aiModel: string | null;
    }>;
}

export default function AgentFeedbackPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/agent/feedback?days=${days}`);
                const json = await res.json();
                if (!json.error) setStats(json);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [days]);

    return (
        <div className="p-6 pt-3 md:p-8 md:pt-4 max-w-[1400px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-4 border border-slate-100 shadow-sm mb-6">
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Activity className="text-[#4050B4]" size={22} />
                        Feedback del Agente
                    </h1>
                    <p className="text-[11px] text-slate-500 font-bold mt-1">
                        Calidad percibida por usuarios — útil para iterar el prompt y detectar queries problemáticas
                    </p>
                </div>
                <div className="flex bg-slate-100 border border-slate-200 p-0.5">
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={cn(
                                'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                                days === d ? 'bg-[#4050B4] text-white' : 'text-slate-500 hover:text-slate-800'
                            )}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-[#4050B4] mb-3" />
                </div>
            )}

            {!loading && stats && stats.totals.total === 0 && (
                <div className="bg-white border border-slate-200 p-12 text-center">
                    <MessageSquare size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Sin feedback en este periodo</p>
                    <p className="text-xs text-slate-400 mt-2">Los usuarios pueden marcar 👍 o 👎 en las respuestas del agente.</p>
                </div>
            )}

            {!loading && stats && stats.totals.total > 0 && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <KpiCard label="Total feedback" value={stats.totals.total} accent="slate" />
                        <KpiCard label="👍 Positivo" value={stats.totals.up} accent="emerald" />
                        <KpiCard label="👎 Negativo" value={stats.totals.down} accent="rose" />
                        <KpiCard label="Calidad %" value={`${stats.ratingPct.toFixed(1)}%`} accent={stats.ratingPct >= 80 ? 'emerald' : stats.ratingPct >= 60 ? 'amber' : 'rose'} />
                    </div>

                    {/* Tendencia últimos 7 días */}
                    {stats.last7Days.length > 0 && (
                        <div className="bg-white border border-slate-200 shadow-sm p-5 mb-6">
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-3">
                                Tendencia últimos 7 días
                            </h2>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.last7Days}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} />
                                        <YAxis tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} />
                                        <Tooltip />
                                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                                        <Bar dataKey="up" fill="#10B981" name="👍" />
                                        <Bar dataKey="down" fill="#EF4444" name="👎" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Respuestas negativas recientes */}
                    <div className="bg-white border border-slate-200 shadow-sm">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <ThumbsDown size={14} className="text-rose-600" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">
                                Respuestas marcadas con 👎 ({stats.recentDown.length})
                            </h2>
                        </div>
                        {stats.recentDown.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                                Sin feedback negativo reciente 🎉
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {stats.recentDown.map(d => (
                                    <div key={d.id} className="p-4 hover:bg-slate-50/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {new Date(d.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                                {d.aiModel && <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600">{d.aiModel}</span>}
                                            </span>
                                            <button
                                                onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                                                className="text-[10px] font-black text-[#4050B4] uppercase tracking-widest hover:underline"
                                            >
                                                {expandedId === d.id ? 'Cerrar' : 'Ver detalle'}
                                            </button>
                                        </div>
                                        {d.reason && (
                                            <p className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-2 mb-2 border-l-2 border-rose-300">
                                                💬 {d.reason}
                                            </p>
                                        )}
                                        {d.prompt && (
                                            <p className="text-xs font-bold text-slate-700 mb-1">
                                                <span className="text-slate-400 font-black uppercase text-[9px] tracking-widest">Pregunta:</span> {d.prompt.slice(0, 200)}{d.prompt.length > 200 ? '…' : ''}
                                            </p>
                                        )}
                                        {expandedId === d.id && (
                                            <div className="mt-3 space-y-3 pt-3 border-t border-slate-100">
                                                {d.response && (
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Respuesta del agente</p>
                                                        <p className="text-xs text-slate-700 bg-slate-50 p-3 whitespace-pre-wrap">{d.response}</p>
                                                    </div>
                                                )}
                                                {d.sql && (
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">SQL ejecutado</p>
                                                        <pre className="text-[10px] font-mono text-slate-700 bg-slate-900 text-emerald-300 p-3 overflow-x-auto">{d.sql}</pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent: 'slate' | 'emerald' | 'rose' | 'amber' }) {
    const colors: Record<string, string> = {
        slate: 'text-slate-900 border-slate-200',
        emerald: 'text-emerald-700 border-emerald-200 bg-emerald-50/50',
        rose: 'text-rose-700 border-rose-200 bg-rose-50/50',
        amber: 'text-amber-700 border-amber-200 bg-amber-50/50'
    };
    return (
        <div className={cn('bg-white border p-5 shadow-sm', colors[accent])}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
            <p className={cn('text-3xl font-black tabular-nums', accent === 'slate' ? 'text-slate-900' : '')}>{value}</p>
        </div>
    );
}
