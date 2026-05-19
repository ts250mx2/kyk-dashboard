"use client";

import { useState, useEffect } from 'react';
import {
    Calendar,
    Users,
    DollarSign,
    RotateCcw,
    CreditCard,
    Search,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    FileSpreadsheet,
    Building,
    FileText,
    Store,
    Check,
    X,
    Loader2
} from 'lucide-react';
import { DashboardCommandBar } from '@/components/dashboard-command-bar';
import { KpiExplainButton } from '@/components/kpi-explain-button';
import { NarrativeSummary } from '@/components/narrative-summary';
import * as XLSX from 'xlsx';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LineChart,
    Line,
    PieChart,
    Pie,
    Legend
} from 'recharts';
import { cn } from '@/lib/utils';

type MetricType = 'contado' | 'credito' | 'publico' | 'notas';

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
    '#16A34A', '#22C55E', '#064E3B', '#DCFCE7', '#7C3AED', '#8B5CF6', '#713F12', '#92400E',
    '#EAB308', '#CA8A04', '#0F172A', '#334155', '#EA580C', '#F97316'
];

const getStoreColor = (name: string) => {
    if (!name) return STORE_COLORS[0];
    const cleanName = name.trim().toUpperCase();
    if (STORE_COLOR_MAP[cleanName]) return STORE_COLOR_MAP[cleanName];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % STORE_COLORS.length;
    return STORE_COLORS[index];
};

export default function ClientsDashboardPage() {
    const getMonterreyDate = () => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Monterrey',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    };

    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('contado');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'FechaFactura', direction: 'desc' });

    // Client Filter States
    const [filterMode, setFilterMode] = useState<'sucursales' | 'clientes'>('sucursales');
    const [selectedClient, setSelectedClient] = useState<{ RFC: string, ClienteConcepto: string } | null>(null);
    const [clientSearchInput, setClientSearchInput] = useState('');
    const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
    const [searchingClients, setSearchingClients] = useState(false);
    const [trendGroupBy, setTrendGroupBy] = useState<'dia' | 'semana' | 'mes'>('dia');
    const [aiMode, setAiMode] = useState(false);

    // HSL Colors harmonized with Kesos iA branding
    const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#4050B4'];

    useEffect(() => {
        setMounted(true);
        setFechaInicio(getMonterreyDate());
        setFechaFin(getMonterreyDate());
    }, []);

    // Incremental Search suggestions loader
    useEffect(() => {
        if (clientSearchInput.trim().length < 2) {
            setClientSuggestions([]);
            return;
        }
        const delayDebounce = setTimeout(async () => {
            setSearchingClients(true);
            try {
                const res = await fetch(`/api/dashboard/sales/clients/search?q=${encodeURIComponent(clientSearchInput)}`);
                const json = await res.json();
                if (json.clients) {
                    setClientSuggestions(json.clients);
                }
            } catch (err) {
                console.error('Error fetching client search suggestions:', err);
            } finally {
                setSearchingClients(false);
            }
        }, 300);
        return () => clearTimeout(delayDebounce);
    }, [clientSearchInput]);

    const fetchData = async () => {
        if (!fechaInicio || !fechaFin) return;
        setLoading(true);
        try {
            const storeParam = selectedStoreIds.length > 0 ? selectedStoreIds.join(',') : 'all';
            const rfcParam = selectedClient ? encodeURIComponent(selectedClient.RFC) : '';
            const res = await fetch(`/api/dashboard/sales/clients?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&idTienda=${storeParam}&rfc=${rfcParam}&groupBy=${trendGroupBy}`);
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error('Error fetching clients data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (fechaInicio && fechaFin) {
            fetchData();
        }
    }, [fechaInicio, fechaFin, selectedStoreIds, selectedClient, trendGroupBy]);

    if (!mounted) return null;

    const kpis = data?.kpis || {
        TotalVentas: 0, TotalClientes: 0,
        ContadoMonto: 0, ContadoClientes: 0,
        CreditoMonto: 0, CreditoClientes: 0,
        PublicoMonto: 0, PublicoOperaciones: 0,
        NotasMonto: 0, NotasClientes: 0, NotasOperaciones: 0
    };

    const totalVentasMonto = kpis.TotalVentas || 1;
    const contadoPct = ((kpis.ContadoMonto / totalVentasMonto) * 100).toFixed(1);
    const creditoPct = ((kpis.CreditoMonto / totalVentasMonto) * 100).toFixed(1);
    const publicoPct = ((kpis.PublicoMonto / totalVentasMonto) * 100).toFixed(1);
    const notasPct = ((kpis.NotasMonto / totalVentasMonto) * 100).toFixed(1);

    const desgloses = data?.desgloses || {
        totales: { top: [], stores: [], daily: [] },
        contado: { top: [], stores: [], daily: [] },
        credito: { top: [], stores: [], daily: [] },
        publico: { top: [], stores: [], daily: [] },
        notas: { top: [], stores: [], daily: [] }
    };

    const storesCatalog = data?.stores || [];
    const activeDesglose = desgloses[selectedMetric];

    // Filter invoices by selected metric
    const allInvoices = data?.invoices || [];
    const filteredInvoices = allInvoices.filter((invoice: any) => {
        const matchesSearch = 
            invoice.ClienteConcepto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.RFC?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.Tienda?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (invoice.AlfaNumerico + invoice.IdFactura).toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        switch (selectedMetric) {
            case 'contado':
                return invoice.Credito === 0 && invoice.RFC !== 'XAXX010101000';
            case 'credito':
                return invoice.Credito === 1;
            case 'publico':
                return invoice.RFC === 'XAXX010101000' && (invoice.Credito === 0 || invoice.Credito === 1);
            case 'notas':
                return invoice.Credito === 2;
            default:
                return false;
        }
    });

    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue = a[key];
        let bValue = b[key];

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleStoreSelection = (storeId: string) => {
        setSelectedStoreIds((prev) => {
            if (prev.includes(storeId)) {
                return prev.filter((id) => id !== storeId);
            } else {
                return [...prev, storeId];
            }
        });
    };

    const selectAllStores = () => {
        setSelectedStoreIds([]);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
    };

    const exportToExcel = () => {
        if (sortedInvoices.length === 0) return;

        const excelData = sortedInvoices.map((inv: any) => ({
            'Folio': `${inv.AlfaNumerico || ''}${inv.IdFactura}`,
            'Cliente': inv.ClienteConcepto,
            'RFC': inv.RFC,
            'Monto': inv.Total,
            'Tipo': inv.Credito === 0 ? 'Contado' : inv.Credito === 1 ? 'Crédito' : 'Nota de Crédito',
            'Método Pago': inv.MetodoPago || 'N/A',
            'Fecha': new Date(inv.FechaFactura).toLocaleString('es-MX'),
            'Tienda': inv.Tienda
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Facturas por Cliente');

        // Column widths
        worksheet['!cols'] = [
            { wch: 12 }, // Folio
            { wch: 35 }, // Cliente
            { wch: 16 }, // RFC
            { wch: 15 }, // Monto
            { wch: 15 }, // Tipo
            { wch: 20 }, // Metodo
            { wch: 20 }, // Fecha
            { wch: 15 }  // Tienda
        ];

        XLSX.writeFile(workbook, `Facturas_Clientes_${fechaInicio}_a_${fechaFin}.xlsx`);
    };

    const renderSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) return <div className="w-4" />;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={14} className="ml-1 text-[#4050B4]" />;
    };

    const selectedStoreNames = selectedStoreIds.length === 0
        ? 'Todas las sucursales'
        : storesCatalog
            .filter((s: any) => selectedStoreIds.includes(s.IdTienda.toString()))
            .map((s: any) => s.Tienda)
            .join(', ');

    // Handler para aplicar actualizaciones desde la barra de comando del agente
    const applyAgentUpdates = (updates: any) => {
        if (updates.fechaInicio) setFechaInicio(updates.fechaInicio);
        if (updates.fechaFin) setFechaFin(updates.fechaFin);
        if (Array.isArray(updates.storeIds)) {
            setSelectedStoreIds(updates.storeIds.map((id: any) => String(id)));
        }
        if (updates.metric && ['contado', 'credito', 'publico', 'notas'].includes(updates.metric)) {
            setSelectedMetric(updates.metric as MetricType);
        }
        if (updates.search !== undefined) setSearchTerm(updates.search);
    };

    // Contexto para el resumen narrativo. NarrativeSummary tiene su propio
    // hash + debounce internamente, así que aquí lo calculamos plano (sin useMemo
    // para no violar Rules of Hooks por el early-return de !mounted más arriba).
    const topStoresActive = activeDesglose.stores
        ?.slice(0, 3)
        .map((s: any) => ({ name: s.Tienda, value: s.Total })) || [];
    const summaryContext = {
        pageContext: 'Dashboard de Ventas por Cliente',
        period: { fechaInicio, fechaFin },
        scope: selectedStoreNames,
        kpis: {
            'Ventas a Contado': kpis.ContadoMonto,
            'Clientes a Contado': kpis.ContadoClientes,
            'Ventas a Crédito': kpis.CreditoMonto,
            'Clientes a Crédito': kpis.CreditoClientes,
            'Público General': kpis.PublicoMonto,
            'Operaciones Público': kpis.PublicoOperaciones,
            'Notas de Crédito': kpis.NotasMonto,
            'Operaciones Notas': kpis.NotasOperaciones
        },
        highlights: { topStores: topStoresActive }
    };

    const kpiSharedContext = {
        pageContext: 'Dashboard de Ventas por Cliente',
        period: { fechaInicio, fechaFin },
        filters: {
            storeIds: selectedStoreIds,
            storeNames: selectedStoreIds.length === 0
                ? ['Todas las sucursales']
                : storesCatalog
                    .filter((s: any) => selectedStoreIds.includes(s.IdTienda.toString()))
                    .map((s: any) => s.Tienda)
        },
        relatedKpis: {
            'Total Ventas': kpis.TotalVentas,
            'Total Clientes': kpis.TotalClientes
        }
    };

    const commandSuggestions = [
        'ventas a crédito de este mes',
        'todas las sucursales hoy',
        'notas de crédito de la semana',
        'público general del mes pasado'
    ];

    return (
        <div className="space-y-6">
            {/* Header section with Date selectors */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-none border border-slate-100 shadow-sm print:hidden">
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Users className="text-[#4050B4]" size={24} />
                        Dashboard de Ventas por Cliente
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                        Análisis detallado de facturación, contado, crédito y devoluciones
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Period selectors */}
                    <div className="flex bg-slate-100 border border-slate-200/60 rounded-none p-0.5">
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

                    {/* Date Pickers */}
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
                        className="p-2.5 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 transition-colors rounded-none shadow-sm group"
                        title="Actualizar Datos"
                    >
                        <RotateCcw size={18} className={cn("group-hover:rotate-180 transition-transform duration-500", loading && "animate-spin")} />
                    </button>

                    {/* Modo IA Switch */}
                    <div 
                        className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-none shadow-sm h-[38px] cursor-pointer select-none hover:bg-slate-100 transition-all"
                        onClick={() => setAiMode(!aiMode)}
                        title="Activa el Asistente IA para hacer preguntas y obtener resúmenes automáticos"
                    >
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            🤖 Modo IA
                        </span>
                        <div
                            className={cn(
                                "relative inline-flex h-4.5 w-8.5 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                aiMode ? "bg-[#4050B4]" : "bg-slate-300"
                            )}
                        >
                            <span
                                className={cn(
                                    "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                    aiMode ? "translate-x-4" : "translate-x-0"
                                )}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Split panel layout: Sidebar Store Selector on Left, Dashboard content on Right */}
            <div className="flex flex-col lg:flex-row gap-6">                {/* Left Panel: Store selector list with Multi-selection or Clients select */}
                <div className="lg:w-72 shrink-0">
                    <div className="bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[650px] sticky top-20">
                        {/* Tab Selector: Sucursales vs. Clientes */}
                        <div className="flex border-b border-slate-100 p-2 gap-1 bg-slate-50">
                            <button
                                onClick={() => setFilterMode('sucursales')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-black uppercase tracking-wider transition-all rounded-none border",
                                    filterMode === 'sucursales'
                                        ? "bg-slate-900 text-white shadow-sm border-slate-900"
                                        : "bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 border-slate-200"
                                )}
                            >
                                <Store size={14} />
                                Sucursales
                            </button>
                            <button
                                onClick={() => setFilterMode('clientes')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-black uppercase tracking-wider transition-all rounded-none border",
                                    filterMode === 'clientes'
                                        ? "bg-slate-900 text-white shadow-sm border-slate-900"
                                        : "bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 border-slate-200"
                                )}
                            >
                                <Users size={14} />
                                Clientes
                            </button>
                        </div>

                        {filterMode === 'sucursales' ? (
                            <>
                                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                     <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Store size={14} />
                                        Seleccionar Sucursales {selectedStoreIds.length > 0 && `(${selectedStoreIds.length})`}
                                     </h2>
                                     {selectedStoreIds.length > 0 && (
                                         <button 
                                             onClick={selectAllStores}
                                             className="text-[9px] font-black text-[#4050B4] uppercase hover:underline"
                                         >
                                             Ver Todas
                                         </button>
                                     )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    <button
                                        onClick={selectAllStores}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 transition-all border-l-4 group text-left rounded-none",
                                            selectedStoreIds.length === 0 
                                                ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                                : "bg-white text-slate-600 border-transparent hover:bg-slate-50 hover:border-slate-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-8 h-8 rounded-none flex items-center justify-center text-xs font-black",
                                                selectedStoreIds.length === 0 ? "bg-white/20" : "bg-slate-100"
                                            )}>
                                                AZ
                                            </div>
                                            <span className="text-[13px] font-bold tracking-tight uppercase">Todas las sucursales</span>
                                        </div>
                                        {selectedStoreIds.length === 0 && <Check size={14} className="text-white" />}
                                    </button>

                                    {storesCatalog.map((store: any) => {
                                        const isActive = selectedStoreIds.includes(store.IdTienda.toString());
                                        const color = getStoreColor(store.Tienda);
                                        return (
                                            <button
                                                key={store.IdTienda}
                                                onClick={() => toggleStoreSelection(store.IdTienda.toString())}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-3 transition-all border-l-4 group text-left rounded-none",
                                                    isActive 
                                                        ? "bg-slate-50 text-slate-900 shadow-sm border-l-4"
                                                        : "bg-white text-slate-600 border-transparent hover:bg-slate-50"
                                                )}
                                                style={{ borderLeftColor: isActive ? color : 'transparent' }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div 
                                                        className="w-8 h-8 rounded-none flex items-center justify-center text-[10px] font-black text-white shadow-sm transition-transform group-hover:scale-105"
                                                        style={{ backgroundColor: color }}
                                                    >
                                                        {store.Tienda.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className={cn(
                                                        "text-[13px] tracking-tight uppercase",
                                                        isActive ? "font-black text-slate-950" : "font-bold text-slate-600"
                                                    )}>{store.Tienda}</span>
                                                </div>
                                                {isActive ? (
                                                    <div 
                                                        className="w-4 h-4 rounded-none flex items-center justify-center text-white"
                                                        style={{ backgroundColor: color }}
                                                    >
                                                        <Check size={10} strokeWidth={3} />
                                                    </div>
                                                ) : (
                                                    <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col p-4 space-y-4">
                                <div className="border-b border-slate-100 pb-2 mb-1">
                                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Users size={14} />
                                        Búsqueda de Clientes
                                    </h2>
                                    <p className="text-[10px] text-slate-400 mt-1">Escribe el nombre o RFC del cliente para buscar.</p>
                                </div>

                                {selectedClient ? (
                                    <div className="bg-blue-50 border border-blue-200 p-4 shadow-sm relative group">
                                        <div className="absolute top-2 right-2">
                                            <button
                                                onClick={() => setSelectedClient(null)}
                                                className="p-1 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-none border border-slate-200 transition-colors"
                                                title="Quitar filtro de cliente"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div className="text-[9px] font-black uppercase text-blue-500 tracking-wider mb-1">Cliente Seleccionado</div>
                                        <h3 className="text-xs font-black text-slate-900 leading-tight pr-6">{selectedClient.ClienteConcepto}</h3>
                                        <p className="text-[10px] font-bold text-slate-500 mt-1 font-mono">{selectedClient.RFC}</p>
                                        <p className="text-[10px] text-blue-700 font-bold mt-3 bg-blue-100/50 p-1.5 uppercase tracking-tight">
                                            Ventas divididas por sucursal abajo
                                        </p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="Buscar cliente..."
                                                value={clientSearchInput}
                                                onChange={(e) => setClientSearchInput(e.target.value)}
                                                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-none text-xs font-bold focus:outline-none focus:border-[#4050B4]"
                                            />
                                            {clientSearchInput && (
                                                <button
                                                    onClick={() => setClientSearchInput('')}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {clientSearchInput.trim().length >= 2 && (
                                            <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl z-20 max-h-[300px] overflow-y-auto">
                                                {searchingClients ? (
                                                    <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4050B4]" />
                                                        Buscando...
                                                    </div>
                                                ) : clientSuggestions.length === 0 ? (
                                                    <div className="p-4 text-center text-xs text-slate-400">
                                                        Sin coincidencias
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-slate-50">
                                                        {clientSuggestions.map((c) => (
                                                            <button
                                                                key={c.RFC}
                                                                onClick={() => {
                                                                    setSelectedClient(c);
                                                                    setClientSearchInput('');
                                                                    setClientSuggestions([]);
                                                                }}
                                                                className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                            >
                                                                <span className="text-xs font-black text-slate-800 leading-tight uppercase">{c.ClienteConcepto}</span>
                                                                <span className="text-[10px] text-slate-400 font-bold font-mono uppercase">{c.RFC}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Primary Dashboard content */}
                <div className="flex-1 min-w-0 space-y-6">

                    {/* === PATRÓN 1: Barra de comando por lenguaje natural === */}
                    {aiMode && (
                        <DashboardCommandBar
                            currentFilters={{
                                fechaInicio,
                                fechaFin,
                                storeIds: selectedStoreIds,
                                metric: selectedMetric,
                                search: searchTerm
                            }}
                            availableStores={storesCatalog}
                            onApplyUpdates={applyAgentUpdates}
                            suggestions={commandSuggestions}
                        />
                    )}

                    {/* === PATRÓN 3: Resumen narrativo automático === */}
                    {aiMode && !loading && (
                        <NarrativeSummary context={summaryContext} />
                    )}

                    {/* Active stores indicator banner */}
                    <div className="bg-slate-50 border border-slate-200/80 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-start gap-2 text-xs font-bold text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#4050B4] mt-0.5 animate-pulse shrink-0" />
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Sucursales Activas:</span>
                                <span className="text-[#4050B4] uppercase font-black tracking-tight">{selectedStoreNames}</span>
                            </div>
                        </div>

                        {selectedClient && (
                            <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Cliente Seleccionado:</span>
                                    <span className="text-emerald-700 uppercase font-black tracking-tight flex items-center gap-1.5">
                                        {selectedClient.ClienteConcepto} ({selectedClient.RFC})
                                        <button
                                            onClick={() => setSelectedClient(null)}
                                            className="text-[9px] font-bold text-slate-400 hover:text-red-500 hover:underline shrink-0 font-sans ml-1 bg-white px-1.5 py-0.5 border border-slate-200 rounded"
                                        >
                                            Quitar Filtro
                                        </button>
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metrics Cards Grid - Balanced 4 Columns Layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Contado */}
                        <button
                            onClick={() => setSelectedMetric('contado')}
                            className={cn(
                                "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left print-visible",
                                selectedMetric === 'contado' ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-slate-100"
                            )}
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <DollarSign size={80} className="text-emerald-500" />
                            </div>
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ventas a Contado</span>
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-none">{contadoPct}%</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 mb-2">{formatCurrency(kpis.ContadoMonto)}</h2>
                                </div>
                                <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-none overflow-hidden mb-1">
                                        <div
                                            className="bg-emerald-500 h-full rounded-none transition-all duration-500"
                                            style={{ width: `${contadoPct}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-slate-500">Clientes Distintos</span>
                                        <span className="text-slate-800">{kpis.ContadoClientes}</span>
                                    </div>
                                    {aiMode && (
                                        <div className="pt-1 -mb-1">
                                            <KpiExplainButton
                                                context={{
                                                    kpiName: 'Ventas a Contado',
                                                    value: kpis.ContadoMonto,
                                                    format: 'currency',
                                                    ...kpiSharedContext
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>

                        {/* Crédito */}
                        <button
                            onClick={() => setSelectedMetric('credito')}
                            className={cn(
                                "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left print-visible",
                                selectedMetric === 'credito' ? "border-amber-500 ring-2 ring-amber-500/10" : "border-slate-100"
                            )}
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <CreditCard size={80} className="text-amber-500" />
                            </div>
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ventas a Crédito</span>
                                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-none">{creditoPct}%</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 mb-2">{formatCurrency(kpis.CreditoMonto)}</h2>
                                </div>
                                <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-none overflow-hidden mb-1">
                                        <div
                                            className="bg-amber-500 h-full rounded-none transition-all duration-500"
                                            style={{ width: `${creditoPct}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-slate-500">Clientes Distintos</span>
                                        <span className="text-slate-800">{kpis.CreditoClientes}</span>
                                    </div>
                                    {aiMode && (
                                        <div className="pt-1 -mb-1">
                                            <KpiExplainButton
                                                context={{
                                                    kpiName: 'Ventas a Crédito',
                                                    value: kpis.CreditoMonto,
                                                    format: 'currency',
                                                    ...kpiSharedContext
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>

                        {/* Público General */}
                        <button
                            onClick={() => setSelectedMetric('publico')}
                            className={cn(
                                "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left print-visible",
                                selectedMetric === 'publico' ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-100"
                            )}
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Users size={80} className="text-blue-500" />
                            </div>
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Público General</span>
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-none">{publicoPct}%</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 mb-2">{formatCurrency(kpis.PublicoMonto)}</h2>
                                </div>
                                <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-none overflow-hidden mb-1">
                                        <div
                                            className="bg-blue-500 h-full rounded-none transition-all duration-500"
                                            style={{ width: `${publicoPct}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-slate-500">Operaciones</span>
                                        <span className="text-slate-800">{kpis.PublicoOperaciones}</span>
                                    </div>
                                    {aiMode && (
                                        <div className="pt-1 -mb-1">
                                            <KpiExplainButton
                                                context={{
                                                    kpiName: 'Público General',
                                                    value: kpis.PublicoMonto,
                                                    format: 'currency',
                                                    ...kpiSharedContext
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>

                        {/* Notas de Crédito */}
                        <button
                            onClick={() => setSelectedMetric('notas')}
                            className={cn(
                                "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left print-visible",
                                selectedMetric === 'notas' ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-100"
                            )}
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <RotateCcw size={80} className="text-rose-500" />
                            </div>
                            <div className="flex flex-col h-full justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Notas de Crédito</span>
                                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-none">{notasPct}%</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-rose-600 mb-2">{formatCurrency(kpis.NotasMonto)}</h2>
                                </div>
                                <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-none overflow-hidden mb-1">
                                        <div
                                            className="bg-rose-500 h-full rounded-none transition-all duration-500"
                                            style={{ width: `${notasPct}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-slate-500">Operaciones (Devol)</span>
                                        <span className="text-slate-800">{kpis.NotasOperaciones}</span>
                                    </div>
                                    {aiMode && (
                                        <div className="pt-1 -mb-1">
                                            <KpiExplainButton
                                                context={{
                                                    kpiName: 'Notas de Crédito',
                                                    value: kpis.NotasMonto,
                                                    format: 'currency',
                                                    ...kpiSharedContext
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Chart 1: Daily sales trend */}
                        <div className="lg:col-span-2 bg-white p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                        Tendencia de Ventas
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                        Evolución de facturación por {trendGroupBy === 'dia' ? 'día' : trendGroupBy === 'semana' ? 'semana' : 'mes'} en el periodo
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex bg-slate-100 p-0.5 gap-0.5 rounded-none border border-slate-200">
                                        {[
                                            { key: 'dia', label: 'Día' },
                                            { key: 'semana', label: 'Semana' },
                                            { key: 'mes', label: 'Mes' }
                                        ].map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => setTrendGroupBy(opt.key as any)}
                                                className={cn(
                                                    "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all",
                                                    trendGroupBy === opt.key
                                                        ? "bg-slate-900 text-white shadow-sm"
                                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="hidden sm:inline px-2 py-1 bg-slate-100 text-[10px] font-bold text-slate-600 rounded-none uppercase">
                                        Métrica: {selectedMetric}
                                    </span>
                                </div>
                            </div>

                            <div className="h-[300px] w-full">
                                {loading ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4050B4]"></div>
                                    </div>
                                ) : activeDesglose.daily.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                                        Sin registros en el periodo
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={activeDesglose.daily} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                            <XAxis
                                                dataKey="Fecha"
                                                tickFormatter={(str) => {
                                                    if (!str) return '';
                                                    const d = new Date(str);
                                                    if (trendGroupBy === 'mes') {
                                                        return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }).toUpperCase();
                                                    }
                                                    if (trendGroupBy === 'semana') {
                                                        return `Sem. ${d.getDate()}/${d.getMonth() + 1}`;
                                                    }
                                                    return `${d.getDate()}/${d.getMonth() + 1}`;
                                                }}
                                                tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                                tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                formatter={(val: any) => [formatCurrency(val), 'Monto']}
                                                labelFormatter={(label) => {
                                                    const d = new Date(label);
                                                    if (trendGroupBy === 'mes') {
                                                        return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' }).toUpperCase();
                                                    }
                                                    if (trendGroupBy === 'semana') {
                                                        return `Semana del ${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`;
                                                    }
                                                    return d.toLocaleDateString('es-MX', { dateStyle: 'long' });
                                                }}
                                                contentStyle={{ backgroundColor: 'white', borderRadius: '0px', border: '1px solid #E2E8F0', fontFamily: 'sans-serif' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="Total"
                                                stroke="#4050B4"
                                                strokeWidth={3}
                                                dot={{ r: 4, strokeWidth: 1 }}
                                                activeDot={{ r: 6 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Chart 2: Store breakdown */}
                        <div className="bg-white p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Distribución por Tiendas</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Participación por sucursal</p>
                                </div>
                            </div>

                            <div className="h-[300px] w-full flex items-center justify-center">
                                {loading ? (
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4050B4] mx-auto"></div>
                                ) : activeDesglose.stores.length === 0 ? (
                                    <span className="text-slate-400 text-sm font-medium">Sin registros en el periodo</span>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={activeDesglose.stores.slice(0, 8)}
                                                dataKey="Total"
                                                nameKey="Tienda"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={2}
                                            >
                                                {activeDesglose.stores.slice(0, 8).map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: any) => formatCurrency(value)} />
                                            <Legend
                                                verticalAlign="bottom"
                                                height={36}
                                                iconType="circle"
                                                wrapperStyle={{ fontSize: '10px', fontWeight: 700 }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Customers or Detailed Store Breakdown of Selected Client */}
                    {selectedClient ? (
                        <div className="bg-white p-5 border border-slate-100 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Store size={18} className="text-[#4050B4]" />
                                    Distribución Detallada por Sucursal: {selectedClient.ClienteConcepto}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Compras del cliente desglosadas por tienda y número de operaciones</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Bar chart of sales per store */}
                                <div className="h-[350px]">
                                    {loading ? (
                                        <div className="h-full flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4050B4]"></div>
                                        </div>
                                    ) : activeDesglose.stores.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                                            Sin registros en el periodo
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={activeDesglose.stores} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                                <XAxis dataKey="Tienda" tick={{ fill: '#475569', fontSize: 9, fontWeight: 800 }} />
                                                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} />
                                                <Tooltip formatter={(val: any) => [formatCurrency(val), 'Monto']} />
                                                <Bar dataKey="Total" fill="#4050B4" radius={[4, 4, 0, 0]}>
                                                    {activeDesglose.stores.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                {/* Table of sales per store */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-2.5 text-left font-black text-[10px] uppercase text-slate-500">Sucursal</th>
                                                <th className="px-4 py-2.5 text-right font-black text-[10px] uppercase text-slate-500">Monto Comprado</th>
                                                <th className="px-4 py-2.5 text-right font-black text-[10px] uppercase text-slate-500">Operaciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {activeDesglose.stores.map((s: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 font-medium">
                                                    <td className="px-4 py-3 flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                                        <span className="font-bold text-slate-800 uppercase">{s.Tienda}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-black text-slate-900 tabular-nums">{formatCurrency(s.Total)}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-500 tabular-nums">{s.Operaciones}</td>
                                                </tr>
                                            ))}
                                            {activeDesglose.stores.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="text-center py-8 text-slate-400 font-bold uppercase tracking-wider">
                                                        Sin compras registradas
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        selectedMetric !== 'publico' && (
                            <div className="bg-white p-5 border border-slate-100 shadow-sm">
                                <div className="mb-4">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Top 15 Clientes Facturados</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Clientes con mayor monto facturado en la métrica activa</p>
                                </div>

                                <div className="h-[400px] w-full">
                                    {loading ? (
                                        <div className="h-full flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4050B4]"></div>
                                        </div>
                                    ) : activeDesglose.top.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                                            Sin registros en el periodo
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={activeDesglose.top}
                                                layout="vertical"
                                                margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                                                <XAxis
                                                    type="number"
                                                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                                    tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="ClienteConcepto"
                                                    tick={{ fill: '#475569', fontSize: 9, fontWeight: 800 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    width={120}
                                                />
                                                <Tooltip
                                                    formatter={(val: any) => [formatCurrency(val), 'Total Facturado']}
                                                    contentStyle={{ backgroundColor: 'white', borderRadius: '0px', border: '1px solid #E2E8F0', fontFamily: 'sans-serif' }}
                                                />
                                                <Bar dataKey="Total" fill="#4050B4" radius={[0, 4, 4, 0]}>
                                                    {activeDesglose.top.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        )
                    )}

                    {/* Invoices List Table */}
                    <div className="bg-white border border-slate-100 shadow-sm">
                        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText size={18} className="text-[#4050B4]" />
                                    Detalle de Facturas
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Mostrando hasta 500 registros coincidentes del periodo</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Search bar */}
                                <div className="relative group min-w-[240px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#4050B4] transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente, RFC, sucursal, folio..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-none py-1.5 pl-9 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#4050B4]/20 focus:bg-white transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                {/* Excel export */}
                                <button
                                    onClick={exportToExcel}
                                    disabled={sortedInvoices.length === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-black uppercase tracking-wider rounded-none"
                                >
                                    <FileSpreadsheet size={15} />
                                    Excel
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-600">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                                    <tr>
                                        <th onClick={() => handleSort('IdFactura')} className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors">
                                            <div className="flex items-center">Folio {renderSortIcon('IdFactura')}</div>
                                        </th>
                                        <th onClick={() => handleSort('ClienteConcepto')} className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors">
                                            <div className="flex items-center">Cliente {renderSortIcon('ClienteConcepto')}</div>
                                        </th>
                                        <th onClick={() => handleSort('RFC')} className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors">
                                            <div className="flex items-center">RFC {renderSortIcon('RFC')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Total')} className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors text-right">
                                            <div className="flex items-center justify-end">Monto {renderSortIcon('Total')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Credito')} className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors">
                                            <div className="flex items-center">Tipo {renderSortIcon('Credito')}</div>
                                        </th>
                                        <th onClick={() => handleSort('MetodoPago')} className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors">
                                            <div className="flex items-center">Método Pago {renderSortIcon('MetodoPago')}</div>
                                        </th>
                                        <th onClick={() => handleSort('FechaFactura')} className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors">
                                            <div className="flex items-center">Fecha {renderSortIcon('FechaFactura')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Tienda')} className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors">
                                            <div className="flex items-center">Tienda {renderSortIcon('Tienda')}</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-10">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#4050B4] mx-auto"></div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Cargando facturas...</p>
                                            </td>
                                        </tr>
                                    ) : sortedInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-10 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                                                Sin facturas en el periodo o criterio de búsqueda
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedInvoices.map((inv: any, index: number) => (
                                            <tr key={`${inv.IdFactura}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-3 font-bold text-[#4050B4]">
                                                    {inv.AlfaNumerico || ''}{inv.IdFactura}
                                                </td>
                                                <td className="px-5 py-3 font-bold text-slate-800 break-words max-w-[200px]">
                                                    {inv.ClienteConcepto}
                                                </td>
                                                <td className="px-5 py-3 font-mono text-slate-500">
                                                    {inv.RFC}
                                                </td>
                                                <td className="px-5 py-3 font-black text-slate-900 text-right">
                                                    {formatCurrency(inv.Total)}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={cn(
                                                        "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-none",
                                                        inv.Credito === 0 
                                                            ? (inv.RFC === 'XAXX010101000' ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700")
                                                            : inv.Credito === 1 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                                                    )}>
                                                        {inv.Credito === 0 
                                                            ? (inv.RFC === 'XAXX010101000' ? 'Púb. General' : 'Contado')
                                                            : inv.Credito === 1 ? 'Crédito' : 'N. Crédito'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 font-bold text-slate-500">
                                                    {inv.MetodoPago || 'N/A'}
                                                </td>
                                                <td className="px-5 py-3 text-slate-500">
                                                    {new Date(inv.FechaFactura).toLocaleDateString('es-MX', {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-1 text-slate-700 font-bold">
                                                        <Building size={14} className="text-slate-400" />
                                                        {inv.Tienda}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
}
