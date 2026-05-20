'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Wand2, Store, Package, CalendarRange, ArrowRight, ArrowLeft, Check, Loader2,
    TrendingUp, TrendingDown, Minus, Receipt, ShoppingCart, DollarSign, Calendar, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { MultiSelect } from '@/components/ui/multi-select';

type Mode = 'sucursales' | 'productos' | 'periodos';
type SubDimension = 'depto' | 'categoria' | 'marca' | 'proveedor' | 'articulo';
type PeriodMode = 'mismo' | 'diferentes';

interface Catalogs {
    stores: Array<{ IdTienda: number; Tienda: string }>;
    deptos: Array<{ IdDepto: number; Depto: string }>;
    familias: string[];
    proveedores: Array<{ IdProveedor: number; Proveedor: string }>;
    articulos: Array<{ CodigoInterno: number; Descripcion: string }>;
}

interface SlotResult {
    id: string;
    label: string;
    kpis: {
        venta: number; costo: number; utilidad: number; margenPct: number;
        tickets: number; ticketProm: number; unidades: number;
    };
    series: Array<{ fecha: string; venta: number; tickets: number; dayIndex: number }>;
}

const SLOT_COLORS = ['#4050B4', '#10B981', '#F59E0B', '#EF4444'];

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

function offsetDate(s: string, days: number): string {
    const d = new Date(s);
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-CA');
}

const fmtMoney = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
const fmtNumber = (n: number) => new Intl.NumberFormat('es-MX').format(n || 0);
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;

export default function GuidedComparePage() {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [mode, setMode] = useState<Mode | null>(null);

    // Estado de selección (depende del modo)
    const [subDimension, setSubDimension] = useState<SubDimension>('depto');
    const [selectedValues, setSelectedValues] = useState<string[]>([]);

    // Estado de periodos
    const [periodMode, setPeriodMode] = useState<PeriodMode>('mismo');
    const [sharedStart, setSharedStart] = useState<string>(() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); });
    const [sharedEnd, setSharedEnd] = useState<string>(mtyDate());
    const [periodSlots, setPeriodSlots] = useState<Array<{ start: string; end: string; label: string }>>([
        { start: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: mtyDate(), label: 'Este mes' },
        { start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })(), label: 'Mes anterior' }
    ]);

    const [catalogs, setCatalogs] = useState<Catalogs>({
        stores: [], deptos: [], familias: [], proveedores: [], articulos: []
    });
    const [results, setResults] = useState<SlotResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [filtersRes, marginsRes] = await Promise.all([
                    fetch('/api/dashboard/trends/filters').then(r => r.json()),
                    fetch('/api/dashboard/sales/reports/margins?onlyStores=true&startDate=2020-01-01&endDate=' + mtyDate()).then(r => r.json())
                ]);
                setCatalogs({
                    stores: marginsRes.stores || [],
                    deptos: filtersRes.deptos || [],
                    familias: (filtersRes.familias || []).map((f: any) => f.Familia || f),
                    proveedores: filtersRes.proveedores || [],
                    articulos: filtersRes.articulos || []
                });
            } catch (e) {
                console.error('Catálogos:', e);
            }
        };
        load();
    }, []);

    const valueOptions = useMemo(() => {
        if (mode === 'sucursales') return catalogs.stores.map(s => ({ label: s.Tienda, value: String(s.IdTienda) }));
        if (mode === 'productos') {
            if (subDimension === 'depto') return catalogs.deptos.map(d => ({ label: d.Depto, value: String(d.IdDepto) }));
            if (subDimension === 'marca') return catalogs.familias.map(f => ({ label: f, value: f }));
            if (subDimension === 'proveedor') return catalogs.proveedores.map(p => ({ label: p.Proveedor, value: String(p.IdProveedor) }));
            if (subDimension === 'articulo') return catalogs.articulos.slice(0, 500).map(a => ({ label: `${a.CodigoInterno} - ${a.Descripcion}`, value: String(a.CodigoInterno) }));
            return [];
        }
        return [];
    }, [mode, subDimension, catalogs]);

    const canProceedFromStep2 = useMemo(() => {
        if (mode === 'periodos') return periodSlots.length >= 2;
        return selectedValues.length >= 2 || (mode === 'productos' && selectedValues.length >= 1);
    }, [mode, selectedValues, periodSlots]);

    const buildSlots = () => {
        if (mode === 'sucursales') {
            const start = periodMode === 'mismo' ? sharedStart : sharedStart;
            const end = periodMode === 'mismo' ? sharedEnd : sharedEnd;
            // Cada sucursal seleccionada = 1 slot, todos con el mismo periodo (esta UX no permite cruzar)
            return selectedValues.slice(0, 4).map((v, i) => ({
                id: `s${i}`,
                label: catalogs.stores.find(s => String(s.IdTienda) === v)?.Tienda || `Sucursal ${v}`,
                dimension: 'sucursal',
                values: [v],
                fechaInicio: start,
                fechaFin: end,
                groupBy: 'dia'
            }));
        }
        if (mode === 'productos') {
            const start = sharedStart;
            const end = sharedEnd;
            return selectedValues.slice(0, 4).map((v, i) => {
                const opt = valueOptions.find(o => o.value === v);
                return {
                    id: `p${i}`,
                    label: opt?.label || v,
                    dimension: subDimension,
                    values: [v],
                    fechaInicio: start,
                    fechaFin: end,
                    groupBy: 'dia'
                };
            });
        }
        if (mode === 'periodos') {
            // Si hay valores seleccionados, los uso como filtro de dimensión, si no: empresa completa
            const dim = selectedValues.length > 0 ? subDimension : 'todos';
            return periodSlots.slice(0, 4).map((p, i) => ({
                id: `t${i}`,
                label: p.label,
                dimension: dim,
                values: selectedValues,
                fechaInicio: p.start,
                fechaFin: p.end,
                groupBy: 'dia'
            }));
        }
        return [];
    };

    const generate = async () => {
        const slots = buildSlots();
        if (slots.length === 0) {
            setError('No hay slots para comparar');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/sales/slot-compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slots })
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Error');
            setResults(json.slots);
            setStep(4);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const restart = () => {
        setStep(1);
        setMode(null);
        setSelectedValues([]);
        setResults([]);
        setError(null);
    };

    const chartData = useMemo(() => {
        const maxLen = Math.max(0, ...results.map(r => r.series.length));
        const data: any[] = [];
        for (let i = 0; i < maxLen; i++) {
            const point: any = { dayIndex: i };
            results.forEach((slot, idx) => {
                const s = slot.series[i];
                if (s) point[`slot_${idx}`] = s.venta;
            });
            data.push(point);
        }
        return data;
    }, [results]);

    return (
        <div className="p-6 pt-3 md:p-8 md:pt-4 max-w-[1400px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 bg-white p-4 border border-slate-100 shadow-sm mb-6">
                <div className="flex items-center gap-2">
                    <Wand2 className="text-[#4050B4]" size={22} />
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">Comparativa Guiada</h1>
                        <p className="text-[11px] text-slate-500 font-bold">Wizard en 3 pasos — para cuando sabes qué quieres comparar pero no cómo</p>
                    </div>
                </div>
                {step > 1 && (
                    <button onClick={restart} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#4050B4] transition-colors">
                        ↺ Empezar de nuevo
                    </button>
                )}
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2 mb-6">
                {[
                    { n: 1, label: '¿Qué comparas?' },
                    { n: 2, label: '¿Cuáles?' },
                    { n: 3, label: '¿Cuándo?' },
                    { n: 4, label: 'Resultado' }
                ].map((s, i) => (
                    <div key={s.n} className="flex items-center gap-2 flex-1">
                        <div className={cn(
                            'flex items-center gap-2 px-3 py-2 border-2 transition-all flex-1',
                            step === s.n ? 'bg-[#4050B4] border-[#4050B4] text-white' :
                                step > s.n ? 'bg-emerald-50 border-emerald-300 text-emerald-700' :
                                    'bg-white border-slate-200 text-slate-400'
                        )}>
                            <span className={cn(
                                'w-6 h-6 inline-flex items-center justify-center rounded-full text-[11px] font-black',
                                step === s.n ? 'bg-white text-[#4050B4]' :
                                    step > s.n ? 'bg-emerald-600 text-white' :
                                        'bg-slate-100 text-slate-500'
                            )}>
                                {step > s.n ? <Check size={12} /> : s.n}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">{s.label}</span>
                        </div>
                        {i < 3 && <ArrowRight size={14} className={cn(step > s.n ? 'text-emerald-500' : 'text-slate-300')} />}
                    </div>
                ))}
            </div>

            {/* PASO 1: ¿Qué comparas? */}
            {step === 1 && (
                <div className="bg-white border border-slate-200 shadow-sm p-8">
                    <h2 className="text-base font-black text-slate-900 mb-1">¿Qué quieres comparar?</h2>
                    <p className="text-xs text-slate-500 font-bold mb-6">Elige el tipo de comparación más natural para tu pregunta.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { m: 'sucursales' as Mode, icon: <Store size={28} />, title: 'Sucursales', desc: 'Compara desempeño entre tiendas', ex: 'Centro vs Leones vs Zuazua' },
                            { m: 'productos' as Mode, icon: <Package size={28} />, title: 'Productos', desc: 'Compara venta entre productos, categorías, marcas o proveedores', ex: 'Departamento Abarrotes vs Carnes' },
                            { m: 'periodos' as Mode, icon: <CalendarRange size={28} />, title: 'Periodos', desc: 'Compara el mismo dato en diferentes momentos del tiempo', ex: 'Marzo 2026 vs Marzo 2025' }
                        ].map(opt => (
                            <button
                                key={opt.m}
                                onClick={() => { setMode(opt.m); setStep(2); }}
                                className="text-left p-6 border-2 border-slate-200 hover:border-[#4050B4] hover:bg-[#4050B4]/5 transition-all group"
                            >
                                <div className="text-[#4050B4] mb-3">{opt.icon}</div>
                                <h3 className="text-sm font-black text-slate-900 mb-1 group-hover:text-[#4050B4]">{opt.title}</h3>
                                <p className="text-xs text-slate-500 font-bold mb-3 leading-relaxed">{opt.desc}</p>
                                <p className="text-[10px] text-slate-400 font-bold italic">Ej: {opt.ex}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* PASO 2: ¿Cuáles? */}
            {step === 2 && mode && (
                <div className="bg-white border border-slate-200 shadow-sm p-8">
                    <h2 className="text-base font-black text-slate-900 mb-1">
                        {mode === 'sucursales' && 'Selecciona las sucursales a comparar'}
                        {mode === 'productos' && 'Selecciona los productos/grupos a comparar'}
                        {mode === 'periodos' && 'Define los periodos a comparar'}
                    </h2>
                    <p className="text-xs text-slate-500 font-bold mb-6">
                        {mode === 'periodos' ? 'Mínimo 2, máximo 4 periodos.' : 'Mínimo 2, máximo 4 elementos para ver la comparativa más clara.'}
                    </p>

                    {/* Sucursales */}
                    {mode === 'sucursales' && (
                        <MultiSelect
                            options={valueOptions}
                            selectedValues={selectedValues}
                            onChange={setSelectedValues}
                            placeholder="Elige sucursales..."
                            icon={<Store size={14} />}
                        />
                    )}

                    {/* Productos */}
                    {mode === 'productos' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Tipo de producto</label>
                                <div className="flex flex-wrap gap-2">
                                    {(['depto', 'marca', 'proveedor', 'articulo'] as SubDimension[]).map(sd => (
                                        <button
                                            key={sd}
                                            onClick={() => { setSubDimension(sd); setSelectedValues([]); }}
                                            className={cn(
                                                "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border",
                                                subDimension === sd ? "bg-[#4050B4] text-white border-[#4050B4]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            {sd === 'depto' ? 'Departamento' : sd === 'marca' ? 'Familia' : sd === 'proveedor' ? 'Proveedor' : 'Artículo'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                    Elige {subDimension === 'depto' ? 'departamentos' : subDimension === 'marca' ? 'familias' : subDimension === 'proveedor' ? 'proveedores' : 'artículos'}
                                </label>
                                <MultiSelect
                                    options={valueOptions}
                                    selectedValues={selectedValues}
                                    onChange={setSelectedValues}
                                    placeholder="Buscar y seleccionar..."
                                    icon={<Package size={14} />}
                                />
                            </div>
                        </div>
                    )}

                    {/* Periodos */}
                    {mode === 'periodos' && (
                        <div className="space-y-3">
                            {periodSlots.map((p, i) => (
                                <div key={i} className="border border-slate-200 p-4 flex items-end gap-3">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Etiqueta</label>
                                        <input
                                            type="text"
                                            value={p.label}
                                            onChange={e => setPeriodSlots(ps => ps.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                                            className="w-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4050B4]"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Inicio</label>
                                        <input
                                            type="date"
                                            value={p.start}
                                            onChange={e => setPeriodSlots(ps => ps.map((x, j) => j === i ? { ...x, start: e.target.value } : x))}
                                            className="w-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4050B4]"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Fin</label>
                                        <input
                                            type="date"
                                            value={p.end}
                                            onChange={e => setPeriodSlots(ps => ps.map((x, j) => j === i ? { ...x, end: e.target.value } : x))}
                                            className="w-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4050B4]"
                                        />
                                    </div>
                                    {periodSlots.length > 2 && (
                                        <button
                                            onClick={() => setPeriodSlots(ps => ps.filter((_, j) => j !== i))}
                                            className="px-2 py-2 text-rose-500 hover:bg-rose-50 text-xs font-black"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                            <div className="flex flex-wrap gap-2">
                                {periodSlots.length < 4 && (
                                    <button
                                        onClick={() => setPeriodSlots(ps => [...ps, { start: mtyDate(-29), end: mtyDate(), label: `Periodo ${ps.length + 1}` }])}
                                        className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                                    >
                                        + Periodo
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (periodSlots.length >= 4) return;
                                        const last = periodSlots[periodSlots.length - 1];
                                        setPeriodSlots(ps => [...ps, {
                                            start: offsetDate(last.start, -365),
                                            end: offsetDate(last.end, -365),
                                            label: `${last.label} (año anterior)`
                                        }]);
                                    }}
                                    disabled={periodSlots.length >= 4}
                                    className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-[#4050B4]/10 text-[#4050B4] hover:bg-[#4050B4]/20 disabled:opacity-40 transition-all"
                                >
                                    + Año anterior del último
                                </button>
                            </div>

                            {/* Filtro dimensional opcional para periodos */}
                            <details className="border border-slate-200 p-3">
                                <summary className="text-xs font-black uppercase tracking-wider text-slate-700 cursor-pointer">Filtrar por dimensión (opcional)</summary>
                                <div className="mt-3 space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {(['depto', 'marca', 'proveedor', 'articulo'] as SubDimension[]).map(sd => (
                                            <button
                                                key={sd}
                                                onClick={() => { setSubDimension(sd); setSelectedValues([]); }}
                                                className={cn(
                                                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all border",
                                                    subDimension === sd ? "bg-[#4050B4] text-white border-[#4050B4]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                {sd === 'depto' ? 'Departamento' : sd === 'marca' ? 'Familia' : sd === 'proveedor' ? 'Proveedor' : 'Artículo'}
                                            </button>
                                        ))}
                                    </div>
                                    <MultiSelect
                                        options={valueOptions}
                                        selectedValues={selectedValues}
                                        onChange={setSelectedValues}
                                        placeholder="Sin filtro = toda la empresa"
                                    />
                                </div>
                            </details>
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                        <button onClick={() => setStep(1)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors">
                            <ArrowLeft size={14} /> Atrás
                        </button>
                        <button
                            onClick={() => mode === 'periodos' ? generate() : setStep(3)}
                            disabled={!canProceedFromStep2}
                            className="flex items-center gap-1.5 px-5 py-2 bg-[#4050B4] hover:bg-[#3a47a0] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-colors"
                        >
                            {mode === 'periodos' ? 'Generar comparativa' : 'Siguiente'} <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* PASO 3: Periodos (solo para sucursales/productos) */}
            {step === 3 && mode !== 'periodos' && (
                <div className="bg-white border border-slate-200 shadow-sm p-8">
                    <h2 className="text-base font-black text-slate-900 mb-1">¿En qué periodo?</h2>
                    <p className="text-xs text-slate-500 font-bold mb-6">Define el rango de fechas para la comparación.</p>

                    {/* Quick periods */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {[
                            { label: 'Esta semana', start: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toLocaleDateString('en-CA'); })(), end: mtyDate() },
                            { label: 'Últimos 7 días', start: mtyDate(-6), end: mtyDate() },
                            { label: 'Últimos 30 días', start: mtyDate(-29), end: mtyDate() },
                            { label: 'Este mes', start: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: mtyDate() },
                            { label: 'Mes anterior', start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })() },
                            { label: 'Este año', start: `${new Date().getFullYear()}-01-01`, end: mtyDate() }
                        ].map(p => {
                            const active = sharedStart === p.start && sharedEnd === p.end;
                            return (
                                <button
                                    key={p.label}
                                    onClick={() => { setSharedStart(p.start); setSharedEnd(p.end); }}
                                    className={cn(
                                        "px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border",
                                        active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Date pickers */}
                    <div className="grid grid-cols-2 gap-4 max-w-md">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Desde</label>
                            <div className="flex items-center gap-2 border border-slate-200 px-3 py-2">
                                <Calendar size={14} className="text-slate-400" />
                                <input type="date" value={sharedStart} onChange={e => setSharedStart(e.target.value)} className="w-full text-xs font-bold text-slate-700 border-none p-0 outline-none bg-transparent" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Hasta</label>
                            <div className="flex items-center gap-2 border border-slate-200 px-3 py-2">
                                <Calendar size={14} className="text-slate-400" />
                                <input type="date" value={sharedEnd} onChange={e => setSharedEnd(e.target.value)} className="w-full text-xs font-bold text-slate-700 border-none p-0 outline-none bg-transparent" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                        <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors">
                            <ArrowLeft size={14} /> Atrás
                        </button>
                        <button
                            onClick={generate}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider transition-colors"
                        >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generar comparativa
                        </button>
                    </div>
                </div>
            )}

            {/* PASO 4: Resultado */}
            {step === 4 && results.length > 0 && (
                <>
                    {/* KPIs comparados */}
                    <div className="bg-white border border-slate-200 shadow-sm mb-6 overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">Comparativa</h2>
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
                                                    {r.label.slice(0, 25)}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <KpiRow label="Venta Total" icon={<DollarSign size={12} />} results={results} pick={k => k.venta} fmt={fmtMoney} />
                                    <KpiRow label="Tickets" icon={<Receipt size={12} />} results={results} pick={k => k.tickets} fmt={fmtNumber} />
                                    <KpiRow label="Ticket Promedio" icon={<ShoppingCart size={12} />} results={results} pick={k => k.ticketProm} fmt={fmtMoney} />
                                    <KpiRow label="Utilidad" icon={<TrendingUp size={12} />} results={results} pick={k => k.utilidad} fmt={fmtMoney} />
                                    <KpiRow label="Margen %" icon={<TrendingUp size={12} />} results={results} pick={k => k.margenPct} fmt={fmtPct} deltaMode="absolute" deltaSuffix="pp" />
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Gráfica */}
                    {chartData.length > 0 && (
                        <div className="bg-white border border-slate-200 shadow-sm p-5 mb-6">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Evolución de venta</h3>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis dataKey="dayIndex" tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `D${Number(v) + 1}`} />
                                        <YAxis tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (!active || !payload || payload.length === 0) return null;
                                                return (
                                                    <div className="bg-white border border-slate-200 shadow-lg p-3 min-w-[200px]">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-1.5 mb-1.5">
                                                            Día {Number(label) + 1}
                                                        </p>
                                                        {payload.map((p: any, i: number) => {
                                                            const idx = Number(p.dataKey.split('_')[1]);
                                                            return (
                                                                <div key={i} className="flex justify-between items-baseline text-[11px] font-bold py-0.5">
                                                                    <span className="flex items-center gap-1.5 text-slate-700">
                                                                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
                                                                        {results[idx]?.label.slice(0, 25)}
                                                                    </span>
                                                                    <span className="font-black tabular-nums ml-3" style={{ color: p.color }}>{fmtMoney(p.value)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 10 }} formatter={(value: string) => {
                                            const idx = Number(value.split('_')[1]);
                                            return results[idx]?.label.slice(0, 30) || value;
                                        }} />
                                        {results.map((_, idx) => (
                                            <Line key={idx} type="monotone" dataKey={`slot_${idx}`} stroke={SLOT_COLORS[idx]} strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-center gap-3">
                        <button onClick={restart} className="px-5 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 transition-colors">
                            ↺ Nueva comparativa
                        </button>
                        <a
                            href="/dashboard/sales/reports/quick-compare"
                            className="px-5 py-2 text-xs font-black uppercase tracking-wider bg-[#4050B4]/10 text-[#4050B4] hover:bg-[#4050B4]/20 transition-colors"
                        >
                            Abrir en Comparativa Simple →
                        </a>
                    </div>
                </>
            )}

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold mt-4">
                    {error}
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
    pick: (k: SlotResult['kpis']) => number;
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
                            {positive && '+'}{delta.toFixed(1)}{deltaSuffix}
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
