'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Users, Store, Calendar, ChevronRight, ArrowLeft, Loader2, Search,
    Package, Home, Building
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Level = 'suppliers' | 'products';

interface Supplier {
    IdProveedor: number;
    Proveedor: string;
    Venta: number;
    Unidades: number;
    Articulos: number;
    Tickets: number;
}

interface Product {
    CodigoInterno: number;
    Descripcion: string;
    CodigoBarras: string;
    Venta: number;
    Cantidad: number;
    Tickets: number;
    PrecioPromedio: number;
}

interface StoreOption {
    IdTienda: number;
    Tienda: string;
}

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
    'MERKDON': '#fcea42'
};

const FALLBACK_COLORS = ['#2563EB', '#DC2626', '#0D9488', '#D97706', '#16A34A', '#7C3AED', '#EA580C'];

function getStoreColor(name: string): string {
    if (!name) return FALLBACK_COLORS[0];
    const clean = name.trim().toUpperCase();
    if (STORE_COLOR_MAP[clean]) return STORE_COLOR_MAP[clean];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function fmtMoney(n: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
}

function fmtNumber(n: number): string {
    return new Intl.NumberFormat('es-MX').format(n || 0);
}

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

export default function VentasPorProveedorPage() {
    const [fechaInicio, setFechaInicio] = useState(() => {
        const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA');
    });
    const [fechaFin, setFechaFin] = useState(mtyDate());

    // Filtro de sucursal (single, "all" = todas)
    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
    const [stores, setStores] = useState<StoreOption[]>([]);

    // Drill-down state
    const [level, setLevel] = useState<Level>('suppliers');
    const [selectedSupplier, setSelectedSupplier] = useState<{ id: number; name: string } | null>(null);

    // Data
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [totals, setTotals] = useState<{ Venta: number; Unidades?: number; Articulos?: number; Cantidad?: number }>({ Venta: 0 });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Carga catálogo de sucursales al cambiar fechas
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`/api/dashboard/sales/by-supplier?level=stores&fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
                const json = await res.json();
                setStores(json.stores || []);
            } catch (e) {
                console.error('Stores load failed:', e);
            }
        };
        load();
    }, [fechaInicio, fechaFin]);

    // Fetch por nivel
    useEffect(() => {
        const ctrl = new AbortController();
        const fetchLevel = async () => {
            setLoading(true);
            setError(null);
            setSearchTerm('');
            try {
                const params = new URLSearchParams({ level, fechaInicio, fechaFin });
                if (selectedStoreId !== 'all') params.set('idTienda', selectedStoreId);
                if (level === 'products' && selectedSupplier) params.set('idProveedor', String(selectedSupplier.id));

                const res = await fetch(`/api/dashboard/sales/by-supplier?${params}`, { signal: ctrl.signal });
                const json = await res.json();
                if (json.error) throw new Error(json.error);

                if (level === 'suppliers') {
                    setSuppliers(json.suppliers || []);
                    setTotals(json.totals || { Venta: 0 });
                }
                if (level === 'products') {
                    setProducts(json.products || []);
                    setTotals(json.totals || { Venta: 0 });
                }
            } catch (e: any) {
                if (e.name !== 'AbortError') setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchLevel();
        return () => ctrl.abort();
    }, [level, selectedSupplier, selectedStoreId, fechaInicio, fechaFin]);

    // Navegación
    const goToSuppliers = () => {
        setSelectedSupplier(null);
        setLevel('suppliers');
    };

    const goToProducts = (s: Supplier) => {
        setSelectedSupplier({ id: s.IdProveedor, name: s.Proveedor });
        setLevel('products');
    };

    const goBack = () => {
        if (level === 'products') goToSuppliers();
    };

    // Quick periods (mismos de Ventas Sucursales)
    const today = mtyDate();
    const periods = [
        { label: 'Hoy', start: today, end: today },
        { label: '7 días', start: mtyDate(-6), end: today },
        { label: 'Mes', start: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: today },
        { label: 'Mes ant.', start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })() },
        { label: 'Año', start: `${new Date().getFullYear()}-01-01`, end: today }
    ];

    // Filtros de búsqueda
    const filteredSuppliers = useMemo(() => {
        if (!searchTerm.trim()) return suppliers;
        const q = searchTerm.toLowerCase();
        return suppliers.filter(s => s.Proveedor.toLowerCase().includes(q));
    }, [suppliers, searchTerm]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm.trim()) return products;
        const q = searchTerm.toLowerCase();
        return products.filter(p =>
            p.Descripcion.toLowerCase().includes(q) ||
            String(p.CodigoInterno).includes(q) ||
            (p.CodigoBarras || '').toLowerCase().includes(q)
        );
    }, [products, searchTerm]);

    const activeStoreName = selectedStoreId === 'all'
        ? 'Todas las sucursales'
        : stores.find(s => String(s.IdTienda) === selectedStoreId)?.Tienda || 'Sucursal';

    return (
        <div className="p-6 pt-3 md:p-8 md:pt-4 max-w-[1600px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-slate-100 shadow-sm mb-4">
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Users className="text-[#4050B4]" size={24} />
                        Ventas por Proveedor
                    </h1>
                    <p className="text-[11px] text-slate-500 font-bold mt-1">
                        Navegación drill-down: Proveedor → Productos
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-slate-100 border border-slate-200/60 p-0.5">
                        {periods.map(p => {
                            const active = fechaInicio === p.start && fechaFin === p.end;
                            return (
                                <button
                                    key={p.label}
                                    onClick={() => { setFechaInicio(p.start); setFechaFin(p.end); }}
                                    className={cn(
                                        'px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                        active ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                    )}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5">
                        <Calendar size={14} className="text-[#4050B4]" />
                        <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none p-0" />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5">
                        <Calendar size={14} className="text-[#4050B4]" />
                        <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none p-0" />
                    </div>
                </div>
            </div>

            {/* Filtro de sucursal — estilo chips horizontales (como heatmap) */}
            <div className="bg-white border border-slate-100 shadow-sm p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <Store size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Filtrar por sucursal
                    </span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] font-bold text-slate-600">{activeStoreName}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setSelectedStoreId('all')}
                        className={cn(
                            "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-l-4",
                            selectedStoreId === 'all'
                                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                : "bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100"
                        )}
                    >
                        Todas
                    </button>
                    {stores.map(s => {
                        const isActive = selectedStoreId === String(s.IdTienda);
                        const color = getStoreColor(s.Tienda);
                        return (
                            <button
                                key={s.IdTienda}
                                onClick={() => setSelectedStoreId(String(s.IdTienda))}
                                className={cn(
                                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-l-4",
                                    isActive
                                        ? "bg-white text-slate-900 shadow ring-1 ring-slate-200"
                                        : "bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100"
                                )}
                                style={{ borderLeftColor: isActive ? color : 'transparent' }}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                                    {s.Tienda}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 bg-white border border-slate-100 px-4 py-2.5 shadow-sm mb-6 overflow-x-auto">
                {level !== 'suppliers' && (
                    <button
                        onClick={goBack}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#4050B4] hover:bg-[#4050B4]/5 transition-colors"
                    >
                        <ArrowLeft size={12} /> Atrás
                    </button>
                )}
                <button onClick={goToSuppliers} className="flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-[#4050B4] transition-colors">
                    <Home size={12} /> Proveedores
                </button>
                {selectedSupplier && (
                    <>
                        <ChevronRight size={12} className="text-slate-300" />
                        <span className="flex items-center gap-1 text-[11px] font-black text-slate-900">
                            <Building size={12} /> {selectedSupplier.name}
                        </span>
                    </>
                )}
            </div>

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold mb-6">
                    Error: {error}
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-[#4050B4] mb-3" />
                    <span className="text-xs font-black uppercase tracking-wider">Cargando...</span>
                </div>
            )}

            {/* NIVEL 1: SUPPLIERS */}
            {!loading && level === 'suppliers' && (
                <div>
                    {/* Card resumen total */}
                    <div className="bg-gradient-to-br from-[#4050B4] to-[#5563d8] text-white p-6 mb-4 shadow-md">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Users size={24} />
                                    <h2 className="text-base font-black uppercase tracking-tight">Resumen total</h2>
                                </div>
                                <p className="text-3xl font-black tabular-nums">{fmtMoney(totals.Venta)}</p>
                                <p className="text-[11px] font-bold opacity-80 uppercase tracking-widest mt-1">
                                    {fmtNumber(suppliers.length)} proveedores · {fmtNumber(totals.Unidades || 0)} unidades · {fmtNumber(totals.Articulos || 0)} artículos
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Buscador */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                            {filteredSuppliers.length} proveedores
                        </div>
                        <div className="relative w-72">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar proveedor..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 py-2 pl-9 pr-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4050B4]"
                            />
                        </div>
                    </div>

                    {filteredSuppliers.length === 0 && (
                        <div className="bg-white border border-slate-200 p-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                            Sin proveedores con ventas en este periodo
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredSuppliers.map(s => {
                            const pctOfTotal = totals.Venta > 0 ? (s.Venta / totals.Venta) * 100 : 0;
                            const isTop = pctOfTotal >= 5;
                            return (
                                <button
                                    key={s.IdProveedor}
                                    onClick={() => goToProducts(s)}
                                    className={cn(
                                        "relative bg-white border rounded-lg p-5 text-left transition-all duration-150 group",
                                        "hover:border-[#4050B4]/40 hover:shadow-[0_0_0_4px_rgba(64,80,180,0.08)]",
                                        "border-slate-200"
                                    )}
                                >
                                    {/* Header: icono + nombre + % */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-md bg-slate-100 group-hover:bg-[#4050B4]/10 group-hover:text-[#4050B4] flex items-center justify-center shrink-0 transition-colors">
                                                <Building size={15} className="text-slate-500 group-hover:text-[#4050B4] transition-colors" />
                                            </div>
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <h4 className="text-[13px] font-bold text-slate-900 truncate leading-tight">{s.Proveedor}</h4>
                                                <p className="text-[10px] font-mono text-slate-400 mt-0.5 tracking-tight">
                                                    #PROV-{String(s.IdProveedor).padStart(4, '0')}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "text-[11px] font-semibold tabular-nums shrink-0 px-1.5 py-0.5 rounded",
                                            isTop ? "bg-emerald-50 text-emerald-700" : "text-slate-400"
                                        )}>
                                            {pctOfTotal.toFixed(1)}%
                                        </span>
                                    </div>

                                    {/* Divider */}
                                    <div className="h-px bg-slate-100 -mx-5 mb-3" />

                                    {/* Datos en columnas perfectas */}
                                    <div className="space-y-1.5">
                                        <DataRow label="Venta" value={fmtMoney(s.Venta)} highlight />
                                        <DataRow label="Artículos" value={fmtNumber(s.Articulos)} />
                                        <DataRow label="Unidades" value={fmtNumber(s.Unidades)} />
                                        <DataRow label="Tickets" value={fmtNumber(s.Tickets)} />
                                    </div>

                                    {/* Chevron al hover */}
                                    <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight size={14} className="text-[#4050B4]" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* NIVEL 2: PRODUCTS */}
            {!loading && level === 'products' && (
                <div>
                    {/* Resumen del proveedor */}
                    <div className="bg-white border border-slate-200 p-5 mb-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#4050B4]/10 text-[#4050B4]">
                                    <Building size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900">{selectedSupplier?.name}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {activeStoreName} · {fechaInicio} → {fechaFin}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Productos</p>
                                    <p className="text-lg font-black text-slate-900 tabular-nums">{fmtNumber(products.length)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidades</p>
                                    <p className="text-lg font-black text-slate-900 tabular-nums">{fmtNumber(totals.Cantidad || 0)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Venta total</p>
                                    <p className="text-lg font-black text-[#4050B4] tabular-nums">{fmtMoney(totals.Venta)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Buscador */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                            {filteredProducts.length} productos
                        </div>
                        <div className="relative w-72">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, código o barras..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 py-2 pl-9 pr-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4050B4]"
                            />
                        </div>
                    </div>

                    {filteredProducts.length === 0 && (
                        <div className="bg-white border border-slate-200 p-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                            Sin productos vendidos para este proveedor en el periodo
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredProducts.map(p => {
                            const pctOfTotal = totals.Venta > 0 ? (p.Venta / totals.Venta) * 100 : 0;
                            const isTop = pctOfTotal >= 5;
                            return (
                                <div
                                    key={p.CodigoInterno}
                                    className={cn(
                                        "relative bg-white border rounded-lg p-5 transition-all duration-150 group",
                                        "hover:border-emerald-300 hover:shadow-[0_0_0_4px_rgba(16,185,129,0.08)]",
                                        "border-slate-200"
                                    )}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-md bg-slate-100 group-hover:bg-emerald-50 flex items-center justify-center shrink-0 transition-colors">
                                                <Package size={15} className="text-slate-500 group-hover:text-emerald-700 transition-colors" />
                                            </div>
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <h4 className="text-[13px] font-bold text-slate-900 truncate leading-tight" title={p.Descripcion}>
                                                    {p.Descripcion}
                                                </h4>
                                                <p className="text-[10px] font-mono text-slate-400 mt-0.5 tracking-tight truncate">
                                                    #{p.CodigoInterno}{p.CodigoBarras ? ` · ${p.CodigoBarras}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "text-[11px] font-semibold tabular-nums shrink-0 px-1.5 py-0.5 rounded",
                                            isTop ? "bg-emerald-50 text-emerald-700" : "text-slate-400"
                                        )}>
                                            {pctOfTotal.toFixed(1)}%
                                        </span>
                                    </div>

                                    {/* Divider */}
                                    <div className="h-px bg-slate-100 -mx-5 mb-3" />

                                    {/* Datos en columnas perfectas */}
                                    <div className="space-y-1.5">
                                        <DataRow label="Venta" value={fmtMoney(p.Venta)} highlight />
                                        <DataRow label="Cantidad" value={fmtNumber(p.Cantidad)} />
                                        <DataRow label="Tickets" value={fmtNumber(p.Tickets)} />
                                        <DataRow label="Precio prom." value={fmtMoney(p.PrecioPromedio)} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function DataRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-medium text-slate-500">{label}</span>
            <span className={cn(
                "tabular-nums truncate",
                highlight ? "text-[15px] font-bold text-slate-900" : "text-[12px] font-semibold text-slate-700"
            )}>
                {value}
            </span>
        </div>
    );
}
