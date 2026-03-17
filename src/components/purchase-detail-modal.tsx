"use client";

import { useState, useEffect, useRef, memo } from 'react';
import {
    X, ShoppingCart, Search, FileSpreadsheet, Minimize2,
    Maximize2, FileText, ChevronUp, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { LoadingScreen } from './ui/loading-screen';

import { ReceiptDetailModal } from './receipt-detail-modal';

interface PurchaseDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    metric: 'compras' | 'devoluciones' | 'transferenciasSalida' | 'transferenciasEntrada';
    storeId?: string | null;
    storeName?: string | null;
    fechaInicio?: string;
    fechaFin?: string;
}

function PurchaseDetailModalComponent({
    isOpen,
    onClose,
    metric,
    storeId,
    storeName,
    fechaInicio,
    fechaFin
}: PurchaseDetailModalProps) {
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'FechaRecibo', direction: 'desc' });

    // Receipt Modal State
    const [selectedFolio, setSelectedFolio] = useState<string | null>(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [selectedStoreForReceipt, setSelectedStoreForReceipt] = useState<string>('');
    const [selectedProviderForReceipt, setSelectedProviderForReceipt] = useState<string>('');

    // Position Persistence
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchDetails();
        } else {
            setSearchTerm('');
            setIsMaximized(false);
            setIsReceiptModalOpen(false);
            setSelectedFolio(null);
        }
    }, [isOpen, metric, storeId, fechaInicio, fechaFin]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (fechaInicio) params.append('startDate', fechaInicio);
            if (fechaFin) params.append('endDate', fechaFin);
            if (storeId) params.append('storeId', storeId);
            params.append('metric', metric);
            
            const res = await fetch(`/api/dashboard/purchases/details?${params.toString()}`);
            const json = await res.json();
            setDetails(json);
        } catch (error) {
            console.error('Error fetching purchase details:', error);
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

    const filteredData = details.filter(t =>
        (t.FolioRecibo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.Proveedor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.RFC || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.Tienda || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue = a[key];
        let bValue = b[key];
        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const exportToExcel = () => {
        if (sortedData.length === 0) return;
        const excelData = sortedData.map(t => ({
            'Sucursal': t.Tienda,
            'Folio': t.FolioRecibo,
            'Fecha': new Date(t.FechaRecibo).toLocaleString('es-MX'),
            'RFC': t.RFC,
            'Proveedor': t.Proveedor,
            'Id SAP': t.IdReciboSAP,
            'Numero Factura': t.Numero,
            'Total Factura': t.TotalRecibo || t.Total,
            'UUID': t.UUID
        }));
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalle');
        XLSX.writeFile(workbook, `Detalle_${metric}_${storeName || 'Global'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

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

    const renderSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) return <div className="w-4" />;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={14} className="ml-1 text-[#4050B4]" />;
    };

    const handleRowClick = (item: any) => {
        setSelectedFolio(item.FolioRecibo);
        setSelectedStoreForReceipt(item.Tienda);
        setSelectedProviderForReceipt(item.Proveedor);
        setIsReceiptModalOpen(true);
    };

    if (!isOpen) return null;

    const getTitle = () => {
        switch (metric) {
            case 'compras': return 'Detalle de Compras';
            case 'devoluciones': return 'Detalle de Devoluciones';
            case 'transferenciasSalida': return 'Detalle de Transferencias Salida';
            case 'transferenciasEntrada': return 'Detalle de Transferencias Entrada';
            default: return 'Detalle';
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={cn(
                    "bg-white shadow-2xl overflow-hidden flex flex-col transition-[width,height,transform] duration-300 border border-slate-200",
                    isMaximized ? "fixed inset-0 m-0" : "w-full max-w-7xl max-h-[90vh]"
                )}
                style={!isMaximized ? {
                    transform: `translate(${position.x}px, ${position.y}px)`,
                } : undefined}
            >
                {/* Header */}
                <div
                    onMouseDown={handleMouseDown}
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
                            <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">{getTitle()}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                                {storeName || 'TODAS LAS TIENDAS'} {fechaInicio ? `• ${fechaInicio} a ${fechaFin}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative mr-4 hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="BUSCAR FOLIO, PROVEEDOR..."
                                className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 w-64"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={exportToExcel}
                            disabled={sortedData.length === 0}
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


                {/* Content */}
                <div className="flex-1 overflow-auto bg-white p-0 relative">
                    {loading ? (
                        <LoadingScreen message="Obteniendo detalles..." />
                    ) : (
                        <div className="min-w-full inline-block align-middle">
                            <table className="min-w-full border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th onClick={() => handleSort('Tienda')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Sucursal {renderSortIcon('Tienda')}</div>
                                        </th>
                                        <th onClick={() => handleSort('FolioRecibo')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Folio {renderSortIcon('FolioRecibo')}</div>
                                        </th>
                                        <th onClick={() => handleSort('FechaRecibo')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Fecha {renderSortIcon('FechaRecibo')}</div>
                                        </th>
                                        <th onClick={() => handleSort('RFC')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">RFC {renderSortIcon('RFC')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Proveedor')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Proveedor {renderSortIcon('Proveedor')}</div>
                                        </th>
                                        <th onClick={() => handleSort('IdReciboSAP')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Id SAP {renderSortIcon('IdReciboSAP')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Numero')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">Num. Factura {renderSortIcon('Numero')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Total')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-end">Total {renderSortIcon('Total')}</div>
                                        </th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            UUID
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedData.length > 0 ? (
                                        sortedData.map((item, idx) => (
                                            <tr 
                                                key={idx} 
                                                onClick={() => handleRowClick(item)}
                                                title="CLIC PARA VER DETALLE DE RECIBO"
                                                className="hover:bg-indigo-50 transition-colors group/row cursor-pointer"
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-700">{item.Tienda}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <FileText size={14} className="text-slate-400 group-hover/row:text-[#4050B4] transition-colors" />
                                                        <span className="text-[11px] font-black text-slate-900 group-hover/row:text-[#4050B4] transition-colors underline decoration-dotted underline-offset-4">{item.FolioRecibo}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-600">
                                                    {new Date(item.FechaRecibo).toLocaleDateString('es-MX')}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-500">{item.RFC}</td>
                                                <td className="px-4 py-3 text-[11px] font-black text-slate-700">{item.Proveedor}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-600">{item.IdReciboSAP}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-600">{item.Numero}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <span className="text-[12px] font-black text-[#4050B4]">{formatCurrency(item.TotalRecibo || item.Total)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-[9px] font-mono text-slate-400 max-w-[150px] truncate" title={item.UUID}>
                                                    {item.UUID}
                                                </td>
                                            </tr>
                                        ))
                                    ) : !loading ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-12 text-center">
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron registros</p>
                                            </td>
                                        </tr>
                                    ) : null}
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
                            <span className="text-sm font-black text-slate-900">{filteredData.length}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Monto Total</span>
                            <span className="text-sm font-black text-[#4050B4]">{formatCurrency(filteredData.reduce((acc, t) => acc + (t.TotalRecibo || t.Total || 0), 0))}</span>
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

            <ReceiptDetailModal 
                isOpen={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                folioRecibo={selectedFolio}
                storeName={selectedStoreForReceipt}
                providerName={selectedProviderForReceipt}
            />
        </div>
    );
}

export const PurchaseDetailModal = memo(PurchaseDetailModalComponent);
