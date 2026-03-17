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

interface Store {
    IdTienda: number;
    Tienda: string;
}

interface PurchaseOrder {
    IdOrdenCompra: number;
    FechaOrdenCompra: string;
    TipoOrdenCompra: string;
    Tienda: string;
    Proveedor: string;
    Status: string;
    FolioReciboMovil: string;
    FechaRecibo: string;
    TotalPedido: number;
    TotalRecibo: number;
    PorcentajeEfectividad: number;
    TotalDev: number;
    TotalPagar: number;
    NumeroFactura: string;
    TotalFactura: number;
    Ordenados: number;
    Recibidos: number;
    Devoluciones: number;
    UsuarioOrden: string;
    UsuarioRecibo: string;
    IdTienda: number;
}

interface OrderDetail {
    PiezasPedido: number;
    Pedido: number;
    PedidoTransito: number;
    SinCargo: string;
    Medida: string;
    CodigoBarras: string;
    Descripcion: string;
    Costo: number;
    IVA100: number;
    IEPS100: number;
    D1: number;
    D2: number;
    D3: number;
    D4: number;
    D5: number;
    Total: number;
    UsuarioOrden: string;
    FechaOrdenCompra: string;
}

interface ReceiptDetailItem {
    CodigoInterno: string;
    CodigoBarras: string;
    Descripcion: string;
    MedidaCompra: string;
    MedidaVenta: string;
    MedidaGranel: string;
    Pedido: number;
    Rec: number;
    RecGranel: number;
    Costo: number;
    Desc0: number;
    Desc1: number;
    Desc2: number;
    Desc3: number;
    Desc4: number;
    Factor: number;
    Total: number;
}

interface DistributionItem {
    IdOrdenCompra: number;
    FechaOrdenCompra: string;
    IdTiendaDestino: number;
    TiendaDestino: string;
    CantidadArticulos: number;
    IdTransferenciaSalida: number | null;
    FolioSalida: string | null;
    FechaSalida: string | null;
    UsuarioSalida: string | null;
    IdTransferenciaEntrada: number | null;
    FolioEntrada: string | null;
    FechaEntrada: string | null;
    UsuarioEntrada: string | null;
    UUID?: string | null;
}

interface DistributionDetailItem {
    Cantidad?: number; // Pending
    MedidaCompra?: string; // Pending
    CantidadSalida?: number; // Processed
    Medida?: string; // Processed
    Piezas?: number; // Field name from pending query
    PiezasPedido?: number; // Field name from processed query
    PiezasRecibo?: number; // Field name from processed query
    MedidaPiezas: string;
    CodigoBarras: string;
    Descripcion: string;
    Costo?: number;
    Total?: number;
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
    const [isKanbanMaximized, setIsKanbanMaximized] = useState(false);

    // Detail Modal State
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailItems, setDetailItems] = useState<OrderDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Receipt Detail Modal State
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

    // Distribution State
    const [distributions, setDistributions] = useState<DistributionItem[]>([]);
    const [loadingDistributions, setLoadingDistributions] = useState(false);

    // Distribution Detail Modal State
    const [isDistDetailModalOpen, setIsDistDetailModalOpen] = useState(false);
    const [distDetailItems, setDistDetailItems] = useState<DistributionDetailItem[]>([]);
    const [loadingDistDetails, setLoadingDistDetails] = useState(false);
    const [selectedDistHeader, setSelectedDistHeader] = useState<{ tienda: string, folio: string | null, fecha: string | null } | null>(null);

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

    const fetchOrderDetails = async (idOrdenCompra: number) => {
        if (!idComputadora) return;
        setLoadingDetails(true);
        setIsDetailModalOpen(true);
        try {
            const res = await fetch(`/api/purchases/orders/details?idComputadora=${idComputadora}&idOrdenCompra=${idOrdenCompra}`);
            const data = await res.json();
            if (data.error) {
                console.error('API Error:', data.error);
            } else {
                setDetailItems(data);
            }
        } catch (error) {
            console.error('Error fetching order details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const fetchReceiptDetails = (folioRecibo: string, shouldOpenModal = true) => {
        if (shouldOpenModal && folioRecibo) {
            setIsReceiptModalOpen(true);
        }
    };

    // Auto-fetch when session ID or dates change
    useEffect(() => {
        if (idComputadora) {
            fetchOrders();
        }
    }, [idComputadora, fechaInicio, fechaFin]);
    const fetchDistributions = async (idOrdenCompra: number) => {
        setLoadingDistributions(true);
        try {
            const response = await fetch(`/api/purchases/orders/distributions?idOrdenCompra=${idOrdenCompra}`);
            const data = await response.json();
            if (response.ok) {
                setDistributions(data);
            } else {
                setDistributions([]);
            }
        } catch (error) {
            console.error('Error fetching distributions:', error);
            setDistributions([]);
        } finally {
            setLoadingDistributions(false);
        }
    };

    const fetchDistDetails = async (dist: DistributionItem) => {
        setLoadingDistDetails(true);
        setSelectedDistHeader({ 
            tienda: dist.TiendaDestino, 
            folio: dist.FolioSalida,
            fecha: dist.FechaSalida 
        });
        setIsDistDetailModalOpen(true);
        try {
            const originStoreId = selectedOrderForKanban?.IdTienda || 0;
            const response = await fetch(`/api/purchases/orders/distributions/details?idOrdenCompra=${dist.IdOrdenCompra}&idTiendaDestino=${dist.IdTiendaDestino}&idTransferenciaSalida=${dist.IdTransferenciaSalida || 0}&idTiendaOrdenCompra=${originStoreId}`);
            const data = await response.json();
            if (response.ok) {
                setDistDetailItems(data);
            } else {
                setDistDetailItems([]);
            }
        } catch (error) {
            console.error('Error fetching distribution details:', error);
            setDistDetailItems([]);
        } finally {
            setLoadingDistDetails(false);
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
                                                        fetchReceiptDetails(order.FolioReciboMovil || '', false);
                                                        fetchDistributions(order.IdOrdenCompra);
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
                                        <td className="p-4 text-slate-600 text-[13px] truncate" title={order.Proveedor}>{order.Proveedor}</td>
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
                                        <td className="p-4 text-slate-600 text-[13px] whitespace-nowrap">{formatDate(order.FechaRecibo)}</td>
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

            {/* Kanban Modal */}
            {isKanbanModalOpen && selectedOrderForKanban && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "bg-white shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300 transition-all",
                        isKanbanMaximized ? "w-full h-full p-0 border-0" : "w-full max-w-7xl h-auto max-h-[90vh]"
                    )}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <LayoutGrid className="text-[#4050B4]" size={24} />
                                    Panel Kanban de Seguimiento
                                    <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[11px] font-black tracking-widest border border-slate-200">
                                        {selectedOrderForKanban.Tienda}
                                    </span>
                                </h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                    Orden #{selectedOrderForKanban.IdOrdenCompra} — {selectedOrderForKanban.Proveedor}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsKanbanMaximized(!isKanbanMaximized)}
                                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-[#4050B4] transition-colors rounded-none"
                                    title={isKanbanMaximized ? "Restaurar" : "Maximizar"}
                                >
                                    {isKanbanMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                                </button>
                                <button 
                                    onClick={() => setIsKanbanModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-colors rounded-none"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Kanban Columns */}
                        <div className={cn(
                            "p-6 grid gap-6 bg-slate-50/30 overflow-hidden relative transition-all",
                            distributions.length > 0 ? "grid-cols-1 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2",
                            isKanbanMaximized ? "flex-1" : "h-[600px]"
                        )}>
                            {/* Lead Time Badge (Order -> Receipt) */}
                            {selectedOrderForKanban.FechaRecibo && selectedOrderForKanban.FechaOrdenCompra && (() => {
                                const diff = getDaysDiff(selectedOrderForKanban.FechaOrdenCompra, selectedOrderForKanban.FechaRecibo);
                                if (diff === null) return null;
                                const isWarning = diff === 0;
                                
                                return (
                                    <div className={cn(
                                        "hidden lg:flex absolute z-50 flex flex-col items-center pointer-events-none transition-all duration-500",
                                        distributions.length > 0 
                                            ? "left-[25%] top-1/2 -translate-x-1/2 -translate-y-1/2" 
                                            : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                                    )}>
                                        <div className={cn(
                                            "bg-white border-2 rounded-full p-2 shadow-xl flex flex-col items-center justify-center w-14 h-14",
                                            isWarning ? "border-amber-400 animate-pulse" : "border-[#4050B4]"
                                        )}>
                                            <div className="flex flex-col items-center justify-center">
                                                <span className={cn(
                                                    "text-base font-black leading-none",
                                                    isWarning ? "text-amber-600" : "text-[#4050B4]"
                                                )}>
                                                    +{diff}
                                                </span>
                                                <span className={cn(
                                                    "text-[7px] font-black uppercase tracking-tighter",
                                                    isWarning ? "text-amber-500" : "text-slate-600"
                                                )}>Días</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Column 1: Orden de Compra */}
                            <div className="flex flex-col gap-4 overflow-hidden">
                                <div className="flex items-center justify-between gap-2 shrink-0">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-[#4050B4] text-white self-start">
                                        <FileSpreadsheet size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Orden de Compra</span>
                                    </div>
                                    <button 
                                        onClick={() => fetchOrderDetails(selectedOrderForKanban.IdOrdenCompra)}
                                        title="Ver Detalle Orden"
                                        className="flex items-center justify-center px-4 py-1 bg-[#4050B4]/10 text-[#4050B4] hover:bg-[#4050B4] hover:text-white transition-all shadow-sm border border-[#4050B4]/20 text-[10px] font-black uppercase tracking-tighter gap-1.5"
                                    >
                                        <ExternalLink size={12} />
                                        Detalle
                                    </button>
                                </div>
                                <div className="flex-1 bg-white border-l-4 border-[#4050B4] p-5 shadow-sm space-y-4 overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                        <KanbanItem label="Folio Orden" value={selectedOrderForKanban.IdOrdenCompra} />
                                        <KanbanItem label="Fecha Orden" value={formatDateTime(selectedOrderForKanban.FechaOrdenCompra)} textSize="text-[11px]" />
                                        <KanbanItem label="Tienda" value={selectedOrderForKanban.Tienda} colSpan={2} />
                                        <KanbanItem label="Proveedor" value={selectedOrderForKanban.Proveedor} colSpan={2} />
                                        <KanbanItem label="Total Pedido" value={formatCurrency(selectedOrderForKanban.TotalPedido)} highlight />
                                        <KanbanItem label="Cant. Orden" value={selectedOrderForKanban.Ordenados} />
                                        <KanbanItem label="Usuario Orden" value={selectedOrderForKanban.UsuarioOrden} colSpan={2} />
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Recibo de Mercancia */}
                            <div className="flex flex-col gap-4 overflow-hidden">
                                <div className="flex items-center justify-between gap-2 shrink-0">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-600 text-white self-start">
                                        <Check size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Recibo de Mercancia</span>
                                    </div>
                                    {selectedOrderForKanban.FolioReciboMovil && (
                                        <button 
                                            onClick={() => fetchReceiptDetails(selectedOrderForKanban.FolioReciboMovil)}
                                            title="Ver Detalle Recibo"
                                            className="flex items-center justify-center px-4 py-1 bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-600/20 text-[10px] font-black uppercase tracking-tighter gap-1.5"
                                        >
                                            <ExternalLink size={12} />
                                            Detalle
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 bg-white border-l-4 border-emerald-500 p-5 shadow-sm space-y-4 overflow-y-auto custom-scrollbar">
                                    {selectedOrderForKanban.FolioReciboMovil ? (
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                            <KanbanItem label="Folio Recibo" value={selectedOrderForKanban.FolioReciboMovil} />
                                            <KanbanItem label="Fecha Recibo" value={formatDateTime(selectedOrderForKanban.FechaRecibo)} textSize="text-[11px]" />
                                            <KanbanItem label="Tienda" value={selectedOrderForKanban.Tienda} colSpan={2} />
                                            <KanbanItem label="Proveedor" value={selectedOrderForKanban.Proveedor} colSpan={2} />
                                            <KanbanItem label="Total Surtido" value={formatCurrency(selectedOrderForKanban.TotalRecibo)} highlight color="text-emerald-600" />
                                            <KanbanItem label="Total Devolución" value={formatCurrency(selectedOrderForKanban.TotalDev)} color="text-rose-500" />
                                            <KanbanItem label="Total a Pagar" value={formatCurrency(selectedOrderForKanban.TotalPagar)} highlight color="text-[#4050B4]" />
                                            <KanbanItem label="Número Factura" value={selectedOrderForKanban.NumeroFactura || "-"} />
                                            <KanbanItem label="Total Factura" value={formatCurrency(selectedOrderForKanban.TotalFactura)} />
                                            <KanbanItem label="Cant. Recibo" value={selectedOrderForKanban.Recibidos} />
                                            <KanbanItem label="Cant. Dev." value={selectedOrderForKanban.Devoluciones} />
                                            <KanbanItem label="Usuario Recibo" value={selectedOrderForKanban.UsuarioRecibo} colSpan={2} />
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-slate-50 border border-dashed border-slate-200">
                                            <div className="w-12 h-12 bg-slate-100 flex items-center justify-center rounded-full mb-3 text-slate-400">
                                                <Search size={24} />
                                            </div>
                                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest italic">Sin Recibo de Mercancía</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Combined Distribution & Entries Section (Conditional) */}
                            {distributions.length > 0 && (
                                <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden relative">
                                    {/* Headers Container */}
                                    <div className="grid grid-cols-2 gap-4 shrink-0">
                                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-500 text-white self-start">
                                            <RotateCcw size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Distribución</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-900 text-white self-start">
                                            <ArrowUpRight size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Entradas de Distribución</span>
                                        </div>
                                    </div>

                                    {/* Unified Unified Scroll Area for both columns */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
                                        <div className="space-y-4">
                                            {distributions.map((dist, idx) => {
                                                const isPendingDist = !dist.FolioSalida;
                                                const isPendingEntry = !dist.FolioEntrada;
                                                
                                                const diffReciboSalida = getDaysDiff(selectedOrderForKanban.FechaRecibo, dist.FechaSalida);
                                                const diffSalidaEntrada = getDaysDiff(dist.FechaSalida, dist.FechaEntrada);

                                                return (
                                                    <div key={idx} className="relative">
                                                        {/* Lead Time Badge (Receipt -> Distribution) */}
                                                        {selectedOrderForKanban.FechaRecibo && dist.FechaSalida && diffReciboSalida !== null && (
                                                            <div className={cn(
                                                                "absolute z-50 flex flex-col items-center pointer-events-none transition-all duration-500",
                                                                "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" // Position exactly on the boundary between Recibo and Distribution
                                                            )}>
                                                                <div className={cn(
                                                                    "bg-white border-2 rounded-full p-1.5 shadow-xl flex flex-col items-center justify-center w-12 h-12",
                                                                    diffReciboSalida === 0 ? "border-amber-400 animate-pulse" : "border-emerald-500"
                                                                )}>
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <span className={cn(
                                                                            "text-[13px] font-black leading-none",
                                                                            diffReciboSalida === 0 ? "text-amber-600" : "text-emerald-600"
                                                                        )}>
                                                                            +{diffReciboSalida}
                                                                        </span>
                                                                        <span className={cn(
                                                                            "text-[6px] font-black uppercase tracking-tighter",
                                                                            diffReciboSalida === 0 ? "text-amber-500" : "text-slate-400"
                                                                        )}>Días</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-2 gap-4 items-stretch relative">
                                                            {/* Lead Time Badge (Distribution -> Entry) */}
                                                            {dist.FechaSalida && dist.FechaEntrada && diffSalidaEntrada !== null && (
                                                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                                                                    <div className="w-10 h-10 rounded-full border-2 bg-white shadow-lg flex flex-col items-center justify-center border-emerald-500">
                                                                        <span className="text-xs font-black leading-none text-emerald-900">+{diffSalidaEntrada}</span>
                                                                        <span className="text-[6px] font-black uppercase text-slate-400">Días</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Distribution Card */}
                                                            <div className={cn(
                                                                "bg-white border-l-4 p-4 shadow-sm space-y-3 relative group overflow-hidden transition-all",
                                                                isPendingDist ? "border-rose-500 bg-rose-50/10" : (dist.UUID ? "border-purple-500" : "border-amber-400")
                                                            )}>
                                                                {isPendingDist && (
                                                                    <div className="absolute top-0 right-0 bg-rose-500 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter animate-pulse flex items-center gap-1 z-30">
                                                                        <RotateCcw size={8} />
                                                                        Distribución Pendiente
                                                                    </div>
                                                                )}
                                                                {!isPendingDist && dist.UUID && (
                                                                    <div className="absolute top-0 right-0 bg-purple-600 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 z-30 shadow-sm">
                                                                        <Receipt size={8} />
                                                                        Factura
                                                                    </div>
                                                                )}
                                                                <div className="grid grid-cols-2 gap-y-3 gap-x-4 relative z-10">
                                                                    <KanbanItem 
                                                                        label="Tienda Destino" 
                                                                        value={dist.TiendaDestino} 
                                                                        colSpan={2} 
                                                                        color={isPendingDist ? "text-rose-700" : (dist.UUID ? "text-purple-700" : "text-amber-700")} 
                                                                    />
                                                                    <KanbanItem label="Artículos" value={dist.CantidadArticulos} />
                                                                    <KanbanItem 
                                                                        label="Folio Salida" 
                                                                        value={dist.FolioSalida || 'PENDIENTE'} 
                                                                        highlight 
                                                                        color={isPendingDist ? "text-rose-600 font-black italic" : (dist.UUID ? "text-purple-600" : "text-amber-600")} 
                                                                    />
                                                                    <KanbanItem label="Fecha Salida" value={dist.FechaSalida ? formatDateTime(dist.FechaSalida) : '---'} textSize="text-[11px]" />
                                                                    <KanbanItem label="Usuario" value={dist.UsuarioSalida || '---'} />
                                                                    {dist.UUID && (
                                                                        <div className="col-span-2 mt-1">
                                                                            <KanbanItem 
                                                                                label="UUID" 
                                                                                value={dist.UUID} 
                                                                                colSpan={2}
                                                                                textSize="text-[9px]"
                                                                                color="text-purple-600"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <button 
                                                                    onClick={() => fetchDistDetails(dist)}
                                                                    className={cn(
                                                                        "w-full mt-2 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn",
                                                                        dist.UUID ? "bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700" : "bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700"
                                                                    )}
                                                                >
                                                                    Ver Detalle
                                                                    <ExternalLink size={10} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                                                </button>
                                                            </div>

                                                            {/* Entry Card */}
                                                            <div className={cn(
                                                                "bg-white border-l-4 p-4 shadow-sm space-y-3 relative group overflow-hidden transition-all",
                                                                isPendingEntry ? "border-rose-500 bg-rose-50/10" : "border-emerald-800"
                                                            )}>
                                                                {isPendingEntry && (
                                                                    <div className="absolute top-0 right-0 bg-rose-500 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter animate-pulse flex items-center gap-1 z-30">
                                                                        <Filter size={8} />
                                                                        Pendiente Entrada
                                                                    </div>
                                                                )}
                                                                <div className="grid grid-cols-2 gap-y-3 gap-x-4 relative z-10">
                                                                    <KanbanItem 
                                                                        label="Tienda Destino" 
                                                                        value={dist.TiendaDestino} 
                                                                        colSpan={2} 
                                                                        color={isPendingEntry ? "text-rose-700" : "text-emerald-900"} 
                                                                    />
                                                                    <KanbanItem label="Artículos" value={dist.CantidadArticulos} />
                                                                    <KanbanItem 
                                                                        label="Folio Entrada" 
                                                                        value={dist.FolioEntrada || 'PENDIENTE'} 
                                                                        highlight 
                                                                        color={isPendingEntry ? "text-rose-600 font-black italic" : "text-emerald-950"} 
                                                                    />
                                                                    <KanbanItem label="Fecha Entrada" value={dist.FechaEntrada ? formatDateTime(dist.FechaEntrada) : '---'} textSize="text-[11px]" />
                                                                    <KanbanItem label="Usuario" value={dist.UsuarioEntrada || '---'} />
                                                                </div>
                                                                <div className="h-[27px]" /> {/* Spacer to align with detail button */}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
              

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button 
                                onClick={() => setIsKanbanModalOpen(false)}
                                className="px-6 py-2 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Items Detail Modal */}
            {isDetailModalOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl h-[85vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                            <div className="flex flex-col">
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <FileSpreadsheet className="text-[#4050B4]" size={20} />
                                    Detalle de Productos - Orden: {selectedOrderForKanban?.IdOrdenCompra}
                                </h2>
                                <div className="flex items-center gap-4 mt-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedOrderForKanban?.Proveedor}</p>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Fecha: {formatDate(detailItems[0]?.FechaOrdenCompra || selectedOrderForKanban?.FechaOrdenCompra || '')}</p>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <p className="text-[10px] font-black text-[#4050B4] uppercase tracking-widest">Generado por: {detailItems[0]?.UsuarioOrden || selectedOrderForKanban?.UsuarioOrden || 'N/A'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsDetailModalOpen(false)}
                                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content - Table */}
                        <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50/50">
                            {loadingDetails ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4">
                                    <div className="w-10 h-10 border-4 border-slate-200 border-t-[#4050B4] rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Consultando buffer...</p>
                                </div>
                            ) : detailItems.length > 0 ? (
                                <table className="w-full text-left border-collapse bg-white shadow-sm border border-slate-200">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Piezas</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Pedido</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Pedido Transito</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">Sin Cargo</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-20">Medida</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-32">Codigo Barras</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Descripcion</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Costo</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">IVA100</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">IEPS100</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D1</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D2</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D3</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D4</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D5</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-28">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {detailItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="p-2 text-[11px] text-right font-bold text-slate-600">{item.PiezasPedido}</td>
                                                <td className="p-2 text-[11px] text-right font-black text-[#4050B4]">{item.Pedido}</td>
                                                <td className="p-2 text-[11px] text-right font-bold text-amber-600">{item.PedidoTransito}</td>
                                                <td className="p-2 text-[11px] font-bold text-slate-500 uppercase truncate max-w-[100px]" title={item.SinCargo}>{item.SinCargo || '-'}</td>
                                                <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{item.Medida}</td>
                                                <td className="p-2 text-[10px] font-mono font-bold text-slate-500">{item.CodigoBarras}</td>
                                                <td className="p-2 text-[11px] font-bold uppercase tracking-tight truncate max-w-[200px]" title={item.Descripcion}>{item.Descripcion}</td>
                                                <td className="p-2 text-[11px] text-right font-bold text-slate-600">{formatCurrency(item.Costo)}</td>
                                                <td className="p-2 text-[11px] text-right font-bold text-slate-500">{item.IVA100}%</td>
                                                <td className="p-2 text-[11px] text-right font-bold text-slate-500">{item.IEPS100}%</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.D1}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.D2}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.D3}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.D4}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.D5}</td>
                                                <td className="p-2 text-[11px] text-right font-black text-slate-900">{formatCurrency(item.Total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                        <tr>
                                            <td colSpan={15} className="p-4 text-right text-[11px] font-black uppercase text-slate-500 tracking-widest">Total General</td>
                                            <td className="p-4 text-right text-base font-black text-[#4050B4]">
                                                {formatCurrency(detailItems.reduce((acc, item) => acc + item.Total, 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                    <div className="w-16 h-16 bg-slate-100 flex items-center justify-center rounded-full mb-4 text-slate-400">
                                        <Search size={32} />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800 uppercase mb-1">Sin detalles</h3>
                                    <p className="text-slate-500 text-sm max-w-xs mx-auto">No se encontraron partidas para esta orden en el buffer.</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                            <button 
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-8 py-2.5 bg-[#4050B4] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#344196] transition-all shadow-lg"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Merchandise Receipt Detail Modal */}
            <ReceiptDetailModal 
                isOpen={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                folioRecibo={selectedOrderForKanban?.FolioReciboMovil || null}
                storeName={selectedOrderForKanban?.Tienda}
                providerName={selectedOrderForKanban?.Proveedor}
            />

            {/* Distribution Detail Modal */}
            {isDistDetailModalOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl h-[70vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                            <div className="flex flex-col">
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <RotateCcw className="text-amber-500" size={20} />
                                    Detalle de Distribución - {selectedDistHeader?.tienda}
                                </h2>
                                <div className="flex items-center gap-4 mt-1">
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                        Folio Transferencia: {selectedDistHeader?.folio || 'PENDIENTE'}
                                    </p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <Clock size={10} />
                                        Fecha Salida: {selectedDistHeader?.fecha ? formatDateTime(selectedDistHeader.fecha) : '---'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsDistDetailModalOpen(false)}
                                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content - Table */}
                        <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50/50">
                            {loadingDistDetails ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4">
                                    <div className="w-10 h-10 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Cargando partidas...</p>
                                </div>
                            ) : distDetailItems.length > 0 ? (
                                <table className="w-full text-left border-collapse bg-white shadow-sm border border-slate-200">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                        {selectedDistHeader?.folio && selectedDistHeader.folio !== 'PENDIENTE' ? (
                                            <tr>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-20">Cant. Salida</th>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400 w-20">Medida</th>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-20">Pzs Pedido</th>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-20">Pzs Recibo</th>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400 w-20">Medida Pzs</th>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400 w-28">Codigo Barras</th>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Descripcion</th>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Costo</th>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Total</th>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Cantidad</th>
                                                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Medida Compra</th>
                                                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Piezas</th>
                                                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Medida Piezas</th>
                                                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">Codigo Barras</th>
                                                <th className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Descripcion</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {distDetailItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                {selectedDistHeader?.folio && selectedDistHeader.folio !== 'PENDIENTE' ? (
                                                    <>
                                                        <td className="p-2 text-[12px] text-right font-black text-amber-600">{item.CantidadSalida}</td>
                                                        <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{item.Medida}</td>
                                                        <td className="p-2 text-[12px] text-right font-bold text-slate-600">{item.PiezasPedido}</td>
                                                        <td className="p-2 text-[12px] text-right font-bold text-emerald-600">{item.PiezasRecibo}</td>
                                                        <td className="p-2 text-[10px] font-black text-slate-400 uppercase italic">{item.MedidaPiezas}</td>
                                                        <td className="p-2 text-[10px] font-mono font-bold text-slate-500">{item.CodigoBarras}</td>
                                                        <td className="p-2 text-[11px] font-bold uppercase tracking-tight truncate max-w-[150px]" title={item.Descripcion}>{item.Descripcion}</td>
                                                        <td className="p-2 text-[11px] text-right font-bold text-slate-600">{formatCurrency(item.Costo || 0)}</td>
                                                        <td className="p-2 text-[12px] text-right font-black text-slate-900">{formatCurrency(item.Total || 0)}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="p-3 text-[12px] text-right font-black text-amber-600">{item.Cantidad}</td>
                                                        <td className="p-3 text-[10px] font-black text-slate-400 uppercase">{item.MedidaCompra}</td>
                                                        <td className="p-3 text-[12px] text-right font-bold text-slate-600">{item.Piezas}</td>
                                                        <td className="p-3 text-[10px] font-black text-slate-400 uppercase italic">{item.MedidaPiezas}</td>
                                                        <td className="p-3 text-[10px] font-mono font-bold text-slate-500">{item.CodigoBarras}</td>
                                                        <td className="p-3 text-[12px] font-bold uppercase tracking-tight">{item.Descripcion}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                    <div className="w-16 h-16 bg-slate-100 flex items-center justify-center rounded-full mb-4 text-slate-400">
                                        <Search size={32} />
                                    </div>
                                    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest italic">No se encontraron artículos distribuidos</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                            <button 
                                onClick={() => setIsDistDetailModalOpen(false)}
                                className="px-8 py-2.5 bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Simple Helper Component for Kanban Items
function KanbanItem({ label, value, colSpan = 1, highlight = false, color = "text-slate-800", textSize = "text-[13px]" }: { label: string, value: any, colSpan?: number, highlight?: boolean, color?: string, textSize?: string }) {
    return (
        <div className={cn("flex flex-col gap-1", colSpan === 2 && "col-span-2")}>
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
            <span className={cn(
                "uppercase truncate", 
                textSize,
                highlight ? "font-black text-sm" : "font-bold",
                color
            )}>
                {value || "-"}
            </span>
        </div>
    );
}
