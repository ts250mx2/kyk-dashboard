"use client";

import { useState, useEffect, useRef, memo } from 'react';
import {
    X, Search, FileSpreadsheet, Minimize2,
    Maximize2, PieChart as PieChartIcon, Package, LayoutGrid, TrendingUp, ShoppingCart, Ticket, ChevronUp, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx-js-style';
import { LoadingScreen } from './ui/loading-screen';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';

interface GroupDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    idGrupoDepto?: number;
    grupoName?: string;
    fechaInicio: string;
    fechaFin: string;
    idTienda?: string | null;
    storeName?: string | null;
    onDeptoClick?: (idDepto: number, deptoName: string) => void;
}

function GroupDetailModalComponent({
    isOpen,
    onClose,
    idGrupoDepto,
    grupoName,
    fechaInicio,
    fechaFin,
    idTienda,
    storeName,
    onDeptoClick
}: GroupDetailModalProps) {
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(isOpen);
    const [chartType, setChartType] = useState<'bar' | 'pie'>('pie');
    const prevParams = useRef<string>('');
    const [isMaximized, setIsMaximized] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'Total', direction: 'desc' });

    // Position Persistence
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

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
        const currentParams = JSON.stringify({ isOpen, idGrupoDepto, idTienda, fechaInicio, fechaFin });

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
    }, [isOpen, idGrupoDepto, idTienda, fechaInicio, fechaFin]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            let url = `/api/dashboard/ventas-desglose?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&tipo=departamento&idGrupoDepto=${idGrupoDepto}`;
            if (idTienda && idTienda !== 'null' && idTienda !== 'undefined') url += `&storeId=${idTienda}`;

            const res = await fetch(url);
            const json = await res.json();
            setDetails(Array.isArray(json.data) ? json.data : []);
        } catch (error) {
            console.error('Error fetching group details:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const COLORS = ['#4050B4', '#10b981', '#f59e0b', '#e11d48', '#8b5cf6', '#06b6d4', '#ec4899', '#78350f'];

    const filteredDetails = details.filter(i =>
        i.Departamento?.toLowerCase().includes(searchTerm.toLowerCase())
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

    const totalVenta = details.reduce((acc, i) => acc + i.Total, 0);
    const totalOps = details.reduce((acc, i) => acc + i.Operaciones, 0);
    const avgTicket = totalOps > 0 ? totalVenta / totalOps : 0;

    const exportToExcel = () => {
        if (sortedDetails.length === 0) return;

        const headers = ['Departamento', 'Ventas', 'Operaciones', 'Ticket Promedio'];
        const data = sortedDetails.map(i => [
            i.Departamento,
            i.Total,
            i.Operaciones,
            i.TicketPromedio
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalle de Grupo');

        const fileName = `Detalle_Grupo_${grupoName}_${storeName || 'Global'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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
                            <LayoutGrid size={18} className="text-[#4050B4]" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">
                                Grupo: {grupoName}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                                {storeName || 'Resumen Global'} • Periodo: {fechaInicio} al {fechaFin}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="hidden md:flex bg-slate-100 p-1 rounded-none border border-slate-200 mr-2">
                            <button
                                onClick={() => setChartType('bar')}
                                className={cn(
                                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                    chartType === 'bar' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                Barras
                            </button>
                            <button
                                onClick={() => setChartType('pie')}
                                className={cn(
                                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                    chartType === 'pie' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                Pastel
                            </button>
                        </div>
                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#4050B4]/5 text-[#4050B4] hover:bg-[#4050B4] hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-[#4050B4]/10 mr-2"
                        >
                            <FileSpreadsheet size={14} />
                            <span>Exportar</span>
                        </button>
                        <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 hover:bg-slate-50 text-slate-500 transition-colors">
                            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-rose-50 text-rose-500 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-slate-50/50 relative p-6">
                    {loading ? (
                        <LoadingScreen message="Consultando departamentos del grupo..." />
                    ) : (
                        <div className="space-y-6">
                            {/* Metric Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 border border-slate-100 shadow-sm relative overflow-hidden group">
                                    <TrendingUp className="absolute -right-4 -bottom-4 text-emerald-500/10 w-24 h-24 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Venta Total Grupo</span>
                                    <h4 className="text-2xl font-black text-slate-900">{formatCurrency(totalVenta)}</h4>
                                </div>
                                <div className="bg-white p-4 border border-slate-100 shadow-sm relative overflow-hidden group">
                                    <ShoppingCart className="absolute -right-4 -bottom-4 text-blue-500/10 w-24 h-24 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Operaciones</span>
                                    <h4 className="text-2xl font-black text-slate-900">{totalOps.toLocaleString()}</h4>
                                </div>
                                <div className="bg-white p-4 border border-slate-100 shadow-sm relative overflow-hidden group">
                                    <Ticket className="absolute -right-4 -bottom-4 text-amber-500/10 w-24 h-24 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ticket Promedio</span>
                                    <h4 className="text-2xl font-black text-emerald-600">{formatCurrency(avgTicket)}</h4>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Chart Section */}
                                <div className="bg-white p-5 border border-slate-100 shadow-sm h-[400px] flex flex-col">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Distribución por Depto</h4>
                                    </div>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            {chartType === 'bar' ? (
                                                <BarChart 
                                                    data={details}
                                                    onClick={(data) => {
                                                        if (data && data.activePayload && data.activePayload[0] && onDeptoClick) {
                                                            const p = data.activePayload[0].payload;
                                                            onDeptoClick(p.IdDepto, p.Departamento);
                                                        }
                                                    }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="Departamento" hide />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} />
                                                    <Tooltip
                                                        content={({ active, payload }) => {
                                                            if (active && payload?.length) {
                                                                const percent = totalVenta > 0 ? (payload[0].value as number / totalVenta * 100).toFixed(1) : 0;
                                                                return (
                                                                    <div className="bg-slate-900 text-white p-2 text-[10px] border border-white/10 shadow-2xl">
                                                                        <p className="font-black border-b border-white/10 pb-1 mb-1 uppercase">{payload[0].payload.Departamento}</p>
                                                                        <p className="flex justify-between gap-4"><span>Venta:</span> <span className="font-black text-emerald-400">{formatCurrency(payload[0].value as number)}</span></p>
                                                                        <p className="flex justify-between gap-4"><span>Participación:</span> <span className="font-black text-blue-400">{percent}%</span></p>
                                                                        <p className="flex justify-between gap-4"><span>Ops:</span> <span className="font-black">{payload[0].payload.Operaciones}</span></p>
                                                                        <p className="mt-1 text-[8px] text-white/40 italic">CLIC PARA DETALLE</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar dataKey="Total" radius={[2, 2, 0, 0]} barSize={30} className="cursor-pointer">
                                                        {details.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            ) : (
                                                <PieChart>
                                                    <Pie
                                                        data={details}
                                                        dataKey="Total"
                                                        nameKey="Departamento"
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={100}
                                                        stroke="none"
                                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                                        labelLine={false}
                                                        onClick={(data) => {
                                                            if (data && data.payload && onDeptoClick) {
                                                                onDeptoClick(data.payload.IdDepto, data.payload.Departamento);
                                                            }
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        {details.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        content={({ active, payload }) => {
                                                            if (active && payload?.length) {
                                                                const percent = totalVenta > 0 ? (payload[0].value as number / totalVenta * 100).toFixed(1) : 0;
                                                                return (
                                                                    <div className="bg-slate-900 text-white p-2 text-[10px] border border-white/10 shadow-2xl">
                                                                        <p className="font-black border-b border-white/10 pb-1 mb-1 uppercase">{payload[0].name}</p>
                                                                        <p className="flex justify-between gap-4"><span>Venta:</span> <span className="font-black text-emerald-400">{formatCurrency(payload[0].value as number)}</span></p>
                                                                        <p className="flex justify-between gap-4"><span>Participación:</span> <span className="font-black text-blue-400">{percent}%</span></p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Legend />
                                                </PieChart>
                                            )}
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Table Section */}
                                <div className="bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                                    <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                placeholder="BUSCAR..."
                                                className="bg-white border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase w-48 outline-none focus:ring-1 focus:ring-[#4050B4]"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white sticky top-0 border-b border-slate-100">
                                                    <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase">Departamento</th>
                                                    <th className="px-4 py-2 text-right text-[10px] font-black text-slate-500 uppercase">Venta</th>
                                                    <th className="px-4 py-2 text-right text-[10px] font-black text-slate-500 uppercase">%</th>
                                                    <th className="px-4 py-2 text-right text-[10px] font-black text-slate-500 uppercase">Ops</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {sortedDetails.map((item, idx) => (
                                                    <tr 
                                                        key={idx} 
                                                        className="hover:bg-[#4050B4]/5 transition-colors cursor-pointer group"
                                                        onClick={() => onDeptoClick?.(item.IdDepto, item.Departamento)}
                                                    >
                                                        <td className="px-4 py-2.5 text-[11px] font-bold text-slate-700 group-hover:text-[#4050B4]">
                                                            {item.Departamento}
                                                            <span className="ml-2 opacity-0 group-hover:opacity-100 text-[8px] font-black uppercase text-[#4050B4]/40 transition-opacity whitespace-nowrap">Ver Detalle</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-[11px] font-black text-slate-900">{formatCurrency(item.Total)}</td>
                                                        <td className="px-4 py-2.5 text-right text-[11px] font-bold text-blue-600">
                                                            {totalVenta > 0 ? (item.Total / totalVenta * 100).toFixed(1) : 0}%
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-[11px] font-bold text-slate-500">{item.Operaciones}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 flex justify-end bg-white">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

export const GroupDetailModal = memo(GroupDetailModalComponent);
