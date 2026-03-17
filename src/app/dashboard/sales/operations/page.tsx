"use client";

import { LoadingScreen } from '@/components/ui/loading-screen';
import { useState, useEffect } from 'react';
import { 
    Calendar, 
    Store, 
    Receipt, 
    Ban, 
    Lock,
    RefreshCw,
    AlertCircle,
    Monitor,
    Search,
    User,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SalesDetailModal } from '@/components/sales-detail-modal';
import { OpeningDetailModal } from '@/components/opening-detail-modal';
import { CancellationDetailModal } from '@/components/cancellation-detail-modal';
import { ClosingTicketModal } from '@/components/closing-ticket-modal';

interface OpeningDetail {
    IdApertura: number;
    Z: string;
    Caja: number;
    Cajero: string;
    Total: number;
    Operaciones: number;
    HoraApertura: string;
    HoraCierre: string | null;
    Supervisor: string | null;
    cancelaciones: number;
    cancelacionesMonto: number;
    RawFechaApertura: string;
    RawFechaCierre: string | null;
}

interface BranchOp {
    id: number;
    name: string;
    aperturas: number;
    ventas: number;
    ventasCount: number;
    ticketPromedio: number;
    details: {
        openings: OpeningDetail[];
        cancelaciones: number;
        cancelacionesMonto: number;
        cortes: number;
    }
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
    'MERKDON': '#fcea42',
};

const STORE_COLORS = [
    '#2563EB', '#3B82F6', '#DC2626', '#EF4444', '#0D9488', '#14B8A6', '#D97706', '#F59E0B',
    '#16A34A', '#22C55E', '#064E3B', '#DCFCE7', '#7C3AED', '#8B5CF6', '#713F12', '#92400E',
    '#EAB308', '#CA8A04', '#0F172A', '#334155', '#EA580C', '#F97316'
];

export default function OperationsKanbanPage() {
    const [date, setDate] = useState<string>(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Monterrey',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date()));
    
    const [data, setData] = useState<BranchOp[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
    const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
    const [isClosingTicketModalOpen, setIsClosingTicketModalOpen] = useState(false);
    const [selectedStore, setSelectedStore] = useState<{ id: string, name: string } | null>(null);
    const [selectedOpeningId, setSelectedOpeningId] = useState<string | undefined>(undefined);
    const [selectedCajaId, setSelectedCajaId] = useState<string | undefined>(undefined);

    // Filter Logic
    const filteredData = data.map(store => {
        const sTerm = searchTerm.toLowerCase().trim();
        if (!sTerm) return store;

        // 1. Check if store name matches
        const matchStore = store.name.toLowerCase().includes(sTerm);
        
        // 2. Filter openings within the store
        const filteredOpenings = store.details.openings.filter(op => {
            const matchCashier = op.Cajero.toLowerCase().includes(sTerm);
            const matchOpening = op.Z.toLowerCase().includes(sTerm) || 
                                op.IdApertura.toString().includes(sTerm);
            return matchCashier || matchOpening;
        });

        // 3. Logic: 
        // If store matches, show ALL its openings (current filter says show all if store matches)
        // If store doesn't match but some openings do, show those openings
        if (matchStore) {
            return store; // Retornar la tienda completa si coincide el nombre
        } else if (filteredOpenings.length > 0) {
            return {
                ...store,
                details: {
                    ...store.details,
                    openings: filteredOpenings
                }
            };
        }
        return null;
    }).filter(Boolean) as BranchOp[];

    const handleOpenSalesModal = (storeId: string, storeName: string, openingId?: string, cajaId?: string) => {
        setSelectedStore({ id: storeId, name: storeName });
        setSelectedOpeningId(openingId);
        setSelectedCajaId(cajaId);
        setIsSalesModalOpen(true);
    };

    const handleOpenOpeningModal = (storeId: string, storeName: string) => {
        setSelectedStore({ id: storeId, name: storeName });
        setIsOpeningModalOpen(true);
    };

    const handleOpenCancellationModal = (storeId: string, storeName: string, openingId?: string, cajaId?: string) => {
        setSelectedStore({ id: storeId, name: storeName });
        setSelectedOpeningId(openingId);
        setSelectedCajaId(cajaId);
        setIsCancellationModalOpen(true);
    };

    const handleOpenClosingTicketModal = (storeId: string, storeName: string, openingId: string, cajaId: string, z: string) => {
        setSelectedStore({ id: storeId, name: storeName });
        setSelectedOpeningId(openingId);
        setSelectedCajaId(cajaId);
        setIsClosingTicketModalOpen(true);
    };

    const handleOpeningClickFromModal = (opening: any) => {
        // When clicking an opening inside the opening modal, close it and open sales detail for that opening
        setSelectedOpeningId(opening.IdApertura.toString());
        setSelectedCajaId(opening.Caja.toString());
        setIsOpeningModalOpen(false);
        setIsSalesModalOpen(true);
    };

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

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/dashboard/operations?fecha=${date}`);
            const json = await res.json();
            
            if (!res.ok) {
                throw new Error(json.error || 'Error al obtener datos');
            }
            
            if (Array.isArray(json)) {
                setData(json);
            } else {
                throw new Error('La respuesta de la API no es válida');
            }
        } catch (err: any) {
            console.error('Error fetching operations:', err);
            setError(err.message);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [date]);

    const handleQuickDate = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        setDate(d.toISOString().split('T')[0]);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };
    const formatDuration = (start: string, end: string | null) => {
        if (!end) return null;
        const d1 = new Date(start);
        const d2 = new Date(end);
        const diffMs = d2.getTime() - d1.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${diffHrs}h ${diffMins}m`;
    };

    const BranchCard = ({ branch }: { branch: BranchOp }) => {
        const color = getStoreColor(branch.name);
        return (
            <div 
                onClick={() => handleOpenOpeningModal(branch.id.toString(), branch.name)}
                className="relative bg-white border-2 px-3 py-4 flex flex-col gap-2 text-left w-full rounded-none transition-all cursor-pointer hover:shadow-lg active:scale-[0.98]"
                style={{ borderColor: color }}
            >
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sucursal</span>
                    <Store size={14} style={{ color }} />
                </div>
                <h4 className="text-[14px] font-black text-slate-800 truncate w-full leading-tight mb-1 uppercase">
                    {branch.name}
                </h4>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Aperturas</span>
                        <span className="text-[13px] font-black text-[#4050B4] tracking-tight">{branch.aperturas}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Ventas</span>
                        <span className="text-[13px] font-black text-emerald-600 tracking-tight">{formatCurrency(branch.ventas)}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Operaciones</span>
                        <span className="text-[13px] font-black text-slate-700 tracking-tight">{branch.ventasCount}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Ticket Prom.</span>
                        <span className="text-[13px] font-black text-amber-600 tracking-tight">{formatCurrency(branch.ticketPromedio)}</span>
                    </div>
                </div>
            </div>
        );
    };

    const SalesCard = ({ opening, storeName, storeId }: { opening: OpeningDetail, storeName: string, storeId: number }) => {
        if (opening.Total <= 0) return null;
        const color = getStoreColor(storeName);
        return (
            <div 
                onClick={() => handleOpenSalesModal(storeId.toString(), storeName, opening.IdApertura.toString(), opening.Caja.toString())}
                className="relative border-2 px-3 py-4 flex flex-col gap-1 text-left w-full rounded-none transition-all bg-emerald-50 border-emerald-200 cursor-pointer hover:shadow-md active:scale-[0.98]"
                style={{ borderColor: color }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="bg-emerald-600 text-white text-[13px] px-2 py-0.5 font-black flex items-center justify-center tracking-tighter shadow-sm">Z: {opening.Z}</span>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Ventas</span>
                    </div>
                    <Receipt size={14} className="text-emerald-500" />
                </div>
                <p className="text-[16px] font-black text-emerald-900 leading-tight mt-1">{formatCurrency(opening.Total)}</p>
                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">{opening.Operaciones} Operaciones</p>
            </div>
        );
    };

    const CancellationCard = ({ opening, storeName, storeId }: { opening: OpeningDetail, storeName: string, storeId: number }) => {
        if (opening.cancelaciones <= 0) return null;
        const color = getStoreColor(storeName);
        return (
            <div 
                onClick={() => handleOpenCancellationModal(storeId.toString(), storeName, opening.IdApertura.toString(), opening.Caja.toString())}
                className="relative border-2 px-3 py-4 flex flex-col gap-1 text-left w-full rounded-none transition-all bg-rose-50 border-rose-200 cursor-pointer hover:shadow-md active:scale-[0.98]"
                style={{ borderColor: color }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="bg-rose-600 text-white text-[13px] px-2 py-0.5 font-black flex items-center justify-center tracking-tighter shadow-sm">Z: {opening.Z}</span>
                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Cancelaciones</span>
                    </div>
                    <Ban size={14} className="text-rose-400" />
                </div>
                <p className="text-[16px] font-black text-rose-900 leading-tight mt-1">{formatCurrency(opening.cancelacionesMonto)}</p>
                <p className="text-[9px] font-bold text-rose-400 uppercase tracking-tighter">{opening.cancelaciones} Movimientos</p>
            </div>
        );
    };

    const CierreCard = ({ opening, storeName, storeId }: { opening: OpeningDetail, storeName: string, storeId: number }) => {
        if (!opening.HoraCierre || !opening.Supervisor) return null;
        const color = getStoreColor(storeName);
        const duration = formatDuration(opening.RawFechaApertura, opening.RawFechaCierre);

        return (
            <div 
                onClick={() => handleOpenClosingTicketModal(storeId.toString(), storeName, opening.IdApertura.toString(), opening.Caja.toString(), opening.Z)}
                className="relative border-2 px-3 py-4 flex flex-col gap-1 text-left w-full rounded-none transition-all bg-indigo-50 border-indigo-200 cursor-pointer hover:shadow-md active:scale-[0.98]"
                style={{ borderColor: color }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="bg-indigo-600 text-white text-[13px] px-2 py-0.5 font-black flex items-center justify-center tracking-tighter shadow-sm">Z: {opening.Z}</span>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Cierre</span>
                    </div>
                    <Lock size={14} className="text-indigo-400" />
                </div>
                
                <p className="text-[16px] font-black text-indigo-900 leading-tight mt-1">Hora: {opening.HoraCierre}</p>
                
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-indigo-200/50">
                    <div className="flex flex-col">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Tiempo Abierta</p>
                        <p className="text-[12px] font-black text-indigo-800 uppercase truncate">
                            {duration || '--'}
                        </p>
                    </div>
                    <div className="flex flex-col text-right">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Supervisor</p>
                        <p className="text-[11px] font-black text-indigo-800 uppercase truncate">{opening.Supervisor || 'N/A'}</p>
                    </div>
                </div>
            </div>
        );
    };

    const OpeningCard = ({ opening, storeName, storeId }: { opening: OpeningDetail, storeName: string, storeId: number }) => {
        const color = getStoreColor(storeName);
        const openingTime = opening.HoraApertura || '--:--';

        return (
            <div 
                onClick={() => handleOpenSalesModal(storeId.toString(), storeName, opening.IdApertura.toString(), opening.Caja.toString())}
                className="relative border-2 px-3 py-4 flex flex-col gap-2 text-left w-full rounded-none transition-all bg-amber-50 border-amber-200 cursor-pointer hover:shadow-md active:scale-[0.98]"
                style={{ borderColor: color }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="bg-amber-600 text-white text-[13px] px-2 py-0.5 font-black flex items-center justify-center tracking-tighter shadow-sm">Z: {opening.Z}</span>
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Apertura</span>
                    </div>
                    <Monitor size={14} className="text-amber-500" />
                </div>
                
                <div className="flex items-center justify-between">
                    <span className="text-[16px] font-black text-slate-800 leading-tight mt-1">Hora: {openingTime}</span>
                </div>

                <div className="mt-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cajero Responsable</p>
                    <p className="text-[13px] font-black text-slate-800 uppercase truncate leading-none">{opening.Cajero}</p>
                </div>
            </div>
        );
    };

    const ColumnHeader = ({ title, icon: Icon, color, className }: any) => (
        <div className={cn("flex items-center gap-1 px-2 py-1 text-white shrink-0", color, className)}>
            <Icon size={10} />
            <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
        </div>
    );

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-50 pb-3 space-y-3 flex-none sticky top-0 z-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white py-2 px-4 shadow-sm border border-slate-100">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase flex items-center gap-2">
                            <span>📊</span>
                            MONITOR DE OPERACIONES
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Estado en tiempo real · {data.length} sucursales activas
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Unified Search Filter */}
                        <div className="relative min-w-[200px] hidden md:block">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <input
                                type="text"
                                placeholder="BUSCAR SUCURSAL, CAJERO O Z..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-100 border border-slate-200 pl-8 pr-8 py-1.5 text-[9px] font-black uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 placeholder:text-slate-400"
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 p-0.5">
                            {[
                                { label: 'Hoy', days: 0 },
                                { label: 'Ayer', days: 1 },
                                { label: 'Antier', days: 2 },
                            ].map(btn => {
                                const btnDate = new Date(new Date().setDate(new Date().getDate() - btn.days)).toISOString().split('T')[0];
                                const isActive = date === btnDate;
                                return (
                                    <button
                                        key={btn.label}
                                        onClick={() => handleQuickDate(btn.days)}
                                        className={cn(
                                            "px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            isActive ? "bg-[#4050B4] text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-white"
                                        )}
                                    >
                                        {btn.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1">
                            <Calendar size={12} className="text-[#4050B4]" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none h-auto leading-none"
                            />
                        </div>

                        <button onClick={fetchData} className="p-2 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 group" title="Actualizar">
                            <RefreshCw size={14} className={cn("group-hover:rotate-180 transition-transform duration-500", loading && "animate-spin")} />
                        </button>
                    </div>
                </div>

                {/* Column Headers Strips */}
                <div className="flex items-center px-0">
                    <ColumnHeader title="Tiendas" icon={Store} color="bg-[#4050B4]" className="w-[300px]" />
                    <div className="w-px bg-white/20 self-stretch" />
                    <ColumnHeader title="Aperturas" icon={Monitor} color="bg-amber-500" className="w-[300px]" />
                    <div className="w-px bg-white/20 self-stretch" />
                    <ColumnHeader title="Ventas Por Terminal" icon={Receipt} color="bg-emerald-600" className="w-[300px]" />
                    <div className="w-px bg-white/20 self-stretch" />
                    <ColumnHeader title="Cancelaciones" icon={Ban} color="bg-rose-600" className="w-[300px]" />
                    <div className="w-px bg-white/20 self-stretch" />
                    <ColumnHeader title="Cierres de Caja" icon={Lock} color="bg-indigo-700" className="w-[300px]" />
                </div>
            </div>

            {/* Kanban Content */}
            {loading ? (
                <div className="flex-1 relative">
                    <LoadingScreen message="Sincronizando Estado..." />
                </div>
            ) : error ? (
                <div className="flex-1 flex items-center justify-center p-6 text-center">
                    <div className="max-w-md bg-white border-2 border-rose-100 p-8 shadow-sm">
                        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 mb-2">Error de Sincronización</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">{error}</p>
                        <button 
                            onClick={() => fetchData()}
                            className="mt-6 px-6 py-2 bg-[#4050B4] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#344196] transition-all"
                        >
                            Reintentar Conexión
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-auto bg-slate-100/30">
                    <div className="min-w-max flex flex-col">
                        {/* Store Rows (Aligned) */}
                        <div className="flex flex-col">
                            {filteredData.map(store => (
                                <div key={store.id} className="flex border-b border-slate-200 group group-hover:bg-white/50 transition-colors py-2">
                                    {/* Store Info */}
                                    <div className="p-4 bg-slate-50/50 border-r border-slate-200 w-[300px] shrink-0">
                                        <BranchCard branch={store} />
                                    </div>

                                    {/* TERMINAL MINI-ROWS CONTAINER */}
                                    <div className="flex flex-col flex-1 divide-y divide-slate-100">
                                        {store.details.openings.length > 0 ? (
                                            store.details.openings.map((op, i) => (
                                                <div key={i} className="flex">
                                                    {/* Aperturas (Col 2) */}
                                                    <div className="p-4 border-r border-slate-200 w-[300px] shrink-0 bg-white flex flex-col items-start">
                                                        <OpeningCard opening={op} storeName={store.name} storeId={store.id} />
                                                    </div>

                                                    {/* Ventas (Col 3) */}
                                                    <div className="p-4 border-r border-slate-200 w-[300px] shrink-0 bg-emerald-50/10 flex flex-col items-start">
                                                        <SalesCard opening={op} storeName={store.name} storeId={store.id} />
                                                    </div>

                                                    {/* Cancelaciones (Col 4) */}
                                                    <div className="p-4 border-r border-slate-200 w-[300px] shrink-0 bg-rose-50/10 flex flex-col items-start">
                                                        <CancellationCard opening={op} storeName={store.name} storeId={store.id} />
                                                    </div>

                                                    {/* Cierres (Col 5) */}
                                                    <div className="p-4 w-[300px] shrink-0 bg-indigo-50/5 flex flex-col items-start">
                                                        <CierreCard opening={op} storeName={store.name} storeId={store.id} />
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-1 min-h-[140px]">
                                                <div className="p-4 border-r border-slate-200 w-[300px] shrink-0 bg-white flex items-center justify-center italic text-slate-300 text-[10px] font-bold uppercase tracking-widest">Sin Aperturas</div>
                                                <div className="p-4 border-r border-slate-200 w-[300px] shrink-0 bg-emerald-50/10 flex items-center justify-center italic text-slate-300 text-[10px] font-bold uppercase tracking-widest">--</div>
                                                <div className="p-4 border-r border-slate-200 w-[300px] shrink-0 bg-rose-50/10 flex items-center justify-center italic text-slate-300 text-[10px] font-bold uppercase tracking-widest">--</div>
                                                <div className="p-4 w-[300px] shrink-0 bg-indigo-50/5 flex items-center justify-center italic text-slate-300 text-[10px] font-bold uppercase tracking-widest">--</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Footer Legend */}
            <div className="flex-none bg-slate-50 border-t border-slate-200 px-6 py-2.5 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Monitoreo Activo</span>
                    </div>
                    <span>Actualizado: {new Date().toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Store size={12} />
                    <span>Sucursales con Apertura: {data.length}</span>
                </div>
            </div>

            <SalesDetailModal
                isOpen={isSalesModalOpen}
                onClose={() => setIsSalesModalOpen(false)}
                idTienda={selectedStore?.id}
                idApertura={selectedOpeningId}
                idCaja={selectedCajaId}
                storeName={selectedStore?.name}
                fechaInicio={date}
                fechaFin={date}
            />

            <OpeningDetailModal
                isOpen={isOpeningModalOpen}
                onClose={() => setIsOpeningModalOpen(false)}
                idTienda={selectedStore?.id}
                storeName={selectedStore?.name}
                fechaInicio={date}
                fechaFin={date}
                onOpeningClick={handleOpeningClickFromModal}
            />

            <CancellationDetailModal
                isOpen={isCancellationModalOpen}
                onClose={() => setIsCancellationModalOpen(false)}
                idTienda={selectedStore?.id}
                idApertura={selectedOpeningId}
                idCaja={selectedCajaId}
                storeName={selectedStore?.name}
                fechaInicio={date}
                fechaFin={date}
            />

            <ClosingTicketModal
                isOpen={isClosingTicketModalOpen}
                onClose={() => setIsClosingTicketModalOpen(false)}
                idTienda={selectedStore?.id}
                idCaja={selectedCajaId}
                idApertura={selectedOpeningId}
                storeName={selectedStore?.name}
                zNumber={data.flatMap(s => s.details.openings).find(o => o.IdApertura.toString() === selectedOpeningId)?.Z}
            />
        </div>
    );
}
