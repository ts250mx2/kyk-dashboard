"use client";

import { useState, useEffect, useRef, memo } from 'react';
import {
    X, Calendar, Search, FileSpreadsheet, Minimize2,
    Maximize2, User, ChevronUp, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { LoadingScreen } from './ui/loading-screen';

interface OpeningDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    idTienda?: string;
    storeName?: string;
    fechaInicio: string;
    fechaFin: string;
    onOpeningClick: (opening: any) => void;
}

function OpeningDetailModalComponent({
    isOpen,
    onClose,
    idTienda,
    storeName,
    fechaInicio,
    fechaFin,
    onOpeningClick
}: OpeningDetailModalProps) {
    const [openingDetails, setOpeningDetails] = useState<any[]>([]);
    const [loadingOpenings, setLoadingOpenings] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);
    const [openingSortConfig, setOpeningSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'Fecha Apertura', direction: 'desc' });

    // Position Persistence
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isPositionLoaded, setIsPositionLoaded] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

    // Load saved position
    useEffect(() => {
        const saved = localStorage.getItem('kyk_opening_modal_position');
        if (saved) {
            try { setPosition(JSON.parse(saved)); } catch (e) { console.error("Error loading position:", e); }
        }
        setIsPositionLoaded(true);
    }, []);

    // Save position
    useEffect(() => {
        if (isPositionLoaded) {
            localStorage.setItem('kyk_opening_modal_position', JSON.stringify(position));
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
            fetchOpeningDetails();
        } else {
            setSearchTerm('');
            setIsMaximized(false);
        }
    }, [isOpen, idTienda, fechaInicio, fechaFin]);

    const fetchOpeningDetails = async () => {
        setLoadingOpenings(true);
        try {
            let url = `/api/dashboard/opening-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
            if (idTienda) url += `&idTienda=${idTienda}`;
            const res = await fetch(url);
            const json = await res.json();
            setOpeningDetails(json);
        } catch (error) {
            console.error('Error fetching opening details:', error);
        } finally {
            setLoadingOpenings(false);
        }
    };

    const handleOpeningSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (openingSortConfig && openingSortConfig.key === key && openingSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setOpeningSortConfig({ key, direction });
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const filteredOpenings = openingDetails.filter(o =>
        o.Cajero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.Z.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.Tienda && o.Tienda.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedOpenings = [...filteredOpenings].sort((a, b) => {
        if (!openingSortConfig) return 0;
        const { key, direction } = openingSortConfig;
        let aValue = a[key];
        let bValue = b[key];
        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const exportToExcel = () => {
        if (sortedOpenings.length === 0) return;
        const excelData = sortedOpenings.map(o => ({
            ...(!idTienda ? { 'Tienda': o.Tienda } : {}),
            'Z': o.Z,
            'Caja': o.Caja,
            'Fecha Apertura': new Date(o['Fecha Apertura']).toLocaleString('es-MX'),
            'Cajero': o.Cajero,
            'Tickets': o.Tickets,
            'Total Venta': o['Total Venta'],
            'Fecha Cierre': o.FechaCierre ? new Date(o.FechaCierre).toLocaleString('es-MX') : 'Abierta'
        }));
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Aperturas');
        XLSX.writeFile(workbook, `Aperturas_${storeName || 'Global'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const renderSortIcon = (columnKey: string) => {
        if (openingSortConfig?.key !== columnKey) return <div className="w-4" />;
        return openingSortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={14} className="ml-1 text-[#4050B4]" />;
    };

    if (!isOpen) return null;

    return (
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
                {/* Modal Header */}
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
                            <Calendar size={18} className="text-[#4050B4]" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Aperturas</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{storeName || 'TODAS LAS TIENDAS'} • {fechaInicio} a {fechaFin}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative mr-4 hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="BUSCAR Z, CAJERO..."
                                className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 w-64"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={exportToExcel}
                            disabled={sortedOpenings.length === 0}
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

                {/* Modal Content */}
                <div className="flex-1 overflow-auto bg-white p-0 relative">
                    {loadingOpenings ? (
                        <LoadingScreen message="Obteniendo aperturas..." />
                    ) : (
                        <div className="min-w-full inline-block align-middle">
                            <table className="min-w-full border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        {!idTienda && (
                                            <th onClick={() => handleOpeningSort('Tienda')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center">Tienda {renderSortIcon('Tienda')}</div>
                                            </th>
                                        )}
                                        <th onClick={() => handleOpeningSort('Z')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-center">Z {renderSortIcon('Z')}</div>
                                        </th>
                                        <th onClick={() => handleOpeningSort('Caja')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-center">Caja {renderSortIcon('Caja')}</div>
                                        </th>
                                        <th onClick={() => handleOpeningSort('Fecha Apertura')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Apertura {renderSortIcon('Fecha Apertura')}</div>
                                        </th>
                                        <th onClick={() => handleOpeningSort('Cajero')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Cajero {renderSortIcon('Cajero')}</div>
                                        </th>
                                        <th onClick={() => handleOpeningSort('Tickets')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-center">Tickets {renderSortIcon('Tickets')}</div>
                                        </th>
                                        <th onClick={() => handleOpeningSort('Total Venta')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-end">Venta {renderSortIcon('Total Venta')}</div>
                                        </th>
                                        <th onClick={() => handleOpeningSort('FechaCierre')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Cierre {renderSortIcon('FechaCierre')}</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedOpenings.length > 0 ? (
                                        sortedOpenings.map((opening, idx) => (
                                            <tr
                                                key={idx}
                                                onClick={() => onOpeningClick(opening)}
                                                className="hover:bg-indigo-50/50 transition-colors group/row cursor-pointer"
                                            >
                                                {!idTienda && (
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] font-black text-slate-900 uppercase">
                                                        {opening.Tienda}
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{opening.Z}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-black">{opening.Caja}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-700">{new Date(opening['Fecha Apertura']).toLocaleDateString('es-MX')}</span>
                                                        <span className="text-[9px] font-medium text-slate-400">{new Date(opening['Fecha Apertura']).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                                        <User size={12} className="text-slate-400" />
                                                        {opening.Cajero}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{opening.Tickets}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <span className="text-[12px] font-black text-[#4050B4]">{formatCurrency(opening['Total Venta'])}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {opening.FechaCierre ? (
                                                        <div className="flex flex-col opacity-60">
                                                            <span className="text-[10px] font-bold text-slate-500">{new Date(opening.FechaCierre).toLocaleDateString('es-MX')}</span>
                                                            <span className="text-[9px] font-medium text-slate-400">{new Date(opening.FechaCierre).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[8px] font-black bg-emerald-100 text-emerald-700 uppercase tracking-widest animate-pulse">En Línea</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : !loadingOpenings ? (
                                        <tr>
                                            <td colSpan={!idTienda ? 8 : 7} className="px-4 py-12 text-center">
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron aperturas</p>
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Z</span>
                            <span className="text-sm font-black text-slate-900">{filteredOpenings.length}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Venta Acumulada</span>
                            <span className="text-sm font-black text-[#4050B4]">{formatCurrency(filteredOpenings.reduce((acc, o) => acc + o['Total Venta'], 0))}</span>
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
    );
}

export const OpeningDetailModal = memo(OpeningDetailModalComponent);
