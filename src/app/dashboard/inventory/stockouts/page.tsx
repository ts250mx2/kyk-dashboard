"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    PackageX, AlertCircle, Store as StoreIcon, RefreshCcw,
    Download, FileText, TrendingDown, Calendar, Layers, X, Search, ArrowUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { MultiSelect } from '@/components/ui/multi-select';
import { exportStockoutsToXlsx, exportStockoutsToPdf } from '@/lib/stockouts/exports';

interface Store { IdTienda: number; Tienda: string; }

interface StockoutItem {
    codigoInterno: number;
    descripcion: string;
    depto: string;
    idTienda: number;
    tienda: string;
    stockActual: number;
    costo: number;
    fechaAct: string | null;
    total30d: number;
    unidades30d: number;
    diasConVenta: number;
    avgDailyRevenue: number;
    avgDailyUnits: number;
    estimatedLostRevenue: number;
    estimatedLostUnits: number;
    severity: 'critico' | 'alto' | 'medio';
}

interface StockoutsResponse {
    scope: { storeIds: number[]; label: string };
    filters: { threshold: number; lookbackDays: number; horizonDays: number };
    kpis: {
        skusInBreakdown: number;
        storesAffected: number;
        estimatedLostRevenue: number;
        estimatedLostUnits: number;
        avgDailyLostRevenue: number;
        totalSkusWithSales: number;
    };
    byStore: Array<{ idTienda: number; tienda: string; skus: number; estimatedLostRevenue: number }>;
    byDepto: Array<{ depto: string; skus: number; estimatedLostRevenue: number }>;
    items: StockoutItem[];
}

const THRESHOLD_OPTIONS = [
    { label: '= 0 (quiebre)', value: 0 },
    { label: '≤ 1', value: 1 },
    { label: '≤ 2', value: 2 },
    { label: '≤ 5', value: 5 },
];
const HORIZON_OPTIONS = [
    { label: '7 días', value: 7 },
    { label: '14 días', value: 14 },
    { label: '30 días', value: 30 },
];

type GroupBy = 'sku' | 'depto' | 'tienda';
const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
    { label: 'Por SKU', value: 'sku' },
    { label: 'Por departamento', value: 'depto' },
    { label: 'Por sucursal', value: 'tienda' },
];

const SEVERITY_META = {
    critico: { label: 'CRÍTICO', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
    alto: { label: 'ALTO', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
    medio: { label: 'MEDIO', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
} as const;

const fmtCurrency = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);
const fmtNumber = (v: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(v);

type SortKey = 'estimatedLostRevenue' | 'avgDailyRevenue' | 'unidades30d' | 'stockActual';

export default function StockoutsPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
    const [threshold, setThreshold] = useState(0);
    const [horizonDays, setHorizonDays] = useState(7);
    const [lookbackDays] = useState(30);
    const [groupBy, setGroupBy] = useState<GroupBy>('sku');
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('estimatedLostRevenue');

    const [data, setData] = useState<StockoutsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/stores')
            .then(r => r.json())
            .then(d => { if (Array.isArray(d)) setStores(d); })
            .catch(err => console.error(err));
    }, []);

    const runReport = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/inventory/stockouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeIds: selectedStoreIds.map(Number),
                    threshold,
                    lookbackDays,
                    horizonDays,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Error al generar reporte');
            setData(json);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [selectedStoreIds, threshold, lookbackDays, horizonDays]);

    useEffect(() => { runReport(); }, [runReport]);

    const filteredItems = useMemo(() => {
        if (!data) return [];
        const term = search.trim().toLowerCase();
        const list = term
            ? data.items.filter(i =>
                i.descripcion.toLowerCase().includes(term)
                || String(i.codigoInterno).includes(term)
                || i.depto.toLowerCase().includes(term)
                || i.tienda.toLowerCase().includes(term)
            )
            : data.items;
        const sorted = [...list].sort((a, b) => {
            switch (sortKey) {
                case 'estimatedLostRevenue': return b.estimatedLostRevenue - a.estimatedLostRevenue;
                case 'avgDailyRevenue': return b.avgDailyRevenue - a.avgDailyRevenue;
                case 'unidades30d': return b.unidades30d - a.unidades30d;
                case 'stockActual': return a.stockActual - b.stockActual;
                default: return 0;
            }
        });
        return sorted;
    }, [data, search, sortKey]);

    const storeOptions = stores.map(s => ({ label: s.Tienda, value: String(s.IdTienda) }));

    const handleExportXlsx = () => {
        if (!data) return;
        exportStockoutsToXlsx(data, filteredItems);
    };
    const handleExportPdf = () => {
        if (!data) return;
        exportStockoutsToPdf(data, filteredItems);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-3 px-6 rounded-none shadow-sm border border-slate-100">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                        <PackageX className="text-rose-600" />
                        QUIEBRES DE STOCK
                    </h1>
                    <p className="hidden lg:block text-xs text-slate-500 max-w-md">
                        SKUs sin existencia (o bajo umbral) con venta reciente — estimación de venta perdida si no se resurte.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportXlsx}
                        disabled={loading || !data || data.items.length === 0}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-none text-sm font-bold hover:bg-emerald-50 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        XLSX
                    </button>
                    <button
                        onClick={handleExportPdf}
                        disabled={loading || !data || data.items.length === 0}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-rose-300 text-rose-700 rounded-none text-sm font-bold hover:bg-rose-50 disabled:opacity-50"
                    >
                        <FileText className="w-4 h-4" />
                        PDF
                    </button>
                    <button
                        onClick={runReport}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#4050B4] text-white rounded-none text-sm font-bold hover:bg-[#37469c] disabled:opacity-50"
                    >
                        <RefreshCcw className={cn('w-4 h-4', loading && 'animate-spin')} />
                        Recalcular
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1.5 min-w-[260px]">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Sucursales</label>
                        <MultiSelect
                            options={storeOptions}
                            selectedValues={selectedStoreIds}
                            onChange={setSelectedStoreIds}
                            placeholder="Todas las sucursales"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Umbral de stock</label>
                        <div className="flex gap-1">
                            {THRESHOLD_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setThreshold(opt.value)}
                                    className={cn(
                                        'px-3 py-2 rounded-md text-sm font-medium',
                                        threshold === opt.value
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Horizonte (venta perdida)</label>
                        <div className="flex gap-1">
                            {HORIZON_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setHorizonDays(opt.value)}
                                    className={cn(
                                        'px-3 py-2 rounded-md text-sm font-medium',
                                        horizonDays === opt.value
                                            ? 'bg-[#4050B4] text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Filtros:</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full border border-slate-200">
                        <Calendar className="w-3.5 h-3.5" />
                        Histórico {lookbackDays}d  ·  Proyección {horizonDays}d
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-medium rounded-full border border-rose-200">
                        <PackageX className="w-3.5 h-3.5" />
                        {threshold === 0 ? 'Stock = 0' : `Stock ≤ ${threshold}`}
                    </span>
                    {selectedStoreIds.length === 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full border border-slate-200">
                            <StoreIcon className="w-3.5 h-3.5" />
                            Todas las sucursales ({stores.length})
                        </span>
                    ) : (
                        <>
                            {selectedStoreIds.map(id => {
                                const store = stores.find(s => String(s.IdTienda) === id);
                                if (!store) return null;
                                return (
                                    <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                                        <StoreIcon className="w-3.5 h-3.5" />
                                        {store.Tienda}
                                        <button
                                            onClick={() => setSelectedStoreIds(prev => prev.filter(v => v !== id))}
                                            className="ml-0.5 hover:bg-blue-200 rounded-full p-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                );
                            })}
                            <button
                                onClick={() => setSelectedStoreIds([])}
                                className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium ml-1"
                            >
                                Limpiar
                            </button>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {loading && <LoadingScreen />}

            {!loading && data && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Kpi icon={<PackageX className="w-5 h-5 text-rose-600" />} label="SKUs en quiebre" value={data.kpis.skusInBreakdown.toLocaleString('es-MX')} sub={`de ${data.kpis.totalSkusWithSales.toLocaleString('es-MX')} con venta reciente`} tone="rose" />
                        <Kpi icon={<TrendingDown className="w-5 h-5 text-amber-600" />} label={`Venta perdida estimada (${horizonDays}d)`} value={fmtCurrency(data.kpis.estimatedLostRevenue)} sub={`≈ ${fmtCurrency(data.kpis.avgDailyLostRevenue)} / día`} tone="amber" />
                        <Kpi icon={<PackageX className="w-5 h-5 text-indigo-600" />} label="Unidades faltantes estimadas" value={fmtNumber(data.kpis.estimatedLostUnits)} sub={`próximos ${horizonDays}d`} tone="indigo" />
                        <Kpi icon={<StoreIcon className="w-5 h-5 text-slate-600" />} label="Sucursales afectadas" value={String(data.kpis.storesAffected)} sub="con al menos 1 SKU en quiebre" tone="slate" />
                    </div>

                    {data.items.length === 0 ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
                            <div className="text-emerald-700 font-bold text-lg mb-1">🎉 Sin quiebres detectados</div>
                            <div className="text-emerald-600 text-sm">
                                Ningún SKU con venta reciente está bajo el umbral seleccionado en este scope.
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Top 10 chart */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-rose-500" />
                                    Top 10 SKUs por venta perdida estimada ({horizonDays}d)
                                </h2>
                                <div className="space-y-2">
                                    {filteredItems.slice(0, 10).map((it, idx) => {
                                        const max = filteredItems[0]?.estimatedLostRevenue || 1;
                                        const pct = (it.estimatedLostRevenue / max) * 100;
                                        return (
                                            <div key={`${it.codigoInterno}-${it.idTienda}`}>
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="font-bold text-slate-700 truncate max-w-[60%]" title={it.descripcion}>
                                                        {idx + 1}. {it.descripcion}
                                                        <span className="text-slate-400 font-normal ml-1">· {it.tienda}</span>
                                                    </span>
                                                    <span className="text-slate-500 font-semibold tabular-nums">{fmtCurrency(it.estimatedLostRevenue)}</span>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-rose-500 to-amber-500" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* By store + by depto */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <BreakdownCard title="Por sucursal" icon={<StoreIcon className="w-4 h-4" />} items={data.byStore.map(b => ({ label: b.tienda, count: b.skus, value: b.estimatedLostRevenue }))} />
                                <BreakdownCard title="Por departamento" icon={<Layers className="w-4 h-4" />} items={data.byDepto.map(b => ({ label: b.depto, count: b.skus, value: b.estimatedLostRevenue }))} />
                            </div>

                            {/* Search + group + table */}
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200">
                                    <h2 className="text-sm font-semibold text-slate-700">
                                        Detalle ({filteredItems.length} filas)
                                    </h2>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar SKU, descripción, depto…"
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-xs w-64 focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                            />
                                        </div>
                                        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-md">
                                            {GROUP_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setGroupBy(opt.value)}
                                                    className={cn(
                                                        'px-2.5 py-1 rounded text-[11px] font-bold',
                                                        groupBy === opt.value ? 'bg-white text-[#4050B4] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                                    )}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    {groupBy === 'sku' ? (
                                        <SkuTable items={filteredItems} sortKey={sortKey} onSort={setSortKey} />
                                    ) : groupBy === 'depto' ? (
                                        <AggregateTable
                                            rows={data.byDepto.map(b => ({ label: b.depto, skus: b.skus, lost: b.estimatedLostRevenue }))}
                                            firstColLabel="Departamento"
                                        />
                                    ) : (
                                        <AggregateTable
                                            rows={data.byStore.map(b => ({ label: b.tienda, skus: b.skus, lost: b.estimatedLostRevenue }))}
                                            firstColLabel="Sucursal"
                                        />
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: 'rose' | 'amber' | 'indigo' | 'slate' }) {
    const bg = { rose: 'bg-rose-50', amber: 'bg-amber-50', indigo: 'bg-indigo-50', slate: 'bg-slate-50' }[tone];
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
                <div className={cn('p-2 rounded-md', bg)}>{icon}</div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
    );
}

function BreakdownCard({ title, icon, items }: { title: string; icon: React.ReactNode; items: Array<{ label: string; count: number; value: number }> }) {
    const max = items[0]?.value || 1;
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                {icon}
                {title}
            </h3>
            {items.length === 0 ? (
                <div className="text-xs text-slate-400 p-3">Sin datos</div>
            ) : (
                <div className="space-y-2">
                    {items.slice(0, 8).map((b) => {
                        const pct = (b.value / max) * 100;
                        return (
                            <div key={b.label}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="font-bold text-slate-700 truncate max-w-[55%]" title={b.label}>{b.label}</span>
                                    <span className="text-slate-500 font-semibold tabular-nums whitespace-nowrap">
                                        {b.count} SKUs · {fmtCurrency(b.value)}
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#4050B4] to-rose-500" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function SortHeader({ label, active, onClick, align = 'right' }: { label: string; active: boolean; onClick: () => void; align?: 'left' | 'right' | 'center' }) {
    return (
        <th className={cn('px-3 py-2 font-bold uppercase tracking-wider', align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left')}>
            <button onClick={onClick} className={cn('inline-flex items-center gap-1', active ? 'text-[#4050B4]' : 'hover:text-slate-700')}>
                {label}
                <ArrowUpDown className={cn('w-3 h-3', active ? 'opacity-100' : 'opacity-30')} />
            </button>
        </th>
    );
}

function SkuTable({ items, sortKey, onSort }: { items: StockoutItem[]; sortKey: SortKey; onSort: (k: SortKey) => void }) {
    return (
        <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
                <tr>
                    <th className="text-left px-3 py-2 font-bold uppercase tracking-wider">Producto</th>
                    <th className="text-left px-3 py-2 font-bold uppercase tracking-wider">Sucursal</th>
                    <th className="text-center px-3 py-2 font-bold uppercase tracking-wider">Severidad</th>
                    <SortHeader label="Stock" active={sortKey === 'stockActual'} onClick={() => onSort('stockActual')} />
                    <SortHeader label="Unid 30d" active={sortKey === 'unidades30d'} onClick={() => onSort('unidades30d')} />
                    <SortHeader label="Venta/día" active={sortKey === 'avgDailyRevenue'} onClick={() => onSort('avgDailyRevenue')} />
                    <SortHeader label="Venta perdida est." active={sortKey === 'estimatedLostRevenue'} onClick={() => onSort('estimatedLostRevenue')} />
                </tr>
            </thead>
            <tbody>
                {items.map(it => {
                    const sev = SEVERITY_META[it.severity];
                    return (
                        <tr key={`${it.codigoInterno}-${it.idTienda}`} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 align-top">
                                <div className="font-bold text-slate-800 max-w-[300px] truncate" title={it.descripcion}>{it.descripcion}</div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-wider">#{it.codigoInterno}{it.depto && ` · ${it.depto}`}</div>
                            </td>
                            <td className="px-3 py-2 align-top text-slate-700">{it.tienda}</td>
                            <td className="px-3 py-2 align-top text-center">
                                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold', sev.bg, sev.text, sev.border)}>
                                    {sev.label}
                                </span>
                            </td>
                            <td className={cn('px-3 py-2 align-top text-right font-bold tabular-nums', it.stockActual <= 0 ? 'text-rose-600' : 'text-amber-600')}>
                                {fmtNumber(it.stockActual)}
                            </td>
                            <td className="px-3 py-2 align-top text-right text-slate-600 tabular-nums">{fmtNumber(it.unidades30d)}</td>
                            <td className="px-3 py-2 align-top text-right text-slate-700 font-medium tabular-nums">{fmtCurrency(it.avgDailyRevenue)}</td>
                            <td className="px-3 py-2 align-top text-right text-rose-700 font-bold tabular-nums">{fmtCurrency(it.estimatedLostRevenue)}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function AggregateTable({ rows, firstColLabel }: { rows: Array<{ label: string; skus: number; lost: number }>; firstColLabel: string }) {
    return (
        <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
                <tr>
                    <th className="text-left px-3 py-2 font-bold uppercase tracking-wider">{firstColLabel}</th>
                    <th className="text-right px-3 py-2 font-bold uppercase tracking-wider">SKUs en quiebre</th>
                    <th className="text-right px-3 py-2 font-bold uppercase tracking-wider">Venta perdida est.</th>
                </tr>
            </thead>
            <tbody>
                {rows.map(r => (
                    <tr key={r.label} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-800">{r.label}</td>
                        <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{r.skus}</td>
                        <td className="px-3 py-2 text-right text-rose-700 font-bold tabular-nums">{fmtCurrency(r.lost)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
