"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    TrendingUp, Calendar, Store, RefreshCcw, 
    ShoppingCart, Ticket, DollarSign, Clock, CalendarDays, CalendarRange,
    CheckSquare, Square, Package, Tags, User, Layers, Info, ArrowRightLeft,
    ChevronDown, ChevronUp, Printer, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SalesComparisonChart } from '@/components/dashboard/sales-comparison-chart';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { MultiSelect } from '@/components/ui/multi-select';

const STORE_COLOR_MAP: Record<string, string> = {
    'BODEGA 238': '#35e844',
    'ARAMBERRI 210': '#eb0258',
    'LINCOLN': '#fcc442',
    'LEONES': '#4ecdc4',
    'ZUAZUA': '#de6262',
    'VALLE SOLEADO': '#ff0f35',
    'RUPERTO MTZ QCF': '#029913',
    'SANTA CATARINA QCF': '#fea189',
    'SOLIDARIDAD': '#566965',
    'MERKADON': '#fcea42',
    'MERKDON': '#fcea42',
};

const STORE_COLORS = [
    '#2563EB', '#3B82F6', '#DC2626', '#EF4444', '#0D9488', '#14B8A6', '#D97706', '#F59E0B',
    '#16A34A', '#22C55E', '#064E3B'
];

const getStoreColor = (name: string) => {
    if (!name) return '#4050B4';
    const cleanName = name.trim().toUpperCase();
    if (STORE_COLOR_MAP[cleanName]) return STORE_COLOR_MAP[cleanName];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % STORE_COLORS.length;
    return STORE_COLORS[index];
};

type GroupFilters = {
    idDepto: string[];
    familia: string[];
    codigoInterno: string[];
    idProveedor: string[];
};

export default function SalesComparisonPage() {
    const mtyDate = (offset = 0) => {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
        d.setDate(d.getDate() + offset);
        return d.toLocaleDateString('en-CA');
    };
    
    const mtyMonth = (monthOffset = 0) => {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
        d.setMonth(d.getMonth() + monthOffset);
        return d;
    };

    const today = mtyDate();
    const currentMonthStart = (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })();

    const [fechaInicio, setFechaInicio] = useState(currentMonthStart);
    const [fechaFin, setFechaFin] = useState(today);
    const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
    const [groupBy, setGroupBy] = useState<'dia' | 'semana' | 'mes'>('dia');
    const [metric, setMetric] = useState<'venta' | 'operaciones' | 'ticket'>('venta');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ groupA: any[], groupB: any[] } | null>(null);
    const [stores, setStores] = useState<any[]>([]);

    const [filterOptions, setFilterOptions] = useState<any>({ deptos: [], familias: [], articulos: [], proveedores: [] });
    
    const [groupA, setGroupA] = useState<GroupFilters>({ idDepto: [], familia: [], codigoInterno: [], idProveedor: [] });
    const [groupB, setGroupB] = useState<GroupFilters>({ idDepto: [], familia: [], codigoInterno: [], idProveedor: [] });

    useEffect(() => {
        // Use existing filter endpoint
        fetch('/api/dashboard/trends/filters')
            .then(res => res.json())
            .then(json => setFilterOptions(json))
            .catch(err => console.error('Error fetching filters:', err));

        // Fetch stores from trends API initially to populate the sidebar
        fetch('/api/dashboard/sales/trends?fechaInicio=' + currentMonthStart + '&fechaFin=' + today)
            .then(res => res.json())
            .then(json => {
                if (json.branchTrends) {
                    setStores(json.branchTrends.map((b: any) => ({ IdTienda: b.IdTienda, Tienda: b.Tienda })));
                }
            })
            .catch(err => console.error('Error fetching stores:', err));
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard/sales/comparison', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fechaInicio,
                    fechaFin,
                    idTienda: selectedStoreIds.length > 0 ? selectedStoreIds : 'all',
                    groupBy,
                    groupA,
                    groupB
                })
            });
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error('Error fetching comparison:', error);
        } finally {
            setLoading(false);
        }
    }, [fechaInicio, fechaFin, selectedStoreIds, groupBy, groupA, groupB]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleStoreToggle = (id: string) => {
        setSelectedStoreIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(i => i !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
    };

    const getGroupSummary = (group: GroupFilters) => {
        const parts = [];
        if (group.idDepto.length > 0) {
            const labels = filterOptions.deptos.filter((d: any) => group.idDepto.includes(d.IdDepto.toString())).map((d: any) => d.Depto);
            parts.push(`Depto: ${labels.join(', ')}`);
        }
        if (group.familia.length > 0) {
            parts.push(`Fam: ${group.familia.join(', ')}`);
        }
        if (group.codigoInterno.length > 0) {
            const labels = filterOptions.articulos.filter((a: any) => group.codigoInterno.includes(a.CodigoInterno.toString())).map((a: any) => a.CodigoInterno);
            parts.push(`Art: ${labels.join(', ')}`);
        }
        if (group.idProveedor.length > 0) {
            const labels = filterOptions.proveedores.filter((p: any) => group.idProveedor.includes(p.IdProveedor.toString())).map((p: any) => p.Proveedor);
            parts.push(`Prov: ${labels.join(', ')}`);
        }
        return parts.length > 0 ? parts.join(' | ') : 'Todos';
    };

    const summaryA = getGroupSummary(groupA);
    const summaryB = getGroupSummary(groupB);


    const periods = [
        { label: 'Mes', start: currentMonthStart, end: today },
        { 
            label: '3 Meses', 
            start: (() => { const d = mtyMonth(-3); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
            end: today 
        },
        { 
            label: '6 Meses', 
            start: (() => { const d = mtyMonth(-6); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
            end: today 
        },
        { 
            label: '1 Año', 
            start: (() => { const d = mtyMonth(-12); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
            end: today 
        }
    ];

    const currentStoreTitle = useMemo(() => {
        if (selectedStoreIds.length === 0) return 'Todas las sucursales';
        if (selectedStoreIds.length === 1) {
            return stores.find(s => s.IdTienda.toString() === selectedStoreIds[0])?.Tienda || 'Sucursal';
        }
        return `${selectedStoreIds.length} sucursales`;
    }, [selectedStoreIds, stores]);

    const totalA = data?.groupA?.reduce((acc: number, curr: any) => acc + curr.Total, 0) || 0;
    const totalB = data?.groupB?.reduce((acc: number, curr: any) => acc + curr.Total, 0) || 0;
    const opsA = data?.groupA?.reduce((acc: number, curr: any) => acc + curr.Operaciones, 0) || 0;
    const opsB = data?.groupB?.reduce((acc: number, curr: any) => acc + curr.Operaciones, 0) || 0;

    const diffPercent = totalB > 0 ? ((totalA - totalB) / totalB) * 100 : 0;

    const SelectionCard = ({ title, group, setGroup, color }: { title: string, group: GroupFilters, setGroup: any, color: string }) => (
        <div className="bg-white border-t-4 shadow-sm p-3 space-y-2" style={{ borderColor: color }}>
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h3>
                {(group.idDepto.length > 0 || group.familia.length > 0 || group.codigoInterno.length > 0 || group.idProveedor.length > 0) && (
                    <button 
                        onClick={() => setGroup({ idDepto: [], familia: [], codigoInterno: [], idProveedor: [] })}
                        className="text-[9px] font-black text-rose-500 uppercase hover:underline"
                    >
                        Limpiar
                    </button>
                )}
            </div>
            
            <div className="space-y-2">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-2">
                        <Layers size={12} /> Departamentos
                    </label>
                    <MultiSelect 
                        options={filterOptions.deptos.map((d: any) => ({ label: d.Depto, value: d.IdDepto.toString() }))}
                        selectedValues={group.idDepto}
                        onChange={(vals) => setGroup({ ...group, idDepto: vals })}
                        placeholder="Todos"
                        className="w-full"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-2">
                        <Tags size={12} /> Familias
                    </label>
                    <MultiSelect 
                        options={filterOptions.familias.map((f: any) => ({ label: f.Familia, value: f.Familia }))}
                        selectedValues={group.familia}
                        onChange={(vals) => setGroup({ ...group, familia: vals })}
                        placeholder="Todas"
                        className="w-full"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-2">
                        <Package size={12} /> Artículos
                    </label>
                    <MultiSelect 
                        options={filterOptions.articulos.map((a: any) => ({ 
                            label: `${a.Descripcion} [${a.CodigoInterno}]`, 
                            value: a.CodigoInterno.toString() 
                        }))}
                        selectedValues={group.codigoInterno}
                        onChange={(vals) => setGroup({ ...group, codigoInterno: vals })}
                        placeholder="Todos"
                        className="w-full"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-2">
                        <User size={12} /> Proveedores
                    </label>
                    <MultiSelect 
                        options={filterOptions.proveedores.map((p: any) => ({ label: p.Proveedor, value: p.IdProveedor.toString() }))}
                        selectedValues={group.idProveedor}
                        onChange={(vals) => setGroup({ ...group, idProveedor: vals })}
                        placeholder="Todos"
                        className="w-full"
                    />
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header with Filters & Periods */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-3 px-6 rounded-none shadow-sm border border-slate-100">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                        <ArrowRightLeft className="text-[#4050B4]" />
                        COMPARATIVAS
                    </h1>

                    <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-none p-0.5">
                        {periods.map(({ label, start, end }) => {
                            const isActive = fechaInicio === start && fechaFin === end;
                            return (
                                <button
                                    key={label}
                                    onClick={() => { setFechaInicio(start); setFechaFin(end); }}
                                    className={cn(
                                        'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                        isActive ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                    )}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5">
                        <Calendar size={16} className="text-[#4050B4]" />
                        <input
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto w-32"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5">
                        <Calendar size={16} className="text-[#4050B4]" />
                        <input
                            type="date"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto w-32"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors rounded-none"
                        >
                            <Printer size={14} />
                            Imprimir PDF
                        </button>
                        <button
                            onClick={fetchData}
                            className="p-2.5 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 transition-colors rounded-none"
                        >
                            <RefreshCcw size={18} className={cn(loading && "animate-spin")} />
                        </button>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    nav, .sidebar, aside, .no-print, button {
                        display: none !important;
                    }
                    body {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .main-content {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }
                    .grid {
                        display: grid !important;
                    }
                    /* Ensure charts are visible */
                    canvas, svg {
                        max-width: 100% !important;
                        height: auto !important;
                    }
                    /* Sidebar logic: When printing, the 'sidebar' (Sucursales) should probably be hidden or formatted differently. 
                       Usually, for a comparison report, you want the stats and the chart. 
                       I will hide the selection sidebar in print. */
                    .lg\\:w-80 {
                        display: none !important;
                    }
                    .flex-1 {
                        width: 100% !important;
                    }
                }
            `}</style>

            {/* Row 1: KPIs Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-black text-[#4050B4] uppercase tracking-widest mb-1 block">Total Grupo A</span>
                        <h2 className="text-2xl font-black text-slate-900">{formatCurrency(totalA)}</h2>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase leading-tight line-clamp-2" title={summaryA}>{summaryA}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-50">
                        <ShoppingCart size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">{opsA} Operaciones</span>
                    </div>
                </div>

                <div className="bg-white p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest mb-1 block">Total Grupo B</span>
                        <h2 className="text-2xl font-black text-slate-900">{formatCurrency(totalB)}</h2>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase leading-tight line-clamp-2" title={summaryB}>{summaryB}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-50">
                        <ShoppingCart size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">{opsB} Operaciones</span>
                    </div>
                </div>

                <div className="bg-slate-900 p-5 shadow-xl">
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1 block">Diferencia A vs B</span>
                    <h2 className={cn(
                        "text-2xl font-black",
                        diffPercent >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                        {diffPercent >= 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                        <DollarSign size={14} className="text-white/30" />
                        <span className="text-xs font-bold text-white/60">{formatCurrency(totalA - totalB)}</span>
                    </div>
                </div>
            </div>

            {/* Layout Container */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left Sidebar: Store Selection */}
                <div className="lg:w-80 shrink-0">
                    <div className="bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Store size={14} />
                                Sucursales
                             </h2>
                             {selectedStoreIds.length > 0 && (
                                <button 
                                    onClick={() => setSelectedStoreIds([])}
                                    className="text-[9px] font-black text-[#4050B4] uppercase hover:underline"
                                >
                                    Limpiar
                                </button>
                             )}
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                            <button
                                onClick={() => setSelectedStoreIds([])}
                                className={cn(
                                    "w-full flex items-center justify-between p-2.5 transition-all border-l-4 rounded-none group",
                                    selectedStoreIds.length === 0 
                                        ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                        : "bg-white text-slate-600 border-transparent hover:bg-slate-50 hover:border-slate-200"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-6 h-6 rounded-none flex items-center justify-center text-[8px] font-black",
                                        selectedStoreIds.length === 0 ? "bg-white/20" : "bg-slate-100 text-slate-400"
                                    )}>
                                        AZ
                                    </div>
                                    <span className="text-[11px] font-bold tracking-tight uppercase">Todas las sucursales</span>
                                </div>
                                {selectedStoreIds.length === 0 ? (
                                    <CheckSquare size={12} className="text-white" />
                                ) : (
                                    <Square size={12} className="text-slate-200" />
                                )}
                            </button>

                            {stores.map((store) => {
                                const isActive = selectedStoreIds.includes(store.IdTienda.toString());
                                const color = getStoreColor(store.Tienda);
                                return (
                                    <button
                                        key={store.IdTienda}
                                        onClick={() => handleStoreToggle(store.IdTienda.toString())}
                                        className={cn(
                                            "w-full flex items-center justify-between p-2.5 transition-all border-l-4 rounded-none",
                                            isActive 
                                                ? "bg-slate-50 text-slate-900 border-[#4050B4] shadow-sm"
                                                : "bg-white text-slate-600 border-transparent hover:bg-slate-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className={cn(
                                                    "w-6 h-6 rounded-none flex items-center justify-center text-[8px] font-black text-white",
                                                    !isActive && "opacity-40"
                                                )}
                                                style={{ backgroundColor: color }}
                                            >
                                                {store.Tienda.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className={cn(
                                                "text-[11px] font-bold tracking-tight uppercase",
                                                isActive ? "text-slate-900" : "text-slate-500"
                                            )}>{store.Tienda}</span>
                                        </div>
                                        {isActive ? (
                                            <CheckSquare size={12} className="text-[#4050B4]" />
                                        ) : (
                                            <Square size={12} className="text-slate-200" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Area: Filters and Chart */}
                <div className="flex-1 min-w-0 space-y-6">
                    {/* Filter Cards Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SelectionCard title="Grupo A" group={groupA} setGroup={setGroupA} color="#4050B4" />
                        <SelectionCard title="Grupo B" group={groupB} setGroup={setGroupB} color="#10B981" />
                    </div>

                    {/* Chart Row */}
                    <div className="bg-white border border-slate-100 shadow-sm p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                    <TrendingUp className="text-[#4050B4]" />
                                    Comparativa de Rendimiento
                                </h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    {currentStoreTitle} / {metric === 'venta' ? 'Ventas' : metric === 'operaciones' ? 'Operaciones' : 'Ticket Promedio'}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5">
                                    {(['venta', 'operaciones', 'ticket'] as const).map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => setMetric(m)}
                                            className={cn(
                                                'px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all',
                                                metric === m ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                            )}
                                        >
                                            {m === 'venta' ? 'Venta' : m === 'operaciones' ? 'Ops' : 'Ticket'}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5">
                                    {(['dia', 'semana', 'mes'] as const).map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setGroupBy(g)}
                                            className={cn(
                                                'px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all',
                                                groupBy === g ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                            )}
                                        >
                                            {g === 'dia' ? 'Día' : g === 'semana' ? 'Sem' : 'Mes'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="h-[400px]">
                            <SalesComparisonChart 
                                groupA={data?.groupA || []} 
                                groupB={data?.groupB || []} 
                                height={400}
                                groupBy={groupBy}
                                metric={metric}
                                nameA={`Grupo A (${getGroupSummary(groupA)})`}
                                nameB={`Grupo B (${getGroupSummary(groupB)})`}
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Info Card */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <div className="flex gap-3">
                    <Info className="text-blue-500 shrink-0" size={20} />
                    <div>
                        <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Guía de Comparación</h4>
                        <p className="text-xs text-blue-800 leading-relaxed">
                            Selecciona diferentes criterios en el <strong className="text-blue-900">Grupo A</strong> y <strong className="text-blue-900">Grupo B</strong> para comparar su desempeño. 
                        </p>
                    </div>
                </div>
            </div>
            
            {loading && <LoadingScreen />}
        </div>
    );
}
