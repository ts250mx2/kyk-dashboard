'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, AlertCircle, Clock, Coins, RefreshCw, ShieldOff, Zap, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricsSummary {
    period_hours: number;
    total_requests: number;
    total_errors: number;
    total_blocked: number;
    total_rate_limited: number;
    total_tokens_input: number;
    total_tokens_output: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    by_model: Array<{ model: string; count: number; tokens: number }>;
    by_user: Array<{ user: string; count: number; tokens: number }>;
    recent_errors: Array<{ time: string; user: string; error: string }>;
}

const PERIODS: Array<{ label: string; hours: number }> = [
    { label: '1h', hours: 1 },
    { label: '24h', hours: 24 },
    { label: '7d', hours: 168 }
];

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

function formatRelative(iso: string): string {
    try {
        const d = new Date(iso);
        const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
        if (diffMin < 1) return 'Ahora';
        if (diffMin < 60) return `Hace ${diffMin} min`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `Hace ${diffHr}h`;
        return d.toLocaleString('es-MX');
    } catch { return ''; }
}

export default function AgentMetricsPage() {
    const [data, setData] = useState<MetricsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [hours, setHours] = useState(24);

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`/api/agent/metrics?hours=${hours}`);
            const d = await r.json();
            setData(d);
        } catch (e) {
            console.error('Error cargando métricas:', e);
        } finally {
            setLoading(false);
        }
    }, [hours]);

    useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

    const errorRate = data && data.total_requests > 0
        ? Math.round((data.total_errors / data.total_requests) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Métricas del Agente</h1>
                    <p className="text-sm text-slate-500 mt-1">Telemetría operativa de Kesito (uso, costos, errores).</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
                        {PERIODS.map(p => (
                            <button
                                key={p.hours}
                                onClick={() => setHours(p.hours)}
                                className={cn(
                                    "px-3 py-1 rounded-md text-xs font-bold transition-all",
                                    hours === p.hours ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchMetrics}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                    icon={<Activity className="w-4 h-4" />}
                    label="Requests"
                    value={data ? formatNumber(data.total_requests) : '—'}
                    subtitle={data ? `${data.total_requests} en ${data.period_hours}h` : ''}
                />
                <KpiCard
                    icon={<Coins className="w-4 h-4" />}
                    label="Tokens consumidos"
                    value={data ? formatNumber(data.total_tokens_input + data.total_tokens_output) : '—'}
                    subtitle={data ? `In ${formatNumber(data.total_tokens_input)} · Out ${formatNumber(data.total_tokens_output)}` : ''}
                />
                <KpiCard
                    icon={<Clock className="w-4 h-4" />}
                    label="Latencia promedio"
                    value={data ? `${data.avg_latency_ms}ms` : '—'}
                    subtitle={data ? `p95: ${data.p95_latency_ms}ms` : ''}
                />
                <KpiCard
                    icon={<AlertCircle className="w-4 h-4" />}
                    label="Tasa de error"
                    value={`${errorRate}%`}
                    subtitle={data ? `${data.total_errors} errores` : ''}
                    tone={errorRate > 5 ? 'danger' : errorRate > 1 ? 'warning' : 'normal'}
                />
            </div>

            {/* Segunda fila: bloqueos y rate limits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <KpiCard
                    icon={<ShieldOff className="w-4 h-4" />}
                    label="SQL bloqueados por sandbox"
                    value={data ? String(data.total_blocked) : '—'}
                    subtitle="Consultas con INSERT/UPDATE/DELETE rechazadas"
                />
                <KpiCard
                    icon={<Zap className="w-4 h-4" />}
                    label="Rate limited"
                    value={data ? String(data.total_rate_limited) : '—'}
                    subtitle="Usuarios que excedieron 30 req/min"
                />
            </div>

            {/* Por modelo y por usuario */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" /> Uso por modelo
                    </h3>
                    {data && data.by_model.length > 0 ? (
                        <div className="space-y-2">
                            {data.by_model.map(m => (
                                <div key={m.model} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-b-0">
                                    <span className="font-mono text-xs text-slate-700">{m.model}</span>
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="text-slate-500">{m.count} req</span>
                                        <span className="font-bold text-slate-900 tabular-nums">{formatNumber(m.tokens)} tokens</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400">Sin datos en este período</p>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" /> Top 10 usuarios
                    </h3>
                    {data && data.by_user.length > 0 ? (
                        <div className="space-y-2">
                            {data.by_user.map(u => (
                                <div key={u.user} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-b-0">
                                    <span className="font-mono text-xs text-slate-700 truncate max-w-[180px]">{u.user}</span>
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="text-slate-500">{u.count} req</span>
                                        <span className="font-bold text-slate-900 tabular-nums">{formatNumber(u.tokens)} tokens</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400">Sin datos en este período</p>
                    )}
                </div>
            </div>

            {/* Errores recientes */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" /> Errores recientes
                </h3>
                {data && data.recent_errors.length > 0 ? (
                    <div className="space-y-2">
                        {data.recent_errors.map((e, i) => (
                            <div key={i} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-b-0 gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-mono text-slate-500">{e.user}</p>
                                    <p className="text-xs text-rose-700 truncate" title={e.error}>{e.error}</p>
                                </div>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatRelative(e.time)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-slate-400">No hay errores en este período</p>
                )}
            </div>
        </div>
    );
}

function KpiCard({ icon, label, value, subtitle, tone = 'normal' }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    subtitle?: string;
    tone?: 'normal' | 'warning' | 'danger';
}) {
    const toneClasses = {
        normal: 'text-slate-900',
        warning: 'text-amber-600',
        danger: 'text-rose-600'
    };
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]">{label}</span>
            </div>
            <div className={cn("text-2xl font-black tabular-nums", toneClasses[tone])}>{value}</div>
            {subtitle && <div className="text-[11px] text-slate-500 mt-1 font-medium">{subtitle}</div>}
        </div>
    );
}
