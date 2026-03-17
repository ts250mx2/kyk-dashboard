"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    ShoppingCart,
    RotateCcw,
    RotateCw,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    Maximize2,
    Minimize2,
    FileDown,
    LayoutGrid,
    ChevronUp,
    ChevronDown,
    Package,
    TrendingUp,
    Store,
    Wallet,
    AlertCircle,
    Rows,
    Columns,
    Truck,
    Box,
    Boxes,
    Warehouse,
    ClipboardList,
    FileSearch,
    ShieldCheck,
    Network
} from 'lucide-react';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { PurchaseDetailModal } from '@/components/purchase-detail-modal';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';
import { cn } from '@/lib/utils';

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

const STORE_COLORS_PALETTE = [
    '#2563EB', '#3B82F6', '#DC2626', '#EF4444', '#0D9488', '#14B8A6', '#D97706', '#F59E0B',
    '#16A34A', '#22C55E', '#064E3B', '#DCFCE7', '#7C3AED', '#8B5CF6', '#713F12', '#92400E',
    '#EAB308', '#CA8A04', '#0F172A', '#334155', '#EA580C', '#F97316'
];

export default function PurchasesDashboardPage() {
    const getMonterreyDate = () => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Monterrey',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    };

    const [fechaInicio, setFechaInicio] = useState(getMonterreyDate());
    const [fechaFin, setFechaFin] = useState(getMonterreyDate());
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [selectedMetric, setSelectedMetric] = useState<'compras' | 'devoluciones' | 'transferenciasSalida' | 'transferenciasEntrada'>('compras');
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
    const [subMetric, setSubMetric] = useState<'Total' | 'Operaciones'>('Total');
    const [isMaximized, setIsMaximized] = useState(false);
    
    // Layout and Minimized states
    const [layoutPosition, setLayoutPosition] = useState<'top' | 'bottom' | 'left' | 'right'>(() => {
        if (typeof window === 'undefined') return 'bottom';
        return (localStorage.getItem('kyk_purchases_dashboard_layout_position') as any) || 'bottom';
    });
    const [isDetailsMinimized, setIsDetailsMinimized] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('kyk_purchases_dashboard_details_minimized') === 'true';
    });
    const [selectedBreakdownTab, setSelectedBreakdownTab] = useState<'sucursal' | 'departamento' | 'familia'>('sucursal');

    // On-demand chart data for Deptos / Familias
    const [purchasesDepto, setPurchasesDepto] = useState<any[]>([]);
    const [purchasesFamilia, setPurchasesFamilia] = useState<any[]>([]);
    const [loadingBreakdown, setLoadingBreakdown] = useState(false);

    // Modal state
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedMetricDetail, setSelectedMetricDetail] = useState<'compras' | 'devoluciones' | 'transferenciasSalida' | 'transferenciasEntrada'>('compras');
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [selectedStoreName, setSelectedStoreName] = useState<string | null>(null);

    // Save UI preferences
    useEffect(() => {
        localStorage.setItem('kyk_purchases_dashboard_layout_position', layoutPosition);
    }, [layoutPosition]);

    useEffect(() => {
        localStorage.setItem('kyk_purchases_dashboard_details_minimized', String(isDetailsMinimized));
    }, [isDetailsMinimized]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const url = `/api/dashboard/purchases/stats?startDate=${fechaInicio}&endDate=${fechaFin}`;
            const res = await fetch(url);
            const json = await res.json();
            setData(json);

            // Reset breakdown data
            setPurchasesDepto([]);
            setPurchasesFamilia([]);
            if (selectedBreakdownTab === 'departamento') fetchPurchasesBreakdown('departamento');
            else if (selectedBreakdownTab === 'familia') fetchPurchasesBreakdown('familia');
        } catch (error) {
            console.error('Error fetching purchases dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [fechaInicio, fechaFin, selectedStoreId, selectedBreakdownTab, selectedMetric]);

    // Fetch breakdown data on-demand
    const fetchPurchasesBreakdown = async (tipo: 'departamento' | 'familia') => {
        setLoadingBreakdown(true);
        try {
            let url = `/api/dashboard/purchases/desglose?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&tipo=${tipo}&metric=${selectedMetric}`;
            if (selectedStoreId) url += `&storeId=${selectedStoreId}`;
            const res = await fetch(url);
            const json = await res.json();
            if (tipo === 'departamento') setPurchasesDepto(json.data || []);
            else setPurchasesFamilia(json.data || []);
        } catch (err) {
            console.error('Error fetching purchases breakdown:', err);
        } finally {
            setLoadingBreakdown(false);
        }
    };

    useEffect(() => {
        if (selectedBreakdownTab === 'departamento' && purchasesDepto.length === 0) fetchPurchasesBreakdown('departamento');
        if (selectedBreakdownTab === 'familia' && purchasesFamilia.length === 0) fetchPurchasesBreakdown('familia');
    }, [selectedBreakdownTab, purchasesDepto.length, purchasesFamilia.length]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const metrics = data?.kpis || {
        compras: { total: 0, operaciones: 0 },
        devoluciones: { total: 0, operaciones: 0 },
        transferenciasSalida: { total: 0, operaciones: 0 },
        transferenciasEntrada: { total: 0, operaciones: 0 }
    };

    const chartData = data?.data?.[selectedMetric] || [];

    const getMetricConfig = () => {
        const breakdownLabel = 
            selectedBreakdownTab === 'sucursal' ? 'por Sucursal' :
            selectedBreakdownTab === 'departamento' ? 'por Departamento' :
            'por Familia';
        
        const storeSuffix = selectedStoreName ? ` de ${selectedStoreName}` : ` ${breakdownLabel}`;
        
        switch (selectedMetric) {
            case 'compras': return { title: `Compras${storeSuffix}`, sub: `Distribución de suministros ${breakdownLabel.toLowerCase()}`, color: '#10b981', icon: Truck };
            case 'devoluciones': return { title: `Devoluciones${storeSuffix}`, sub: `Gestión de retornos ${breakdownLabel.toLowerCase()}`, color: '#e11d48', icon: Box };
            case 'transferenciasSalida': return { title: `Transferencias de Salida${storeSuffix}`, sub: `Logística de salida ${breakdownLabel.toLowerCase()}`, color: '#f59e0b', icon: Boxes };
            case 'transferenciasEntrada': return { title: `Transf. Entrada${storeSuffix}`, sub: `Logística de entrada ${breakdownLabel.toLowerCase()}`, color: '#3b82f6', icon: Warehouse };
        }
    };

    const config = getMetricConfig()!;

    const getStoreColor = (name: string) => {
        if (!name) return STORE_COLORS_PALETTE[0];
        const cleanName = name.trim().toUpperCase();
        if (STORE_COLOR_MAP[cleanName]) return STORE_COLOR_MAP[cleanName];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % STORE_COLORS_PALETTE.length;
        return STORE_COLORS_PALETTE[index];
    };

    const handleChartBarClick = (payload: any) => {
        if (payload && payload.IdTienda) {
            setSelectedStoreId(payload.IdTienda.toString());
            setSelectedStoreName(payload.Tienda);
            setSelectedBreakdownTab('departamento');
        }
    };

    return (
        <div className={cn(
            "space-y-4 relative min-h-screen",
            isMaximized ? "fixed inset-0 z-[100] bg-[#f8fafc] overflow-y-auto p-4 sm:p-8 md:p-10" : "bg-[#f8fafc]"
        )}>
            {/* Technical Background Pattern */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
                 style={{ backgroundImage: `radial-gradient(#4050B4 1px, transparent 1px)`, backgroundSize: '24px 24px' }}></div>

            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 py-3 px-6 rounded-none shadow-xl border-b-4 border-amber-500 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-500 p-2 shadow-lg shadow-amber-500/20">
                        <Truck size={24} className="text-slate-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-2 m-0 leading-none">
                            HUB DE COMPRAS
                        </h1>
                        <p className="text-[9px] font-bold text-amber-500 uppercase tracking-[0.2em] mt-1">SISTEMA DE CONTROL LOGÍSTICO</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-none p-0.5">
                        {(() => {
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
                            const periods = [
                                { label: 'Hoy', start: today, end: today },
                                { label: 'Ayer', start: mtyDate(-1), end: mtyDate(-1) },
                                {
                                    label: 'Semana',
                                    start: (() => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' })); d.setDate(d.getDate() - d.getDay()); return d.toLocaleDateString('en-CA'); })(),
                                    end: today
                                },
                                { label: '7 días', start: mtyDate(-6), end: today },
                                {
                                    label: 'Este mes',
                                    start: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
                                    end: today
                                },
                                {
                                    label: 'Mes ant.',
                                    start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
                                    end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })()
                                },
                            ];
                            return periods.map(({ label, start, end }) => {
                                const isActive = fechaInicio === start && fechaFin === end;
                                return (
                                    <button
                                        key={label}
                                        onClick={() => { setFechaInicio(start); setFechaFin(end); }}
                                        className={cn(
                                            'px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                            isActive ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                        )}
                                    >
                                        {label}
                                    </button>
                                );
                            });
                        })()}
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#4050B4]/20 transition-all">
                        <Calendar size={16} className="text-[#4050B4]" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Inicio</span>
                            <input
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto leading-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#4050B4]/20 transition-all">
                        <Calendar size={16} className="text-[#4050B4]" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Fin</span>
                            <input
                                type="date"
                                value={fechaFin}
                                onChange={(e) => setFechaFin(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto leading-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={fetchData}
                        className="p-2.5 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 transition-colors rounded-none shadow-sm"
                    >
                        <RotateCw size={18} className={cn(loading && "animate-spin")} />
                    </button>

                    <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        className="p-2.5 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-none shadow-sm"
                    >
                        {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                <button
                    onClick={() => setSelectedMetric('compras')}
                    className={cn(
                        "bg-white p-4 rounded-none border-l-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left",
                        selectedMetric === 'compras' ? "border-emerald-500 bg-emerald-50/30" : "border-slate-200"
                    )}
                >
                    <div className="absolute -top-2 -right-2 p-3 opacity-[0.08] group-hover:opacity-15 transition-opacity text-emerald-600 rotate-12">
                        <Truck size={100} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Suministros</span>
                            <div className="h-[1px] flex-1 bg-slate-100" />
                            <span className="text-[8px] font-mono text-slate-300">TRK-01</span>
                        </div>
                        <h2 className="text-2xl font-black text-emerald-600 mb-2">{formatCurrency(metrics.compras.total)}</h2>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-t border-slate-100 pt-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-slate-400 tracking-wider">Despachos</span>
                                <span className="text-emerald-600 font-black">{metrics.compras.operaciones}</span>
                            </div>
                            <div className="bg-emerald-500 p-1.5 shadow-sm">
                                <Truck size={14} className="text-white" />
                            </div>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => setSelectedMetric('devoluciones')}
                    className={cn(
                        "bg-white p-4 rounded-none border-l-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left",
                        selectedMetric === 'devoluciones' ? "border-rose-500 bg-rose-50/30" : "border-slate-200"
                    )}
                >
                    <div className="absolute -top-2 -right-2 p-3 opacity-[0.08] group-hover:opacity-15 transition-opacity text-rose-600 -rotate-12">
                        <Box size={100} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Retornos</span>
                            <div className="h-[1px] flex-1 bg-slate-100" />
                            <span className="text-[8px] font-mono text-slate-300">BOX-02</span>
                        </div>
                        <h2 className="text-2xl font-black text-rose-600 mb-2">{formatCurrency(metrics.devoluciones.total)}</h2>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-t border-slate-100 pt-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-slate-400 tracking-wider">Incidencias</span>
                                <span className="text-rose-600 font-black">{metrics.devoluciones.operaciones}</span>
                            </div>
                            <div className="bg-rose-500 p-1.5 shadow-sm">
                                <RotateCcw size={14} className="text-white" />
                            </div>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => setSelectedMetric('transferenciasSalida')}
                    className={cn(
                        "bg-white p-4 rounded-none border-l-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left",
                        selectedMetric === 'transferenciasSalida' ? "border-amber-500 bg-amber-50/30" : "border-slate-200"
                    )}
                >
                    <div className="absolute -top-2 -right-2 p-3 opacity-[0.08] group-hover:opacity-15 transition-opacity text-amber-600">
                        <Boxes size={100} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transferencias de Salida</span>
                            <div className="h-[1px] flex-1 bg-slate-100" />
                            <span className="text-[8px] font-mono text-slate-300">OUT-03</span>
                        </div>
                        <h2 className="text-2xl font-black text-amber-600 mb-2">{formatCurrency(metrics.transferenciasSalida.total)}</h2>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-t border-slate-100 pt-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-slate-400 tracking-wider">Cargas</span>
                                <span className="text-amber-600 font-black">{metrics.transferenciasSalida.operaciones}</span>
                            </div>
                            <div className="bg-amber-500 p-1.5 shadow-sm">
                                <ArrowDownRight size={14} className="text-white" />
                            </div>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => setSelectedMetric('transferenciasEntrada')}
                    className={cn(
                        "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left",
                        selectedMetric === 'transferenciasEntrada' ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-100"
                    )}
                >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ArrowUpRight size={80} className="text-blue-500" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Transf. Entrada</span>
                        <h2 className="text-2xl font-black text-blue-600 mb-2">{formatCurrency(metrics.transferenciasEntrada.total)}</h2>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-t border-slate-50 pt-3">
                            <div className="flex flex-col">
                                <span>Operaciones</span>
                                <span className="text-blue-500 px-2 py-0.5 bg-blue-50">{metrics.transferenciasEntrada.operaciones}</span>
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            {/* Layout Controls */}
            <div className="flex items-center justify-end gap-2 mb-0 bg-slate-100/50 p-1 self-end w-fit ml-auto">
                <button
                    onClick={() => setLayoutPosition('top')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                        layoutPosition === 'top' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Rows size={14} className="rotate-180" /> Arriba
                </button>
                <button
                    onClick={() => setLayoutPosition('bottom')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                        layoutPosition === 'bottom' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Rows size={14} /> Abajo
                </button>
                <button
                    onClick={() => setLayoutPosition('left')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                        layoutPosition === 'left' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Columns size={14} className="rotate-180" /> Izquierda
                </button>
                <button
                    onClick={() => setLayoutPosition('right')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                        layoutPosition === 'right' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Columns size={14} /> Derecha
                </button>
            </div>

            <div className={cn(
                "flex gap-4 relative z-10",
                (layoutPosition === 'left' || layoutPosition === 'right') ? "flex-col lg:grid lg:grid-cols-3" :
                    layoutPosition === 'top' ? "flex-col-reverse" : "flex-col",
                layoutPosition === 'left' && "lg:flex-row-reverse"
            )}>
                {/* Main Chart Section */}
                <div className={cn(
                    "bg-white p-6 rounded-none border-t-2 border-slate-900 shadow-xl relative overflow-hidden transition-all duration-300",
                    (layoutPosition === 'left' || layoutPosition === 'right') && "lg:col-span-2",
                    layoutPosition === 'left' && "lg:order-2"
                )}>
                    {/* Technical detail overlay */}
                    <div className="absolute top-0 right-0 p-4 font-mono text-[8px] text-slate-100 select-none">
                        DDR-ANL-v1.0 // SCM_PRO_HUB
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-900 p-2 text-white shadow-lg">
                                <FileSearch size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    {config?.title}
                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 font-mono text-slate-400">STATUS:LIVE</span>
                                </h3>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{config?.sub}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded-none">
                                <button
                                    onClick={() => setSelectedBreakdownTab('sucursal')}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all rounded-none",
                                        selectedBreakdownTab === 'sucursal' ? "bg-amber-500 text-slate-900 shadow-lg" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    Sucursales
                                </button>
                                <button
                                    onClick={() => setSelectedBreakdownTab('departamento')}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all rounded-none",
                                        selectedBreakdownTab === 'departamento' ? "bg-amber-500 text-slate-900 shadow-lg" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    Deptos
                                </button>
                                <button
                                    onClick={() => setSelectedBreakdownTab('familia')}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all rounded-none",
                                        selectedBreakdownTab === 'familia' ? "bg-amber-500 text-slate-900 shadow-lg" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    Familias
                                </button>
                            </div>
                            
                            <div className="flex bg-slate-100 p-0.5 rounded-none border border-slate-200">
                                <button
                                    onClick={() => setSubMetric('Total')}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                        subMetric === 'Total' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Monto
                                </button>
                                <button
                                    onClick={() => setSubMetric('Operaciones')}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                        subMetric === 'Operaciones' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Ops
                                </button>
                            </div>

                            <div className="flex bg-slate-100 p-0.5 rounded-none border border-slate-200">
                                <button
                                    onClick={() => setChartType('bar')}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                        chartType === 'bar' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    <LayoutGrid size={14} />
                                </button>
                                <button
                                    onClick={() => setChartType('pie')}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                        chartType === 'pie' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    <ShieldCheck size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-[400px] relative">
                        {/* Technical lines background for chart */}
                        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-slate-100"></div>
                        <div className="absolute inset-y-0 left-0 w-[1px] bg-slate-100"></div>

                        {loading || loadingBreakdown ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4">
                                <div className="h-10 w-10 animate-spin border-t-4 border-amber-500 border-slate-200 rounded-none shadow-xl"></div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Procesando Datos SCM...</span>
                            </div>
                        ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartType === 'bar' ? (
                                        <BarChart 
                                            data={
                                                selectedBreakdownTab === 'sucursal' 
                                                    ? chartData 
                                                    : selectedBreakdownTab === 'departamento' 
                                                        ? purchasesDepto 
                                                        : purchasesFamilia
                                            } 
                                            margin={{ top: 20, right: 30, left: 40, bottom: 60 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey={
                                                    selectedBreakdownTab === 'sucursal' 
                                                        ? "Tienda" 
                                                        : selectedBreakdownTab === 'departamento' 
                                                            ? "Departamento" 
                                                            : "Familia"
                                                }
                                                axisLine={false}
                                                tickLine={false}
                                                interval={0}
                                                tick={(props: any) => {
                                                    const { x, y, payload } = props;
                                                    return (
                                                        <g transform={`translate(${x},${y})`}>
                                                            <text x={0} y={0} dy={16} textAnchor="end" fill="#64748b" transform="rotate(-45)" className="text-[10px] font-bold uppercase">
                                                                {payload.value}
                                                            </text>
                                                        </g>
                                                    );
                                                }}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(val) => subMetric === 'Total' ? `$${(val / 1000).toFixed(0)}k` : val}
                                                className="text-[10px] font-bold fill-slate-400"
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const label = selectedBreakdownTab === 'sucursal' 
                                                            ? payload[0].payload.Tienda 
                                                            : selectedBreakdownTab === 'departamento' 
                                                                ? payload[0].payload.Departamento 
                                                                : payload[0].payload.Familia;
                                                        return (
                                                            <div className="bg-slate-900 text-white p-3 rounded-none shadow-2xl border border-white/10">
                                                                <p className="text-[10px] font-bold text-white/50 uppercase mb-2">{label}</p>
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex justify-between gap-6 items-baseline">
                                                                        <span className="text-[10px] font-bold text-white/40 uppercase">Monto</span>
                                                                        <span className="text-sm font-black text-white">{formatCurrency(payload[0].payload.Total)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-6 items-baseline">
                                                                        <span className="text-[10px] font-bold text-white/40 uppercase">Operaciones</span>
                                                                        <span className="text-sm font-black text-white">{payload[0].payload.Operaciones}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar 
                                                dataKey={subMetric} 
                                                radius={[0, 0, 0, 0]} 
                                                barSize={40}
                                                onClick={(data) => {
                                                    if (selectedBreakdownTab === 'sucursal') handleChartBarClick(data.payload);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                {(selectedBreakdownTab === 'sucursal' 
                                                    ? chartData 
                                                    : selectedBreakdownTab === 'departamento' 
                                                        ? purchasesDepto 
                                                        : purchasesFamilia
                                                ).map((entry: any, index: number) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={selectedBreakdownTab === 'sucursal' ? getStoreColor(entry.Tienda) : '#4050B4'} 
                                                        fillOpacity={0.9} 
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    ) : (
                                        <PieChart>
                                            <Pie
                                                data={
                                                    selectedBreakdownTab === 'sucursal' 
                                                        ? chartData 
                                                        : selectedBreakdownTab === 'departamento' 
                                                            ? purchasesDepto 
                                                            : purchasesFamilia
                                                }
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={160}
                                                paddingAngle={4}
                                                dataKey={subMetric}
                                                nameKey={
                                                    selectedBreakdownTab === 'sucursal' 
                                                        ? "Tienda" 
                                                        : selectedBreakdownTab === 'departamento' 
                                                            ? "Departamento" 
                                                            : "Familia"
                                                }
                                                stroke="none"
                                                onClick={(data) => {
                                                    if (selectedBreakdownTab === 'sucursal') handleChartBarClick(data.payload);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                {(selectedBreakdownTab === 'sucursal' 
                                                    ? chartData 
                                                    : selectedBreakdownTab === 'departamento' 
                                                        ? purchasesDepto 
                                                        : purchasesFamilia
                                                ).map((entry: any, index: number) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={selectedBreakdownTab === 'sucursal' ? getStoreColor(entry.Tienda) : STORE_COLORS_PALETTE[index % STORE_COLORS_PALETTE.length]} 
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-slate-900 text-white p-3 rounded-none shadow-2xl border border-white/10">
                                                                <p className="text-[10px] font-bold text-white/50 uppercase mb-2">{payload[0].name}</p>
                                                                <p className="text-sm font-black text-white">{subMetric === 'Total' ? formatCurrency(payload[0].value as number) : payload[0].value}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Legend />
                                        </PieChart>
                                    )}
                                </ResponsiveContainer>
                            )}
                        </div>
                </div>

                {/* Branch Details Grid */}
                <div className={cn(
                        "bg-white rounded-none border-t-2 border-slate-900 shadow-2xl flex flex-col transition-all duration-300 relative overflow-hidden",
                        (layoutPosition === 'left' || layoutPosition === 'right') ? "lg:col-span-1 h-[530px]" : "h-full",
                        layoutPosition === 'left' && "lg:order-1"
                    )}>
                    <div className="flex items-center justify-between p-5 bg-slate-50 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-500 p-2 text-slate-900">
                                <Network size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">DISTRIBUCIÓN SCM</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sucursales Activas</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsDetailsMinimized(!isDetailsMinimized)}
                            className="p-1 px-3 bg-slate-900 text-amber-500 transition-colors rounded-none border border-slate-800 text-[10px] font-black uppercase"
                        >
                            {isDetailsMinimized ? 'EXPANDIR' : 'CONTRAER'}
                        </button>
                    </div>

                    {!isDetailsMinimized && (
                        <div className={cn(
                            "flex-1 grid gap-4 p-5 no-scrollbar justify-start overflow-y-auto overflow-x-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]",
                            (layoutPosition === 'left' || layoutPosition === 'right') 
                                ? "grid-cols-1" 
                                : "grid-cols-[repeat(auto-fill,minmax(280px,1fr))]"
                        )}>
                            {/* Summary / All Stores Card */}
                            <div
                                onClick={() => {
                                    setSelectedStoreId(null);
                                    setSelectedStoreName(null);
                                    setSelectedBreakdownTab('sucursal');
                                }}
                                className={cn(
                                    "flex flex-col p-4 rounded-none border-t-2 border-r border-b border-l-4 group transition-all outline-none w-full min-w-[280px] cursor-pointer relative",
                                    !selectedStoreId
                                        ? "bg-slate-900 border-slate-900 border-l-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)] translate-y-[-2px]"
                                        : "bg-slate-800 border-slate-700 border-l-slate-600 hover:border-slate-600 hover:translate-y-[-2px]"
                                )}
                            >
                                {/* Technical deco minimal */}
                                <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/10 flex items-center justify-center border-l border-b border-amber-500/20">
                                    <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse shadow-[0_0_5px_rgba(245,158,11,0.5)]"></div>
                                </div>

                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-none flex items-center justify-center bg-amber-500 font-black text-sm text-slate-900 shadow-lg">
                                            Σ
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-white leading-none tracking-tight uppercase">GLOBAL HUB</span>
                                            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-1">Todas las Tiendas</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedMetricDetail(selectedMetric);
                                            setSelectedStoreId(null);
                                            setSelectedStoreName('TODAS LAS TIENDAS');
                                            setIsDetailModalOpen(true);
                                        }}
                                        className="text-[9px] font-black uppercase tracking-tighter text-slate-900 bg-amber-500 hover:bg-amber-400 px-3 py-1.5 transition-all shadow-sm active:scale-95"
                                    >
                                        DETALLE
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/10 text-white">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Monto</span>
                                        <span className="text-xs font-black text-white">{formatCurrency(metrics[selectedMetric].total || 0)}</span>
                                    </div>
                                    <div className="flex flex-col border-x border-white/10 px-3">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ops</span>
                                        <span className="text-xs font-black text-white">{metrics[selectedMetric].operaciones || 0}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[8px] font-black text-amber-500/80 uppercase tracking-widest mb-1.5">Network %</span>
                                        <span className="text-xs font-black text-emerald-400">100.0%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Store Cards */}
                            {(data?.data?.[selectedMetric] || []).map((store: any) => {
                                const isSelected = selectedStoreId === store.IdTienda.toString();
                                const color = getStoreColor(store.Tienda);
                                return (
                                    <div
                                        key={store.IdTienda}
                                        onClick={() => {
                                            setSelectedStoreId(store.IdTienda.toString());
                                            setSelectedStoreName(store.Tienda);
                                            if (selectedBreakdownTab === 'sucursal') {
                                                setSelectedBreakdownTab('departamento');
                                            }
                                        }}
                                        className={cn(
                                            "flex flex-col p-4 bg-white rounded-none border-t-2 border-r border-b border-l-4 group transition-all outline-none w-full min-w-[280px] cursor-pointer relative",
                                            isSelected ? "shadow-2xl translate-y-[-2px] border-slate-900 border-l-slate-900" : "border-slate-100 hover:border-slate-300 hover:shadow-lg hover:translate-y-[-2px]"
                                        )}
                                        style={{ borderLeftColor: isSelected ? undefined : color }}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-none flex items-center justify-center font-black text-xs border-2 shadow-sm"
                                                    style={{ backgroundColor: `${color}05`, borderColor: color, color: color }}
                                                >
                                                    {store.Tienda.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-900 leading-none tracking-tight uppercase">{store.Tienda}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Branch Terminal</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedMetricDetail(selectedMetric);
                                                    setSelectedStoreId(store.IdTienda?.toString() || null);
                                                    setSelectedStoreName(store.Tienda);
                                                    setIsDetailModalOpen(true);
                                                }}
                                                className="text-[9px] font-black uppercase tracking-tighter text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 transition-all border border-slate-200"
                                            >
                                                DETALLE
                                            </button>
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Monto</span>
                                                <span className="text-xs font-black text-slate-900">{formatCurrency(store.Total)}</span>
                                            </div>
                                            <div className="flex flex-col border-x border-slate-100 px-3">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ops</span>
                                                <span className="text-xs font-black text-slate-700">{store.Operaciones}</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Network %</span>
                                                <span className="text-xs font-black text-emerald-600">
                                                    {((store.Total / (metrics[selectedMetric]?.total || 1)) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {loading && <LoadingScreen message="Sincronizando Compras..." />}

            <PurchaseDetailModal 
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                metric={selectedMetricDetail}
                storeId={selectedStoreId}
                storeName={selectedStoreName}
                fechaInicio={fechaInicio}
                fechaFin={fechaFin}
            />
        </div>
    );
}
