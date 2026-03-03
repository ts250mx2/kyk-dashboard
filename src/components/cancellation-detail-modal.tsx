"use client";

import { useState, useEffect, useRef } from 'react';
import {
    X, AlertCircle, Search, FileSpreadsheet, Minimize2,
    Maximize2, User, FileDown, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { LoadingScreen } from './ui/loading-screen';

interface CancellationDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    idTienda?: string;
    idUsuario?: string;
    role?: 'cajeros' | 'supervisores';
    fechaInicio: string;
    fechaFin: string;
    storeName?: string;
    userName?: string;
}

export function CancellationDetailModal({
    isOpen,
    onClose,
    idTienda,
    idUsuario,
    role,
    fechaInicio,
    fechaFin,
    storeName,
    userName
}: CancellationDetailModalProps) {
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'FechaCancelacion', direction: 'desc' });

    // Position Persistence
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isPositionLoaded, setIsPositionLoaded] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

    // Load saved position
    useEffect(() => {
        const saved = localStorage.getItem('kyk_cancellation_modal_position');
        if (saved) {
            try { setPosition(JSON.parse(saved)); } catch (e) { console.error("Error loading position:", e); }
        }
        setIsPositionLoaded(true);
    }, []);

    // Save position
    useEffect(() => {
        if (isPositionLoaded) {
            localStorage.setItem('kyk_cancellation_modal_position', JSON.stringify(position));
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
            fetchDetails();
        } else {
            setDetails([]);
            setSearchTerm('');
            setIsMaximized(false);
        }
    }, [isOpen, idTienda, idUsuario, role, fechaInicio, fechaFin]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            let url = `/api/dashboard/cancellation-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
            if (idTienda) url += `&idTienda=${idTienda}`;
            if (idUsuario) url += `&idUsuario=${idUsuario}`;
            if (role) url += `&role=${role}`;

            const res = await fetch(url);
            const json = await res.json();
            setDetails(Array.isArray(json) ? json : []);
        } catch (error) {
            console.error('Error fetching cancellation details:', error);
        } finally {
            setLoading(false);
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

    const filteredDetails = details.filter(c =>
        c['Folio Cancelacion']?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Cajero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Supervisor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Z?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedDetails = [...filteredDetails].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue = a[key];
        let bValue = b[key];
        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const exportToExcel = () => {
        if (sortedDetails.length === 0) return;
        const excelData = sortedDetails.map(c => ({
            'Z': c.Z,
            'Folio Cancelación': c['Folio Cancelacion'],
            'Fecha': new Date(c.FechaCancelacion).toLocaleString('es-MX'),
            'Cantidad': c.Cantidad,
            'Código': c['Codigo Barras'],
            'Descripción': c.Descripcion,
            'P. Venta': c['Precio Venta'],
            'Total': c.Total,
            'Cajero': c.Cajero,
            'Supervisor': c.Supervisor
        }));
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cancelaciones');
        const wscols = [
            { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 15 },
            { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
        ];
        worksheet['!cols'] = wscols;
        const fileName = `Cancelaciones_${storeName || 'Global'}_${userName || ''}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const renderSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) return null;
        return sortConfig.direction === 'asc' ? <Minimize2 size={12} className="rotate-90 ml-1" /> : <Maximize2 size={12} className="rotate-90 ml-1" />;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={cn(
                    "bg-white shadow-2xl overflow-hidden flex flex-col transition-[width,height,transform] duration-300 border border-slate-200",
                    isMaximized ? "fixed inset-0 m-0" : "w-full max-w-6xl max-h-[90vh]"
                )}
                style={!isMaximized ? {
                    transform: `translate(${position.x}px, ${position.y}px)`,
                } : undefined}
            >
                {/* Header */}
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
                            <AlertCircle size={18} className="text-rose-500" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Cancelaciones</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                                {storeName || 'Todas las Tiendas'} {userName ? `• ${role === 'cajeros' ? 'Cajero' : 'Supervisor'}: ${userName}` : ''} • {fechaInicio} a {fechaFin}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative mr-4 hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="BUSCAR FOLIO, ARTICULO, PERSONAL..."
                                className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 w-64"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={exportToExcel}
                            disabled={sortedDetails.length === 0}
                            className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-rose-100 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
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

                {/* Content */}
                <div className="flex-1 overflow-auto bg-white relative">
                    {loading ? (
                        <LoadingScreen message="Obteniendo cancelaciones..." />
                    ) : (
                        <div className="min-w-full inline-block align-middle">
                            <table className="min-w-full border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th onClick={() => handleSort('Z')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-center">Z {renderSortIcon('Z')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Folio Cancelacion')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Folio {renderSortIcon('Folio Cancelacion')}</div>
                                        </th>
                                        <th onClick={() => handleSort('FechaCancelacion')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Fecha {renderSortIcon('FechaCancelacion')}</div>
                                        </th>
                                        <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider">Cant</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Descripción</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">Importe</th>
                                        <th onClick={() => handleSort('Cajero')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Cajero {renderSortIcon('Cajero')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Supervisor')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Supervisor {renderSortIcon('Supervisor')}</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedDetails.length > 0 ? (
                                        sortedDetails.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-rose-50/30 transition-colors group/row">
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{item.Z}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-rose-600">{item['Folio Cancelacion']}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-700">
                                                    {new Date(item.FechaCancelacion).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{item.Cantidad}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-800 leading-tight">{item.Descripcion}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{item['Codigo Barras']}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <div className="flex flex-col">
                                                        <span className="text-[12px] font-black text-slate-900">{formatCurrency(item.Total)}</span>
                                                        <span className="text-[9px] font-medium text-slate-400">@{formatCurrency(item['Precio Venta'])}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                                        <User size={12} className="text-slate-400" />
                                                        {item.Cajero}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-rose-700/80 font-black italic text-[11px]">
                                                    {item.Supervisor}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-12 text-center bg-white">
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron cancelaciones</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Registros</span>
                            <span className="text-sm font-black text-slate-900">{filteredDetails.length}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Monto Cancelado</span>
                            <span className="text-sm font-black text-rose-600">{formatCurrency(filteredDetails.reduce((acc, c) => acc + c.Total, 0))}</span>
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
