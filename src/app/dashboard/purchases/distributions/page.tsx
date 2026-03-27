"use client";

import { useState, useEffect, memo, useMemo, useCallback } from 'react';
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
    EsTransferenciaFactura: number;
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
                        isFactura ? "bg-emerald-100/50 hover:bg-emerald-600 hover:text-white text-emerald-700" : "bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700"
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
    
    const getSieteDiasRange = () => {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
        const today = d.toLocaleDateString('en-CA');
        d.setDate(d.getDate() - 6);
        return { start: d.toLocaleDateString('en-CA'), end: today };
    };

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

    const initialRange = getSieteDiasRange();
    const [fechaInicio, setFechaInicio] = useState(initialRange.start);
    const [fechaFin, setFechaFin] = useState(initialRange.end);
    const [rows, setRows] = useState<CedisRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    // Stores only user-toggled overrides; dist-* and entry-* start minimized by default
    const [cardOverrides, setCardOverrides] = useState<Map<string, boolean>>(new Map());
    const [allExpanded, setAllExpanded] = useState(false);
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

    const fetchData = async (force = false) => {
        const hasExistingData = rows.length > 0;
        // If we have data, don't block UI — refresh silently in background
        if (hasExistingData && !force) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        // Reset overrides on new fetch so default minimized state applies
        setCardOverrides(new Map());
        setAllExpanded(false);
        try {
            const forceParam = force ? '&force=1' : '';
            const res = await fetch(`/api/purchases/distributions?startDate=${fechaInicio}&endDate=${fechaFin}&status=${kanbanFilter}${forceParam}`);
            const data = await res.json();
            if (Array.isArray(data)) setRows(data);
            else setRows([]);
        } catch (e) {
            console.error(e);
            setRows([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Derive minimized state: dist-* and entry-* are minimized by default unless overridden
    const minimizedCards = useMemo(() => {
        const set = new Set<string>();
        if (!allExpanded) {
            rows.forEach(r => {
                set.add(`dist-${r.IdOrdenCompra}-${r.IdTiendaDestino}`);
                set.add(`entry-${r.IdOrdenCompra}-${r.IdTiendaDestino}`);
            });
        }
        // Apply user overrides
        cardOverrides.forEach((expanded, id) => {
            if (expanded) set.delete(id); else set.add(id);
        });
        return set;
    }, [rows, cardOverrides, allExpanded]);

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

    const fetchDistDetails = (row: CedisRow, type: 'SALIDA' | 'ENTRADA' = 'SALIDA') => {
        setSelectedRow(row);
        const folio = type === 'SALIDA' ? row.FolioSalida : row.FolioEntrada;
        const fecha = type === 'SALIDA' ? row.FechaSalida : row.FechaEntrada;
        setSelectedDistHeader({ tienda: row.TiendaDestino, folio: folio, fecha: fecha });
        setIsDistDetailModalOpen(true);
        setLoadingDistDetails(true);
        const fetchItems = async () => {
            try {
                const res = await fetch(`/api/purchases/orders/distributions/details?idOrdenCompra=${row.IdOrdenCompra}&idTiendaDestino=${row.IdTiendaDestino}&idTransferenciaSalida=${row.IdTransferenciaSalida || 0}&idTiendaOrdenCompra=${row.IdTiendaOrigen}`);
                const data = await res.json();
                if (Array.isArray(data)) setDistDetailItems(data); else setDistDetailItems([]);
            } catch (e) { console.error(e); setDistDetailItems([]); }
            finally { setLoadingDistDetails(false); }
        };
        fetchItems();
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

    const toggleCardGlobal = useCallback(() => {
        // Toggle global expand/collapse — clear overrides and flip the allExpanded flag
        setCardOverrides(new Map());
        setAllExpanded(prev => !prev);
    }, []);

    const toggleCard = useCallback((cardId: string) => {
        // Read current state from the computed minimizedCards set
        // Override: true = user wants it EXPANDED, false = user wants it MINIMIZED
        setCardOverrides(prev => {
            const next = new Map(prev);
            const isCurrentlyMinimized = minimizedCards.has(cardId);
            next.set(cardId, isCurrentlyMinimized); // true = expanded (opposite of current)
            return next;
        });
    }, [minimizedCards]);

    return (
        <div className={cn(
            "flex flex-col h-screen bg-white text-slate-900 font-sans overflow-hidden",
            isMaximized && "fixed inset-0 z-[100] bg-slate-50 p-4 sm:p-6"
        )}>
            {/* Header */}
            <div className="flex-none bg-slate-50 p-4 border-b border-slate-200">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-[#4050B4] tracking-tighter uppercase flex items-center gap-2">
                             <span>🏭</span> DISTRIBUCIONES CEDIS
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Kanban general · {Object.keys(orderGroups).length} órdenes · {filteredRows.length} distribuciones
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#4050B4] w-44"
                            />
                        </div>

                        <div className="flex items-center gap-0.5 bg-slate-200 p-0.5 rounded">
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

                        <div className="flex items-center gap-1">
                            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 outline-none" />
                            <span className="text-slate-400">→</span>
                            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 outline-none" />
                        </div>

                        <button onClick={() => fetchData(true)} className="p-2 bg-white border border-slate-200 text-[#4050B4] hover:bg-slate-50" title="Actualizar datos">
                            <RotateCcw size={14} className={(loading || refreshing) ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
                            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                    </div>
                </div>

                {/* Column Headers */}
                <div className="flex items-center mt-4 bg-slate-100 p-1 border border-slate-200">
                    <div className="w-1/5 shrink-0 flex items-center gap-1.5 px-3 py-1 bg-[#4050B4] text-white font-black text-[10px] uppercase">
                        <FileSpreadsheet size={12} /> Orden
                    </div>
                    <div className="w-5" />
                    <div className="w-1/5 shrink-0 flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white font-black text-[10px] uppercase">
                        <Package size={12} /> Recibo
                    </div>
                    <div className="w-5" />
                    <div className="flex-1 flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white font-black text-[10px] uppercase">
                        <RotateCcw size={12} /> Distribución
                    </div>
                    <div className="w-5" />
                    <div className="flex-1 flex items-center gap-1.5 px-3 py-1 bg-emerald-900 text-white font-black text-[10px] uppercase">
                        <ArrowRight size={12} /> Entrada Tienda
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-slate-50">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-3">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#4050B4] rounded-full animate-spin" />
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Cargando...</p>
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <span className="text-4xl mb-3">🏭</span>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">Sin Distribuciones</h2>
                        <p className="text-slate-400 text-sm">No se encontraron distribuciones en el rango seleccionado.</p>
                    </div>
                ) : (
                    <div className="pb-20">
                        {displayedOrders.map(([orderIdStr, orderRows]) => {
                            const orderId = parseInt(orderIdStr);
                            const firstRow = orderRows[0];
                            const isPendingRecibo = !firstRow.FolioReciboMovil;
                            const diffOrdenRecibo = getDaysDiff(firstRow.FechaOrdenCompra, firstRow.FechaRecibo);

                            return (
                                <div key={orderId} className="border-b border-slate-200 py-1 bg-white hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start">
                                        {/* Col 1: Orden */}
                                        <div className="w-1/5 shrink-0 px-4">
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

                                        <Connector label={diffOrdenRecibo !== null ? `+${diffOrdenRecibo}d` : undefined} />

                                        {/* Col 2: Recibo */}
                                        <div className="w-1/5 shrink-0 px-4">
                                            {isPendingRecibo ? (
                                                <KanbanNode label="Sin Recibo" color="border-rose-300 border-dashed bg-rose-50" textColor="text-rose-600" isPending isMinimized={minimizedCards.has(`receipt-${orderId}`)} onToggle={() => toggleCard(`receipt-${orderId}`)}>
                                                    <div className="col-span-2 py-4 flex flex-col items-center justify-center">
                                                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Pendiente Recibo</span>
                                                    </div>
                                                </KanbanNode>
                                            ) : (
                                                <KanbanNode
                                                    label={firstRow.FolioReciboMovil!}
                                                    sublabel={firstRow.Proveedor}
                                                    tag={formatDateTime(firstRow.FechaRecibo)}
                                                    color="border-emerald-500 bg-emerald-50"
                                                    textColor="text-emerald-700"
                                                    onClick={() => fetchReceiptDetails(firstRow)}
                                                    isMinimized={minimizedCards.has(`receipt-${orderId}`)}
                                                    onToggle={() => toggleCard(`receipt-${orderId}`)}
                                                >
                                                    <KanbanDetailItem label="Usuario" value={firstRow.UsuarioRecibo} colSpan={2} />
                                                    <KanbanDetailItem label="Arts. Dist." value={firstRow.CantidadArticulos} />
                                                </KanbanNode>
                                            )}
                                        </div>

                                        {/* Distributions column */}
                                        <div className="flex-1 flex flex-col gap-1">
                                            {orderRows.map((row, rowIdx) => {
                                                const isPendingSalida = !row.FolioSalida;
                                                const isEntroRecibo = row.FolioEntrada === 'ENTRO RECIBO';
                                                const isPendingEntrada = (!row.FolioEntrada || row.FolioEntrada.trim() === '') && !isEntroRecibo;
                                                const isFactura = !!row.UUID && row.UUID.trim() !== '' && row.UUID.toLowerCase() !== 'null';
                                                
                                                const diffReciboSalida = getDaysDiff(firstRow.FechaRecibo, row.FechaSalida);
                                                const diffSalidaEntrada = getDaysDiff(row.FechaSalida, row.FechaEntrada);
                                                const daysInTransit = !isPendingSalida && isPendingEntrada ? getDaysDiff(row.FechaSalida, today) : null;

                                                const distCardId = `dist-${orderId}-${row.IdTiendaDestino}`;
                                                const entryCardId = `entry-${orderId}-${row.IdTiendaDestino}`;

                                                return (
                                                    <div key={rowIdx} className="flex items-start">
                                                        <Connector label={diffReciboSalida !== null ? `+${diffReciboSalida}d` : undefined} />
                                                        
                                                        {/* Col 3: Distribución */}
                                                        <div className="flex-1 px-4">
                                                            {isPendingSalida ? (
                                                                <KanbanNode
                                                                    label={minimizedCards.has(distCardId) ? `${row.TiendaDestino} - Pendiente` : `→ ${row.TiendaDestino}`}
                                                                    sublabel={`${row.CantidadArticulos} arts`}
                                                                    color="border-rose-500 border-dashed bg-rose-50"
                                                                    textColor="text-rose-600"
                                                                    isPending
                                                                    showDetail={true}
                                                                    onClick={() => fetchDistDetails(row)}
                                                                    isMinimized={minimizedCards.has(distCardId)}
                                                                    onToggle={() => toggleCard(distCardId)}
                                                                />
                                                            ) : (
                                                                <KanbanNode
                                                                    label={minimizedCards.has(distCardId) ? `${row.FolioSalida} ${row.TiendaDestino}` : row.FolioSalida!}
                                                                    sublabel={`${row.TiendaDestino} · ${row.CantidadArticulos} arts`}
                                                                    tag={formatDateTime(row.FechaSalida)}
                                                                    color={
                                                                        row.EsTransferenciaFactura === 1 ? "border-purple-500 bg-purple-50" :
                                                                        (isFactura || !isPendingEntrada) ? "border-emerald-500 bg-emerald-50" : 
                                                                        "border-orange-400 bg-orange-50"
                                                                    }
                                                                    textColor={
                                                                        row.EsTransferenciaFactura === 1 ? "text-purple-700" :
                                                                        (isFactura || !isPendingEntrada) ? "text-emerald-700" : 
                                                                        "text-orange-700"
                                                                    }
                                                                    isFactura={isFactura}
                                                                    showDetail={true}
                                                                    onClick={() => fetchDistDetails(row, 'SALIDA')}
                                                                    isMinimized={minimizedCards.has(distCardId)}
                                                                    onToggle={() => toggleCard(distCardId)}
                                                                    badge={row.EsTransferenciaFactura === 1 ? <span className="bg-purple-600 text-white px-1 py-0.5 text-[6px] font-black uppercase tracking-tighter">FACTURA</span> : isFactura ? <span className="bg-emerald-600 text-white px-1 py-0.5 text-[6px] font-black uppercase">FAC</span> : undefined}
                                                                >
                                                                    <KanbanDetailItem label="UUID" value={row.UUID} colSpan={2} textSize="text-[8px]" />
                                                                </KanbanNode>
                                                            )}
                                                        </div>

                                                        {/* Col 4: Entrada */}
                                                        {isPendingSalida || (!isFactura && isPendingEntrada) ? (
                                                            <div className="flex-1" />
                                                        ) : (
                                                            <>
                                                                <Connector label={diffSalidaEntrada !== null && !isEntroRecibo ? `+${diffSalidaEntrada}d` : undefined} />
                                                                <div className="flex-1 px-4">
                                                                    {isEntroRecibo ? (
                                                                        <KanbanNode label="Entró por Recibo" tag={formatDateTime(row.FechaEntrada)} color="border-emerald-700/30 bg-emerald-50" textColor="text-emerald-800" isMinimized={minimizedCards.has(entryCardId)} onToggle={() => toggleCard(entryCardId)} />
                                                                    ) : isPendingEntrada ? (
                                                                        <KanbanNode
                                                                            label={daysInTransit && daysInTransit >= 1 ? `⚠️ ${daysInTransit}d TRÁNSITO` : "PENDIENTE ENTRADA"}
                                                                            sublabel={row.TiendaDestino}
                                                                            color="border-rose-500 bg-rose-50"
                                                                            textColor="text-rose-600"
                                                                            isPending
                                                                            showDetail={true}
                                                                            onClick={() => fetchDistDetails(row, 'ENTRADA')}
                                                                            isMinimized={minimizedCards.has(entryCardId)}
                                                                            onToggle={() => toggleCard(entryCardId)}
                                                                        />
                                                                    ) : (
                                                                        <KanbanNode
                                                                            label={row.FolioEntrada!}
                                                                            sublabel={row.TiendaDestino}
                                                                            tag={formatDateTime(row.FechaEntrada)}
                                                                            color="border-emerald-900 bg-slate-100"
                                                                            textColor="text-emerald-900"
                                                                            showDetail={true}
                                                                            onClick={() => fetchDistDetails(row, 'ENTRADA')}
                                                                            isMinimized={minimizedCards.has(entryCardId)}
                                                                            onToggle={() => toggleCard(entryCardId)}
                                                                            badge={<CheckCircle2 size={10} className="text-emerald-600" />}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
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
                                    className="px-12 py-3 bg-white border-2 border-[#4050B4] text-[#4050B4] text-[11px] font-black uppercase tracking-widest hover:bg-[#4050B4] hover:text-white transition-all shadow-lg"
                                >
                                    Cargar más...
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex-none bg-slate-100 border-t border-slate-200 px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Distribuciones:</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-300 text-[#4050B4] text-[10px] font-black">{filteredRows.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Órdenes:</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-300 text-emerald-600 text-[10px] font-black">{Object.keys(orderGroups).length}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={toggleCardGlobal} className="px-3 py-1 bg-white border border-slate-300 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50">
                        {allExpanded ? "Minimizar todo" : "Expandir todo"}
                    </button>

                    <div className="flex bg-slate-200 p-0.5 rounded">
                        {[
                            { id: 'TODOS', label: 'Todos' },
                            { id: 'PENDIENTE_RECIBO', label: 'Pend. Recibo' },
                            { id: 'PENDIENTE_SALIDA', label: 'Pend. Salida' },
                            { id: 'PENDIENTE_ENTRADA', label: 'Pend. Entrada' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setKanbanFilter(f.id as any)}
                                className={cn(
                                    "px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all",
                                    kanbanFilter === f.id ? "bg-[#4050B4] text-white" : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {[
                        { color: 'bg-[#4050B4]', label: 'Orden' },
                        { color: 'bg-emerald-500', label: 'Recibo' },
                        { color: 'bg-purple-500', label: 'Factura' },
                        { color: 'bg-orange-400', label: 'Salida' },
                        { color: 'bg-emerald-900', label: 'Entrada' },
                        { color: 'bg-rose-500', label: 'Pendiente' },
                    ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <span className={cn("w-2 h-2 inline-block rounded-full", color)} />
                            <span className="text-[8px] text-slate-400 font-bold uppercase">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modals */}
            {/* Order Detail Modal */}
            {isDetailModalOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-6xl h-[85vh] shadow-2xl border border-slate-200 flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-black text-slate-800 uppercase flex items-center gap-2">
                                <FileSpreadsheet className="text-[#4050B4]" size={20} /> Detalle de Orden: {selectedRow?.IdOrdenCompra}
                            </h2>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-slate-50">
                            {loadingDetails ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-2">
                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-[#4050B4] rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase text-slate-400">Cargando...</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse bg-white shadow-sm">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400 text-right">Pedido</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Medida</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Cód. Barras</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Descripción</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400 text-right">Costo</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {detailItems.map((item, idx) => (
                                            <tr key={idx} className="border-b hover:bg-slate-50">
                                                <td className="p-2 text-[11px] text-right font-black text-[#4050B4]">{item.Pedido}</td>
                                                <td className="p-2 text-[10px] font-bold text-slate-500">{item.Medida}</td>
                                                <td className="p-2 text-[10px] font-mono text-slate-500">{item.CodigoBarras}</td>
                                                <td className="p-2 text-[11px] font-bold uppercase">{item.Descripcion}</td>
                                                <td className="p-2 text-[11px] text-right">{formatCurrency(item.Costo)}</td>
                                                <td className="p-2 text-[11px] text-right font-black">{formatCurrency(item.Total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t flex justify-end">
                            <button onClick={() => setIsDetailModalOpen(false)} className="px-6 py-2 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-700">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Detail Modal */}
            {isReceiptModalOpen && receiptData && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-6xl h-[85vh] shadow-2xl border border-slate-200 flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-black text-slate-800 uppercase flex items-center gap-2">
                                <Check className="text-emerald-600" size={20} /> Detalle de Recibo: {receiptData.header.folioRecibo}
                            </h2>
                            <button onClick={() => setIsReceiptModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-slate-50">
                            <table className="w-full text-left border-collapse bg-white shadow-sm">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="p-2 text-[9px] font-black uppercase text-slate-400 text-right">Recibido</th>
                                        <th className="p-2 text-[9px] font-black uppercase text-slate-400">Medida</th>
                                        <th className="p-2 text-[9px] font-black uppercase text-slate-400">Cód. Barras</th>
                                        <th className="p-2 text-[9px] font-black uppercase text-slate-400">Descripción</th>
                                        <th className="p-2 text-[9px] font-black uppercase text-slate-400 text-right">Costo</th>
                                        <th className="p-2 text-[9px] font-black uppercase text-slate-400 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="text-slate-700">
                                    {receiptData.receiptItems.map((item, idx) => (
                                        <tr key={idx} className="border-b hover:bg-slate-50">
                                            <td className="p-2 text-[11px] text-right font-black text-emerald-600">{item.Rec}</td>
                                            <td className="p-2 text-[10px] font-bold text-slate-500">{item.MedidaCompra}</td>
                                            <td className="p-2 text-[10px] font-mono text-slate-500">{item.CodigoBarras}</td>
                                            <td className="p-2 text-[11px] font-bold uppercase">{item.Descripcion}</td>
                                            <td className="p-2 text-[11px] text-right">{formatCurrency(item.Costo)}</td>
                                            <td className="p-2 text-[11px] text-right font-black">{formatCurrency(item.Total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t flex justify-end gap-3">
                            {receiptData.header.UUID && (
                                <a href={`https://recursos.kykcloud.mx/${receiptData.header.UUID}`} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2">Ver Factura <ExternalLink size={12} /></a>
                            )}
                            <button onClick={() => setIsReceiptModalOpen(false)} className="px-6 py-2 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-700">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Distribution Detail Modal */}
            {isDistDetailModalOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl h-[70vh] shadow-2xl border border-slate-200 flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-black text-slate-800 uppercase flex items-center gap-2">
                                <RotateCcw className="text-amber-500" size={20} /> Detalle de Distribución: {selectedDistHeader?.tienda}
                            </h2>
                            <button onClick={() => setIsDistDetailModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-slate-50">
                            {loadingDistDetails ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-2">
                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase text-slate-400">Cargando...</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse bg-white shadow-sm">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400 text-right">Cant. Salida</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Medida</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Cód. Barras</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Descripción</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400 text-right">Costo</th>
                                            <th className="p-2 text-[9px] font-black uppercase text-slate-400 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {distDetailItems.map((item, idx) => (
                                            <tr key={idx} className="border-b hover:bg-slate-50">
                                                <td className="p-2 text-[11px] text-right font-black text-amber-600">{item.CantidadSalida || item.Cantidad}</td>
                                                <td className="p-2 text-[10px] font-bold text-slate-500">{item.Medida || item.MedidaCompra}</td>
                                                <td className="p-2 text-[10px] font-mono text-slate-500">{item.CodigoBarras}</td>
                                                <td className="p-2 text-[11px] font-bold uppercase">{item.Descripcion}</td>
                                                <td className="p-2 text-[11px] text-right">{formatCurrency(item.Costo || 0)}</td>
                                                <td className="p-2 text-[11px] text-right font-black">{formatCurrency(item.Total || 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t flex justify-end">
                            <button onClick={() => setIsDistDetailModalOpen(false)} className="px-6 py-2 bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest hover:bg-amber-600">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
