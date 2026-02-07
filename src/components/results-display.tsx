'use client';

import { useState, useRef, useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
} from 'recharts';
import { Table, FileCode, BarChart3, Download, FileText, Receipt, X, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';

interface ResultsDisplayProps {
    data: Record<string, any>[];
    sql: string;
    question: string;
    visualization: 'table' | 'bar' | 'line' | 'pie' | 'area';
    onVisualizationChange?: (viz: 'table' | 'bar' | 'line' | 'pie' | 'area') => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function ResultsDisplay({ data, sql, question, visualization: initialViz, onVisualizationChange }: ResultsDisplayProps) {
    const [view, setView] = useState<'table' | 'chart' | 'sql'>(initialViz === 'table' ? 'table' : 'chart');
    const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'area'>(initialViz === 'table' ? 'bar' : initialViz as any);
    const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [isMaximized, setIsMaximized] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    const handleViewChange = (newView: 'table' | 'chart' | 'sql') => {
        setView(newView);
        if (onVisualizationChange) {
            onVisualizationChange(newView === 'chart' ? chartType : 'table');
        }
    };

    const handleChartTypeChange = (newType: 'bar' | 'line' | 'pie' | 'area') => {
        setChartType(newType);
        if (onVisualizationChange && view === 'chart') {
            onVisualizationChange(newType);
        }
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const sortedAndFilteredData = useMemo(() => {
        if (!data) return [];
        let processedData = [...data];

        Object.keys(filters).forEach(key => {
            const filterValue = filters[key].toLowerCase();
            if (filterValue) {
                processedData = processedData.filter(row =>
                    String(row[key] || '').toLowerCase().includes(filterValue)
                );
            }
        });

        if (sortConfig) {
            processedData.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return processedData;
    }, [data, filters, sortConfig]);

    const hasData = data && data.length > 0;
    const keys = hasData ? Object.keys(data[0]) : [];
    const xKey = keys[0];
    const dataKeys = keys.slice(1);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const renderChart = () => {
        const CommonProps = {
            data,
            margin: { top: 5, right: 30, left: 20, bottom: 5 },
        };

        switch (chartType) {
            case 'line':
                return (
                    <LineChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                        />
                        <Legend />
                        {dataKeys.map((key, index) => (
                            <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} />
                        ))}
                    </LineChart>
                );
            case 'pie':
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            outerRadius={150}
                            fill="#8884d8"
                            dataKey={dataKeys[0]}
                            nameKey={xKey}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                );
            case 'area':
                return (
                    <AreaChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                        />
                        <Legend />
                        {dataKeys.map((key, index) => (
                            <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </AreaChart>
                );
            case 'bar':
            default:
                return (
                    <BarChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                        />
                        <Legend />
                        {dataKeys.map((key, index) => (
                            <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </BarChart>
                );
        }
    };

    const formatValue = (key: string, value: any) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number') {
            const isCurrency = /Total|Costo|Monto|TotalVenta|Promedio|Total Venta|Precio/i.test(key);
            if (isCurrency) {
                return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
            }
        }
        return String(value);
    };

    const handleExportExcel = () => {
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Results");
        writeFile(wb, "query_results.xlsx");
    };

    const handleExportPDF = async () => {
        const doc = new jsPDF();
        if (view === 'chart' && chartRef.current) {
            try {
                const canvas = await html2canvas(chartRef.current);
                const imgData = canvas.toDataURL('image/png');
                const imgProps = doc.getImageProperties(imgData);
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                doc.save("chart_visualization.pdf");
            } catch (error) {
                console.error("Error exporting chart to PDF:", error);
            }
        } else {
            autoTable(doc, {
                head: [keys],
                body: data.map(row => keys.map(key => row[key])),
            });
            doc.save("query_results.pdf");
        }
    };

    const renderTable = (isModal = false) => {
        if (!hasData) {
            return (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-none bg-muted mb-4">
                        <span className="text-4xl">📊</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Sin resultados</h3>
                    <p className="text-sm text-muted-foreground">
                        La consulta se ejecutó correctamente pero no devolvió ningún resultado.
                    </p>
                </div>
            );
        }

        return (
            <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className={cn("bg-muted text-muted-foreground font-medium", isModal && "bg-slate-100")}>
                    <tr>
                        {keys.map((key) => (
                            <th key={key} className={cn(
                                "px-4 py-3 align-top min-w-[150px] border-r border-b border-border last:border-r-0 sticky top-0 z-20 shadow-sm",
                                isModal ? "bg-slate-100" : "bg-muted"
                            )}>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleSort(key)}
                                        className="flex items-center gap-1 hover:text-foreground transition-colors font-bold text-[11px] uppercase tracking-wider"
                                    >
                                        {key}
                                        {sortConfig?.key === key ? (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                                        )}
                                    </button>
                                    <div className="relative">
                                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Filtrar..."
                                            value={filters[key] || ''}
                                            onChange={(e) => handleFilterChange(key, e.target.value)}
                                            className="w-full pl-7 pr-2 py-1 text-[11px] border border-border rounded-none bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {sortedAndFilteredData.map((row, i) => (
                        <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                            {keys.map((key) => (
                                <td key={key} className="px-4 py-3 border-r border-b border-border/10 last:border-r-0 font-medium whitespace-nowrap">
                                    {key.toLowerCase() === 'ticketcorte' && row[key] ? (
                                        <button
                                            onClick={() => setSelectedTicket(row[key])}
                                            className="p-1 text-[#4050B4] hover:bg-blue-100 rounded-none transition-colors"
                                            title="Ver Ticket"
                                        >
                                            <span className="text-xl">🧾</span>
                                        </button>
                                    ) : key.toLowerCase() === 'thumbnail' && row[key] ? (
                                        <img src={row[key]} alt="Product" className={cn("object-contain rounded-none border border-border", isModal ? "w-16 h-16" : "w-10 h-10")} />
                                    ) : key.toLowerCase() === 'link' && row[key] ? (
                                        <a href={row[key]} target="_blank" rel="noopener noreferrer" className="text-[#4050B4] hover:underline flex items-center gap-1 font-bold">
                                            Ver tienda 🔗
                                        </a>
                                    ) : (
                                        formatValue(key, row[key])
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <>
            <div className="bg-card rounded-none shadow-sm border border-border overflow-hidden">
                <div className="flex flex-col border-b border-border bg-muted/30">
                    <div className="px-4 py-2 bg-slate-900/5 border-b border-border/40 flex items-center gap-2">
                        <span className="text-[10px] font-black text-[#4050B4] uppercase tracking-widest opacity-70">Resultado para:</span>
                        <span className="text-[11px] font-bold text-slate-700 truncate italic">"{question}"</span>
                    </div>

                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={() => handleViewChange('table')}
                                className={cn("p-2 rounded-none hover:bg-blue-50 transition-colors", view === 'table' && "bg-blue-100 text-[#4050B4]")}
                                title="Table View"
                            >
                                <span className="text-xl">📊</span>
                            </button>
                            <button
                                onClick={() => handleViewChange('chart')}
                                className={cn("p-2 rounded-none hover:bg-blue-50 transition-colors", view === 'chart' && "bg-blue-100 text-[#4050B4]")}
                                title="Chart View"
                            >
                                <span className="text-xl">📈</span>
                            </button>
                            <button
                                onClick={() => handleViewChange('sql')}
                                className={cn("p-2 rounded-none hover:bg-blue-50 transition-colors", view === 'sql' && "bg-blue-100 text-[#4050B4]")}
                                title="SQL View"
                            >
                                <span className="text-xl">💻</span>
                            </button>
                            <div className="w-px h-6 bg-border mx-2 self-center" />
                            <button
                                onClick={handleExportExcel}
                                className="p-2 rounded-none hover:bg-blue-50 transition-colors text-blue-600"
                                title="Export to Excel"
                            >
                                <span className="text-xl">📥</span>
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="p-2 rounded-none hover:bg-blue-50 transition-colors text-blue-600"
                                title="Export to PDF"
                            >
                                <span className="text-xl">📄</span>
                            </button>
                            <div className="w-px h-6 bg-border mx-2 self-center" />
                            <button
                                onClick={() => setIsMaximized(!isMaximized)}
                                className={cn("p-2 rounded-none hover:bg-blue-50 transition-colors text-[#4050B4]", isMaximized && "bg-blue-100")}
                                title={isMaximized ? "Contraer" : "Expandir"}
                            >
                                <span className="text-xl">{isMaximized ? '🗗' : '⛶'}</span>
                            </button>
                        </div>

                        {view === 'chart' && (
                            <div className="flex space-x-2">
                                <button onClick={() => handleChartTypeChange('bar')} className={cn("text-xs px-2 py-1 rounded-none border", chartType === 'bar' ? "bg-[#4050B4] text-white border-[#4050B4]" : "bg-transparent hover:bg-blue-50")}>Bar</button>
                                <button onClick={() => handleChartTypeChange('line')} className={cn("text-xs px-2 py-1 rounded-none border", chartType === 'line' ? "bg-[#4050B4] text-white border-[#4050B4]" : "bg-transparent hover:bg-blue-50")}>Line</button>
                                <button onClick={() => handleChartTypeChange('pie')} className={cn("text-xs px-2 py-1 rounded-none border", chartType === 'pie' ? "bg-[#4050B4] text-white border-[#4050B4]" : "bg-transparent hover:bg-blue-50")}>Pie</button>
                                <button onClick={() => handleChartTypeChange('area')} className={cn("text-xs px-2 py-1 rounded-none border", chartType === 'area' ? "bg-[#4050B4] text-white border-[#4050B4]" : "bg-transparent hover:bg-blue-50")}>Area</button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 overflow-auto max-h-[600px]">
                    {view === 'table' && renderTable()}
                    {view === 'chart' && (
                        <div ref={chartRef} className="h-[400px] w-full bg-card p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                {renderChart()}
                            </ResponsiveContainer>
                        </div>
                    )}
                    {view === 'sql' && (
                        <pre className="bg-muted p-4 rounded-none overflow-x-auto font-mono text-sm text-muted-foreground">
                            {sql}
                        </pre>
                    )}
                </div>
            </div>

            {isMaximized && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 lg:p-12 overflow-hidden animate-in fade-in duration-300">
                    <div className="bg-white w-full h-full max-w-7xl relative flex flex-col shadow-2xl rounded-none border-4 border-[#4050B4]">
                        <div className="flex items-center justify-between p-4 bg-[#4050B4] text-white">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">📊</span>
                                <div className="flex flex-col">
                                    <h3 className="text-lg font-black uppercase tracking-tighter leading-none">Resultados del Analista</h3>
                                    <span className="text-[11px] font-medium opacity-80 mt-1 italic">"{question}"</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMaximized(false)}
                                className="p-2 hover:bg-white/20 transition-colors rounded-none font-bold"
                            >
                                <span className="text-2xl leading-none">✕</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50">
                            <div className="bg-white min-h-full">
                                {view === 'table' && renderTable(true)}
                                {view === 'chart' && (
                                    <div className="h-[70vh] w-full p-8">
                                        <ResponsiveContainer width="100%" height="100%">
                                            {renderChart()}
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                {view === 'sql' && (
                                    <div className="p-8">
                                        <pre className="bg-slate-900 text-emerald-400 p-8 rounded-none overflow-x-auto font-mono text-sm shadow-inner border-l-4 border-emerald-500">
                                            {sql}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center gap-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{sortedAndFilteredData.length} registros encontrados</p>
                                <div className="h-4 w-px bg-slate-200" />
                                <div className="flex gap-1">
                                    <button onClick={handleExportExcel} className="p-2 hover:bg-slate-100 transition-colors border border-slate-200" title="Excel">📥</button>
                                    <button onClick={handleExportPDF} className="p-2 hover:bg-slate-100 transition-colors border border-slate-200" title="PDF">📄</button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setView('table')} className={cn("px-6 py-2 font-black text-[11px] uppercase border-2 transition-all", view === 'table' ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400")}>Tabla</button>
                                <button onClick={() => setView('chart')} className={cn("px-6 py-2 font-black text-[11px] uppercase border-2 transition-all", view === 'chart' ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400")}>Gráfica</button>
                                <button onClick={() => setIsMaximized(false)} className="px-8 py-2 bg-[#4050B4] text-white font-black text-[11px] uppercase hover:bg-opacity-90 transition-all shadow-lg active:scale-95">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedTicket && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-2xl max-h-[80vh] rounded-none shadow-xl flex flex-col border border-border">
                        <div className="flex items-center justify-between p-4 border-b border-border bg-[#4050B4] text-white">
                            <h3 className="text-lg font-black flex items-center gap-2 uppercase tracking-tighter">
                                <span className="text-xl">🧾</span>
                                Detalle del Ticket
                            </h3>
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="p-1 hover:bg-white/20 rounded-none transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto font-mono text-sm whitespace-pre-wrap bg-slate-50 text-slate-700 leading-relaxed shadow-inner">
                            {selectedTicket}
                        </div>
                        <div className="p-4 border-t border-border flex justify-end bg-white">
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="px-8 py-2 bg-[#4050B4] text-white font-black text-[11px] uppercase hover:bg-opacity-90 transition-all shadow-md"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
