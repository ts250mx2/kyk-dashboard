"use client";

import { useState, useEffect, useRef } from 'react';
import {
    X, Search, FileSpreadsheet, Minimize2,
    Maximize2, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Percent,
    Bot, Sparkles, Cpu, Brain, Download, Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import { LoadingScreen } from './ui/loading-screen';
import { ModelPicker } from '@/components/model-picker';
import { getStoredModel } from '@/lib/chat-models';

interface ParetoAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    fechaInicio: string;
    fechaFin: string;
    idTienda?: string;
    storeName?: string;
}

export function ParetoAnalysisModal({
    isOpen,
    onClose,
    fechaInicio,
    fechaFin,
    idTienda,
    storeName
}: ParetoAnalysisModalProps) {
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [groupBy, setGroupBy] = useState<'articulo' | 'departamento' | 'familia' | 'sucursal'>('articulo');
    const [compareWith, setCompareWith] = useState<'periodo' | 'anio'>('periodo');
    const [trendFilter, setTrendFilter] = useState<'todos' | 'suben' | 'bajan' | 'nuevos'>('todos');
    const [comparePeriod, setComparePeriod] = useState<{ fechaInicio: string; fechaFin: string } | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'TotalItemVenta', direction: 'desc' });

    // Position Persistence
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isPositionLoaded, setIsPositionLoaded] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

    // Load saved position
    useEffect(() => {
        const saved = localStorage.getItem('kyk_pareto_modal_position');
        if (saved) {
            try { setPosition(JSON.parse(saved)); } catch (e) { console.error("Error loading position:", e); }
        }
        setIsPositionLoaded(true);
    }, []);

    // Save position
    useEffect(() => {
        if (isPositionLoaded) {
            localStorage.setItem('kyk_pareto_modal_position', JSON.stringify(position));
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
            fetchPareto();
        } else {
            setDetails([]);
            setSearchTerm('');
            setTrendFilter('todos');
            setComparePeriod(null);
            setIsMaximized(false);
        }
    }, [isOpen, idTienda, fechaInicio, fechaFin, groupBy, compareWith]);

    const fetchPareto = async () => {
        setLoading(true);
        try {
            let url = `/api/dashboard/pareto-analysis?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&groupBy=${groupBy}&compareWith=${compareWith}`;
            if (idTienda && idTienda !== 'null' && idTienda !== 'undefined') url += `&storeId=${idTienda}`;

            const res = await fetch(url);
            const json = await res.json();
            if (Array.isArray(json)) {
                setDetails(json);
                setComparePeriod(null);
            } else {
                setDetails(Array.isArray(json?.rows) ? json.rows : []);
                setComparePeriod(json?.compare ?? null);
            }
        } catch (error) {
            console.error('Error fetching Pareto analysis:', error);
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

    const matchesSearch = (i: any) =>
        (groupBy === 'articulo' ? i.CodigoBarras?.toLowerCase().includes(searchTerm.toLowerCase()) : false) ||
        i.Descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (groupBy === 'articulo' ? i.Familia?.toLowerCase().includes(searchTerm.toLowerCase()) : false);

    const matchesTrend = (i: any) => {
        if (trendFilter === 'suben') return !i.EsNuevo && (i.VariacionImporte ?? 0) > 0;
        if (trendFilter === 'bajan') return (i.VariacionImporte ?? 0) < 0;
        if (trendFilter === 'nuevos') return i.EsNuevo === 1;
        return true;
    };

    const filteredDetails = details.filter(i => matchesSearch(i) && matchesTrend(i));

    const top80Items = details.filter(i => i.CumulativePercentage <= 80 || (i.CumulativePercentage - i.IndividualPercentage < 80));
    const rest20Items = details.filter(i => !top80Items.includes(i));

    // Estadísticas de incrementos / decrementos vs periodo de comparación
    const incItems = details.filter(i => !i.EsNuevo && (i.VariacionImporte ?? 0) > 0);
    const decItems = details.filter(i => (i.VariacionImporte ?? 0) < 0);
    const newItems = details.filter(i => i.EsNuevo === 1);
    const incTotal = incItems.reduce((acc, i) => acc + (i.VariacionImporte ?? 0), 0);
    const decTotal = decItems.reduce((acc, i) => acc + (i.VariacionImporte ?? 0), 0);
    const totalActual = details.reduce((acc, i) => acc + (i.TotalItemVenta ?? 0), 0);
    const totalAnterior = details.reduce((acc, i) => acc + (i.VentaAnterior ?? 0), 0);
    const netVar = totalActual - totalAnterior;
    const netVarPct = totalAnterior > 0 ? (netVar / totalAnterior) * 100 : null;

    const unitLabel = groupBy === 'articulo' ? 'Items' : groupBy === 'departamento' ? 'Deptos' : groupBy === 'familia' ? 'Familias' : 'Sucursales';

    // AI Summary State
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiModel, setAiModel] = useState(getStoredModel());

    const handleAISummary = async (useModel?: string) => {
        // Si no se pasa modelo (abrir), hereda el elegido en el chat.
        const m = useModel ?? getStoredModel();
        setAiModel(m);
        setAiLoading(true);
        setIsAIModalOpen(true);
        setAiSummary(null);
        try {
            const res = await fetch(`/api/dashboard/pareto-analysis/summary?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&storeId=${idTienda || ''}&storeName=${storeName || 'Global'}&model=${encodeURIComponent(m)}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setAiSummary(data.summary);
        } catch (error) {
            console.error('Error fetching AI summary:', error);
            setAiSummary("Ocurrió un error al generar el análisis táctico. Por favor, intenta de nuevo.");
        } finally {
            setAiLoading(false);
        }
    };

    /** Cambia el modelo solo para este análisis y lo regenera. */
    const handleAiModelChange = (m: string) => {
        setAiModel(m);
        handleAISummary(m);
    };

    const exportToPDF = () => {
        if (!aiSummary) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let y = 20;

        // Title
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(64, 80, 180); // Indigo 600
        doc.text("Analista Digital KYK", margin, y);
        y += 8;

        doc.setFontSize(14);
        doc.setTextColor(33, 33, 33);
        doc.text("Informe Táctico de Participación y Tendencias", margin, y);
        y += 12;

        // Metadata Header Box
        doc.setFillColor(245, 247, 250);
        doc.rect(margin, y - 5, pageWidth - (margin * 2), 25, 'F');

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("SUCURSAL:", margin + 5, y + 5);
        doc.setFont("helvetica", "normal");
        doc.text(storeName || "Global / Todas las Tiendas", margin + 35, y + 5);

        doc.setFont("helvetica", "bold");
        doc.text("PERIODO:", margin + 5, y + 12);
        doc.setFont("helvetica", "normal");
        doc.text(`${fechaInicio} al ${fechaFin}`, margin + 35, y + 12);
        y += 30;

        // Content
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);

        const contentLines = aiSummary.split('\n');

        contentLines.forEach((line) => {
            if (y > 275) {
                doc.addPage();
                y = 20;
            }

            const cleanLine = line.replace(/^\s*[\*\#]+\s*/, '').replace(/\*\*/g, '');

            if (line.startsWith('#') || line.includes('**')) {
                doc.setFont("helvetica", "bold");
            } else {
                doc.setFont("helvetica", "normal");
            }

            const splitLines = doc.splitTextToSize(line.startsWith('-') ? line : line, pageWidth - (margin * 2));

            splitLines.forEach((sLine: string) => {
                if (y > 275) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(sLine, margin, y);
                y += 6;
            });

            if (line.trim() === '') y += 2;
        });

        // Footer
        const finalY = doc.internal.pageSize.getHeight() - 15;
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150);
        doc.text("Generado automáticamente por KYK Analista Digital IA", margin, finalY);
        doc.text(new Date().toLocaleString(), pageWidth - margin - 40, finalY);

        doc.save(`Analisis_Participacion_${storeName || 'Global'}_${fechaInicio}.pdf`);
    };

    const sortedDetails = [...filteredDetails].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        const aValue = a[key];
        const bValue = b[key];
        if (typeof aValue === 'string' || typeof bValue === 'string') {
            const aStr = String(aValue ?? '');
            const bStr = String(bValue ?? '');
            return direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        }
        // Los nulos (ej. Var % de items nuevos) siempre van al final
        const aNum = aValue ?? -Infinity;
        const bNum = bValue ?? -Infinity;
        return direction === 'asc' ? aNum - bNum : bNum - aNum;
    });

    const exportToExcel = () => {
        if (sortedDetails.length === 0) return;

        // Header and Data rows
        const dimensionHeader = groupBy === 'departamento' ? 'Departamento' : groupBy === 'familia' ? 'Familia' : 'Sucursal';
        const headers = groupBy === 'articulo'
            ? ['Código', 'Descripción', 'Familia', 'Ventas', 'Venta Anterior', 'Var $', 'Var %', '% Indiv', '% Acum', 'Cantidad', 'Operaciones']
            : [dimensionHeader, 'Ventas', 'Venta Anterior', 'Var $', 'Var %', '% Indiv', '% Acum', 'Cantidad', 'Operaciones'];

        const data = sortedDetails.map(i => {
            const isTop80 = i.CumulativePercentage <= 80 || (i.CumulativePercentage - i.IndividualPercentage < 80);
            const color = isTop80 ? 'D1FAE5' : 'FEF3C7'; // emerald-100 : amber-100
            const textColor = isTop80 ? '065F46' : '92400E'; // emerald-800 : amber-800

            const indivPctCell = {
                v: i.IndividualPercentage / 100,
                t: 'n',
                z: '0.00%',
                s: {
                    fill: { fgColor: { rgb: color } },
                    font: { color: { rgb: textColor }, bold: true },
                    alignment: { horizontal: 'right' }
                }
            };

            const accumPctCell = {
                v: i.CumulativePercentage / 100,
                t: 'n',
                z: '0.00%',
                s: {
                    font: { color: { rgb: "94A3B8" } },
                    alignment: { horizontal: 'right' }
                }
            };

            const salesCell = {
                v: i.TotalItemVenta,
                t: 'n',
                z: '"$"#,##0.00',
                s: { alignment: { horizontal: 'right' } }
            };

            const variacion = i.VariacionImporte ?? 0;
            const varColor = i.EsNuevo ? '4F46E5' : variacion > 0 ? '059669' : variacion < 0 ? 'E11D48' : '94A3B8';

            const prevSalesCell = {
                v: i.VentaAnterior ?? 0,
                t: 'n',
                z: '"$"#,##0.00',
                s: { font: { color: { rgb: '94A3B8' } }, alignment: { horizontal: 'right' } }
            };

            const varCell = {
                v: variacion,
                t: 'n',
                z: '"$"#,##0.00',
                s: { font: { color: { rgb: varColor }, bold: true }, alignment: { horizontal: 'right' } }
            };

            const varPctCell = i.EsNuevo
                ? { v: 'NUEVO', t: 's', s: { font: { color: { rgb: '4F46E5' }, bold: true }, alignment: { horizontal: 'right' } } }
                : (i.VariacionPct !== null && i.VariacionPct !== undefined)
                    ? {
                        v: i.VariacionPct / 100,
                        t: 'n',
                        z: '0.0%',
                        s: { font: { color: { rgb: varColor }, bold: true }, alignment: { horizontal: 'right' } }
                    }
                    : { v: '', t: 's' };

            if (groupBy === 'articulo') {
                return [
                    i.CodigoBarras,
                    i.Descripcion,
                    i.Familia || 'SIN FAMILIA',
                    salesCell,
                    prevSalesCell,
                    varCell,
                    varPctCell,
                    indivPctCell,
                    accumPctCell,
                    i.CantidadVendida,
                    i.Operaciones
                ];
            } else {
                return [
                    i.Descripcion,
                    salesCell,
                    prevSalesCell,
                    varCell,
                    varPctCell,
                    indivPctCell,
                    accumPctCell,
                    i.CantidadVendida,
                    i.Operaciones
                ];
            }
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
                alignment: { horizontal: 'center' }
            };
            if (C === 0 || (groupBy === 'articulo' && (C === 1 || C === 2))) {
                worksheet[address].s.alignment.horizontal = 'left';
            }
        }

        const wscols = groupBy === 'articulo'
            ? [{ wch: 15 }, { wch: 45 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
            : [{ wch: 45 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Participación ${groupBy === 'articulo' ? '80-20' : groupBy === 'departamento' ? 'Deptos' : groupBy === 'familia' ? 'Familias' : 'Sucursales'}`);

        const fileName = `Participacion_${groupBy}_${storeName || 'Global'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const renderSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) return <ChevronDown size={12} className="opacity-0 ml-1" />;
        return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={12} className="ml-1 text-[#4050B4]" />;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[13000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                            <TrendingUp size={18} className="text-[#4050B4]" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Análisis Participación</h3>
                            <div className="flex items-center gap-4">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">
                                    {storeName || 'Resumen Global'} • {fechaInicio} a {fechaFin}
                                </p>
                                <div className="flex items-center bg-slate-100 p-0.5 rounded-none border border-slate-200">
                                    {[
                                        { id: 'articulo', label: 'Artículos' },
                                        { id: 'departamento', label: 'Deptos' },
                                        { id: 'familia', label: 'Familias' },
                                        { id: 'sucursal', label: 'Sucursales' }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setGroupBy(tab.id as any)}
                                            className={cn(
                                                "px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter transition-all rounded-none",
                                                groupBy === tab.id
                                                    ? "bg-white text-[#4050B4] shadow-sm ring-1 ring-black/5"
                                                    : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                            onClick={() => handleAISummary()}
                            disabled={loading || details.length === 0}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest border border-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed mr-2 shadow-lg shadow-indigo-200"
                        >
                            <Brain size={14} />
                            <span>Resumen IA</span>
                        </button>
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

                {/* Barra Incrementos / Decrementos */}
                {!loading && details.length > 0 && (
                    <div className="flex items-stretch justify-between gap-3 px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 shrink-0 overflow-x-auto">
                        <div className="flex items-stretch gap-2">
                            <div className={cn(
                                "flex flex-col justify-center px-3 py-1.5 border rounded-none min-w-[130px]",
                                netVar >= 0 ? "bg-white border-emerald-200" : "bg-white border-rose-200"
                            )}>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    {netVar >= 0 ? <TrendingUp size={10} className="text-emerald-500" /> : <TrendingDown size={10} className="text-rose-500" />}
                                    Variación Neta
                                </span>
                                <span className={cn("text-xs font-black", netVar >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                    {netVar >= 0 ? '+' : ''}{formatCurrency(netVar)}
                                    {netVarPct !== null && (
                                        <span className="text-[9px] font-bold ml-1 opacity-70">({netVarPct >= 0 ? '+' : ''}{netVarPct.toFixed(1)}%)</span>
                                    )}
                                </span>
                            </div>
                            <button
                                onClick={() => setTrendFilter(trendFilter === 'suben' ? 'todos' : 'suben')}
                                className={cn(
                                    "flex flex-col items-start justify-center px-3 py-1.5 border rounded-none min-w-[120px] transition-all text-left",
                                    trendFilter === 'suben'
                                        ? "bg-emerald-600 border-emerald-700 text-white shadow-lg shadow-emerald-200"
                                        : "bg-white border-slate-200 hover:border-emerald-400"
                                )}
                            >
                                <span className={cn("text-[8px] font-black uppercase tracking-widest flex items-center gap-1", trendFilter === 'suben' ? "text-emerald-100" : "text-slate-400")}>
                                    <TrendingUp size={10} className={trendFilter === 'suben' ? "text-white" : "text-emerald-500"} /> Incrementos
                                </span>
                                <span className={cn("text-xs font-black", trendFilter === 'suben' ? "text-white" : "text-emerald-600")}>
                                    {incItems.length} <span className="text-[9px] font-bold opacity-70">· +{formatCurrency(incTotal)}</span>
                                </span>
                            </button>
                            <button
                                onClick={() => setTrendFilter(trendFilter === 'bajan' ? 'todos' : 'bajan')}
                                className={cn(
                                    "flex flex-col items-start justify-center px-3 py-1.5 border rounded-none min-w-[120px] transition-all text-left",
                                    trendFilter === 'bajan'
                                        ? "bg-rose-600 border-rose-700 text-white shadow-lg shadow-rose-200"
                                        : "bg-white border-slate-200 hover:border-rose-400"
                                )}
                            >
                                <span className={cn("text-[8px] font-black uppercase tracking-widest flex items-center gap-1", trendFilter === 'bajan' ? "text-rose-100" : "text-slate-400")}>
                                    <TrendingDown size={10} className={trendFilter === 'bajan' ? "text-white" : "text-rose-500"} /> Decrementos
                                </span>
                                <span className={cn("text-xs font-black", trendFilter === 'bajan' ? "text-white" : "text-rose-600")}>
                                    {decItems.length} <span className="text-[9px] font-bold opacity-70">· {formatCurrency(decTotal)}</span>
                                </span>
                            </button>
                            <button
                                onClick={() => setTrendFilter(trendFilter === 'nuevos' ? 'todos' : 'nuevos')}
                                className={cn(
                                    "flex flex-col items-start justify-center px-3 py-1.5 border rounded-none min-w-[90px] transition-all text-left",
                                    trendFilter === 'nuevos'
                                        ? "bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-200"
                                        : "bg-white border-slate-200 hover:border-indigo-400"
                                )}
                            >
                                <span className={cn("text-[8px] font-black uppercase tracking-widest flex items-center gap-1", trendFilter === 'nuevos' ? "text-indigo-100" : "text-slate-400")}>
                                    <Sparkles size={10} className={trendFilter === 'nuevos' ? "text-white" : "text-indigo-500"} /> Nuevos
                                </span>
                                <span className={cn("text-xs font-black", trendFilter === 'nuevos' ? "text-white" : "text-indigo-600")}>
                                    {newItems.length} <span className="text-[9px] font-bold opacity-70">{unitLabel}</span>
                                </span>
                            </button>
                        </div>
                        <div className="flex flex-col items-end justify-center gap-1 shrink-0">
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-none border border-slate-200">
                                {[
                                    { id: 'periodo', label: 'VS Periodo Ant.' },
                                    { id: 'anio', label: 'VS Año Ant.' }
                                ].map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => setCompareWith(mode.id as 'periodo' | 'anio')}
                                        className={cn(
                                            "px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter transition-all rounded-none",
                                            compareWith === mode.id
                                                ? "bg-white text-[#4050B4] shadow-sm ring-1 ring-black/5"
                                                : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                            {comparePeriod && (
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                    Comparado: {comparePeriod.fechaInicio} a {comparePeriod.fechaFin}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto bg-white relative">
                    {loading ? (
                        <LoadingScreen message="Analizando datos participacion..." />
                    ) : (
                        <div className="min-w-full inline-block align-middle">
                            <table className="min-w-full border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        {groupBy === 'articulo' && (
                                            <th onClick={() => handleSort('CodigoBarras')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center">Código {renderSortIcon('CodigoBarras')}</div>
                                            </th>
                                        )}
                                        <th onClick={() => handleSort('Descripcion')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center">{groupBy === 'articulo' ? 'Descripción' : groupBy === 'departamento' ? 'Departamento' : groupBy === 'familia' ? 'Familia' : 'Sucursal'} {renderSortIcon('Descripcion')}</div>
                                        </th>
                                        <th onClick={() => handleSort('TotalItemVenta')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-end">Ventas {renderSortIcon('TotalItemVenta')}</div>
                                        </th>
                                        <th onClick={() => handleSort('VentaAnterior')} className="hidden xl:table-cell px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors border-l border-slate-100">
                                            <div className="flex items-center justify-end">V. Anterior {renderSortIcon('VentaAnterior')}</div>
                                        </th>
                                        <th onClick={() => handleSort('VariacionImporte')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors border-l border-slate-100">
                                            <div className="flex items-center justify-end">Var $ {renderSortIcon('VariacionImporte')}</div>
                                        </th>
                                        <th onClick={() => handleSort('VariacionPct')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-end">Var % {renderSortIcon('VariacionPct')}</div>
                                        </th>
                                        <th onClick={() => handleSort('IndividualPercentage')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors border-l border-slate-100">
                                            <div className="flex items-center justify-end">% Indiv {renderSortIcon('IndividualPercentage')}</div>
                                        </th>
                                        <th onClick={() => handleSort('CumulativePercentage')} className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors border-l border-slate-100">
                                            <div className="flex items-center justify-end">% Acum {renderSortIcon('CumulativePercentage')}</div>
                                        </th>
                                        <th onClick={() => handleSort('Operaciones')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center justify-center">Ops {renderSortIcon('Operaciones')}</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedDetails.length > 0 ? (
                                        sortedDetails.map((item, idx) => (
                                            <tr key={idx} className={cn(
                                                "hover:bg-[#4050B4]/5 transition-colors group/row",
                                                (item.CumulativePercentage <= 80 || (item.CumulativePercentage - item.IndividualPercentage < 80)) ? "bg-white" : "bg-slate-50/30"
                                            )}>
                                                {groupBy === 'articulo' && (
                                                    <td className="px-4 py-3 whitespace-nowrap text-[11px] font-black text-[#4050B4]">{item.CodigoBarras}</td>
                                                )}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-bold text-slate-700 leading-tight block truncate max-w-[250px]" title={item.Descripcion}>
                                                                {item.Descripcion}
                                                            </span>
                                                            {(item.CumulativePercentage <= 80 || (item.CumulativePercentage - item.IndividualPercentage < 80)) && (
                                                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded-none uppercase tracking-tighter">Top 80%</span>
                                                            )}
                                                        </div>
                                                        {groupBy === 'articulo' && (
                                                            <span className="text-[9px] font-black text-slate-400 uppercase">{item.Familia || 'SIN FAMILIA'}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[12px] font-black text-slate-900">
                                                    {formatCurrency(item.TotalItemVenta)}
                                                </td>
                                                <td className="hidden xl:table-cell px-4 py-3 whitespace-nowrap text-right text-[11px] font-bold text-slate-400 border-l border-slate-100/50">
                                                    {formatCurrency(item.VentaAnterior ?? 0)}
                                                </td>
                                                <td className={cn(
                                                    "px-4 py-3 whitespace-nowrap text-right text-[11px] font-black border-l border-slate-100/50",
                                                    item.EsNuevo ? "text-indigo-600" : (item.VariacionImporte ?? 0) > 0 ? "text-emerald-600" : (item.VariacionImporte ?? 0) < 0 ? "text-rose-600" : "text-slate-400"
                                                )}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {item.EsNuevo ? (
                                                            <Sparkles size={11} />
                                                        ) : (item.VariacionImporte ?? 0) > 0 ? (
                                                            <TrendingUp size={11} />
                                                        ) : (item.VariacionImporte ?? 0) < 0 ? (
                                                            <TrendingDown size={11} />
                                                        ) : (
                                                            <Minus size={11} />
                                                        )}
                                                        {(item.VariacionImporte ?? 0) > 0 ? '+' : ''}{formatCurrency(item.VariacionImporte ?? 0)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-black">
                                                    {item.EsNuevo ? (
                                                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-black rounded-none uppercase tracking-tighter">Nuevo</span>
                                                    ) : item.VariacionPct !== null && item.VariacionPct !== undefined ? (
                                                        <span className={cn(
                                                            item.VariacionPct > 0 ? "text-emerald-600" : item.VariacionPct < 0 ? "text-rose-600" : "text-slate-400"
                                                        )}>
                                                            {item.VariacionPct > 0 ? '+' : ''}{Number(item.VariacionPct).toFixed(1)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className={cn(
                                                    "px-4 py-3 whitespace-nowrap text-right text-[12px] font-black border-l transition-colors",
                                                    (item.CumulativePercentage <= 80 || (item.CumulativePercentage - item.IndividualPercentage < 80))
                                                        ? "text-emerald-600 bg-emerald-50/30 border-emerald-100/50"
                                                        : "text-amber-600 bg-amber-50/30 border-amber-100/50"
                                                )}>
                                                    {item.IndividualPercentage.toFixed(2)}%
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-bold text-slate-400 border-l border-slate-100/50">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden hidden md:block">
                                                            <div
                                                                className="h-full bg-slate-300"
                                                                style={{ width: `${item.CumulativePercentage}%` }}
                                                            />
                                                        </div>
                                                        {item.CumulativePercentage.toFixed(2)}%
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-600">
                                                    {item.Operaciones}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={10} className="px-4 py-12 text-center bg-white">
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No hay datos suficientes para el análisis</p>
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
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Participación 80%</span>
                            <span className="text-sm font-black text-emerald-600">{top80Items.length} <span className="text-[10px] text-slate-400 font-bold ml-1">{unitLabel}</span></span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Participación 20%</span>
                            <span className="text-sm font-black text-amber-600">{rest20Items.length} <span className="text-[10px] text-slate-400 font-bold ml-1">{unitLabel}</span></span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total {unitLabel}</span>
                            <span className="text-sm font-black text-slate-900">{details.length}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Venta Total</span>
                            <span className="text-sm font-black text-[#4050B4]">{formatCurrency(totalActual)}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-200 pl-6">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Venta Comparada</span>
                            <span className="text-sm font-black text-slate-500">{formatCurrency(totalAnterior)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-none">
                            <Percent size={14} className="text-amber-500" />
                            <span className="text-[9px] font-bold uppercase tracking-wider italic">
                                Variaciones vs {compareWith === 'anio' ? 'mismo periodo del año anterior' : 'periodo inmediato anterior'}
                            </span>
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

            {/* AI Summary Modal Overlay */}
            {isAIModalOpen && (
                <div className="fixed inset-0 z-[13000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300">
                    <div className="bg-white shadow-2xl w-full max-w-2xl flex flex-col border border-slate-200 animate-in zoom-in-95 duration-300">
                        <div className="bg-indigo-600 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Brain className="text-white" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-sm uppercase tracking-wider">Análisis Táctico Inteligente</h3>
                                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-tight">Análisis Participación 80/20</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAIModalOpen(false)}
                                className="p-2 hover:bg-white/10 text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                            {aiLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="w-12 h-12 flex items-center justify-center animate-bounce">
                                        <img src="/kesito.svg" alt="Loading" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-slate-900 font-bold tracking-tight">Analista Digital KYK</span>
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse">Generando reporte estratégico...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="prose prose-slate max-w-none">
                                    <div className="bg-indigo-50/50 border-l-4 border-indigo-500 p-6 rounded-r-2xl mb-6">
                                        <p className="text-indigo-900 text-[15px] font-medium leading-relaxed italic m-0 whitespace-pre-wrap">
                                            {aiSummary}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center pt-4">
                                        <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-full flex items-center gap-2">
                                            <Sparkles size={14} className="text-indigo-500" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IA Generativa KYK v1.0</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <ModelPicker value={aiModel} onChange={handleAiModelChange} disabled={aiLoading} />
                                <button
                                    onClick={exportToPDF}
                                    disabled={!aiSummary || aiLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm disabled:opacity-50"
                                >
                                    <Download size={14} />
                                    DESCARGAR PDF
                                </button>
                            </div>
                            <button
                                onClick={() => setIsAIModalOpen(false)}
                                className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                ENTENDIDO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
