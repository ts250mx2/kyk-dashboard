"use client";

import { useState, useEffect, memo, useMemo } from 'react';
import {
    Calendar,
    Search,
    RotateCcw,
    ArrowRight,
    FileSpreadsheet,
    Receipt,
    Maximize2,
    Minimize2,
    X,
    ExternalLink,
    Package,
    Check,
    Clock,
    CheckCircle2,
    Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CedisRow {
    IdOrdenCompra: number;
    FechaOrdenCompra: string;
    TiendaOrigen: string;
    Proveedor: string;
    Status: string;
    TipoOrdenCompra: string;
    FolioReciboMovil: string | null;
    FechaRecibo: string | null;
    UUIDRecibo: string | null;
    UsuarioRecibo: string | null;
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
    UUID: string | null;
    IdTiendaOrigen: number;
    TotalPedido: number;
    Ordenados: number;
    TotalRecibo: number | null;
    Recibidos: number | null;
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
    D1: number; D2: number; D3: number; D4: number; D5: number;
    Total: number;
    UsuarioOrden: string;
    FechaOrdenCompra: string;
}

interface ReceiptDetailItem {
    CodigoBarras: string;
    Descripcion: string;
    MedidaCompra: string;
    MedidaVenta: string;
    MedidaGranel: string;
    Pedido: number;
    Rec: number;
    RecGranel: number;
    Costo: number;
    Desc0: number; Desc1: number; Desc2: number; Desc3: number; Desc4: number;
    Factor: number;
    Total: number;
}

interface ReceiptData {
    header: { folioRecibo: string; IdReciboMovil: number; IdTienda: number; UUID: string; FechaRecibo: string; Usuario: string; };
    receiptItems: ReceiptDetailItem[];
    returnItems: ReceiptDetailItem[];
}

interface DistDetailItem {
    Cantidad?: number;
    MedidaCompra?: string;
    CantidadSalida?: number;
    Medida?: string;
    Piezas?: number;
    PiezasPedido?: number;
    PiezasRecibo?: number;
    MedidaPiezas: string;
    CodigoBarras: string;
    Descripcion: string;
    Costo?: number;
    Total?: number;
}

const StatusBadge = ({ status }: { status: string }) => {
    const colors =
        status === 'CANCELADA' ? 'bg-rose-100 text-rose-600' :
        status === 'AUTORIZADA' ? 'bg-sky-100 text-sky-600' :
        status.includes('RECIBIDA') ? 'bg-emerald-100 text-emerald-600' :
        status === 'CADUCA' ? 'bg-purple-100 text-purple-600' :
        'bg-slate-100 text-slate-600';
    return (
        <span className={cn("px-1 py-0.5 text-[7px] font-black uppercase tracking-tight", colors)}>
            {status}
        </span>
    );
};

// Compact pill card for kanban node
const KanbanNode = memo(({
    label,
    sublabel,
    tag,
    color,
    textColor,
    isPending,
    isFactura,
    onClick,
    badge,
    showDetail,
    isMinimized,
    onToggle,
    children,
}: {
    label: string;
    sublabel?: string | null;
    tag?: string | null;
    color: string;
    textColor: string;
    isPending?: boolean;
    isFactura?: boolean;
    onClick?: () => void;
    badge?: React.ReactNode;
    showDetail?: boolean;
    isMinimized?: boolean;
    onToggle?: (e: React.MouseEvent) => void;
    children?: React.ReactNode;
}) => (
    <div className="relative group/kanban w-full">
        <button
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                "relative border-2 px-3 py-4 flex flex-col gap-2 text-left w-full rounded-none transition-all group overflow-hidden",
                color,
                onClick && "cursor-pointer hover:brightness-95",
                isMinimized && "py-1.5 gap-1 shadow-sm"
            )}
        >
            <div className={cn("flex items-center justify-between w-full relative", isMinimized ? "flex-row gap-2" : "flex-col items-start gap-1")}>
                <span className={cn(
                    "font-black uppercase tracking-wider truncate", 
                    textColor,
                    isMinimized ? "text-[10px] flex-1 pr-4" : "text-[11px] w-full pr-6"
                )}>
                    {label}
                </span>

                {onToggle && (
                    <div 
                        onClick={(e) => { e.stopPropagation(); onToggle(e); }}
                        className={cn(
                            "absolute z-10 p-0.5 hover:bg-black/5 transition-all cursor-pointer",
                            isMinimized ? "right-[-4px] top-[-2px]" : "right-[-8px] top-[-10px]"
                        )}
                    >
                        {isMinimized ? <Maximize2 size={8} className="text-slate-400" /> : <Minimize2 size={8} className="text-slate-300 opacity-0 group-hover/kanban:opacity-100" />}
                    </div>
                )}

                {isMinimized && tag && (
                    <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{tag}</span>
                )}
                {!isMinimized && badge && <div className="absolute top-0 right-[-4px]">{badge}</div>}
                {isMinimized && badge && <div>{badge}</div>}
            </div>

            {!isMinimized && sublabel && (
                <span className="text-[14px] font-black text-slate-800 truncate w-full leading-tight">{sublabel}</span>
            )}
            
            {!isMinimized && tag && (
                <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 self-start mt-1 rounded-none bg-black/5 text-slate-500"
                )}>{tag}</span>
            )}

            {!isMinimized && children && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2 pt-2 border-t border-black/5 w-full">
                    {children}
                </div>
            )}

            {showDetail && !isMinimized && (
                <div 
                    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                    className={cn(
                        "w-full mt-2 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-none",
                        isFactura ? "bg-purple-100/50 hover:bg-purple-600 hover:text-white text-purple-700" : "bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700"
                    )}
                >
                    Ver Detalle
                    <ExternalLink size={10} />
                </div>
            )}
            {!showDetail && onClick && !isMinimized && (
                <ExternalLink size={10} className="absolute bottom-3 right-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
            )}
        </button>
    </div>
));

// Arrow connector between cards
const Connector = ({ label }: { label?: string | null }) => (
    <div className="flex items-center justify-center px-1 shrink-0 relative">
        <div className="h-px w-6 bg-slate-100" />
        <ArrowRight size={12} className="text-slate-300 -ml-1" />
        {label && (
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-black text-[#4050B4] whitespace-nowrap bg-white border border-slate-200 rounded-full w-8 h-8 flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110">
                {label}
            </span>
        )}
    </div>
);

const KanbanDetailItem = memo(({ label, value, colSpan = 1, color = 'text-slate-800', textSize = 'text-xs' }: {
    label: string; value: React.ReactNode; colSpan?: number; color?: string; textSize?: string;
}) => (
    <div className={cn("flex flex-col gap-0.5", colSpan === 2 && "col-span-2")}>
        <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</span>
        <span className={cn("font-black leading-tight", textSize, color)}>{value || '—'}</span>
    </div>
));

export default function CedisDistributionsPage() {
    const getSemanaRange = () => {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
        const today = d.toLocaleDateString('en-CA');
        d.setDate(d.getDate() - d.getDay());
        return { start: d.toLocaleDateString('en-CA'), end: today };
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

    const initialRange = getSemanaRange();
    const [fechaInicio, setFechaInicio] = useState(initialRange.start);
    const [fechaFin, setFechaFin] = useState(initialRange.end);
    const [rows, setRows] = useState<CedisRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [minimizedCards, setMinimizedCards] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [idComputadora, setIdComputadora] = useState<number | null>(null);
    const [kanbanFilter, setKanbanFilter] = useState<'TODOS' | 'PENDIENTE_RECIBO' | 'PENDIENTE_SALIDA' | 'PENDIENTE_ENTRADA'>('TODOS');
    const [visibleCount, setVisibleCount] = useState(50);

    // Order Detail Modal
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailItems, setDetailItems] = useState<OrderDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [selectedRow, setSelectedRow] = useState<CedisRow | null>(null);

    // Receipt Detail Modal
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [loadingReceiptDetails, setLoadingReceiptDetails] = useState(false);
    const [activeReceiptTab, setActiveReceiptTab] = useState<'recibo' | 'devoluciones'>('recibo');

    // Distribution Detail Modal
    const [isDistDetailModalOpen, setIsDistDetailModalOpen] = useState(false);
    const [distDetailItems, setDistDetailItems] = useState<DistDetailItem[]>([]);
    const [loadingDistDetails, setLoadingDistDetails] = useState(false);
    const [selectedDistHeader, setSelectedDistHeader] = useState<{ tienda: string; folio: string | null; fecha: string | null } | null>(null);

    useEffect(() => {
        const saved = sessionStorage.getItem('kyk_id_computadora');
        if (saved) setIdComputadora(parseInt(saved));
        else {
            const id = Math.floor(Math.random() * 90000) + 10000;
            sessionStorage.setItem('kyk_id_computadora', id.toString());
            setIdComputadora(id);
        }
    }, []);

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

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/purchases/distributions?startDate=${fechaInicio}&endDate=${fechaFin}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setRows(data);
                // Minimize ONLY distributions and entries by default
                const initialMinimized = new Set<string>();
                data.forEach((r: CedisRow) => {
                    initialMinimized.add(`dist-${r.IdOrdenCompra}-${r.IdTiendaDestino}`);
                    initialMinimized.add(`entry-${r.IdOrdenCompra}-${r.IdTiendaDestino}`);
                });
                setMinimizedCards(initialMinimized);
            }
            else setRows([]);
        } catch (e) {
            console.error(e);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setVisibleCount(50);
        fetchData();
    }, [fechaInicio, fechaFin]);

    useEffect(() => {
        setVisibleCount(50);
    }, [search, kanbanFilter]);

    const fetchOrderDetails = async (row: CedisRow) => {
        if (!idComputadora) return;
        setSelectedRow(row);
        setIsDetailModalOpen(true);
        setLoadingDetails(true);
        try {
            const res = await fetch(`/api/purchases/orders/details?idComputadora=${idComputadora}&idOrdenCompra=${row.IdOrdenCompra}`);
            const data = await res.json();
            if (Array.isArray(data)) setDetailItems(data); else setDetailItems([]);
        } catch (e) { console.error(e); setDetailItems([]); }
        finally { setLoadingDetails(false); }
    };

    const fetchReceiptDetails = async (row: CedisRow) => {
        if (!row.FolioReciboMovil) return;
        setSelectedRow(row);
        setIsReceiptModalOpen(true);
        setActiveReceiptTab('recibo');
        setLoadingReceiptDetails(true);
        try {
            const res = await fetch(`/api/purchases/receipts/details?folioRecibo=${row.FolioReciboMovil}`);
            const data = await res.json();
            if (!data.error) setReceiptData(data); else setReceiptData(null);
        } catch (e) { console.error(e); setReceiptData(null); }
        finally { setLoadingReceiptDetails(false); }
    };

    const fetchDistDetails = async (row: CedisRow) => {
        setSelectedRow(row);
        setSelectedDistHeader({ tienda: row.TiendaDestino, folio: row.FolioSalida, fecha: row.FechaSalida });
        setIsDistDetailModalOpen(true);
        setLoadingDistDetails(true);
        try {
            const res = await fetch(`/api/purchases/orders/distributions/details?idOrdenCompra=${row.IdOrdenCompra}&idTiendaDestino=${row.IdTiendaDestino}&idTransferenciaSalida=${row.IdTransferenciaSalida || 0}&idTiendaOrdenCompra=${row.IdTiendaOrigen}`);
            const data = await res.json();
            if (Array.isArray(data)) setDistDetailItems(data); else setDistDetailItems([]);
        } catch (e) { console.error(e); setDistDetailItems([]); }
        finally { setLoadingDistDetails(false); }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleString('es-MX', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
        const s = search.toLowerCase();
        const passesSearch = !search || (
            r.IdOrdenCompra.toString().includes(s) ||
            r.TiendaOrigen?.toLowerCase().includes(s) ||
            r.Proveedor?.toLowerCase().includes(s) ||
            r.TiendaDestino?.toLowerCase().includes(s) ||
            r.FolioSalida?.toLowerCase().includes(s) ||
            r.FolioReciboMovil?.toLowerCase().includes(s)
        );

        if (!passesSearch) return false;

        if (kanbanFilter === 'PENDIENTE_RECIBO') return !r.FolioReciboMovil;
        if (kanbanFilter === 'PENDIENTE_SALIDA') return !!r.FolioReciboMovil && !r.FolioSalida;
        if (kanbanFilter === 'PENDIENTE_ENTRADA') return !!r.FolioSalida && (!r.FolioEntrada || r.FolioEntrada === 'ENTRO RECIBO');

        return true;
    });
    }, [rows, search, kanbanFilter]);

    const orderGroups = useMemo(() => {
        return filteredRows.reduce<Record<number, CedisRow[]>>((acc, row) => {
        if (!acc[row.IdOrdenCompra]) acc[row.IdOrdenCompra] = [];
        acc[row.IdOrdenCompra].push(row);
        return acc;
    }, {});
    }, [filteredRows]);

    const orderEntries = useMemo(() => {
        return Object.entries(orderGroups).sort((a, b) => {
        // Sort by the first row's date (descending)
        return new Date(b[1][0].FechaOrdenCompra).getTime() - new Date(a[1][0].FechaOrdenCompra).getTime();
    });
    }, [orderGroups]);

    const displayedOrders = useMemo(() => {
        return orderEntries.slice(0, visibleCount);
    }, [orderEntries, visibleCount]);

    const getDaysDiff = (start: string | null, end: string | null) => {
        if (!start || !end) return null;
        const diffTime = new Date(end).getTime() - new Date(start).getTime();
        return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    };

    return (
        <div className={cn(
            "flex flex-col h-[calc(100vh-160px)] min-h-[600px]",
            isMaximized && "fixed inset-0 z-[100] bg-slate-50 p-4 sm:p-6 h-screen"
        )}>
            {/* Header */}
            <div className="bg-slate-50 pb-3 space-y-3 flex-none sticky top-0 z-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white py-2 px-4 shadow-sm border border-slate-100">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-[#4050B4] tracking-tighter uppercase flex items-center gap-2">
                            <span>🏭</span>
                            DISTRIBUCIONES CEDIS
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Kanban general · {Object.keys(orderGroups).length} órdenes · {filteredRows.length} distribuciones
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-1 focus:ring-[#4050B4] w-44"
                            />
                        </div>

                        {/* Period Buttons */}
                        <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 p-0.5">
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

                        {/* Date Inputs */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1">
                            <Calendar size={12} className="text-[#4050B4]" />
                            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none h-auto leading-none" />
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1">
                            <Calendar size={12} className="text-[#4050B4]" />
                            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none h-auto leading-none" />
                        </div>

                        <button onClick={fetchData} className="p-2 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 group" title="Actualizar">
                            <RotateCcw size={14} className={cn("group-hover:rotate-180 transition-transform duration-500", loading && "animate-spin")} />
                        </button>
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className={cn("p-2 border transition-all", isMaximized ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")}
                        >
                            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                    </div>
                </div>

                {/* Column Header Labels */}
                <div className="flex items-center px-0">
                    <div className="w-1/5 shrink-0 flex items-center gap-1 px-2 py-1 bg-[#4050B4] text-white">
                        <FileSpreadsheet size={10} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Orden</span>
                    </div>
                    <div className="w-5 shrink-0" />
                    <div className="w-1/5 shrink-0 flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white">
                        <Package size={10} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Recibo Cedis</span>
                    </div>
                    <div className="w-5 shrink-0" />
                    <div className="flex-1 flex items-center gap-1 px-2 py-1 bg-amber-500 text-white">
                        <RotateCcw size={10} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Distribución</span>
                    </div>
                    <div className="w-5 shrink-0" />
                    <div className="flex-1 flex items-center gap-1 px-2 py-1 bg-emerald-900 text-white">
                        <ArrowRight size={10} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Entrada Tienda</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-3">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#4050B4] rounded-full animate-spin" />
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Cargando...</p>
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <span className="text-4xl mb-3">🏭­</span>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">Sin Distribuciones</h2>
                        <p className="text-slate-400 text-sm">No se encontraron distribuciones en el rango seleccionado.</p>
                    </div>
                ) : (
                    <div className="space-y-px pb-4">
                        {displayedOrders.map(([orderIdStr, orderRows]) => {
                            const orderId = parseInt(orderIdStr);
                            const firstRow = orderRows[0];
                            const isPendingRecibo = !firstRow.FolioReciboMovil;
                            const diffOrdenRecibo = getDaysDiff(firstRow.FechaOrdenCompra, firstRow.FechaRecibo);
                            
                            const toggleCard = (cardId: string) => {
                                const next = new Set(minimizedCards);
                                if (next.has(cardId)) next.delete(cardId);
                                else next.add(cardId);
                                setMinimizedCards(next);
                            };

                            return (
                                <div key={orderId} className="flex flex-col border-b border-slate-100 hover:bg-slate-50/50 transition-colors py-2">
                                    <div className="flex items-start gap-0">
                                        <div className="w-1/5 shrink-0 px-6 py-0 relative group/order">
                                            <KanbanNode
                                                label={`#${firstRow.IdOrdenCompra} · ${firstRow.TiendaOrigen}`}
                                                sublabel={firstRow.Proveedor}
                                                tag={formatDateTime(firstRow.FechaOrdenCompra)}
                                                color="border-[#4050B4] bg-blue-50/50"
                                                textColor="text-[#4050B4]"
                                                onClick={() => fetchOrderDetails(firstRow)}
                                                badge={<StatusBadge status={firstRow.Status} />}
                                                isMinimized={minimizedCards.has(`order-${orderId}`)}
                                                onToggle={() => toggleCard(`order-${orderId}`)}
                                            >
                                                <KanbanDetailItem label="Tipo" value={firstRow.TipoOrdenCompra} />
                                                <KanbanDetailItem label="Status" value={<StatusBadge status={firstRow.Status} />} />
                                                <KanbanDetailItem label="Total Pedido" value={formatCurrency(firstRow.TotalPedido)} color="text-[#4050B4]" />
                                                <KanbanDetailItem label="Arts. Pedido" value={firstRow.Ordenados} />
                                            </KanbanNode>
                                        </div>

                                    {/* Connector 1→2 */}
                                    <Connector label={diffOrdenRecibo !== null ? `+${diffOrdenRecibo}d` : undefined} />

                                    {/* Col 2: Recibo — once per order */}
                                    <div className="w-1/5 shrink-0 px-6">
                                        {isPendingRecibo ? (
                                            <KanbanNode
                                                label="Sin Recibo"
                                                color="border-rose-500/50 border-dashed bg-rose-50"
                                                textColor="text-rose-600"
                                                isPending
                                                isMinimized={minimizedCards.has(`receipt-${orderId}`)}
                                                onToggle={() => toggleCard(`receipt-${orderId}`)}
                                            >
                                                <div className="col-span-2 py-4 flex flex-col items-center justify-center border border-dashed border-rose-200 bg-rose-50/50">
                                                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Esperando Recibo Móvil</span>
                                                </div>
                                            </KanbanNode>
                                        ) : (
                                            <KanbanNode
                                                label={firstRow.FolioReciboMovil!}
                                                sublabel={firstRow.UsuarioRecibo}
                                                tag={formatDateTime(firstRow.FechaRecibo)}
                                                color="border-emerald-600 bg-emerald-50"
                                                textColor="text-emerald-700"
                                                onClick={() => fetchReceiptDetails(firstRow)}
                                                isMinimized={minimizedCards.has(`receipt-${orderId}`)}
                                                onToggle={() => toggleCard(`receipt-${orderId}`)}
                                            >
                                                <KanbanDetailItem label="Usuario" value={firstRow.UsuarioRecibo} colSpan={2} />
                                                <KanbanDetailItem label="Total Recibo" value={formatCurrency(firstRow.TotalRecibo || 0)} color="text-emerald-600" />
                                                <KanbanDetailItem label="Arts. Recibo" value={firstRow.Recibidos} />
                                            </KanbanNode>
                                        )}
                                    </div>

                                    {/* Distributions stacked */}
                                    <div className="flex-1 flex flex-col">
                                        {orderRows.map((row, rowIdx) => {
                                            const isPendingSalida = !row.FolioSalida;
                                            const isPendingEntrada = !row.FolioEntrada || row.FolioEntrada === 'ENTRO RECIBO';
                                            const isFactura = !!row.UUID;
                                            const isEntroRecibo = row.FolioEntrada === 'ENTRO RECIBO';
                                            const diffReciboSalida = getDaysDiff(firstRow.FechaRecibo, row.FechaSalida);
                                            const diffSalidaEntrada = getDaysDiff(row.FechaSalida, row.FechaEntrada);
                                            const daysInTransit = !isPendingSalida && isPendingEntrada ? getDaysDiff(row.FechaSalida, today) : null;

                                            return (
                                                <div key={`${row.IdOrdenCompra}-${row.IdTiendaDestino}-${rowIdx}`} className={cn("flex items-start flex-1", rowIdx > 0 && "mt-1")}>

                                                    {/* Connector 2→3 */}
                                                    <Connector label={diffReciboSalida !== null ? `+${diffReciboSalida}d` : undefined} />

                                                     {/* Col 3: Distribución */}
                                                     <div className="flex-1 px-6">
                                                         {isPendingSalida ? (
                                                             <KanbanNode
                                                                 label={minimizedCards.has(`dist-${orderId}-${row.IdTiendaDestino}`) ? `${row.TiendaDestino} ${row.CantidadArticulos}` : `→ ${row.TiendaDestino}`}
                                                                 sublabel={`${row.CantidadArticulos} arts`}
                                                                 color="border-amber-300 border-dashed bg-amber-50/30"
                                                                 textColor="text-amber-500"
                                                                 isPending
                                                                 showDetail={true}
                                                                 onClick={() => fetchDistDetails(row)}
                                                                 isMinimized={minimizedCards.has(`dist-${orderId}-${row.IdTiendaDestino}`)}
                                                                 onToggle={() => toggleCard(`dist-${orderId}-${row.IdTiendaDestino}`)}
                                                             />
                                                         ) : (
                                                             <KanbanNode
                                                                 label={minimizedCards.has(`dist-${orderId}-${row.IdTiendaDestino}`) ? `${row.FolioSalida || ""} ${row.TiendaDestino}` : row.FolioSalida!}
                                                                 sublabel={`${row.TiendaDestino} · ${row.CantidadArticulos} arts`}
                                                                 tag={formatDateTime(row.FechaSalida)}
                                                                 color={isFactura ? "border-purple-500 bg-purple-50" : "border-amber-500 bg-amber-50"}
                                                                 textColor={isFactura ? "text-purple-700" : "text-amber-700"}
                                                                 isFactura={isFactura}
                                                                 showDetail={true}
                                                                 onClick={() => fetchDistDetails(row)}
                                                                 isMinimized={minimizedCards.has(`dist-${orderId}-${row.IdTiendaDestino}`)}
                                                                 onToggle={() => toggleCard(`dist-${orderId}-${row.IdTiendaDestino}`)}
                                                                 badge={isFactura ? (
                                                                     <span className="bg-purple-600 text-white px-1 py-0.5 text-[6px] font-black uppercase tracking-tight flex items-center gap-0.5">
                                                                         <Receipt size={5} />FAC
                                                                     </span>
                                                                 ) : undefined}
                                                             />
                                                         )}
                                                     </div>

                                                     {/* Connector 3→4 */}
                                                     <Connector label={diffSalidaEntrada !== null && !isEntroRecibo ? `+${diffSalidaEntrada}d` : undefined} />

                                                     {/* Col 4: Entrada */}
                                                     <div className="flex-1 px-6">
                                                         {isEntroRecibo ? (
                                                             <KanbanNode
                                                                 label={minimizedCards.has(`entry-${orderId}-${row.IdTiendaDestino}`) ? `RECIBO ${row.TiendaDestino}` : "Entró por Recibo"}
                                                                 tag={formatDateTime(row.FechaEntrada)}
                                                                 color="border-emerald-600/30 bg-emerald-50/30"
                                                                 textColor="text-emerald-700"
                                                                 isMinimized={minimizedCards.has(`entry-${orderId}-${row.IdTiendaDestino}`)}
                                                                 onToggle={() => toggleCard(`entry-${orderId}-${row.IdTiendaDestino}`)}
                                                                 badge={<CheckCircle2 size={10} className="text-emerald-600" />}
                                                             />
                                                         ) : isPendingEntrada ? (
                                                             <KanbanNode
                                                                 label={daysInTransit && daysInTransit >= 1 ? `⚠️ ${daysInTransit}d TRANSITO ${row.TiendaDestino}` : `SIN ENTRADA ${row.TiendaDestino}`}
                                                                 color={isPendingSalida ? "border-amber-400/50 border-dashed bg-amber-50" : "border-rose-500/50 border-dashed bg-rose-50"}
                                                                  textColor={isPendingSalida ? "text-amber-600" : "text-rose-600"}
                                                                 isPending
                                                                 isMinimized={minimizedCards.has(`entry-${orderId}-${row.IdTiendaDestino}`)}
                                                                 onToggle={() => toggleCard(`entry-${orderId}-${row.IdTiendaDestino}`)}
                                                                  badge={daysInTransit && daysInTransit >= 1 ? (
                                                                      <span className="flex items-center gap-1 bg-rose-600 text-white px-1.5 py-0.5 text-[8px] font-black animate-pulse shadow-sm">
                                                                          <Clock size={8} /> {daysInTransit} DÍAS
                                                                      </span>
                                                                  ) : undefined}
                                                              />
                                                         ) : (
                                                             <KanbanNode
                                                                 label={minimizedCards.has(`entry-${orderId}-${row.IdTiendaDestino}`) ? `${row.FolioEntrada} ${row.TiendaDestino}` : row.FolioEntrada!}
                                                                 sublabel={`${row.TiendaDestino}${row.UsuarioEntrada ? ` · ${row.UsuarioEntrada}` : ''}`}
                                                                 tag={formatDateTime(row.FechaEntrada)}
                                                                 color="border-emerald-900 bg-emerald-900/10"
                                                                 textColor="text-emerald-900"
                                                                 isMinimized={minimizedCards.has(`entry-${orderId}-${row.IdTiendaDestino}`)}
                                                                 onToggle={() => toggleCard(`entry-${orderId}-${row.IdTiendaDestino}`)}
                                                                 badge={<CheckCircle2 size={10} className="text-emerald-600" />}
                                                             />
                                                         )}
                                                     </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                        })}

                        {orderEntries.length > visibleCount && (
                            <div className="flex justify-center py-8">
                                <button
                                    onClick={() => setVisibleCount(prev => prev + 50)}
                                    className="px-12 py-3 bg-white border-2 border-[#4050B4] text-[#4050B4] text-[11px] font-black uppercase tracking-widest hover:bg-[#4050B4] hover:text-white transition-all shadow-lg active:scale-95"
                                >
                                    Cargar {Math.min(50, orderEntries.length - visibleCount)} más
                                    <span className="ml-2 opacity-50">({orderEntries.length - visibleCount} pendientes)</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex-none bg-slate-100 border-t border-slate-200 px-4 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Distribuciones:</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-200 text-[#4050B4] text-[10px] font-black">{filteredRows.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Órdenes:</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-200 text-emerald-600 text-[10px] font-black">{Object.keys(orderGroups).length}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => {
                            const allInitialMinimized = new Set<string>();
                            rows.forEach(r => {
                                allInitialMinimized.add(`dist-${r.IdOrdenCompra}-${r.IdTiendaDestino}`);
                                allInitialMinimized.add(`entry-${r.IdOrdenCompra}-${r.IdTiendaDestino}`);
                            });

                            if (minimizedCards.size > 0) {
                                setMinimizedCards(new Set());
                            } else {
                                setMinimizedCards(allInitialMinimized);
                            }
                        }}
                        className="px-3 py-1 bg-white border border-slate-300 text-[8px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                        title={minimizedCards.size > 0 ? "Expandir todo" : "Minimizar todo"}
                    >
                        {minimizedCards.size > 0 ? "Expandir todo" : "Minimizar todo"}
                    </button>

                    {/* Status Filters */}
                    <div className="flex bg-slate-200 p-0.5 border border-slate-300">
                        {[
                            { id: 'TODOS', label: 'Todos' },
                            { id: 'PENDIENTE_RECIBO', label: 'Pendientes Recibo' },
                            { id: 'PENDIENTE_SALIDA', label: 'Dist. Pend. Salida' },
                            { id: 'PENDIENTE_ENTRADA', label: 'Dist. Pend. Entrada' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setKanbanFilter(f.id as any)}
                                className={cn(
                                    "px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all",
                                    kanbanFilter === f.id ? "bg-[#4050B4] text-white" : "text-slate-500 hover:bg-white hover:text-slate-800"
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {[
                        { color: 'bg-[#4050B4]', label: 'Orden' },
                        { color: 'bg-emerald-500', label: 'Recibo Cedis' },
                        { color: 'bg-amber-400', label: 'Distribución' },
                        { color: 'bg-purple-500', label: 'Factura' },
                        { color: 'bg-rose-400', label: 'Pendiente' },
                    ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <span className={cn("w-2 h-2 inline-block", color)} />
                            <span className="text-[7px] text-slate-400 font-bold uppercase">{label}</span>
                        </div>
                    ))}
                </div>
            </div>


            {/* ===== Order Detail Modal ===== */}
            {isDetailModalOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl h-[85vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                            <div className="flex flex-col">
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <FileSpreadsheet className="text-[#4050B4]" size={20} />
                                    Detalle de Productos - Orden: {selectedRow?.IdOrdenCompra}
                                </h2>
                                <div className="flex items-center gap-4 mt-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedRow?.Proveedor}</p>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Fecha: {formatDate(detailItems[0]?.FechaOrdenCompra ?? selectedRow?.FechaOrdenCompra ?? null)}</p>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <p className="text-[10px] font-black text-[#4050B4] uppercase tracking-widest">Generado por: {detailItems[0]?.UsuarioOrden || 'N/A'}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                        </div>
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
                                            <td className="p-4 text-right text-base font-black text-[#4050B4]">{formatCurrency(detailItems.reduce((a, i) => a + i.Total, 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                    <div className="w-16 h-16 bg-slate-100 flex items-center justify-center rounded-full mb-4 text-slate-400"><Search size={32} /></div>
                                    <h3 className="text-lg font-black text-slate-800 uppercase mb-1">Sin detalles</h3>
                                    <p className="text-slate-500 text-sm max-w-xs mx-auto">No se encontraron partidas para esta orden en el buffer.</p>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                            <button onClick={() => setIsDetailModalOpen(false)} className="px-8 py-2.5 bg-[#4050B4] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#344196] transition-all shadow-lg">Cerrar Detalle</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Receipt Detail Modal ===== */}
            {isReceiptModalOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl h-[85vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                            <div className="flex flex-col">
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <Check className="text-emerald-600" size={20} />
                                    Detalle de Recibo: {receiptData?.header.folioRecibo}
                                </h2>
                                <div className="flex flex-wrap items-center gap-3 mt-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedRow?.TiendaOrigen}</p>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedRow?.Proveedor}</p>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Fecha: {formatDate(receiptData?.header.FechaRecibo ?? null)}</p>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <p className="text-[10px] font-black text-[#4050B4] uppercase tracking-widest">Recibe: {receiptData?.header.Usuario || 'N/A'}</p>
                                    {receiptData?.header.UUID && (
                                        <>
                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                            <a href={`https://recursos.kykcloud.mx/${receiptData.header.UUID}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-amber-600 uppercase tracking-widest hover:underline flex items-center gap-1">UUID <ExternalLink size={10} /></a>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => setIsReceiptModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="flex bg-slate-50 border-b border-slate-100 px-6">
                            <button onClick={() => setActiveReceiptTab('recibo')} className={cn("px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2", activeReceiptTab === 'recibo' ? "border-emerald-500 text-emerald-600 bg-white" : "border-transparent text-slate-400 hover:text-slate-600")}>
                                Recibo ({receiptData?.receiptItems.length || 0})
                            </button>
                            {receiptData?.returnItems && receiptData.returnItems.length > 0 && (
                                <button onClick={() => setActiveReceiptTab('devoluciones')} className={cn("px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2", activeReceiptTab === 'devoluciones' ? "border-rose-500 text-rose-600 bg-white" : "border-transparent text-slate-400 hover:text-slate-600")}>
                                    Devoluciones ({receiptData?.returnItems.length || 0})
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50/30">
                            {loadingReceiptDetails ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4">
                                    <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Consultando recibo...</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse bg-white shadow-sm border border-slate-200">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            {activeReceiptTab === 'recibo' ? (<>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Pedido</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Rec</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">Medida Compra</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Kgs</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-20">MedidaGranel</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-32">Codigo Barras</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Descripcion</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Costo</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D1</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D2</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D3</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D4</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D5</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Volumen</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-28">Total</th>
                                            </>) : (<>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Dev</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">Medida</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-32">Codigo Barras</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Descripcion</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Costo</th>
                                                <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-28">Total</th>
                                            </>)}
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {(activeReceiptTab === 'recibo' ? receiptData?.receiptItems : receiptData?.returnItems)?.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                {activeReceiptTab === 'recibo' ? (<>
                                                    <td className="p-2 text-[11px] text-right font-bold text-slate-400">{item.Pedido}</td>
                                                    <td className="p-2 text-[11px] text-right font-black text-[#4050B4]">{item.Rec}</td>
                                                    <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{item.MedidaCompra}</td>
                                                    <td className="p-2 text-[11px] text-right font-bold text-emerald-600">{item.RecGranel.toFixed(3)}</td>
                                                    <td className="p-2 text-[10px] font-black text-slate-400 uppercase italic">{item.MedidaGranel}</td>
                                                    <td className="p-2 text-[10px] font-mono font-bold text-slate-500">{item.CodigoBarras}</td>
                                                    <td className="p-2 text-[11px] font-bold uppercase tracking-tight truncate max-w-[150px]" title={item.Descripcion}>{item.Descripcion}</td>
                                                    <td className="p-2 text-[11px] text-right font-bold text-slate-600">{formatCurrency(item.Costo)}</td>
                                                    <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.Desc0}</td>
                                                    <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.Desc1}</td>
                                                    <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.Desc2}</td>
                                                    <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.Desc3}</td>
                                                    <td className="p-2 text-[10px] text-right font-bold text-slate-400">{item.Desc4}</td>
                                                    <td className="p-2 text-[10px] text-right font-bold text-amber-600">{item.Factor}</td>
                                                    <td className="p-2 text-[11px] text-right font-black text-slate-900">{formatCurrency(item.Total)}</td>
                                                </>) : (<>
                                                    <td className="p-2 text-[11px] text-right font-black text-rose-600">{item.Rec}</td>
                                                    <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{item.MedidaVenta}</td>
                                                    <td className="p-2 text-[10px] font-mono font-bold text-slate-500">{item.CodigoBarras}</td>
                                                    <td className="p-2 text-[11px] font-bold uppercase tracking-tight">{item.Descripcion}</td>
                                                    <td className="p-2 text-[11px] text-right font-bold text-slate-600">{formatCurrency(item.Costo)}</td>
                                                    <td className="p-2 text-[11px] text-right font-black text-rose-900">{formatCurrency(item.Total)}</td>
                                                </>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                        <tr>
                                            <td colSpan={activeReceiptTab === 'recibo' ? 14 : 5} className="p-4 text-right text-[11px] font-black uppercase text-slate-500 tracking-widest">Total {activeReceiptTab === 'recibo' ? 'Recibido' : 'Devolución'}</td>
                                            <td className={cn("p-4 text-right text-base font-black", activeReceiptTab === 'recibo' ? "text-emerald-600" : "text-rose-600")}>
                                                {formatCurrency((activeReceiptTab === 'recibo' ? receiptData?.receiptItems : receiptData?.returnItems)?.reduce((a, i) => a + i.Total, 0) || 0)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                            <button onClick={() => setIsReceiptModalOpen(false)} className="px-8 py-2.5 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Distribution Detail Modal ===== */}
            {isDistDetailModalOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl h-[70vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                            <div className="flex flex-col">
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <RotateCcw className="text-amber-500" size={20} />
                                    Detalle de Distribución - {selectedDistHeader?.tienda}
                                </h2>
                                <div className="flex items-center gap-4 mt-1">
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Folio Transferencia: {selectedDistHeader?.folio || 'PENDIENTE'}</p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <Clock size={10} />Fecha Salida: {selectedDistHeader?.fecha ? formatDateTime(selectedDistHeader.fecha) : '---'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsDistDetailModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                        </div>
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
                                                {selectedDistHeader?.folio && selectedDistHeader.folio !== 'PENDIENTE' ? (<>
                                                    <td className="p-2 text-[12px] text-right font-black text-amber-600">{item.CantidadSalida}</td>
                                                    <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{item.Medida}</td>
                                                    <td className="p-2 text-[12px] text-right font-bold text-slate-600">{item.PiezasPedido}</td>
                                                    <td className="p-2 text-[12px] text-right font-bold text-emerald-600">{item.PiezasRecibo}</td>
                                                    <td className="p-2 text-[10px] font-black text-slate-400 uppercase italic">{item.MedidaPiezas}</td>
                                                    <td className="p-2 text-[10px] font-mono font-bold text-slate-500">{item.CodigoBarras}</td>
                                                    <td className="p-2 text-[11px] font-bold uppercase tracking-tight truncate max-w-[150px]" title={item.Descripcion}>{item.Descripcion}</td>
                                                    <td className="p-2 text-[11px] text-right font-bold text-slate-600">{formatCurrency(item.Costo || 0)}</td>
                                                    <td className="p-2 text-[12px] text-right font-black text-slate-900">{formatCurrency(item.Total || 0)}</td>
                                                </>) : (<>
                                                    <td className="p-3 text-[12px] text-right font-black text-amber-600">{item.Cantidad}</td>
                                                    <td className="p-3 text-[10px] font-black text-slate-400 uppercase">{item.MedidaCompra}</td>
                                                    <td className="p-3 text-[12px] text-right font-bold text-slate-600">{item.Piezas}</td>
                                                    <td className="p-3 text-[10px] font-black text-slate-400 uppercase italic">{item.MedidaPiezas}</td>
                                                    <td className="p-3 text-[10px] font-mono font-bold text-slate-500">{item.CodigoBarras}</td>
                                                    <td className="p-3 text-[12px] font-bold uppercase tracking-tight">{item.Descripcion}</td>
                                                </>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                    <div className="w-16 h-16 bg-slate-100 flex items-center justify-center rounded-full mb-4 text-slate-400"><Search size={32} /></div>
                                    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest italic">No se encontraron artículos distribuidos</p>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                            <button onClick={() => setIsDistDetailModalOpen(false)} className="px-8 py-2.5 bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
