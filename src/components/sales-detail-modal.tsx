"use client";

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
    X, ShoppingCart, Search, FileSpreadsheet, Minimize2,
    Maximize2, User, FileText, Package, ChevronUp, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { LoadingScreen } from './ui/loading-screen';

interface SalesDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    idTienda?: string;
    idApertura?: string | number;
    idCaja?: string | number;
    storeName?: string;
    fechaInicio?: string;
    fechaFin?: string;
}

function SalesDetailModalComponent({
    isOpen,
    onClose,
    idTienda,
    idApertura,
    idCaja,
    storeName,
    fechaInicio,
    fechaFin
}: SalesDetailModalProps) {
    const [ticketDetails, setTicketDetails] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'Fecha Venta', direction: 'desc' });

    // Secondary Modal (Ticket Items)
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [ticketItems, setTicketItems] = useState<any[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Position Persistence
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isPositionLoaded, setIsPositionLoaded] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

    // Load saved position
    useEffect(() => {
        const saved = localStorage.getItem('kyk_sales_modal_position');
        if (saved) {
            try { setPosition(JSON.parse(saved)); } catch (e) { console.error("Error loading position:", e); }
        }
        setIsPositionLoaded(true);
    }, []);

    // Save position
    useEffect(() => {
        if (isPositionLoaded) {
            localStorage.setItem('kyk_sales_modal_position', JSON.stringify(position));
        }
    }, [position, isPositionLoaded]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isMaximized) return;
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;

        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: position.x,
            initialY: position.y
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!dragRef.current) return;
            const deltaX = moveEvent.clientX - dragRef.current.startX;
            const deltaY = moveEvent.clientY - dragRef.current.startY;
            setPosition({
                x: dragRef.current.initialX + deltaX,
                y: dragRef.current.initialY + deltaY
            });
        };

        const onMouseUp = () => {
            setIsDragging(false);
            dragRef.current = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    useEffect(() => {
        if (isOpen) {
            fetchTicketDetails();
        } else {
            setSearchTerm('');
            setIsMaximized(false);
            setIsItemsModalOpen(false);
        }
    }, [isOpen, idTienda, idApertura, idCaja, fechaInicio, fechaFin]);

    const fetchTicketDetails = async () => {
        setLoadingDetails(true);
        try {
            let url = `/api/dashboard/sales-details?`;
            const params = new URLSearchParams();
            if (idApertura) params.append('idApertura', idApertura.toString());
            if (idCaja) params.append('idCaja', idCaja.toString());
            if (idTienda) params.append('idTienda', idTienda.toString());
            if (fechaInicio) params.append('fechaInicio', fechaInicio);
            if (fechaFin) params.append('fechaFin', fechaFin);
            
            const res = await fetch(url + params.toString());
            const json = await res.json();
            setTicketDetails(json);
        } catch (error) {
            console.error('Error fetching ticket details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleTicketClick = async (ticket: any) => {
        setSelectedTicket(ticket);
        setLoadingItems(true);
        setIsItemsModalOpen(true);
        try {
            const res = await fetch(`/api/dashboard/ticket-items?idTienda=${ticket.IdTienda}&idCaja=${ticket.Caja}&idVenta=${ticket.IdVenta}`);
            const json = await res.json();
            setTicketItems(json);
        } catch (error) {
            console.error('Error fetching ticket items:', error);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const filteredTickets = ticketDetails.filter(t =>
        t.FolioVenta.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.Cajero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.Z.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedTickets = [...filteredTickets].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue = a[key];
        let bValue = b[key];
        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const exportToExcel = () => {
        if (sortedTickets.length === 0) return;
        const excelData = sortedTickets.map(t => ({
            'Folio': t.FolioVenta,
            'Z': t.Z,
            'Caja': t.Caja,
            'Fecha': new Date(t['Fecha Venta']).toLocaleString('es-MX'),
            'Artículos': t.Articulos,
            'Cajero': t.Cajero,
            'Tipo Pago': t.Pago,
            'Total': t.Total
        }));
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');
        worksheet['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 12 }];
        XLSX.writeFile(workbook, `Tickets_${storeName || 'Global'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const renderSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) return <div className="w-4" />;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={14} className="ml-1 text-[#4050B4]" />;
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div
                    className={cn(
                        "bg-white shadow-2xl overflow-hidden flex flex-col transition-[width,height,transform] duration-300 border border-slate-200",
                        isMaximized ? "fixed inset-0 m-0" : "w-full max-w-6xl max-h-[90vh]"
                    )}
                    style={!isMaximized ? {
                        transform: `translate(${position.x}px, ${position.y}px)`,
                    } : undefined}
                >
                    {/* Main Modal Header */}
                    <div
                        onMouseDown={handleMouseDown}
                        onDoubleClick={() => setPosition({ x: 0, y: 0 })}
                        className={cn(
                            "flex items-center justify-between bg-white border-b border-slate-100 p-4 shrink-0",
                            !isMaximized && "cursor-grab active:cursor-grabbing select-none"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                <ShoppingCart size={18} className="text-[#4050B4]" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Tickets</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">
                                    {storeName || 'TODAS LAS TIENDAS'} {idCaja ? `• CAJA ${idCaja}` : ''} {idApertura ? `• Z ${idApertura}` : ''} {fechaInicio && !idApertura ? `• ${fechaInicio} a ${fechaFin}` : ''}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative mr-4 hidden md:block">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="BUSCAR FOLIO, CAJERO..."
                                    className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={exportToExcel}
                                disabled={sortedTickets.length === 0}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#4050B4]/10 text-[#4050B4] hover:bg-[#4050B4] hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-[#4050B4]/20 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
                            >
                                <FileSpreadsheet size={14} />
                                <span>Exportar Excel</span>
                            </button>
                            <button
                                onClick={() => setIsMaximized(!isMaximized)}
                                className="p-2 hover:bg-slate-50 text-slate-500 transition-colors"
                            >
                                {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-rose-50 text-rose-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Main Modal Content */}
                    <div className="flex-1 overflow-auto bg-white p-0 relative">
                        {loadingDetails ? (
                            <LoadingScreen message="Obteniendo tickets..." />
                        ) : (
                            <div className="min-w-full inline-block align-middle">
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th onClick={() => handleSort('FolioVenta')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center">Folio {renderSortIcon('FolioVenta')}</div>
                                            </th>
                                            <th onClick={() => handleSort('Z')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center justify-center">Z {renderSortIcon('Z')}</div>
                                            </th>
                                            <th onClick={() => handleSort('Caja')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center justify-center">Caja {renderSortIcon('Caja')}</div>
                                            </th>
                                            <th onClick={() => handleSort('Fecha Venta')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center">Fecha {renderSortIcon('Fecha Venta')}</div>
                                            </th>
                                            <th onClick={() => handleSort('Articulos')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center justify-center">Arts {renderSortIcon('Articulos')}</div>
                                            </th>
                                            <th onClick={() => handleSort('Cajero')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center">Cajero {renderSortIcon('Cajero')}</div>
                                            </th>
                                            <th onClick={() => handleSort('Pago')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center justify-end">Pago {renderSortIcon('Pago')}</div>
                                            </th>
                                            <th onClick={() => handleSort('Total')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center justify-end">Total {renderSortIcon('Total')}</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sortedTickets.length > 0 ? (
                                            sortedTickets.map((ticket) => (
                                                <tr
                                                    key={ticket.FolioVenta}
                                                    onClick={() => handleTicketClick(ticket)}
                                                    className="hover:bg-indigo-50/50 transition-colors cursor-pointer group/row"
                                                >
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <FileText size={14} className="text-slate-400 group-hover/row:text-[#4050B4] transition-colors" />
                                                            <span className="text-[11px] font-black text-slate-900">{ticket.FolioVenta}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-bold text-slate-600">{ticket.Z}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-black">{ticket.Caja}</span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-bold text-slate-700">{new Date(ticket['Fecha Venta']).toLocaleDateString('es-MX')}</span>
                                                            <span className="text-[9px] font-medium text-slate-400">{new Date(ticket['Fecha Venta']).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{ticket.Articulos}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                                            <User size={12} className="text-slate-400" />
                                                            {ticket.Cajero}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-bold text-slate-600 italic">{ticket.Pago}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                                        <span className="text-[12px] font-black text-[#4050B4]">{formatCurrency(ticket.Total)}</span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : !loadingDetails ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-12 text-center">
                                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron tickets</p>
                                                </td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Main Modal Footer */}
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Tickets</span>
                                <span className="text-sm font-black text-slate-900">{filteredTickets.length}</span>
                            </div>
                            <div className="flex flex-col border-l border-slate-200 pl-6">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sumatoria Ventas</span>
                                <span className="text-sm font-black text-[#4050B4]">{formatCurrency(filteredTickets.reduce((acc, t) => acc + t.Total, 0))}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                        >
                            CERRAR
                        </button>
                    </div>
                </div>
            </div>

            {/* Ticket Items Breakdown Modal (Secondary level) */}
            {isItemsModalOpen && (
                <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in zoom-in duration-200">
                    <div className="bg-white shadow-3xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-200">
                        {/* Items Header */}
                        <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 p-4 select-none">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-none border border-slate-200 shadow-sm">
                                    <Package size={18} className="text-[#4050B4]" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xs uppercase tracking-widest leading-none mb-1 text-slate-800">Partidas del Ticket</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">FOLIO: {selectedTicket?.FolioVenta} • {selectedTicket?.Cajero}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsItemsModalOpen(false)}
                                className="p-2 hover:bg-slate-200 rounded-none transition-colors text-slate-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Items Content */}
                        <div className="flex-1 overflow-auto bg-white relative">
                            {loadingItems ? (
                                <LoadingScreen message="Cargando partidas del ticket..." />
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-white border-b border-slate-200">
                                            <th className="px-6 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">Cant</th>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">Código</th>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">Descripción</th>
                                            <th className="px-6 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">P. Normal</th>
                                            <th className="px-6 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">P. Venta</th>
                                            <th className="px-6 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">Importe</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {ticketItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900 italic">{item.Cantidad}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-[11px] font-bold text-slate-500">{item['Codigo Barras']}</td>
                                                <td className="px-6 py-3 text-[11px] font-black text-slate-700">{item.Descripcion}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right text-[11px] font-medium text-slate-400 line-through decoration-rose-300">
                                                    {formatCurrency(item['Precio Normal'])}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right text-[11px] font-black text-slate-600">
                                                    {formatCurrency(item['Precio Venta'])}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right">
                                                    <span className="text-[12px] font-black text-[#4050B4] bg-[#4050B4]/5 px-2 py-1">
                                                        {formatCurrency(item.Total)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Items Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-8">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Unidades</span>
                                    <span className="text-sm font-black text-slate-900">{ticketItems.reduce((acc, i) => acc + i.Cantidad, 0)}</span>
                                </div>
                                <div className="flex flex-col border-l border-slate-200 pl-6">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Monto Total</span>
                                    <span className="text-sm font-black text-[#4050B4]">
                                        {formatCurrency(ticketItems.reduce((acc, i) => acc + i.Total, 0))}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsItemsModalOpen(false)}
                                className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                VOLVER A TICKETS
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export const SalesDetailModal = memo(SalesDetailModalComponent);
