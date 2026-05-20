'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Scale, Plus, X, Copy, Calendar, Loader2, Play, Download,
    TrendingUp, TrendingDown, Minus, Store, Package, Tag, Users,
    BarChart3, ShoppingCart, Receipt, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { MultiSelect } from '@/components/ui/multi-select';

type Dimension = 'todos' | 'sucursal' | 'depto' | 'categoria' | 'marca' | 'proveedor' | 'articulo';
type Metric = 'venta' | 'tickets';

interface Slot {
    id: string;
    label: string;
    dimension: Dimension;
    values: string[];
    fechaInicio: string;
    fechaFin: string;
}

interface SlotKpis {
    venta: number;
    costo: number;
    utilidad: number;
    margenPct: number;
    tickets: number;
    ticketProm: number;
    unidades: number;
}

interface SlotResult extends Slot {
    kpis: SlotKpis;
    series: Array<{ fecha: string; venta: number; tickets: number; dayIndex: number }>;
}

const SLOT_COLORS = ['#4050B4', '#10B981', '#F59E0B', '#EF4444'];

const DIMENSIONS: { key: Dimension; label: string; icon: React.ReactNode }[] = [
    { key: 'todos', label: 'Toda la empresa', icon: <BarChart3 size={14} /> },
    { key: 'sucursal', label: 'Sucursal', icon: <Store size={14} /> },
    { key: 'depto', label: 'Departamento', icon: <Tag size={14} /> },
    { key: 'categoria', label: 'Categoría', icon: <Tag size={14} /> },
    { key: 'marca', label: 'Familia', icon: <Tag size={14} /> },
    { key: 'proveedor', label: 'Proveedor', icon: <Users size={14} /> },
    { key: 'articulo', label: 'Artículo', icon: <Package size={14} /> }
];

function mtyDate(offset = 0): string {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-CA');
}

function mtyMonth(monthOffset = 0): Date {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
    d.setMonth(d.getMonth() + monthOffset);
    return d;
}

function fmtMoney(n: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
}

function fmtNumber(n: number): string {
    return new Intl.NumberFormat('es-MX').format(n || 0);
}

function fmtPct(n: number): string {
    return `${(n || 0).toFixed(1)}%`;
}

function offsetDate(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-CA');
}

function buildSlotLabel(s: Slot, catalogs: Catalogs): string {
    if (s.label) return s.label;
    let dimPart = '';
    if (s.dimension === 'todos') dimPart = 'Toda la empresa';
    else if (s.values.length === 0) dimPart = `Todos (${s.dimension})`;
    else if (s.values.length === 1) {
        dimPart = catalogLabel(catalogs, s.dimension, s.values[0]) || s.values[0];
    } else {
        dimPart = `${s.values.length} ${s.dimension}s`;
    }
    return `${dimPart} · ${s.fechaInicio} → ${s.fechaFin}`;
}

interface Catalogs {
    stores: Array<{ IdTienda: number; Tienda: string }>;
    deptos: Array<{ IdDepto: number; Depto: string }>;
    categorias: string[];
    familias: string[];
    proveedores: Array<{ IdProveedor: number; Proveedor: string }>;
    articulos: Array<{ CodigoInterno: number; Descripcion: string }>;
}

function catalogLabel(c: Catalogs, dim: Dimension, value: string): string | null {
    if (dim === 'sucursal') {
        return c.stores.find(s => String(s.IdTienda) === value)?.Tienda || null;
    }
    if (dim === 'depto') {
        return c.deptos.find(d => String(d.IdDepto) === value)?.Depto || null;
    }
    if (dim === 'proveedor') {
        return c.proveedores.find(p => String(p.IdProveedor) === value)?.Proveedor || null;
    }
    if (dim === 'articulo') {
        const a = c.articulos.find(x => String(x.CodigoInterno) === value);
        return a ? `${a.CodigoInterno} - ${a.Descripcion}` : null;
    }
    return value;
}

function dimensionOptions(c: Catalogs, dim: Dimension): { label: string; value: string }[] {
    if (dim === 'sucursal') return c.stores.map(s => ({ label: s.Tienda, value: String(s.IdTienda) }));
    if (dim === 'depto') return c.deptos.map(d => ({ label: d.Depto, value: String(d.IdDepto) }));
    if (dim === 'categoria') return c.categorias.map(x => ({ label: x, value: x }));
    if (dim === 'marca') return c.familias.map(x => ({ label: x, value: x }));
    if (dim === 'proveedor') return c.proveedores.map(p => ({ label: p.Proveedor, value: String(p.IdProveedor) }));
    if (dim === 'articulo') return c.articulos.map(a => ({ label: `${a.CodigoInterno} - ${a.Descripcion}`, value: String(a.CodigoInterno) }));
    return [];
}

function generateSlotId(): string {
    return 'slot_' + Math.random().toString(36).slice(2, 8);
}

function defaultSlot(): Slot {
    return {
        id: generateSlotId(),
        label: '',
        dimension: 'sucursal',
        values: [],
        fechaInicio: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
        fechaFin: mtyDate()
    };
}

export default function QuickComparePage() {
    const [slots, setSlots] = useState<Slot[]>(() => [defaultSlot(), defaultSlot()]);
    const [results, setResults] = useState<SlotResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [metric, setMetric] = useState<Metric>('venta');
    const [autoRun, setAutoRun] = useState(true);

    const [catalogs, setCatalogs] = useState<Catalogs>({
        stores: [], deptos: [], categorias: [], familias: [], proveedores: [], articulos: []
    });

    // Cargar catálogos una vez
    useEffect(() => {
        const load = async () => {
            try {
                const [filtersRes, marginsRes] = await Promise.all([
                    fetch('/api/dashboard/trends/filters').then(r => r.json()),
                    fetch('/api/dashboard/sales/reports/margins?onlyStores=true&startDate=2020-01-01&endDate=' + mtyDate()).then(r => r.json())
                ]);
                // Categorías y familias adicionales: extraemos del catálogo de artículos / API existente
                // Por ahora reutilizamos familias del endpoint y deducimos categorias del catálogo articulos
                setCatalogs({
                    stores: marginsRes.stores || [],
                    deptos: filtersRes.deptos || [],
                    familias: (filtersRes.familias || []).map((f: any) => f.Familia || f),
                    categorias: [], // se llenará via endpoint si lo hubiese; por ahora vacío
                    proveedores: filtersRes.proveedores || [],
                    articulos: filtersRes.articulos || []
                });
            } catch (e) {
                console.error('Error cargando catálogos:', e);
            }
        };
        load();
    }, []);

    const runComparison = async (slotsToRun: Slot[]) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/sales/slot-compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slots: slotsToRun.map(s => ({
                        id: s.id,
                        label: buildSlotLabel(s, catalogs),
                        dimension: s.dimension,
                        values: s.values,
                        fechaInicio: s.fechaInicio,
                        fechaFin: s.fechaFin,
                        groupBy: 'dia'
                    }))
                })
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Error');
            setResults(json.slots);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-run con debounce cuando cambien los slots
    useEffect(() => {
        if (!autoRun) return;
        if (catalogs.stores.length === 0) return;
        const t = setTimeout(() => runComparison(slots), 500);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slots, autoRun, catalogs.stores.length]);

    const updateSlot = (id: string, patch: Partial<Slot>) => {
        setSlots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    };

    const addSlot = () => {
        if (slots.length >= 4) return;
        setSlots(prev => [...prev, defaultSlot()]);
    };

    const removeSlot = (id: string) => {
        if (slots.length <= 1) return;
        setSlots(prev => prev.filter(s => s.id !== id));
    };

    const duplicateSlot = (id: string, mode: 'identical' | 'lastYear' | 'lastMonth') => {
        const original = slots.find(s => s.id === id);
        if (!original || slots.length >= 4) return;
        let fechaInicio = original.fechaInicio;
        let fechaFin = original.fechaFin;
        if (mode === 'lastYear') {
            fechaInicio = offsetDate(original.fechaInicio, -365);
            fechaFin = offsetDate(original.fechaFin, -365);
        } else if (mode === 'lastMonth') {
            fechaInicio = offsetDate(original.fechaInicio, -30);
            fechaFin = offsetDate(original.fechaFin, -30);
        }
        const copy: Slot = { ...original, id: generateSlotId(), fechaInicio, fechaFin, label: '' };
        const idx = slots.findIndex(s => s.id === id);
        setSlots(prev => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
    };

    // Datos para gráfica unificada (eje X = dayIndex)
    const chartData = useMemo(() => {
        const maxLen = Math.max(0, ...results.map(r => r.series.length));
        const data: any[] = [];
        for (let i = 0; i < maxLen; i++) {
            const point: any = { dayIndex: i };
            results.forEach((slot, idx) => {
                const s = slot.series[i];
                if (s) {
                    point[`slot_${idx}`] = metric === 'venta' ? s.venta : s.tickets;
                }
            });
            data.push(point);
        }
        return data;
    }, [results, metric]);

    // Insights automáticos
    const insights = useMemo(() => {
        if (results.length < 2) return [] as string[];
        const base = results[0];
        const out: string[] = [];
        results.slice(1).forEach((r) => {
            const ventaDelta = base.kpis.venta > 0 ? ((r.kpis.venta - base.kpis.venta) / base.kpis.venta) * 100 : 0;
            const ticketDelta = base.kpis.tickets > 0 ? ((r.kpis.tickets - base.kpis.tickets) / base.kpis.tickets) * 100 : 0;
            const tpDelta = base.kpis.ticketProm > 0 ? ((r.kpis.ticketProm - base.kpis.ticketProm) / base.kpis.ticketProm) * 100 : 0;
            const margenDelta = r.kpis.margenPct - base.kpis.margenPct;

            if (Math.abs(ventaDelta) > 5) {
                out.push(`${r.label} vende ${ventaDelta >= 0 ? '+' : ''}${ventaDelta.toFixed(1)}% vs ${base.label} (${fmtMoney(r.kpis.venta - base.kpis.venta)} de diferencia).`);
            }
            if (Math.abs(tpDelta) > 8) {
                out.push(`Ticket promedio de ${r.label} es ${tpDelta >= 0 ? '+' : ''}${tpDelta.toFixed(1)}% vs ${base.label} — ${tpDelta >= 0 ? 'venden más por transacción' : 'venden menos por transacción'}.`);
            }
            if (Math.abs(ticketDelta) > 10 && Math.abs(ventaDelta) < 5) {
                out.push(`${r.label} tiene ${ticketDelta >= 0 ? 'más' : 'menos'} tickets (${ticketDelta.toFixed(1)}%) pero venta similar — composición de canasta distinta.`);
            }
            if (Math.abs(margenDelta) > 3) {
                out.push(`Margen de ${r.label} es ${margenDelta >= 0 ? '+' : ''}${margenDelta.toFixed(1)}pp vs ${base.label} — ${margenDelta >= 0 ? 'mayor' : 'menor'} rentabilidad por peso vendido.`);
            }
        });
        if (out.length === 0) {
            out.push('Los slots comparados se comportan de forma similar. Prueba cambiar la dimensión o el periodo para encontrar contrastes.');
        }
        return out.slice(0, 4);
    }, [results]);

    const exportExcel = () => {
        if (results.length === 0) return;
        const wb = XLSX.utils.book_new();

        // Hoja 1: KPIs
        const kpiRows = results.map(r => ({
            Slot: r.label,
            Dimensión: r.dimension,
            Periodo: `${r.fechaInicio} → ${r.fechaFin}`,
            Venta: r.kpis.venta,
            Costo: r.kpis.costo,
            Utilidad: r.kpis.utilidad,
            'Margen %': Number(r.kpis.margenPct.toFixed(2)),
            Tickets: r.kpis.tickets,
            'Ticket Prom': Number(r.kpis.ticketProm.toFixed(2)),
            Unidades: r.kpis.unidades
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), 'KPIs');

        // Hoja 2: serie por slot
        results.forEach((r, i) => {
            const sheetName = `Serie_${i + 1}`.slice(0, 31);
            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(r.series.map(s => ({
                    Fecha: s.fecha,
                    Día: s.dayIndex + 1,
                    Venta: s.venta,
                    Tickets: s.tickets
                }))),
                sheetName
            );
        });

        XLSX.writeFile(wb, `comparativa-simple-${mtyDate()}.xlsx`);
    };

    return (
        <div className="p-6 pt-3 md:p-8 md:pt-4 max-w-[1600px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-none border border-slate-100 shadow-sm mb-6">
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Scale className="text-[#4050B4]" size={24} />
                        Comparativa Simple
                    </h1>
                    <p className="text-[11px] text-slate-500 font-bold mt-1">
                        Compara hasta 4 slots independientes — sucursales, productos o periodos distintos
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={addSlot}
                        disabled={slots.length >= 4}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#4050B4] hover:bg-[#3a47a0] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-colors h-[38px]"
                    >
                        <Plus size={14} /> Agregar Slot
                    </button>
                    <button
                        onClick={() => runComparison(slots)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider transition-colors h-[38px]"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Generar
                    </button>
                    <button
                        onClick={exportExcel}
                        disabled={results.length === 0}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider transition-colors h-[38px]"
                    >
                        <Download size={14} /> XLSX
                    </button>
                    <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 cursor-pointer h-[38px]">
                        <input type="checkbox" checked={autoRun} onChange={e => setAutoRun(e.target.checked)} className="accent-[#4050B4]" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Auto</span>
                    </label>
                </div>
            </div>

            {/* Slots */}
            <div className={cn(
                "grid gap-4 mb-6",
                slots.length === 1 ? "grid-cols-1" :
                    slots.length === 2 ? "grid-cols-1 md:grid-cols-2" :
                        slots.length === 3 ? "grid-cols-1 md:grid-cols-3" :
                            "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
            )}>
                {slots.map((slot, idx) => (
                    <SlotCard
                        key={slot.id}
                        slot={slot}
                        color={SLOT_COLORS[idx]}
                        index={idx}
                        canRemove={slots.length > 1}
                        canDuplicate={slots.length < 4}
                        catalogs={catalogs}
                        onUpdate={(patch) => updateSlot(slot.id, patch)}
                        onRemove={() => removeSlot(slot.id)}
                        onDuplicate={(mode) => duplicateSlot(slot.id, mode)}
                    />
                ))}
            </div>

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold mb-6">
                    {error}
                </div>
            )}

            {/* KPIs comparados */}
            {results.length > 0 && (
                <div className="bg-white border border-slate-200 shadow-sm mb-6 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">
                            Comparación de KPIs
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-left font-black text-[10px] uppercase tracking-widest text-slate-500 w-40">Métrica</th>
                                    {results.map((r, idx) => (
                                        <th key={r.id} className="px-4 py-3 text-right font-black text-[10px] uppercase tracking-widest" style={{ color: SLOT_COLORS[idx] }}>
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="inline-block w-2 h-2 rounded-full" style={{ background: SLOT_COLORS[idx] }} />
                                                Slot {String.fromCharCode(65 + idx)}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <KpiRow label="Venta Total" icon={<DollarSign size={12} />} results={results} pick={k => k.venta} fmt={fmtMoney} />
                                <KpiRow label="Tickets" icon={<Receipt size={12} />} results={results} pick={k => k.tickets} fmt={fmtNumber} />
                                <KpiRow label="Ticket Promedio" icon={<ShoppingCart size={12} />} results={results} pick={k => k.ticketProm} fmt={fmtMoney} />
                                <KpiRow label="Unidades" icon={<Package size={12} />} results={results} pick={k => k.unidades} fmt={fmtNumber} />
                                <KpiRow label="Utilidad Bruta" icon={<TrendingUp size={12} />} results={results} pick={k => k.utilidad} fmt={fmtMoney} />
                                <KpiRow label="Margen %" icon={<TrendingUp size={12} />} results={results} pick={k => k.margenPct} fmt={fmtPct} deltaMode="absolute" deltaSuffix="pp" />
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Gráfica unificada */}
            {results.length > 0 && chartData.length > 0 && (
                <div className="bg-white border border-slate-200 shadow-sm p-5 mb-6">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                        <div>
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                Gráfica Comparativa
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                Eje X = días desde el inicio de cada slot — permite superponer periodos distintos
                            </p>
                        </div>
                        <div className="flex bg-slate-100 p-0.5 border border-slate-200">
                            {(['venta', 'tickets'] as Metric[]).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMetric(m)}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all",
                                        metric === m ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                                    )}
                                >
                                    {m === 'venta' ? 'Venta' : 'Tickets'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis
                                    dataKey="dayIndex"
                                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                                    axisLine={{ stroke: '#E2E8F0' }}
                                    tickLine={{ stroke: '#E2E8F0' }}
                                    label={{ value: 'Día del periodo', position: 'insideBottom', offset: -10, style: { fontSize: 10, fontWeight: 700, fill: '#94A3B8' } }}
                                    tickFormatter={(v) => `D${Number(v) + 1}`}
                                />
                                <YAxis
                                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                                    axisLine={{ stroke: '#E2E8F0' }}
                                    tickLine={{ stroke: '#E2E8F0' }}
                                    tickFormatter={(v) => metric === 'venta' ? `$${(v / 1000).toFixed(0)}k` : fmtNumber(v)}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#4050B4', strokeWidth: 1, strokeDasharray: '3 3' }}
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload || payload.length === 0) return null;
                                        return (
                                            <div className="bg-white border border-slate-200 shadow-lg p-3 min-w-[220px]">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-1.5 mb-1.5">
                                                    Día {Number(label) + 1} del periodo
                                                </p>
                                                {payload.map((p: any, i: number) => {
                                                    const slotIdx = Number(p.dataKey.split('_')[1]);
                                                    const slot = results[slotIdx];
                                                    if (!slot) return null;
                                                    const real = slot.series[Number(label)];
                                                    return (
                                                        <div key={i} className="flex justify-between items-baseline text-[11px] font-bold py-0.5">
                                                            <span className="flex items-center gap-1.5 text-slate-700">
                                                                <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
                                                                {slot.label.slice(0, 30)}
                                                            </span>
                                                            <span className="font-black tabular-nums ml-3" style={{ color: p.color }}>
                                                                {metric === 'venta' ? fmtMoney(p.value) : fmtNumber(p.value)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 10 }}
                                    formatter={(value: string) => {
                                        const idx = Number(value.split('_')[1]);
                                        return results[idx]?.label.slice(0, 35) || value;
                                    }}
                                />
                                {results.map((_, idx) => (
                                    <Line
                                        key={idx}
                                        type="monotone"
                                        dataKey={`slot_${idx}`}
                                        stroke={SLOT_COLORS[idx]}
                                        strokeWidth={2.5}
                                        dot={{ r: 2.5 }}
                                        activeDot={{ r: 5 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Insights */}
            {results.length >= 2 && insights.length > 0 && (
                <div className="bg-gradient-to-br from-[#4050B4]/5 to-emerald-50 border border-[#4050B4]/15 p-5 mb-6">
                    <h3 className="text-xs font-black text-[#4050B4] uppercase tracking-widest mb-3 flex items-center gap-2">
                        💡 Lo que destaca de la comparativa
                    </h3>
                    <ul className="space-y-2">
                        {insights.map((ins, i) => (
                            <li key={i} className="text-[12px] text-slate-700 font-bold leading-relaxed flex items-start gap-2">
                                <span className="text-[#4050B4] mt-0.5">▸</span>
                                <span>{ins}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {loading && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-[#4050B4] mb-3" />
                    <span className="text-xs font-black uppercase tracking-wider">Generando comparativa...</span>
                </div>
            )}

            {!loading && results.length === 0 && !error && (
                <div className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    Configura los slots y presiona &quot;Generar&quot; (o activa Auto)
                </div>
            )}
        </div>
    );
}

function KpiRow({
    label, icon, results, pick, fmt, deltaMode = 'percent', deltaSuffix = '%'
}: {
    label: string;
    icon: React.ReactNode;
    results: SlotResult[];
    pick: (k: SlotKpis) => number;
    fmt: (n: number) => string;
    deltaMode?: 'percent' | 'absolute';
    deltaSuffix?: string;
}) {
    const baseVal = results[0] ? pick(results[0].kpis) : 0;
    return (
        <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
            <td className="px-4 py-3 font-black text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="text-slate-400">{icon}</span>
                {label}
            </td>
            {results.map((r, idx) => {
                const v = pick(r.kpis);
                let deltaNode: React.ReactNode = null;
                if (idx > 0 && baseVal !== 0) {
                    const delta = deltaMode === 'percent' ? ((v - baseVal) / Math.abs(baseVal)) * 100 : (v - baseVal);
                    const positive = delta > 0;
                    const neutral = Math.abs(delta) < 0.01;
                    deltaNode = (
                        <div className={cn(
                            "text-[10px] font-black uppercase tracking-wider mt-0.5",
                            neutral ? "text-slate-400" : positive ? "text-emerald-600" : "text-rose-600"
                        )}>
                            {neutral ? <Minus size={10} className="inline" /> : positive ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                            {' '}
                            {positive && '+'}{delta.toFixed(1)}{deltaSuffix} vs A
                        </div>
                    );
                } else if (idx === 0 && results.length > 1) {
                    deltaNode = <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">base</div>;
                }
                return (
                    <td key={r.id} className="px-4 py-3 text-right tabular-nums">
                        <div className="text-base font-black text-slate-900">{fmt(v)}</div>
                        {deltaNode}
                    </td>
                );
            })}
        </tr>
    );
}

function SlotCard({
    slot, color, index, canRemove, canDuplicate, catalogs,
    onUpdate, onRemove, onDuplicate
}: {
    slot: Slot;
    color: string;
    index: number;
    canRemove: boolean;
    canDuplicate: boolean;
    catalogs: Catalogs;
    onUpdate: (patch: Partial<Slot>) => void;
    onRemove: () => void;
    onDuplicate: (mode: 'identical' | 'lastYear' | 'lastMonth') => void;
}) {
    const [showDupMenu, setShowDupMenu] = useState(false);
    const options = useMemo(() => dimensionOptions(catalogs, slot.dimension), [catalogs, slot.dimension]);
    const letter = String.fromCharCode(65 + index);

    const today = mtyDate();
    const periodShortcuts: { label: string; start: string; end: string }[] = [
        { label: 'Hoy', start: today, end: today },
        { label: '7d', start: mtyDate(-6), end: today },
        { label: '30d', start: mtyDate(-29), end: today },
        { label: 'Mes', start: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: today },
        { label: 'Mes ant.', start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })() },
        { label: 'Año', start: (() => { const d = mtyMonth(0); d.setFullYear(d.getFullYear() - 1); d.setMonth(d.getMonth() + 1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: today }
    ];

    return (
        <div className="bg-white border-l-4 border border-slate-200 shadow-sm" style={{ borderLeftColor: color }}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: `${color}08` }}>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black text-white" style={{ background: color }}>
                        {letter}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Slot {letter}</span>
                </div>
                <div className="flex items-center gap-1 relative">
                    {canDuplicate && (
                        <>
                            <button
                                onClick={() => setShowDupMenu(v => !v)}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                                title="Duplicar slot"
                            >
                                <Copy size={13} />
                            </button>
                            {showDupMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowDupMenu(false)} />
                                    <div className="absolute right-0 top-8 bg-white border border-slate-200 shadow-xl z-20 min-w-[180px]">
                                        <button onClick={() => { onDuplicate('identical'); setShowDupMenu(false); }} className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                                            Duplicar idéntico
                                        </button>
                                        <button onClick={() => { onDuplicate('lastMonth'); setShowDupMenu(false); }} className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 border-t border-slate-100">
                                            Duplicar · Mes anterior
                                        </button>
                                        <button onClick={() => { onDuplicate('lastYear'); setShowDupMenu(false); }} className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 border-t border-slate-100">
                                            Duplicar · Año anterior
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                    {canRemove && (
                        <button
                            onClick={onRemove}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Quitar slot"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-3">
                {/* Etiqueta custom */}
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Etiqueta (opcional)</label>
                    <input
                        type="text"
                        value={slot.label}
                        onChange={e => onUpdate({ label: e.target.value })}
                        placeholder={buildSlotLabel(slot, catalogs).slice(0, 40)}
                        className="w-full border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4050B4]"
                    />
                </div>

                {/* Dimensión */}
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Comparar por</label>
                    <select
                        value={slot.dimension}
                        onChange={e => onUpdate({ dimension: e.target.value as Dimension, values: [] })}
                        className="w-full border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-[#4050B4]"
                    >
                        {DIMENSIONS.map(d => (
                            <option key={d.key} value={d.key}>{d.label}</option>
                        ))}
                    </select>
                </div>

                {/* Valores */}
                {slot.dimension !== 'todos' && (
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            Valores {options.length > 0 && <span className="text-slate-300">({options.length} disponibles)</span>}
                        </label>
                        <MultiSelect
                            options={options}
                            selectedValues={slot.values}
                            onChange={v => onUpdate({ values: v })}
                            placeholder={slot.values.length === 0 ? 'Todos' : `${slot.values.length} seleccionados`}
                        />
                    </div>
                )}

                {/* Periodo */}
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Periodo</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1 border border-slate-200 px-2 py-1">
                            <Calendar size={12} className="text-slate-400" />
                            <input
                                type="date"
                                value={slot.fechaInicio}
                                onChange={e => onUpdate({ fechaInicio: e.target.value })}
                                className="w-full text-xs font-bold text-slate-700 border-none p-0 outline-none bg-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-1 border border-slate-200 px-2 py-1">
                            <Calendar size={12} className="text-slate-400" />
                            <input
                                type="date"
                                value={slot.fechaFin}
                                onChange={e => onUpdate({ fechaFin: e.target.value })}
                                className="w-full text-xs font-bold text-slate-700 border-none p-0 outline-none bg-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Quick periods */}
                <div className="flex flex-wrap gap-1">
                    {periodShortcuts.map(p => {
                        const active = slot.fechaInicio === p.start && slot.fechaFin === p.end;
                        return (
                            <button
                                key={p.label}
                                onClick={() => onUpdate({ fechaInicio: p.start, fechaFin: p.end })}
                                className={cn(
                                    "px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all",
                                    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                )}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                </div>

                {/* Shift periodo */}
                <div className="flex gap-1 pt-2 border-t border-slate-100">
                    <button
                        onClick={() => onUpdate({ fechaInicio: offsetDate(slot.fechaInicio, -365), fechaFin: offsetDate(slot.fechaFin, -365) })}
                        className="flex-1 px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                        ← Año
                    </button>
                    <button
                        onClick={() => onUpdate({ fechaInicio: offsetDate(slot.fechaInicio, -30), fechaFin: offsetDate(slot.fechaFin, -30) })}
                        className="flex-1 px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                        ← Mes
                    </button>
                    <button
                        onClick={() => onUpdate({ fechaInicio: offsetDate(slot.fechaInicio, 30), fechaFin: offsetDate(slot.fechaFin, 30) })}
                        className="flex-1 px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                        Mes →
                    </button>
                    <button
                        onClick={() => onUpdate({ fechaInicio: offsetDate(slot.fechaInicio, 365), fechaFin: offsetDate(slot.fechaFin, 365) })}
                        className="flex-1 px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                        Año →
                    </button>
                </div>
            </div>
        </div>
    );
}
