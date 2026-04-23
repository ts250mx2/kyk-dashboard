"use client";

import { useState, useEffect, useRef, memo } from 'react';
import {
    X, Search, FileSpreadsheet, Minimize2,
    Maximize2, User, Package, ChevronUp, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx-js-style';
import { LoadingScreen } from './ui/loading-screen';

interface DeptoDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    idDepto?: number;
    deptoName?: string;
    familia?: string;
    fechaInicio: string;
    fechaFin: string;
    idTienda?: string;
    storeName?: string;
}

function DeptoDetailModalComponent({
    isOpen,
    onClose,
    idDepto,
    deptoName,
    familia,
    fechaInicio,
    fechaFin,
    idTienda,
    storeName
}: DeptoDetailModalProps) {
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(isOpen);
    const [viewType, setViewType] = useState<'articulo' | 'familia'>('articulo');
    const prevParams = useRef<string>('');
    const [isMaximized, setIsMaximized] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'Total', direction: 'desc' });

    // Position Persistence
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isPositionLoaded, setIsPositionLoaded] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

    // Load saved position
    useEffect(() => {
        const saved = localStorage.getItem('kyk_depto_modal_position');
        if (saved) {
            try { setPosition(JSON.parse(saved)); } catch (e) { console.error("Error loading position:", e); }
        }
        setIsPositionLoaded(true);
    }, []);

    // Save position
    useEffect(() => {
        if (isPositionLoaded) {
            localStorage.setItem('kyk_depto_modal_position', JSON.stringify(position));
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
        const currentParams = JSON.stringify({ isOpen, idDepto, familia, idTienda, fechaInicio, fechaFin, viewType });

        if (isOpen) {
            if (prevParams.current !== currentParams) {
                setLoading(true);
                fetchDetails();
                prevParams.current = currentParams;
            }
        } else {
            setDetails([]);
            setSearchTerm('');
            setIsMaximized(false);
            setLoading(false);
            prevParams.current = '';
        }
    }, [isOpen, idDepto, familia, idTienda, fechaInicio, fechaFin, viewType]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            let url = `/api/dashboard/department-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&tipo=${viewType}`;
            if (idDepto) url += `&idDepto=${idDepto}`;
            if (familia) url += `&familia=${encodeURIComponent(familia)}`;
            if (idTienda && idTienda !== 'null') url += `&storeId=${idTienda}`;

            const res = await fetch(url);
            const json = await res.json();
            setDetails(Array.isArray(json) ? json : []);
        } catch (error) {
            console.error('Error fetching department details:', error);
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

    const filteredDetails = details.filter(i =>
        i.CodigoBarras?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.Descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.Familia?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedDetails = [...filteredDetails].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue = a[key];
        let bValue = b[key];
        if (typeof aValue === 'string') {
            return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
    });

    const exportToExcel = () => {
        if (sortedDetails.length === 0) return;

        // Header and Data rows
        const headers = ['Código', 'Descripción', 'Departamento', 'Familia', 'Ventas', '% Part.', 'Cantidad', 'Operaciones', 'Ticket Promedio'];
        const data = sortedDetails.map(i => {
            const isTop80 = (i.PorcentajeAcumulado - i.PorcentajeParticipacion) < 80;
            const color = isTop80 ? 'D1FAE5' : 'FEF3C7'; // emerald-100 : amber-100
            const textColor = isTop80 ? '065F46' : '92400E'; // emerald-800 : amber-800

            return [
                i.CodigoBarras,
                i.Descripcion,
                i.Departamento,
                i.Familia || 'SIN FAMILIA',
                i.Total,
                {
                    v: i.PorcentajeParticipacion / 100,
                    t: 'n',
                    z: '0.00%',
                    s: {
                        fill: { fgColor: { rgb: color } },
                        font: { color: { rgb: textColor }, bold: true },
                        alignment: { horizontal: 'right' }
                    }
                },
                Number(i.Cantidad || 0),
                i.Operaciones,
                i.TicketPromedio
            ];
        });

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

        // Apply styles to headers
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_col(C) + '1';
            if (!worksheet[address]) continue;
            worksheet[address].s = {
                fill: { fgColor: { rgb: "F8FAFC" } },
                font: { bold: true, color: { rgb: "64748B" }, sz: 10 },
                alignment: { horizontal: C === 0 || C === 1 || C === 2 || C === 3 ? 'left' : (C === 6 || C === 7 ? 'center' : 'right') }
            };
        }

        // Apply number formats to other columns
        for (let R = 1; R <= range.e.r; ++R) {
            // Ventas (Col 4)
            const salesAddr = XLSX.utils.encode_cell({ r: R, c: 4 });
            if (worksheet[salesAddr]) {
                worksheet[salesAddr].z = '"$"#,##0.00';
            }
            // Cantidad (Col 6)
            const qtyAddr = XLSX.utils.encode_cell({ r: R, c: 6 });
            if (worksheet[qtyAddr]) {
                worksheet[qtyAddr].z = '0.000';
            }
            // Ticket Promedio (Col 8)
            const avgAddr = XLSX.utils.encode_cell({ r: R, c: 8 });
            if (worksheet[avgAddr]) {
                worksheet[avgAddr].z = '"$"#,##0.00';
            }
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalle de Departamento');

        const wscols = [
            { wch: 20 }, { wch: 45 }, { wch: 20 }, { wch: 20 },
            { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
        ];
        worksheet['!cols'] = wscols;

        const fileName = `Participacion_${familia || deptoName || 'General'}_${storeName || 'Global'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const renderSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) return <ChevronDown size={12} className="opacity-0 ml-1" />;
        return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={12} className="ml-1 text-[#4050B4]" />;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[13000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div
                className={cn(
                    "bg-white shadow-2xl overflow-hidden flex flex-col transition-[width,height,transform] duration-300 border border-slate-200 rounded-none",
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
                            <Package size={18} className="text-[#4050B4]" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">
                                {familia ? `Detalle Familia: ${familia}` :
                                    idDepto ? `Detalle de Departamento: ${deptoName}` :
                                        'Análisis Participación'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                                {storeName || 'Resumen Global'} • {fechaInicio} a {fechaFin}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="hidden md:flex bg-slate-100 p-1 rounded-none border border-slate-200 mr-2">
                            <button
                                onClick={() => setViewType('articulo')}
                                className={cn(
                                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                    viewType === 'articulo' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                Productos
                            </button>
                            <button
                                onClick={() => setViewType('familia')}
                                className={cn(
                                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                    viewType === 'familia' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                Familias
                            </button>
                        </div>
                        <div className="relative mr-4 hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="BUSCAR CODIGO, DESCRIPCION..."
                                className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 w-64"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={exportToExcel}
                            disabled={sortedDetails.length === 0}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#4050B4]/5 text-[#4050B4] hover:bg-[#4050B4] hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-[#4050B4]/10 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
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
                    {(loading || (isOpen && details.length === 0)) ? (
                        <LoadingScreen message={`Consultando detalle de ${familia ? 'familia' : idDepto ? 'departamento' : 'artículos'}...`} />
                    ) : (
                        <div className="min-w-full inline-block align-middle">
                            <table className="min-w-full border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        {viewType === 'articulo' && (
                                            <>
                                                <th onClick={() => handleSort('CodigoBarras')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Código {renderSortIcon('CodigoBarras')}</div>
                                                </th>
                                                <th onClick={() => handleSort('Descripcion')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Descripción {renderSortIcon('Descripcion')}</div>
                                                </th>
                                            </>
                                        )}
                                        {(!idDepto && viewType === 'articulo') && (
                                            <th onClick={() => handleSort('Departamento')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center">Depto {renderSortIcon('Departamento')}</div>
                                            </th>
                                        )}
                                        <th onClick={() => handleSort('Familia')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">{viewType === 'familia' ? 'Familia de Producto' : 'Familia'} {renderSortIcon('Familia')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Total')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-end">Venta {renderSortIcon('Total')}</div>
                                        </th>
                                        <th onClick={() => handleSort('PorcentajeParticipacion')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors border-l border-slate-200">
                                            <div className="flex items-center justify-end">% Part. {renderSortIcon('PorcentajeParticipacion')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Cantidad')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-center">Cant {renderSortIcon('Cantidad')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Operaciones')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-center">Ops {renderSortIcon('Operaciones')}</div>
                                        </th>
                                        <th onClick={() => handleSort('TicketPromedio')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-end">Ticket Prom. {renderSortIcon('TicketPromedio')}</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedDetails.length > 0 ? (
                                        sortedDetails.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-[#4050B4]/5 transition-colors group/row">
                                                {viewType === 'articulo' && (
                                                    <>
                                                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-black text-[#4050B4]">{item.CodigoBarras}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-[11px] font-bold text-slate-700 leading-tight block truncate max-w-[300px]" title={item.Descripcion}>
                                                                {item.Descripcion}
                                                            </span>
                                                        </td>
                                                    </>
                                                )}
                                                {(!idDepto && viewType === 'articulo') && (
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] font-bold uppercase border border-slate-100">
                                                            {item.Departamento}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase">
                                                        {item.Familia || 'SIN FAMILIA'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[12px] font-black text-slate-900">
                                                    {formatCurrency(item.Total)}
                                                </td>
                                                <td className={cn(
                                                    "px-4 py-3 whitespace-nowrap text-right text-[11px] font-black border-l",
                                                    (item.PorcentajeAcumulado - item.PorcentajeParticipacion) < 80
                                                        ? "text-emerald-600 bg-emerald-50/30 border-emerald-50"
                                                        : "text-amber-600 bg-amber-50/30 border-amber-50"
                                                )}>
                                                    {item.PorcentajeParticipacion?.toFixed(2)}%
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-600">
                                                    {Number(item.Cantidad || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-600">
                                                    {item.Operaciones}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-bold text-slate-500 italic">
                                                    {formatCurrency(item.TicketPromedio)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : !loading ? (
                                        <tr>
                                            <td colSpan={10} className="px-4 py-12 text-center bg-white">
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron artículos</p>
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
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Artículos</span>
                            <span className="text-sm font-black text-slate-900">{filteredDetails.length}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Artículos (80%)</span>
                            <span className="text-sm font-black text-emerald-700">
                                {filteredDetails.filter(i => (i.PorcentajeAcumulado - i.PorcentajeParticipacion) < 80).length}
                            </span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-0.5">Artículos (20%)</span>
                            <span className="text-sm font-black text-amber-700">
                                {filteredDetails.filter(i => (i.PorcentajeAcumulado - i.PorcentajeParticipacion) >= 80).length}
                            </span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Venta Acumulada</span>
                            <span className="text-sm font-black text-[#4050B4]">{formatCurrency(filteredDetails.reduce((acc, i) => acc + i.Total, 0))}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Ops. Totales</span>
                            <span className="text-sm font-black text-slate-600">{filteredDetails.reduce((acc, i) => acc + i.Operaciones, 0)}</span>
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
export const DeptoDetailModal = memo(DeptoDetailModalComponent);
