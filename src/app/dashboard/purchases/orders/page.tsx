"use client";

import { useState, useEffect, useRef } from 'react';
import { 
    Calendar, 
    ChevronDown, 
    Search, 
    Filter, 
    RotateCcw,
    FileSpreadsheet,
    FileDown,
    X,
    Check,
    ExternalLink,
    LayoutGrid,
    ArrowUpRight,
    Columns,
    Maximize2,
    Minimize2,
    Rows,
    Clock,
    Receipt
} from 'lucide-react';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { cn } from '@/lib/utils';
import { ReceiptDetailModal } from '@/components/receipt-detail-modal';
import { PurchaseKanbanModal } from '@/components/purchases/PurchaseKanbanModal';
import { PurchaseOrder, OrderDetail, DistributionItem, DistributionDetailItem } from '@/types/purchases';


interface Store {
    IdTienda: number;
    Tienda: string;
}

export default function PurchaseOrdersPage() {
    const getMonterreyDate = () => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Monterrey',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    };

    const getSemanaRange = () => {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
        const today = d.toLocaleDateString('en-CA');
        d.setDate(d.getDate() - d.getDay());
        return { start: d.toLocaleDateString('en-CA'), end: today };
    };

    const initialRange = getSemanaRange();
    const [fechaInicio, setFechaInicio] = useState(initialRange.start);
    const [fechaFin, setFechaFin] = useState(initialRange.end);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [storeSearch, setStoreSearch] = useState('');
    const [isStoreDrilldownOpen, setIsStoreDrilldownOpen] = useState(false);
    const [idComputadora, setIdComputadora] = useState<number | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    
    // Column Filters
    const [filters, setFilters] = useState({
        folio: '',
        sucursal: '',
        proveedor: '',
        recibo: ''
    });
    // Kanban Modal State
    const [isKanbanModalOpen, setIsKanbanModalOpen] = useState(false);
    const [selectedOrderForKanban, setSelectedOrderForKanban] = useState<PurchaseOrder | null>(null);


    // Initialize IdComputadora from session or generate new one
    useEffect(() => {
        const savedId = sessionStorage.getItem('kyk_id_computadora');
        if (savedId) {
            setIdComputadora(parseInt(savedId));
        } else {
            const newId = Math.floor(Math.random() * (100000 - 10000 + 1)) + 10000;
            sessionStorage.setItem('kyk_id_computadora', newId.toString());
            setIdComputadora(newId);
        }
    }, []);

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await fetch('/api/purchases/stores');
                const data: Store[] = await res.json();
                setStores(data);
                // Select all stores by default
                setSelectedStoreIds(data.map(s => s.IdTienda));
            } catch (error) {
                console.error('Error fetching stores:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStores();
    }, []);

    const fetchOrders = async () => {
        if (!idComputadora) return;
        setLoadingOrders(true);
        try {
            const storeIdsParam = selectedStoreIds.length > 0 ? `&storeIds=${selectedStoreIds.join(',')}` : '';
            const res = await fetch(`/api/purchases/orders?idComputadora=${idComputadora}&startDate=${fechaInicio}&endDate=${fechaFin}${storeIdsParam}`);
            const data = await res.json();
            if (data.error) {
                console.error('API Error:', data.error);
            } else {
                setOrders(data);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoadingOrders(false);
        }
    };


    const toggleStore = (id: number) => {
        setSelectedStoreIds(prev => 
            prev.includes(id) 
                ? prev.filter(s => s !== id) 
                : [...prev, id]
        );
    };

    const selectAllStores = () => {
        if (selectedStoreIds.length === filteredStores.length) {
            setSelectedStoreIds([]);
        } else {
            setSelectedStoreIds(filteredStores.map(s => s.IdTienda));
        }
    };

    const filteredStores = stores.filter(s => 
        s.Tienda.toLowerCase().includes(storeSearch.toLowerCase())
    );

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

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const getDaysDiff = (start: string | null | undefined, end: string | null | undefined) => {
        if (!start || !end) return null;
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = e.getTime() - s.getTime();
        return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    };

    const filteredOrders = orders.filter(order => {
        const matchFolio = order.IdOrdenCompra.toString().toLowerCase().includes(filters.folio.toLowerCase());
        const matchSucursal = order.Tienda.toLowerCase().includes(filters.sucursal.toLowerCase());
        const matchProveedor = order.Proveedor.toLowerCase().includes(filters.proveedor.toLowerCase());
        const matchRecibo = (order.FolioReciboMovil || '').toLowerCase().includes(filters.recibo.toLowerCase());
        return matchFolio && matchSucursal && matchProveedor && matchRecibo;
    });

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
                            <span>📝</span>
                            Ordenes de Compra
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Store Selection Dropdown Drilldown */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsStoreDrilldownOpen(!isStoreDrilldownOpen)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all text-xs font-bold uppercase tracking-widest rounded-none shadow-sm",
                                    selectedStoreIds.length > 0 && "border-[#4050B4] text-[#4050B4] bg-[#4050B4]/5"
                                )}
                            >
                                <Filter size={16} />
                                <span>Sucursales ({selectedStoreIds.length})</span>
                                <ChevronDown size={14} className={cn("transition-transform duration-200", isStoreDrilldownOpen && "rotate-180")} />
                            </button>

                            {isStoreDrilldownOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setIsStoreDrilldownOpen(false)}
                                    />
                                    <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 shadow-xl z-50 animate-in fade-in zoom-in duration-150 origin-top-left">
                                        <div className="p-3 border-b border-slate-100">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar..."
                                                    value={storeSearch}
                                                    onChange={(e) => setStoreSearch(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-[#4050B4]"
                                                />
                                            </div>
                                            <div className="flex justify-between items-center mt-2 px-1">
                                                <button 
                                                    onClick={selectAllStores}
                                                    className="text-[9px] font-black uppercase text-[#4050B4] hover:underline"
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
                                                                ? "bg-[#4050B4]/5 border-[#4050B4] text-[#4050B4]" 
                                                                : "border-transparent text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <span className={cn("text-[11px] uppercase tracking-tight", isSelected ? "font-black" : "font-semibold")}>
                                                            {store.Tienda}
                                                        </span>
                                                        {isSelected && <Check size={14} className="text-[#4050B4]" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="p-2 border-t border-slate-100 bg-slate-50 flex justify-end">
                                            <button 
                                                onClick={() => setIsStoreDrilldownOpen(false)}
                                                className="px-4 py-1.5 bg-[#4050B4] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#344196]"
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
                                            isActive ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                        )}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
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
                            onClick={fetchOrders}
                            className="p-2.5 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 transition-colors rounded-none shadow-sm group"
                            title="Actualizar Datos"
                        >
                            <RotateCcw size={18} className={cn("group-hover:rotate-180 transition-transform duration-500", loadingOrders && "animate-spin")} />
                        </button>

                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className={cn(
                                "p-2.5 border transition-all rounded-none shadow-sm group",
                                isMaximized
                                    ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            )}
                            title={isMaximized ? "Salir de Pantalla Completa" : "Pantalla Completa"}
                        >
                            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 min-w-0">
                <div className="bg-white border border-slate-100 shadow-sm overflow-auto custom-scrollbar h-full relative">
                    {loadingOrders && (
                        <LoadingScreen message="Cargando órdenes..." />
                    )}

                    {filteredOrders.length > 0 ? (
                        <table className="w-full text-left border-collapse min-w-[2800px] table-fixed">
                            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-20">
                                <tr>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[100px] sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-center">Acciones</th>
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[100px] sticky left-[100px] bg-slate-50 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                        <div className="flex flex-col gap-2">
                                            <span>Folio Orden</span>
                                            <input 
                                                type="text"
                                                placeholder="Filtrar..."
                                                className="p-1.5 text-[10px] font-bold bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#4050B4]"
                                                value={filters.folio}
                                                onChange={e => setFilters(prev => ({ ...prev, folio: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[120px]">Fecha Orden</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[120px]">Tipo Orden</th>
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[180px]">
                                         <div className="flex flex-col gap-2">
                                            <span>Sucursal</span>
                                            <input 
                                                type="text"
                                                placeholder="Filtrar..."
                                                className="p-1.5 text-[10px] font-bold bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#4050B4]"
                                                value={filters.sucursal}
                                                onChange={e => setFilters(prev => ({ ...prev, sucursal: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[250px]">
                                         <div className="flex flex-col gap-2">
                                            <span>Proveedor</span>
                                            <input 
                                                type="text"
                                                placeholder="Filtrar..."
                                                className="p-1.5 text-[10px] font-bold bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#4050B4]"
                                                value={filters.proveedor}
                                                onChange={e => setFilters(prev => ({ ...prev, proveedor: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[130px]">Status Orden</th>
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[110px]">
                                         <div className="flex flex-col gap-2">
                                            <span>Folio Recibo</span>
                                            <input 
                                                type="text"
                                                placeholder="Filtrar..."
                                                className="p-1.5 text-[10px] font-bold bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#4050B4]"
                                                value={filters.recibo}
                                                onChange={e => setFilters(prev => ({ ...prev, recibo: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[120px]">Fecha Recibo</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-[140px]">Total Pedido</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-[140px]">Total Surtido</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[120px]">% Efec.</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-[140px]">Total Dev.</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-[140px]">Total Pagar</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[140px]">Num. Factura</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-[140px]">Total Factura</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-[110px]">Cant. Orden</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-[110px]">Cant. Recibo</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-[110px]">Cant. Dev.</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {filteredOrders.map((order) => (
                                    <tr key={order.IdOrdenCompra} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                                        <td className="p-2 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedOrderForKanban(order);
                                                        setIsKanbanModalOpen(true);
                                                    }}
                                                    title="Ver Kanban"
                                                    className="flex items-center justify-center w-7 h-7 bg-[#4050B4]/10 text-[#4050B4] hover:bg-[#4050B4] hover:text-white transition-all shadow-sm border border-[#4050B4]/20"
                                                >
                                                    <LayoutGrid size={12} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4 font-black text-slate-700 text-sm whitespace-nowrap sticky left-[100px] bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">{order.IdOrdenCompra}</td>
                                        <td className="p-4 text-slate-600 text-[13px] whitespace-nowrap">{formatDate(order.FechaOrdenCompra)}</td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "px-2 py-1 text-[11px] font-bold uppercase tracking-tight",
                                                (order.TipoOrdenCompra === 'SUGERIDA' || order.TipoOrdenCompra === 'SUGERIDA/DIST') ? "bg-emerald-100 text-emerald-600" :
                                                order.TipoOrdenCompra === 'MANUAL' ? "bg-rose-100 text-rose-600" :
                                                "bg-slate-100 text-slate-600"
                                            )}>
                                                {order.TipoOrdenCompra}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-slate-700 text-[13px] whitespace-nowrap">{order.Tienda}</td>
                                        <td className="p-4 text-slate-600 text-[11px] truncate" title={order.Proveedor}>{order.Proveedor}</td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "px-2 py-1 text-[11px] font-black uppercase tracking-tight",
                                                order.Status === 'CANCELADA' ? "bg-rose-100 text-rose-600" :
                                                order.Status === 'AUTORIZADA' ? "bg-sky-100 text-sky-600" :
                                                order.Status.includes('RECIBIDA') ? "bg-emerald-100 text-emerald-600" :
                                                order.Status === 'CADUCA' ? "bg-purple-100 text-purple-600" :
                                                "bg-slate-100 text-slate-600"
                                            )}>
                                                {order.Status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-600 text-[13px] font-mono">{order.FolioReciboMovil || "-"}</td>
                                        <td className="p-4 text-slate-600 text-[13px] whitespace-nowrap">{formatDate(order.FechaRecibo || "")}</td>
                                        <td className="p-4 text-slate-900 text-sm font-black text-right whitespace-nowrap">{formatCurrency(order.TotalPedido)}</td>
                                        <td className="p-4 text-emerald-600 text-sm font-black text-right whitespace-nowrap">{formatCurrency(order.TotalRecibo)}</td>
                                        <td className="p-4 min-w-[120px]">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-center px-0.5">
                                                    <span className="text-[10px] font-black text-slate-700">{Math.round(order.PorcentajeEfectividad || 0)}%</span>
                                                    <ArrowUpRight size={10} className="text-emerald-500" />
                                                </div>
                                                <div className="h-1.5 bg-slate-100 overflow-hidden shadow-inner">
                                                    <div 
                                                        className={cn(
                                                            "h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]",
                                                            (order.PorcentajeEfectividad || 0) > 80 ? "bg-emerald-500" :
                                                            (order.PorcentajeEfectividad || 0) > 50 ? "bg-amber-500" :
                                                            "bg-rose-500"
                                                        )}
                                                        style={{ width: `${order.PorcentajeEfectividad || 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-rose-500 text-sm font-black text-right whitespace-nowrap">{formatCurrency(order.TotalDev)}</td>
                                        <td className="p-4 text-[#4050B4] text-sm font-black text-right whitespace-nowrap">{formatCurrency(order.TotalPagar)}</td>
                                        <td className="p-4 text-slate-600 text-[13px] font-bold">{order.NumeroFactura || "-"}</td>
                                        <td className="p-4 text-slate-900 text-sm font-black text-right whitespace-nowrap">{formatCurrency(order.TotalFactura)}</td>
                                        <td className="p-4 text-slate-600 font-bold text-right">{order.Ordenados}</td>
                                        <td className="p-4 text-emerald-600 font-bold text-right">{order.Recibidos}</td>
                                        <td className="p-4 text-rose-500 font-bold text-right">{order.Devoluciones}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="min-h-[600px] flex flex-col items-center justify-center text-center p-8">
                            <div className="w-24 h-24 bg-slate-50 flex items-center justify-center mb-6">
                                <span className="text-5xl">📄</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Sin Datos que Mostrar</h2>
                            <p className="text-slate-500 max-w-md mx-auto">
                                Selecciona los filtros y haz clic en actualizar para visualizar el listado de órdenes de compra para las sucursales seleccionadas.
                            </p>
                        </div>
                    )}
                </div>
                {/* Grid Footer - Record Count */}
                <div className="flex-none bg-slate-100 border-t border-slate-200 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total de Registros:</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-200 text-[#4050B4] text-[11px] font-black shadow-sm">
                            {filteredOrders.length}
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

