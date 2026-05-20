'use client';

import { useEffect, useState } from 'react';
import {
    X, Loader2, Calendar, TrendingUp, Package, ShoppingCart, Receipt, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend
} from 'recharts';

export interface ProductTrendModalProps {
    open: boolean;
    onClose: () => void;
    product: {
        CodigoInterno: number;
        Descripcion: string;
        CodigoBarras?: string;
    } | null;
    /** ID de sucursal heredado (opcional, "all" para todas) */
    idTienda?: string;
}

type GroupBy = 'dia' | 'semana' | 'mes';

interface SeriesPoint {
    fecha: string;
    venta: number;
    cantidad: number;
    tickets: number;
}

interface TrendData {
    totals: {
        venta: number;
        cantidad: number;
        tickets: number;
        precioPromedio: number;
    };
    series: SeriesPoint[];
}

function mtyDate(offset = 0): string {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-CA');
}

function yearsAgo(years: number): string {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
    d.setFullYear(d.getFullYear() - years);
    return d.toLocaleDateString('en-CA');
}

function monthsAgo(months: number): string {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
    d.setMonth(d.getMonth() - months);
    return d.toLocaleDateString('en-CA');
}

const DEFAULT_MONTHS_BACK = 6;

const fmtMoney = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
const fmtNumber = (n: number) => new Intl.NumberFormat('es-MX').format(n || 0);

function fmtDateLabel(fecha: string, groupBy: GroupBy): string {
    const d = new Date(fecha);
    if (groupBy === 'mes') return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
    if (groupBy === 'semana') return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export function ProductTrendModal({ open, onClose, product, idTienda }: ProductTrendModalProps) {
    // Defaults: 6 meses atrás, por mes
    const [fechaInicio, setFechaInicio] = useState(() => monthsAgo(DEFAULT_MONTHS_BACK));
    const [fechaFin, setFechaFin] = useState(() => mtyDate());
    const [groupBy, setGroupBy] = useState<GroupBy>('mes');

    const [data, setData] = useState<TrendData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset al abrir
    useEffect(() => {
        if (open) {
            setFechaInicio(monthsAgo(DEFAULT_MONTHS_BACK));
            setFechaFin(mtyDate());
            setGroupBy('mes');
            setError(null);
        }
    }, [open]);

    // Fetch
    useEffect(() => {
        if (!open || !product) return;
        const ctrl = new AbortController();
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    codigoInterno: String(product.CodigoInterno),
                    fechaInicio,
                    fechaFin,
                    groupBy
                });
                if (idTienda && idTienda !== 'all') params.set('idTienda', idTienda);

                const res = await fetch(`/api/dashboard/sales/by-supplier/product-trend?${params}`, { signal: ctrl.signal });
                const json = await res.json();
                if (!json.success) throw new Error(json.error || 'Error cargando tendencia');
                setData({ totals: json.totals, series: json.series });
            } catch (e: any) {
                if (e.name !== 'AbortError') setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
        return () => ctrl.abort();
    }, [open, product, fechaInicio, fechaFin, groupBy, idTienda]);

    // Cerrar con ESC
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open || !product) return null;

    const today = mtyDate();
    const periodShortcuts = [
        { label: '1 mes', start: monthsAgo(1), end: today },
        { label: '3 meses', start: monthsAgo(3), end: today },
        { label: '6 meses', start: monthsAgo(6), end: today },
        { label: '1 año', start: yearsAgo(1), end: today },
        { label: '2 años', start: yearsAgo(2), end: today }
    ];

    const chartData = (data?.series || []).map(s => ({
        ...s,
        label: fmtDateLabel(s.fecha, groupBy)
    }));

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Package size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900 truncate">{product.Descripcion}</h2>
                            <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                                #{product.CodigoInterno}{product.CodigoBarras ? ` · ${product.CodigoBarras}` : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                        title="Cerrar (ESC)"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center gap-3">
                    {/* Periodo shortcuts */}
                    <div className="flex bg-slate-100 border border-slate-200 p-0.5 rounded-md">
                        {periodShortcuts.map(p => {
                            const active = fechaInicio === p.start && fechaFin === p.end;
                            return (
                                <button
                                    key={p.label}
                                    onClick={() => { setFechaInicio(p.start); setFechaFin(p.end); }}
                                    className={cn(
                                        'px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap rounded',
                                        active ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                    )}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Datepickers */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md">
                        <Calendar size={13} className="text-[#4050B4]" />
                        <input
                            type="date"
                            value={fechaInicio}
                            onChange={e => setFechaInicio(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-slate-700 outline-none border-none p-0"
                        />
                        <span className="text-slate-300 text-xs">→</span>
                        <input
                            type="date"
                            value={fechaFin}
                            onChange={e => setFechaFin(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-slate-700 outline-none border-none p-0"
                        />
                    </div>

                    {/* Agrupación */}
                    <div className="flex bg-slate-100 border border-slate-200 p-0.5 rounded-md ml-auto">
                        {(['dia', 'semana', 'mes'] as GroupBy[]).map(g => (
                            <button
                                key={g}
                                onClick={() => setGroupBy(g)}
                                className={cn(
                                    'px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all rounded',
                                    groupBy === g ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                )}
                            >
                                {g === 'dia' ? 'Día' : g === 'semana' ? 'Semana' : 'Mes'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {/* KPIs */}
                    {data && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            <KpiBox icon={<DollarSign size={14} />} label="Venta total" value={fmtMoney(data.totals.venta)} accent="emerald" />
                            <KpiBox icon={<Package size={14} />} label="Unidades" value={fmtNumber(data.totals.cantidad)} accent="blue" />
                            <KpiBox icon={<Receipt size={14} />} label="Tickets" value={fmtNumber(data.totals.tickets)} accent="amber" />
                            <KpiBox icon={<ShoppingCart size={14} />} label="Precio prom." value={fmtMoney(data.totals.precioPromedio)} accent="slate" />
                        </div>
                    )}

                    {/* Gráfica */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                <TrendingUp size={14} className="text-[#4050B4]" />
                                Tendencia de ventas
                            </h3>
                            {data && (
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {data.series.length} {groupBy === 'mes' ? 'meses' : groupBy === 'semana' ? 'semanas' : 'días'}
                                </span>
                            )}
                        </div>

                        {loading && (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                <Loader2 className="w-7 h-7 animate-spin text-[#4050B4] mb-2" />
                                <span className="text-xs font-bold uppercase tracking-wider">Cargando tendencia...</span>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold">
                                {error}
                            </div>
                        )}

                        {!loading && !error && chartData.length === 0 && (
                            <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                Sin ventas de este producto en el periodo
                            </div>
                        )}

                        {!loading && chartData.length > 0 && (
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
                                            axisLine={{ stroke: '#E2E8F0' }}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
                                            axisLine={{ stroke: '#E2E8F0' }}
                                            tickLine={false}
                                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
                                            axisLine={{ stroke: '#E2E8F0' }}
                                            tickLine={false}
                                            tickFormatter={(v) => fmtNumber(v)}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(64, 80, 180, 0.05)' }}
                                            content={({ active, payload, label }) => {
                                                if (!active || !payload || payload.length === 0) return null;
                                                return (
                                                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[180px]">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-1.5 mb-1.5">{label}</p>
                                                        {payload.map((p: any, i: number) => (
                                                            <div key={i} className="flex justify-between items-baseline text-[11px] font-semibold py-0.5">
                                                                <span className="flex items-center gap-1.5 text-slate-700">
                                                                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
                                                                    {p.name}
                                                                </span>
                                                                <span className="font-bold tabular-nums ml-3" style={{ color: p.color }}>
                                                                    {p.dataKey === 'venta' ? fmtMoney(p.value) : fmtNumber(p.value)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 10 }} />
                                        <Bar
                                            yAxisId="right"
                                            dataKey="cantidad"
                                            name="Unidades"
                                            fill="#10B981"
                                            fillOpacity={0.7}
                                            radius={[3, 3, 0, 0]}
                                        />
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="venta"
                                            name="Venta"
                                            stroke="#4050B4"
                                            strokeWidth={2.5}
                                            dot={{ r: 3, fill: '#4050B4' }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiBox({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: 'emerald' | 'blue' | 'amber' | 'slate' }) {
    const colors: Record<string, { bg: string; text: string }> = {
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-700' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-700' },
        slate: { bg: 'bg-slate-100', text: 'text-slate-700' }
    };
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1.5">
                <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", colors[accent].bg, colors[accent].text)}>
                    {icon}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
            </div>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
        </div>
    );
}
