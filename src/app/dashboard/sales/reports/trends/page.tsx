"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    TrendingUp, TrendingDown, Calendar, Store, ArrowUpRight, 
    ArrowDownRight, RefreshCcw, ChevronRight, LayoutGrid, 
    ShoppingCart, Ticket, DollarSign, Clock, CalendarDays, CalendarRange,
    CheckSquare, Square, Package, Tags, User, Layers, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SalesTrendsChart } from '@/components/dashboard/sales-trends-chart';
import { SalesTrendsDetails } from '@/components/dashboard/sales-trends-details';
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

export default function SalesTrendsPage() {
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
    const [data, setData] = useState<any>(null);
    const [stores, setStores] = useState<any[]>([]);

    // Advanced Filters
    const [filterOptions, setFilterOptions] = useState<any>({ deptos: [], familias: [], articulos: [], proveedores: [] });
    const [selectedDeptos, setSelectedDeptos] = useState<string[]>([]);
    const [selectedFamilias, setSelectedFamilias] = useState<string[]>([]);
    const [selectedArticulos, setSelectedArticulos] = useState<string[]>([]);
    const [selectedProveedores, setSelectedProveedores] = useState<string[]>([]);
    const [providerArticles, setProviderArticles] = useState<any[]>([]);
    const [syncingProvider, setSyncingProvider] = useState(false);

    useEffect(() => {
        fetch('/api/dashboard/trends/filters')
            .then(res => res.json())
            .then(json => setFilterOptions(json))
            .catch(err => console.error('Error fetching filters:', err));
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const idTiendaParam = selectedStoreIds.length > 0 ? selectedStoreIds.join(',') : 'all';
            let url = `/api/dashboard/sales/trends?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&idTienda=${idTiendaParam}&groupBy=${groupBy}`;
            if (selectedDeptos.length > 0) url += `&idDepto=${selectedDeptos.join(',')}`;
            if (selectedFamilias.length > 0) url += `&familia=${encodeURIComponent(selectedFamilias.join(','))}`;
            if (selectedArticulos.length > 0) url += `&codigoInterno=${selectedArticulos.join(',')}`;
            if (selectedProveedores.length > 0) url += `&idProveedor=${selectedProveedores.join(',')}`;

            const res = await fetch(url);
            const json = await res.json();
            setData(json);
            
            if (stores.length === 0 && json.branchTrends) {
                setStores(json.branchTrends.map((b: any) => ({ IdTienda: b.IdTienda, Tienda: b.Tienda })));
            }
        } catch (error) {
            console.error('Error fetching trends:', error);
        } finally {
            setLoading(false);
        }
    }, [fechaInicio, fechaFin, selectedStoreIds, groupBy, selectedDeptos, selectedFamilias, selectedArticulos, selectedProveedores, stores.length]);

    const handleProvidersChange = async (ids: string[]) => {
        const lastSelected = ids.length > selectedProveedores.length 
            ? ids.find(id => !selectedProveedores.includes(id)) 
            : null;
        
        setSelectedProveedores(ids);
        
        if (lastSelected) {
            setSyncingProvider(true);
            try {
                const res = await fetch('/api/dashboard/trends/provider-articles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idProveedor: lastSelected })
                });
                const json = await res.json();
                if (json.articles) {
                    // Merge new articles with existing ones, avoiding duplicates
                    setProviderArticles(prev => {
                        const newArts = json.articles.filter((a: any) => !prev.some(p => p.CodigoInterno === a.CodigoInterno));
                        return [...prev, ...newArts];
                    });
                }
            } catch (err) {
                console.error('Error syncing provider articles:', err);
            } finally {
                setSyncingProvider(false);
            }
        } else if (ids.length === 0) {
            setProviderArticles([]);
        }
    };


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

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
    };

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
        },
        { 
            label: '2 Años', 
            start: (() => { const d = mtyMonth(-24); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
            end: today 
        },
    ];

    const currentStoreTitle = useMemo(() => {
        if (selectedStoreIds.length === 0) return 'Todas las sucursales';
        if (selectedStoreIds.length === 1) {
            return stores.find(s => s.IdTienda.toString() === selectedStoreIds[0])?.Tienda || 'Sucursal';
        }
        return `${selectedStoreIds.length} sucursales seleccionadas`;
    }, [selectedStoreIds, stores]);

    const filterTitle = useMemo(() => {
        const parts = [];
        
        if (selectedDeptos.length > 0) {
            const names = selectedDeptos.map(id => filterOptions.deptos.find((d: any) => d.IdDepto.toString() === id)?.Depto).filter(Boolean);
            parts.push(names.length > 2 ? `${names.length} DEPTOS` : names.join(', '));
        }
        if (selectedFamilias.length > 0) {
            parts.push(selectedFamilias.length > 2 ? `${selectedFamilias.length} FAMILIAS` : selectedFamilias.join(', '));
        }
        if (selectedArticulos.length > 0) {
            const names = selectedArticulos.map(id => filterOptions.articulos.find((a: any) => a.CodigoInterno.toString() === id)?.Descripcion).filter(Boolean);
            parts.push(names.length > 2 ? `${names.length} ARTÍCULOS` : names.join(', '));
        }
        if (selectedProveedores.length > 0) {
            const names = selectedProveedores.map(id => filterOptions.proveedores.find((p: any) => p.IdProveedor.toString() === id)?.Proveedor).filter(Boolean);
            parts.push(names.length > 2 ? `${names.length} PROVEEDORES` : names.join(', '));
        }

        return parts.length > 0 ? ` / ${parts.join(' - ')}` : '';
    }, [selectedDeptos, selectedFamilias, selectedArticulos, selectedProveedores, filterOptions]);

    const storeColor = useMemo(() => {
        if (selectedStoreIds.length === 1) {
            const name = stores.find(s => s.IdTienda.toString() === selectedStoreIds[0])?.Tienda;
            return name ? getStoreColor(name) : '#4050B4';
        }
        return '#4050B4'; // Default for multi or all
    }, [selectedStoreIds, stores]);

    const totalSales = data?.timeSeries?.reduce((acc: number, curr: any) => acc + curr.Total, 0) || 0;
    const totalOps = data?.timeSeries?.reduce((acc: number, curr: any) => acc + curr.Operaciones, 0) || 0;
    const ticketPromedio = totalOps > 0 ? totalSales / totalOps : 0;
    
    // Variation metrics
    const currentTotal = data?.branchTrends?.reduce((acc: number, curr: any) => acc + curr.CurrentTotal, 0) || 0;
    const prevTotal = data?.branchTrends?.reduce((acc: number, curr: any) => acc + curr.PrevTotal, 0) || 0;
    const globalTrend = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

    return (
        <div className="space-y-6">
            {/* Header with Filters & Periods */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-3 px-6 rounded-none shadow-sm border border-slate-100">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                        <TrendingUp style={{ color: storeColor }} />
                        TENDENCIAS
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
                    <button
                        onClick={fetchData}
                        className="p-2.5 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 transition-colors rounded-none"
                    >
                        <RefreshCcw size={18} className={cn(loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Advanced Filters Bar */}
            <div className="bg-slate-900 py-3 px-6 rounded-none shadow-lg border-t border-slate-800 flex flex-wrap items-center gap-4">
                <MultiSelect 
                    options={filterOptions.deptos.map((d: any) => ({ label: d.Depto, value: d.IdDepto.toString() }))}
                    selectedValues={selectedDeptos}
                    onChange={setSelectedDeptos}
                    placeholder="DEPTOS"
                    icon={<Layers size={14} className="text-blue-400" />}
                    className="w-48"
                />

                <MultiSelect 
                    options={filterOptions.familias.map((f: any) => ({ label: f.Familia, value: f.Familia }))}
                    selectedValues={selectedFamilias}
                    onChange={setSelectedFamilias}
                    placeholder="FAMILIAS"
                    icon={<Tags size={14} className="text-purple-400" />}
                    className="w-48"
                />

                <MultiSelect 
                    options={filterOptions.articulos.map((a: any) => ({ label: a.Descripcion, value: a.CodigoInterno.toString() }))}
                    selectedValues={selectedArticulos}
                    onChange={setSelectedArticulos}
                    placeholder="ARTICULOS"
                    icon={<Package size={14} className="text-amber-400" />}
                    className="w-64"
                />

                <div className="flex items-center gap-2 border-l border-slate-700 pl-4 ml-2">
                    <MultiSelect 
                        options={filterOptions.proveedores.map((p: any) => ({ label: p.Proveedor, value: p.IdProveedor.toString() }))}
                        selectedValues={selectedProveedores}
                        onChange={handleProvidersChange}
                        placeholder="PROVEEDORES"
                        icon={<User size={14} className="text-emerald-400" />}
                        className="w-64"
                    />
                    {syncingProvider && <RefreshCcw size={14} className="text-emerald-400 animate-spin ml-2" />}
                </div>

                {(selectedDeptos.length > 0 || selectedFamilias.length > 0 || selectedArticulos.length > 0 || selectedProveedores.length > 0) && (
                    <button 
                        onClick={() => {
                            setSelectedDeptos([]);
                            setSelectedFamilias([]);
                            setSelectedArticulos([]);
                            setSelectedProveedores([]);
                            setProviderArticles([]);
                        }}
                        className="text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-300 transition-colors ml-auto"
                    >
                        Limpiar Filtros
                    </button>
                )}
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-none border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <DollarSign size={80} style={{ color: storeColor }} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Venta Total</span>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">{formatCurrency(totalSales)}</h2>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold border-t border-slate-50 pt-4 mt-2">
                        <span className="text-slate-500">Ticket Promedio</span>
                        <span style={{ color: storeColor }}>{formatCurrency(ticketPromedio)}</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-none border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <ShoppingCart size={80} className="text-emerald-500" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Operaciones</span>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">{totalOps}</h2>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 p-2 rounded-none mt-4">
                        <ArrowUpRight size={14} className="text-emerald-500" />
                        <span>Flujo de tickets</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-none border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        {globalTrend > 0 ? <TrendingUp size={80} style={{ color: storeColor }} /> : <TrendingDown size={80} className="text-rose-500" />}
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Variación</span>
                        <h2 className={cn("text-2xl font-black mb-2", globalTrend > 0 ? "text-[#4050B4]" : "text-rose-600")} style={{ color: globalTrend > 0 ? storeColor : undefined }}>
                            {globalTrend > 0 ? '+' : ''}{globalTrend.toFixed(1)}%
                        </h2>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold border-t border-slate-50 pt-4 mt-2">
                        <span className="text-slate-500">Vs. Periodo Anterior</span>
                        <span className={cn(globalTrend > 0 ? "text-emerald-600" : "text-rose-600")}>
                            {formatCurrency(currentTotal - prevTotal)}
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-none shadow-xl shadow-blue-500/20 relative overflow-hidden group" style={{ backgroundColor: storeColor }}>
                    <div className="absolute top-0 right-0 p-3 opacity-20">
                        <LayoutGrid size={80} className="text-white" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 block">Rendimiento</span>
                        <h2 className="text-2xl font-black text-white mb-2 uppercase truncate pr-8">{currentStoreTitle}</h2>
                    </div>
                    <div className="w-full bg-white/10 h-1 rounded-full mt-4 overflow-hidden">
                        <div className="bg-white h-full rounded-full w-[85%]" />
                    </div>
                </div>
            </div>

            {/* Sidebar + Chart Layout */}
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-72 shrink-0">
                    <div className="bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Store size={14} />
                                Seleccionar sucursales
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
                                    "w-full flex items-center justify-between p-3 transition-all border-l-4 group",
                                    selectedStoreIds.length === 0 
                                        ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                        : "bg-white text-slate-600 border-transparent hover:bg-slate-50 hover:border-slate-200"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-none flex items-center justify-center text-xs font-black",
                                        selectedStoreIds.length === 0 ? "bg-white/20" : "bg-slate-100 text-slate-400"
                                    )}>
                                        AZ
                                    </div>
                                    <span className="text-[13px] font-bold tracking-tight uppercase">Todas las sucursales</span>
                                </div>
                                {selectedStoreIds.length === 0 ? (
                                    <CheckSquare size={14} className="text-white" />
                                ) : (
                                    <Square size={14} className="text-slate-200" />
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
                                            "w-full flex items-center justify-between p-3 transition-all border-l-4 group",
                                            isActive 
                                                ? "bg-white text-slate-900 shadow-lg ring-1 ring-slate-200"
                                                : "bg-white text-slate-600 border-transparent hover:bg-slate-50"
                                        )}
                                        style={{ borderLeftColor: isActive ? color : 'transparent' }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className={cn(
                                                    "w-8 h-8 rounded-none flex items-center justify-center text-[10px] font-black text-white shadow-sm transition-opacity",
                                                    !isActive && "opacity-40"
                                                )}
                                                style={{ backgroundColor: color }}
                                            >
                                                {store.Tienda.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className={cn(
                                                "text-[13px] font-bold tracking-tight uppercase",
                                                isActive ? "text-slate-900" : "text-slate-500"
                                            )}>{store.Tienda}</span>
                                        </div>
                                        {isActive ? (
                                            <CheckSquare size={14} style={{ color: color }} />
                                        ) : (
                                            <Square size={14} className="text-slate-200 opacity-0 group-hover:opacity-100" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="space-y-4">
                         <div className="bg-white border border-slate-100 shadow-sm p-4 h-[500px] flex flex-col">
                            <div className="mb-4 pb-3 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center flex-wrap gap-2">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: storeColor }} />
                                    Tendencia de Venta
                                    <span className="text-slate-300 font-light mx-1">/</span>
                                    <span style={{ color: storeColor }}>{currentStoreTitle}</span>
                                    {filterTitle && (
                                        <span className="text-slate-400 font-medium text-xs normal-case bg-slate-50 px-2 py-1 rounded-none border border-slate-100">
                                            {filterTitle.substring(3)}
                                        </span>
                                    )}
                                </h2>

                                 <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-none p-0.5 self-end md:self-auto">
                                    <button
                                        onClick={() => setMetric('venta')}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                                            metric === 'venta' ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                        )}
                                        title="Por Venta"
                                    >
                                        <DollarSign size={12} /> Venta
                                    </button>
                                    <button
                                        onClick={() => setMetric('operaciones')}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                                            metric === 'operaciones' ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                        )}
                                        title="Por Operaciones"
                                    >
                                        <ShoppingCart size={12} /> Ops
                                    </button>
                                    <button
                                        onClick={() => setMetric('ticket')}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                                            metric === 'ticket' ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                        )}
                                        title="Por Ticket Promedio"
                                    >
                                        <Ticket size={12} /> Ticket
                                    </button>
                                </div>

                                {/* Grouping Toggle */}
                                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-none p-0.5 self-end md:self-auto">
                                    <button
                                        onClick={() => setGroupBy('dia')}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                                            groupBy === 'dia' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                        )}
                                    >
                                        <Clock size={12} /> Día
                                    </button>
                                    <button
                                        onClick={() => setGroupBy('semana')}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                                            groupBy === 'semana' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                        )}
                                    >
                                        <CalendarDays size={12} /> Sem
                                    </button>
                                    <button
                                        onClick={() => setGroupBy('mes')}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                                            groupBy === 'mes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                        )}
                                    >
                                        <CalendarRange size={12} /> Mes
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 pt-2">
                                <SalesTrendsChart 
                                    data={data?.timeSeries || []} 
                                    height={380} 
                                    color={storeColor} 
                                    groupBy={groupBy} 
                                    isMulti={selectedStoreIds.length > 1} 
                                    metric={metric}
                                />
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            {data?.branchTrends && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                        <SalesTrendsDetails data={data.branchTrends} />
                    </div>
                    <div className="bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Package size={14} className="text-emerald-500" />
                                Artículos del Proveedor
                             </h2>
                             {selectedProveedores.length > 0 && (
                                 <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">
                                     {providerArticles.length} items
                                 </span>
                             )}
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-0">
                            {selectedProveedores.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                                    <Info size={32} className="opacity-20" />
                                    <p className="text-xs font-bold uppercase tracking-tight">Selecciona un proveedor para ver sus artículos</p>
                                </div>
                            ) : providerArticles.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                                    {syncingProvider ? <RefreshCcw size={32} className="animate-spin opacity-20" /> : <Package size={32} className="opacity-20" />}
                                    <p className="text-xs font-bold uppercase tracking-tight">
                                        {syncingProvider ? 'Sincronizando...' : 'No hay artículos asociados a este proveedor'}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {providerArticles.map((art: any) => (
                                        <div key={art.CodigoInterno} className="p-3 hover:bg-slate-50 transition-colors group">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[11px] font-black text-slate-800 uppercase line-clamp-2">{art.Descripcion}</span>
                                                <span className="text-[9px] font-black text-slate-400 ml-2">#{art.CodigoInterno}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1">
                                                    <DollarSign size={10} className="text-slate-400" />
                                                    <span className="text-[10px] font-bold text-emerald-600">{formatCurrency(art.Costo || 0)}</span>
                                                </div>
                                                {art.CodigoCompra && (
                                                    <div className="flex items-center gap-1">
                                                        <Info size={10} className="text-slate-400" />
                                                        <span className="text-[9px] font-medium text-slate-500 uppercase">{art.CodigoCompra}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
