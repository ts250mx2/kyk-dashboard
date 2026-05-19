'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Package,
    Receipt,
    Loader2,
    Download,
    ArrowUpDown,
    Filter,
    Store,
    Search,
    X,
    Check,
    Calendar,
    RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

type GroupBy = 'sucursal' | 'depto' | 'articulo' | 'categoria' | 'marca';

interface Row {
    Grupo: string;
    Unidades: number;
    Ingreso: number;
    Costo: number;
    Utilidad: number;
    MargenPct: number;
    Tickets: number;
}

interface Kpis {
    ingreso: number;
    costo: number;
    utilidad: number;
    margenPct: number;
    unidades: number;
    tickets: number;
}

const GROUPS: { key: GroupBy; label: string }[] = [
    { key: 'sucursal', label: 'Sucursal' },
    { key: 'depto', label: 'Departamento' },
    { key: 'categoria', label: 'Categoría' },
    { key: 'marca', label: 'Familia' },
    { key: 'articulo', label: 'Artículo (Top 100)' }
];

function fmtMoney(n: number | undefined | null): string {
    if (n == null || isNaN(Number(n))) return '$0';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n));
}

function fmtPct(n: number | undefined | null): string {
    if (n == null || isNaN(Number(n))) return '0.0%';
    return `${Number(n).toFixed(1)}%`;
}

function fmtNumber(n: number | undefined | null): string {
    if (n == null || isNaN(Number(n))) return '0';
    return new Intl.NumberFormat('es-MX').format(Number(n));
}

function getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getFirstOfMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function MargenesRentabilidadPage() {
    const [startDate, setStartDate] = useState(getFirstOfMonth());
    const [endDate, setEndDate] = useState(getToday());
    const [groupBy, setGroupBy] = useState<GroupBy>('sucursal');
    const [rows, setRows] = useState<Row[]>([]);
    const [kpis, setKpis] = useState<Kpis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<keyof Row>('Utilidad');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    
    // Stores Filter State
    const [storesCatalog, setStoresCatalog] = useState<any[]>([]);
    const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
    const [showStoreDropdown, setShowStoreDropdown] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch Stores Catalog
    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await fetch(`/api/dashboard/sales/reports/margins?onlyStores=true&startDate=${startDate}&endDate=${endDate}`);
                const json = await res.json();
                if (json.success && json.stores) {
                    setStoresCatalog(json.stores);
                }
            } catch (err) {
                console.error('Error fetching stores:', err);
            }
        };
        fetchStores();
    }, [startDate, endDate]);

    // Fetch Margin Data
    useEffect(() => {
        const ctrl = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                let storeFilter = 'all';
                if (selectedStoreIds.length > 0) {
                    storeFilter = selectedStoreIds.join(',');
                }
                const url = `/api/dashboard/sales/reports/margins?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}&storeId=${storeFilter}`;
                const res = await fetch(url, { signal: ctrl.signal });
                const json = await res.json();
                if (!json.success) throw new Error(json.error || 'Error al obtener datos');
                setRows(json.data || []);
                setKpis(json.kpis || null);
            } catch (e: any) {
                if (e.name !== 'AbortError') setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        return () => ctrl.abort();
    }, [startDate, endDate, groupBy, selectedStoreIds]);

    const filteredRows = useMemo(() => {
        if (!searchTerm.trim()) return rows;
        return rows.filter(r => 
            r.Grupo?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rows, searchTerm]);

    const sortedRows = useMemo(() => {
        const copy = [...filteredRows];
        copy.sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
        return copy;
    }, [filteredRows, sortKey, sortDir]);

    const toggleSort = (key: keyof Row) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const toggleStoreSelection = (id: string) => {
        setSelectedStoreIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const clearStoreSelection = () => {
        setSelectedStoreIds([]);
    };

    const exportXls = () => {
        const ws = XLSX.utils.json_to_sheet(sortedRows.map(r => ({
            [GROUPS.find(g => g.key === groupBy)!.label]: r.Grupo,
            Unidades: r.Unidades,
            Ingreso: r.Ingreso,
            Costo: r.Costo,
            Utilidad: r.Utilidad,
            'Margen %': Number(r.MargenPct).toFixed(2),
            Tickets: r.Tickets
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Margen');
        XLSX.writeFile(wb, `margen-${groupBy}-${startDate}-a-${endDate}.xlsx`);
    };

    const activeStoresText = useMemo(() => {
        if (selectedStoreIds.length === 0) return 'Todas las sucursales';
        if (selectedStoreIds.length === 1) {
            const st = storesCatalog.find(s => s.IdTienda.toString() === selectedStoreIds[0]);
            return st ? st.Tienda : '1 sucursal';
        }
        return `${selectedStoreIds.length} sucursales`;
    }, [selectedStoreIds, storesCatalog]);

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen">
            {/* Header section with Date selectors */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-none border border-slate-100 shadow-sm print:hidden mb-6">
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <TrendingUp className="text-[#4050B4]" size={24} />
                        Márgenes y Rentabilidad
                    </h1>
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
                                const isActive = startDate === start && endDate === end;
                                return (
                                    <button
                                        key={label}
                                        onClick={() => { setStartDate(start); setEndDate(end); }}
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
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
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
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto leading-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={exportXls}
                        disabled={loading || rows.length === 0}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed",
                            "text-white rounded-none text-xs font-black uppercase tracking-wider shadow transition-colors h-[38px]"
                        )}
                        title="Exportar a Excel"
                    >
                        <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar XLSX</span>
                    </button>
                </div>
            </div>

            {/* Filtros Bar */}
            <div className="bg-white border border-slate-100 shadow-sm p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Filtro Sucursal Multi-select */}
                    <div className="relative">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Filtrar por Tienda</label>
                        <button
                            onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                            className="flex items-center gap-2 border border-slate-200 rounded-none px-4 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 min-w-[200px] justify-between h-[38px]"
                        >
                            <span className="flex items-center gap-2">
                                <Store size={16} className="text-slate-400" />
                                {activeStoresText}
                            </span>
                            <ArrowUpDown size={14} className="text-slate-400" />
                        </button>

                        {showStoreDropdown && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowStoreDropdown(false)} />
                                <div className="absolute left-0 mt-1 w-72 bg-white border border-slate-200 rounded-none shadow-xl z-20 p-3 max-h-80 overflow-y-auto">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Seleccionar Tiendas</span>
                                        {selectedStoreIds.length > 0 && (
                                            <button
                                                onClick={clearStoreSelection}
                                                className="text-[10px] text-rose-500 font-bold hover:underline"
                                            >
                                                Limpiar
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        {storesCatalog.map(s => {
                                            const isSelected = selectedStoreIds.includes(s.IdTienda.toString());
                                            return (
                                                <button
                                                    key={s.IdTienda}
                                                    onClick={() => toggleStoreSelection(s.IdTienda.toString())}
                                                    className={cn(
                                                        "w-full flex items-center justify-between p-2 text-xs text-left font-bold transition-all",
                                                        isSelected ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50 text-slate-700"
                                                    )}
                                                >
                                                    <span>{s.Tienda}</span>
                                                    {isSelected && <Check size={14} className="text-[#4050B4] font-black" />}
                                                </button>
                                            );
                                        })}
                                        {storesCatalog.length === 0 && (
                                            <p className="text-xs text-slate-400 text-center py-4">No hay tiendas con transacciones.</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Agrupación */}
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Agrupar por</label>
                        <div className="flex bg-slate-100 p-0.5 border border-slate-200 gap-0.5 rounded-none h-[38px] items-center">
                            {GROUPS.map(g => (
                                <button
                                    key={g.key}
                                    onClick={() => setGroupBy(g.key)}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all h-[32px]",
                                        groupBy === g.key ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                                    )}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Buscador reactivo integrado */}
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Buscar</label>
                    <div className="relative flex items-center border border-slate-200 bg-white px-3 py-1 focus-within:ring-2 focus-within:ring-[#4050B4]/20 transition-all h-[38px] w-64">
                        <Search size={16} className="text-slate-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Buscar en la tabla..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full border-none p-0 h-auto"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')}>
                                <X size={14} className="text-slate-400 hover:text-slate-600" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <KpiCard
                    icon={<DollarSign />}
                    label="Ingreso Total"
                    value={fmtMoney(kpis?.ingreso)}
                    accent="emerald"
                    loading={loading}
                />
                <KpiCard
                    icon={<Package />}
                    label="Costo Total"
                    value={fmtMoney(kpis?.costo)}
                    accent="orange"
                    loading={loading}
                />
                <KpiCard
                    icon={<TrendingUp />}
                    label="Utilidad Bruta"
                    value={fmtMoney(kpis?.utilidad)}
                    accent="blue"
                    loading={loading}
                    secondary={
                        kpis?.utilidad != null && kpis.utilidad < 0 ? (
                            <span className="text-rose-600 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest mt-1">
                                <TrendingDown className="w-3.5 h-3.5" /> Pérdida
                            </span>
                        ) : null
                    }
                />
                <KpiCard
                    icon={<Receipt />}
                    label="Margen de Utilidad"
                    value={fmtPct(kpis?.margenPct)}
                    accent={
                        kpis && kpis.margenPct >= 30 ? 'emerald' :
                            kpis && kpis.margenPct >= 15 ? 'blue' :
                                kpis && kpis.margenPct >= 0 ? 'amber' : 'rose'
                    }
                    loading={loading}
                    secondary={
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
                            {fmtNumber(kpis?.tickets)} tkt · {fmtNumber(kpis?.unidades)} uds.
                        </span>
                    }
                />
            </div>

            {/* Data Table */}
            <div className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        Detalle agrupado por <span className="text-[#4050B4]">{GROUPS.find(g => g.key === groupBy)?.label}</span>
                    </h2>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder={`Buscar ${GROUPS.find(g => g.key === groupBy)?.label.toLowerCase()}...`}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-none py-1.5 pl-9 pr-8 text-xs font-bold focus:outline-none focus:border-[#4050B4]"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-200/50 px-2 py-1 uppercase rounded-none shrink-0">
                            {sortedRows.length} resultados
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="p-6 text-rose-600 text-sm font-bold bg-rose-50/50 border-b border-rose-100">
                        Error al cargar el reporte: {error}
                    </div>
                )}

                {loading && rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-[#4050B4] mb-3" />
                        <span className="text-xs font-black uppercase tracking-wider">Cargando márgenes de inventario...</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <Th label={GROUPS.find(g => g.key === groupBy)?.label || ''} onClick={() => toggleSort('Grupo')} active={sortKey === 'Grupo'} dir={sortDir} align="left" />
                                    <Th label="Unidades" onClick={() => toggleSort('Unidades')} active={sortKey === 'Unidades'} dir={sortDir} />
                                    <Th label="Ingreso Bruto" onClick={() => toggleSort('Ingreso')} active={sortKey === 'Ingreso'} dir={sortDir} />
                                    <Th label="Costo Inventario" onClick={() => toggleSort('Costo')} active={sortKey === 'Costo'} dir={sortDir} />
                                    <Th label="Utilidad Bruta" onClick={() => toggleSort('Utilidad')} active={sortKey === 'Utilidad'} dir={sortDir} />
                                    <Th label="Margen %" onClick={() => toggleSort('MargenPct')} active={sortKey === 'MargenPct'} dir={sortDir} />
                                    <Th label="Tickets" onClick={() => toggleSort('Tickets')} active={sortKey === 'Tickets'} dir={sortDir} />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.map((r, i) => {
                                    const pct = Number(r.MargenPct) || 0;
                                    return (
                                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-900 border-r border-slate-100">{r.Grupo || '(Sin nombre)'}</td>
                                            <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-600">{fmtNumber(r.Unidades)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-800">{fmtMoney(r.Ingreso)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-700">{fmtMoney(r.Costo)}</td>
                                            <td className={cn('px-4 py-3 text-right tabular-nums font-black border-l border-slate-50', Number(r.Utilidad) < 0 ? 'text-rose-600' : 'text-emerald-700')}>
                                                {fmtMoney(r.Utilidad)}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums border-l border-slate-50">
                                                <span className={cn(
                                                    'inline-flex items-center px-2 py-0.5 rounded-none font-black text-[10px] uppercase tracking-wider',
                                                    pct >= 30 ? 'bg-emerald-100 text-emerald-800' :
                                                        pct >= 15 ? 'bg-blue-100 text-blue-800' :
                                                            pct >= 0 ? 'bg-amber-100 text-amber-800' :
                                                                'bg-rose-100 text-rose-800'
                                                )}>
                                                    {fmtPct(pct)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-400">{fmtNumber(r.Tickets)}</td>
                                        </tr>
                                    );
                                })}
                                {sortedRows.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-16 text-slate-400 font-bold uppercase tracking-wider">
                                            Sin datos para los filtros seleccionados
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Note */}
            <p className="text-[10px] text-slate-400 mt-6 font-bold uppercase tracking-widest">
                * El costo unitario se toma dinámicamente de <code className="bg-slate-100 p-0.5 font-black text-slate-600">tblExistencias.CostoReal</code> por sucursal. 
                Cuando una sucursal no registra costo para el artículo, se utiliza el costo global SAP del artículo (<code className="bg-slate-100 p-0.5 font-black text-slate-600">tblArticulos.UltimoCosto</code>).
            </p>
        </div>
    );
}

function Th({ label, onClick, active, dir, align = 'right' }: { label: string; onClick: () => void; active: boolean; dir: 'asc' | 'desc'; align?: 'left' | 'right' }) {
    return (
        <th
            onClick={onClick}
            className={cn(
                'px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500 cursor-pointer select-none hover:text-[#4050B4] transition-colors',
                align === 'right' ? 'text-right' : 'text-left'
            )}
        >
            <span className={cn("inline-flex items-center gap-1", align === 'right' ? "justify-end w-full" : "")}>
                {label}
                <ArrowUpDown className={cn('w-3 h-3 transition-opacity', active ? 'text-[#4050B4] opacity-100' : 'opacity-30')} />
                {active && <span className="text-[#4050B4] text-[9px] font-black">{dir === 'asc' ? '▲' : '▼'}</span>}
            </span>
        </th>
    );
}

function KpiCard({
    icon, label, value, accent, loading, secondary
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accent: 'emerald' | 'blue' | 'orange' | 'amber' | 'rose';
    loading?: boolean;
    secondary?: React.ReactNode;
}) {
    const accentMap: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100'
    };
    return (
        <div className="bg-white border border-slate-200 rounded-none p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center gap-3 mb-2.5">
                <div className={cn('p-2 rounded-none border', accentMap[accent])}>
                    {icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#4050B4]" /> : value}
            </div>
            {secondary}
        </div>
    );
}
