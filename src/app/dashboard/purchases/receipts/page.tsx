"use client";

import { useState, useEffect } from 'react';
import { 
    Calendar, 
    ChevronDown, 
    Search, 
    Filter, 
    RotateCcw,
    Check,
    Maximize2,
    Minimize2,
    Truck,
    LayoutGrid,
    ArrowUpRight,
    FileSpreadsheet,
    Clock,
    PackageCheck,
    CheckCircle2
} from 'lucide-react';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { cn } from '@/lib/utils';
import { PurchaseKanbanModal } from '@/components/purchases/PurchaseKanbanModal';
import { PurchaseOrder } from '@/types/purchases';

interface Store {
    IdTienda: number;
    Tienda: string;
}

interface ReceiptItem {
    IdReciboMovil: number;
    IdTienda: number;
    FolioReciboMovil: string;
    FechaRecibo: string;
    IdReciboSAP: number;
    Numero: string;
    Total: number;
    UUID: string | null;
    DescuentosDevoluciones: number;
    Proveedor: string;
    RFC: string;
    Tienda: string;
    CountInterfaceSAP: number;
    MaxFechaInterfaceSAP: string | null;
    CountAutorizacionSAP: number;
    MaxFechaAutorizacionSAP: string | null;
    IdOrdenCompra: number | null;
    DescripcionAutorizacion: string;
    DescripcionAutorizacionDevolucion: string;
    StatusAutorizacion: number;
    StatusAutorizacionDevolucion: number;
}

export default function ReceiptsPage() {
    const getMonterreyDate = () => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Monterrey',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    };

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
            label: 'Sema',
            start: (() => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' })); d.setDate(d.getDate() - d.getDay()); return d.toLocaleDateString('en-CA'); })(),
            end: today
        },
        { label: '7 Días', start: mtyDate(-6), end: today },
        {
            label: 'Este Mes',
            start: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
            end: today
        },
        {
            label: 'Mes Ant.',
            start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
            end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })()
        },
    ];

    const [fechaInicio, setFechaInicio] = useState(periods[0].start); // Default to Hoy
    const [fechaFin, setFechaFin] = useState(periods[0].end);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingReceipts, setLoadingReceipts] = useState(false);
    const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
    const [storeSearch, setStoreSearch] = useState('');
    const [isStoreDrilldownOpen, setIsStoreDrilldownOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    
    // Column Filters
    const [filters, setFilters] = useState({
        folio: '',
        folioOrden: '',
        sucursal: '',
        proveedor: '',
        numero: ''
    });

    // Kanban Modal State
    const [isKanbanModalOpen, setIsKanbanModalOpen] = useState(false);
    const [selectedOrderForKanban, setSelectedOrderForKanban] = useState<PurchaseOrder | null>(null);

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await fetch('/api/purchases/stores');
                const data: Store[] = await res.json();
                setStores(data);
                setSelectedStoreIds(data.map(s => s.IdTienda));
            } catch (error) {
                console.error('Error fetching stores:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStores();
    }, []);

    const fetchReceipts = async () => {
        setLoadingReceipts(true);
        try {
            const storeIdsParam = selectedStoreIds.length > 0 ? `&storeIds=${selectedStoreIds.join(',')}` : '';
            const res = await fetch(`/api/purchases/receipts?startDate=${fechaInicio}&endDate=${fechaFin}${storeIdsParam}`);
            const data = await res.json();
            if (data.error) {
                console.error('API Error:', data.error);
            } else {
                setReceipts(data);
            }
        } catch (error) {
            console.error('Error fetching receipts:', error);
        } finally {
            setLoadingReceipts(false);
        }
    };

    useEffect(() => {
        if (!loading && selectedStoreIds.length > 0) {
            fetchReceipts();
        }
    }, [loading, fechaInicio, fechaFin]);

    const toggleStore = (id: number) => {
        setSelectedStoreIds(prev => 
            prev.includes(id) 
                ? prev.filter(s => s !== id) 
                : [...prev, id]
        );
    };

    const filteredStores = stores.filter(s => 
        s.Tienda.toLowerCase().includes(storeSearch.toLowerCase())
    );

    const selectAllStores = () => {
        if (selectedStoreIds.length === filteredStores.length) {
            setSelectedStoreIds([]);
        } else {
            setSelectedStoreIds(filteredStores.map(s => s.IdTienda));
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const extractUUID = (val: string | null) => {
        if (!val) return "-";
        if (val.includes('id=')) {
            try {
                // Try as URL first
                if (val.startsWith('http')) {
                    const url = new URL(val);
                    const id = url.searchParams.get('id');
                    if (id) return id;
                }
                // Fallback to regex for cases where URL might fail or be partial
                const match = val.match(/[?&]id=([^&]+)/);
                if (match) return match[1];
            } catch (e) {
                const match = val.match(/[?&]id=([^&]+)/);
                if (match) return match[1];
            }
        }
        return val;
    };

    // Initialize IdComputadora from session or generate new one
    useEffect(() => {
        const savedId = sessionStorage.getItem('kyk_id_computadora');
        if (!savedId) {
            const newId = Math.floor(Math.random() * (100000 - 10000 + 1)) + 10000;
            sessionStorage.setItem('kyk_id_computadora', newId.toString());
        }
    }, []);

    const handleOpenKanban = (receipt: ReceiptItem) => {
        const mappedOrder: PurchaseOrder = {
            IdOrdenCompra: receipt.IdOrdenCompra || 0,
            FechaOrdenCompra: receipt.FechaRecibo,
            TipoOrdenCompra: "REPORTE",
            Tienda: receipt.Tienda,
            Proveedor: receipt.Proveedor,
            Status: receipt.DescripcionAutorizacion,
            FolioReciboMovil: receipt.FolioReciboMovil,
            FechaRecibo: receipt.FechaRecibo,
            TotalPedido: receipt.Total,
            TotalRecibo: receipt.Total,
            PorcentajeEfectividad: 100,
            TotalDev: receipt.DescuentosDevoluciones,
            TotalPagar: receipt.Total - receipt.DescuentosDevoluciones,
            NumeroFactura: receipt.Numero,
            TotalFactura: receipt.Total,
            Ordenados: 0,
            Recibidos: 1, 
            Devoluciones: receipt.DescuentosDevoluciones > 0 ? 1 : 0,
            UsuarioOrden: "N/A",
            UsuarioRecibo: "N/A",
            IdTienda: receipt.IdTienda,
            IdReciboMovil: receipt.IdReciboMovil,
            UUID: extractUUID(receipt.UUID)
        };
        setSelectedOrderForKanban(mappedOrder);
        setIsKanbanModalOpen(true);
    };

    const filteredReceipts = receipts.filter(r => {
        const matchesFolio = r.FolioReciboMovil.toLowerCase().includes(filters.folio.toLowerCase());
        const matchesFolioOrden = (r.IdOrdenCompra?.toString() || '').includes(filters.folioOrden);
        const matchesSucursal = r.Tienda.toLowerCase().includes(filters.sucursal.toLowerCase());
        const matchesProveedor = r.Proveedor.toLowerCase().includes(filters.proveedor.toLowerCase());
        const matchesNumero = r.Numero.toLowerCase().includes(filters.numero.toLowerCase());

        return matchesFolio && matchesFolioOrden && matchesSucursal && matchesProveedor && matchesNumero;
    });

    if (loading) return <LoadingScreen />;

    return (
        <div className={cn(
            "flex flex-col h-[calc(100vh-160px)] min-h-[600px]",
            isMaximized && "fixed inset-0 z-[100] bg-slate-50 p-4 sm:p-8 md:p-10 h-screen"
        )}>
            {/* Header with Filters - STICKY */}
            <div className="bg-slate-50 pb-4 space-y-4 flex-none sticky top-0 z-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-2 px-4 rounded-none shadow-sm border border-slate-100">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
                            <span>🧾</span>
                            Recibos de Compra
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Store Selection Dropdown */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsStoreDrilldownOpen(!isStoreDrilldownOpen)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all text-xs font-bold uppercase tracking-widest rounded-none shadow-sm",
                                    selectedStoreIds.length > 0 && "border-emerald-600 text-emerald-600 bg-emerald-50"
                                )}
                            >
                                <Filter size={16} />
                                <span>Sucursales ({selectedStoreIds.length})</span>
                                <ChevronDown size={14} className={cn("transition-transform duration-200", isStoreDrilldownOpen && "rotate-180")} />
                            </button>

                            {isStoreDrilldownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsStoreDrilldownOpen(false)} />
                                    <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 shadow-xl z-50 animate-in fade-in zoom-in duration-150 origin-top-left">
                                        <div className="p-3 border-b border-slate-100">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar..."
                                                    value={storeSearch}
                                                    onChange={(e) => setStoreSearch(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
                                                />
                                            </div>
                                            <div className="flex justify-between items-center mt-2 px-1">
                                                <button 
                                                    onClick={selectAllStores}
                                                    className="text-[9px] font-black uppercase text-emerald-600 hover:underline"
                                                >
                                                    {selectedStoreIds.length === filteredStores.length ? 'Ninguna' : 'Todas'}
                                                </button>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                    {selectedStoreIds.length} select
                                                </span>
                                            </div>
                                        </div>
                                        <div className="max-h-[350px] overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                                            {filteredStores.map(store => {
                                                const isSelected = selectedStoreIds.includes(store.IdTienda);
                                                return (
                                                    <button
                                                        key={store.IdTienda}
                                                        onClick={() => toggleStore(store.IdTienda)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-3 py-2 text-left transition-all border-l-4",
                                                            isSelected 
                                                                ? "bg-emerald-50 border-emerald-600 text-emerald-600" 
                                                                : "border-transparent text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <span className={cn("text-[11px] uppercase tracking-tight", isSelected ? "font-black" : "font-semibold")}>
                                                            {store.Tienda}
                                                        </span>
                                                        {isSelected && <Check size={14} className="text-emerald-600" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="p-2 border-t border-slate-100 bg-slate-50 flex justify-end">
                                            <button 
                                                onClick={() => setIsStoreDrilldownOpen(false)}
                                                className="px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Quick Date Period Buttons */}
                        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-none p-0.5">
                            {periods.map(({ label, start, end }) => {
                                const isActive = fechaInicio === start && fechaFin === end;
                                return (
                                    <button
                                        key={label}
                                        onClick={() => { setFechaInicio(start); setFechaFin(end); }}
                                        className={cn(
                                            'px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                            isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                        )}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom Date Range */}
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-600/20 transition-all">
                            <Calendar size={16} className="text-emerald-600" />
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
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-600/20 transition-all">
                            <Calendar size={16} className="text-emerald-600" />
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
                            onClick={fetchReceipts}
                            disabled={loadingReceipts}
                            className="p-2.5 bg-slate-50 border border-slate-200 text-emerald-600 hover:bg-slate-100 transition-colors rounded-none shadow-sm group disabled:opacity-50"
                        >
                            <RotateCcw size={18} className={cn("group-hover:rotate-180 transition-transform duration-500", loadingReceipts && "animate-spin")} />
                        </button>

                        <button 
                            onClick={() => setIsMaximized(!isMaximized)}
                            className={cn(
                                "p-2.5 border transition-all rounded-none shadow-sm group",
                                isMaximized
                                    ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            )}
                        >
                            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="flex-1 bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                {loadingReceipts && (
                    <LoadingScreen message="Cargando recibos..." />
                )}

                <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse min-w-[1400px]">
                        <thead className="sticky top-0 z-30 bg-slate-50">
                            <tr className="border-b border-slate-200">
                                <th className="p-4 w-12 sticky left-0 bg-slate-50 z-40 border-r border-slate-200 text-center text-[10px] font-black uppercase text-slate-400">Acc</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Folio Recibo</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Folio Orden</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha Recibo</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Sucursal</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Proveedor</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estatus Recibo</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estatus Dev.</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Factura</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">UUID</th>
                            </tr>
                            <tr className="bg-slate-50/50">
                                <th className="p-2 sticky left-0 bg-slate-50/50 z-40 border-r border-slate-200" />
                                <th className="p-2">
                                    <input 
                                        type="text" 
                                        className="w-full p-1.5 text-[10px] font-bold border border-slate-200 outline-none"
                                        placeholder="Filtrar..."
                                        value={filters.folio}
                                        onChange={(e) => setFilters({...filters, folio: e.target.value})}
                                    />
                                </th>
                                <th className="p-2">
                                    <input 
                                        type="text" 
                                        className="w-full p-1.5 text-[10px] font-bold border border-slate-200 outline-none"
                                        placeholder="Filtrar..."
                                        value={filters.folioOrden}
                                        onChange={(e) => setFilters({...filters, folioOrden: e.target.value})}
                                    />
                                </th>
                                <th className="p-2" />
                                <th className="p-2">
                                    <input 
                                        type="text" 
                                        className="w-full p-1.5 text-[10px] font-bold border border-slate-200 outline-none"
                                        placeholder="Filtrar..."
                                        value={filters.sucursal}
                                        onChange={(e) => setFilters({...filters, sucursal: e.target.value})}
                                    />
                                </th>
                                <th className="p-2">
                                    <input 
                                        type="text" 
                                        className="w-full p-1.5 text-[10px] font-bold border border-slate-200 outline-none"
                                        placeholder="Filtrar..."
                                        value={filters.proveedor}
                                        onChange={(e) => setFilters({...filters, proveedor: e.target.value})}
                                    />
                                </th>
                                <th className="p-2" />
                                <th className="p-2" />
                                <th className="p-2">
                                    <input 
                                        type="text" 
                                        className="w-full p-1.5 text-[10px] font-bold border border-slate-200 outline-none"
                                        placeholder="Filtrar..."
                                        value={filters.numero}
                                        onChange={(e) => setFilters({...filters, numero: e.target.value})}
                                    />
                                </th>
                                <th className="p-2" />
                                <th className="p-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredReceipts.length === 0 && !loadingReceipts ? (
                                <tr>
                                    <td colSpan={11} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-30">
                                            <Search size={48} />
                                            <p className="text-[13px] font-black uppercase tracking-widest">No se encontraron resultados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredReceipts.map((receipt, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-2 text-center sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-sm">
                                            <button 
                                                onClick={() => handleOpenKanban(receipt)}
                                                title="Ver Kanban"
                                                className="flex items-center justify-center w-7 h-7 mx-auto bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100"
                                            >
                                                <PackageCheck size={14} />
                                            </button>
                                        </td>
                                        <td className="p-4 font-black text-slate-800 text-[13px]">{receipt.FolioReciboMovil}</td>
                                        <td className="p-4 font-bold text-[#4050B4] text-[13px]">{receipt.IdOrdenCompra || "-"}</td>
                                        <td className="p-4 text-slate-600 text-[13px] whitespace-nowrap">{formatDate(receipt.FechaRecibo)}</td>
                                        <td className="p-4 font-bold text-slate-700 text-[13px] whitespace-nowrap">{receipt.Tienda}</td>
                                        <td className="p-4 text-slate-600 text-[13px] truncate max-w-[200px]" title={receipt.Proveedor}>{receipt.Proveedor}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={cn(
                                                    "px-2 py-1 text-[10px] font-black uppercase tracking-tight text-center",
                                                    receipt.StatusAutorizacion === 0 ? "bg-amber-100 text-amber-600 border border-amber-200" :
                                                    receipt.StatusAutorizacion === 1 ? "bg-emerald-100 text-emerald-600 border border-emerald-200" :
                                                    receipt.StatusAutorizacion === 2 ? "bg-sky-100 text-sky-600 border border-sky-200" :
                                                    receipt.StatusAutorizacion === 99 ? "bg-purple-100 text-purple-600 border border-purple-200" :
                                                    "bg-slate-100 text-slate-600"
                                                )}>
                                                    {receipt.DescripcionAutorizacion}
                                                </span>
                                                {receipt.MaxFechaAutorizacionSAP && (
                                                    <span className="text-[8px] font-black text-slate-400 italic text-right">
                                                        {new Date(receipt.MaxFechaAutorizacionSAP).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "px-2 py-1 text-[10px] font-black uppercase tracking-tight block text-center border",
                                                receipt.StatusAutorizacionDevolucion === -1 ? "bg-slate-50 text-slate-300 border-transparent" :
                                                receipt.StatusAutorizacionDevolucion === 0 ? "bg-rose-100 text-rose-600 border-rose-200" :
                                                receipt.StatusAutorizacionDevolucion === 1 ? "bg-emerald-100 text-emerald-600 border-emerald-200" :
                                                "bg-slate-100 text-slate-600"
                                            )}>
                                                {receipt.DescripcionAutorizacionDevolucion}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-600 text-[13px] font-mono">{receipt.Numero || "-"}</td>
                                        <td className="p-4 text-emerald-900 text-sm font-black text-right whitespace-nowrap bg-emerald-50/20">
                                            {formatCurrency(receipt.Total)}
                                        </td>
                                        <td className="p-4 text-[10px] font-mono text-slate-400 max-w-[200px] truncate" title={receipt.UUID || ''}>
                                            {extractUUID(receipt.UUID)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Grid Footer - Record Count */}
                <div className="flex-none bg-slate-100 border-t border-slate-200 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total de Registros:</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-200 text-emerald-600 text-[11px] font-black shadow-sm">
                            {filteredReceipts.length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Reusable Kanban Modal */}
            <PurchaseKanbanModal 
                isOpen={isKanbanModalOpen}
                onClose={() => setIsKanbanModalOpen(false)}
                order={selectedOrderForKanban}
            />
        </div>
    );
}

