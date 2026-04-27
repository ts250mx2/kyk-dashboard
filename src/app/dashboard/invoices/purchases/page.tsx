"use client";

import { useState, useEffect } from 'react';
import { 
    Calendar, 
    Search, 
    RotateCcw,
    Maximize2,
    Minimize2,
    Download,
    CreditCard,
    FileSpreadsheet,
    FileCode,
    FileText,
    Eye,
    X,
    ShoppingCart
} from 'lucide-react';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { cn } from '@/lib/utils';
import { generateInvoicePDF } from '@/utils/cfdi-pdf-renderer';

export default function FacturasCompraPage() {
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

    const today = mtyDate();
    const periods = [
        { label: 'Hoy', start: today, end: today },
        { label: 'Ayer', start: mtyDate(-1), end: mtyDate(-1) },
        {
            label: 'Sema',
            start: (() => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' })); d.setDate(d.getDate() - d.getDay()); return d.toLocaleDateString('en-CA'); })(),
            end: today
        },
        { label: '7 Días', start: mtyDate(-6), end: today },
        {
            label: 'Este Mes',
            start: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
            end: today
        },
        {
            label: 'Mes Ant.',
            start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
            end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })()
        },
    ];

    const [fechaInicio, setFechaInicio] = useState(periods[3].start); // Default to 7 Días
    const [fechaFin, setFechaFin] = useState(periods[3].end);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);
    
    // XML/PDF State
    const [selectedXml, setSelectedXml] = useState<string | null>(null);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/invoices/purchases?startDate=${fechaInicio}&endDate=${fechaFin}`);
            const json = await res.json();
            if (json.error) {
                console.error('API Error:', json.error);
            } else {
                setData(json);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fechaInicio, fechaFin]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const filteredData = data.filter(item => {
        const search = searchTerm.toLowerCase();
        return (
            item.UUID?.toLowerCase().includes(search) ||
            item.Serie?.toLowerCase().includes(search) ||
            item.Folio?.toString().includes(search) ||
            item.RFCEmisor?.toLowerCase().includes(search) ||
            item.EmisorReceptor?.toLowerCase().includes(search)
        );
    });

    const exportToCSV = () => {
        if (filteredData.length === 0) return;
        const headers = Object.keys(filteredData[0]);
        const csvContent = [
            headers.join(','),
            ...filteredData.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `facturas_compra_${fechaInicio}_${fechaFin}.csv`);
        link.click();
    };

    const handleViewXml = async (uuid: string) => {
        setLoadingAction(uuid + '-xml');
        try {
            const res = await fetch(`/api/purchases/invoices/xml?uuid=${uuid}`);
            const data = await res.json();
            if (res.ok && data.xml) {
                setSelectedXml(data.xml);
            } else {
                alert('No se pudo obtener el XML de esta factura.');
            }
        } catch (error) {
            console.error('Error fetching XML:', error);
            alert('Error al obtener el XML.');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleViewPdf = async (uuid: string) => {
        setLoadingAction(uuid + '-pdf');
        try {
            const res = await fetch(`/api/purchases/invoices/xml?uuid=${uuid}`);
            const data = await res.json();
            if (res.ok && data.xml) {
                const doc = await generateInvoicePDF(data.xml);
                window.open(doc.output('bloburl'), '_blank');
            } else {
                alert('No se pudo obtener el XML para generar el PDF.');
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF.');
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className={cn(
            "flex flex-col h-[calc(100vh-160px)] min-h-[600px]",
            isMaximized && "fixed inset-0 z-[100] bg-slate-50 p-4 sm:p-8 md:p-10 h-screen"
        )}>
            {/* Header with Filters */}
            <div className="bg-slate-50 pb-2 space-y-2 flex-none sticky top-0 z-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-2 px-4 rounded-none shadow-sm border border-slate-100">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
                            <ShoppingCart size={24} className="text-[#4050B4]" />
                            Facturas de Compra
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consulta de comprobantes recibidos BDCFDV40</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-none p-0.5">
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

                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 transition-all">
                            <Calendar size={16} className="text-[#4050B4]" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Inicio</span>
                                <input
                                    type="date"
                                    value={fechaInicio}
                                    onChange={(e) => setFechaInicio(e.target.value)}
                                    className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto leading-none"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 transition-all">
                            <Calendar size={16} className="text-[#4050B4]" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Fin</span>
                                <input
                                    type="date"
                                    value={fechaFin}
                                    onChange={(e) => setFechaFin(e.target.value)}
                                    className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto leading-none"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={fetchData}
                            disabled={loading}
                            className="p-2.5 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 transition-colors rounded-none disabled:opacity-50"
                        >
                            <RotateCcw size={18} className={cn(loading && "animate-spin")} />
                        </button>

                        <button 
                            onClick={() => setIsMaximized(!isMaximized)}
                            className={cn(
                                "p-2.5 border transition-all rounded-none",
                                isMaximized ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-slate-50 border-slate-200 text-slate-600"
                            )}
                        >
                            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 bg-white/50 py-2 px-4 border border-slate-200 shadow-sm backdrop-blur-sm">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4050B4]" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar por UUID, Folio, Emisor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#4050B4]/20"
                        />
                    </div>

                    <button 
                        onClick={exportToCSV}
                        disabled={filteredData.length === 0}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 shadow-lg"
                    >
                        <FileSpreadsheet size={16} />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="flex-1 bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                        <RotateCcw size={40} className="text-[#4050B4] animate-spin" />
                    </div>
                )}

                <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse min-w-[1400px]">
                        <thead className="sticky top-0 z-30 bg-slate-50">
                            <tr className="border-b border-slate-200">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">UUID</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Serie/Folio</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Emisor</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Receptor</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Condiciones</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={7} className="p-20 text-center opacity-30">
                                        <Search size={48} className="mx-auto mb-4" />
                                        <p className="text-[13px] font-black uppercase tracking-widest">Sin resultados</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 text-[11px] font-mono text-slate-500 max-w-[120px] truncate" title={item.UUID}>{item.UUID}</td>
                                        <td className="p-4 text-[12px] font-black text-slate-800">{item.Serie}{item.Folio}</td>
                                        <td className="p-4 text-[12px] font-bold text-slate-600">{new Date(item.Fecha).toLocaleString()}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-slate-700 uppercase leading-none mb-1">{item.EmisorReceptor}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{item.RFCEmisor}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-[12px] font-bold text-slate-600">{item.RFCReceptor}</span>
                                        </td>
                                        <td className="p-4 text-[13px] font-black text-right text-[#4050B4] bg-blue-50/20">{formatCurrency(item.Total)}</td>
                                        <td className="p-4 text-[11px] font-bold text-slate-500 uppercase">{item.CondicionesPago || '---'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => handleViewXml(item.UUID)}
                                                    disabled={loadingAction === item.UUID + '-xml'}
                                                    className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-none border border-amber-100 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase"
                                                    title="Ver XML"
                                                >
                                                    {loadingAction === item.UUID + '-xml' ? <RotateCcw size={14} className="animate-spin" /> : <FileCode size={14} />}
                                                    XML
                                                </button>
                                                <button 
                                                    onClick={() => handleViewPdf(item.UUID)}
                                                    disabled={loadingAction === item.UUID + '-pdf'}
                                                    className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-none border border-red-100 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase"
                                                    title="Ver PDF"
                                                >
                                                    {loadingAction === item.UUID + '-pdf' ? <RotateCcw size={14} className="animate-spin" /> : <FileText size={14} />}
                                                    PDF
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex-none bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Facturas:</span>
                            <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-800 text-[11px] font-black">{filteredData.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total:</span>
                            <span className="px-2 py-0.5 bg-[#4050B4] text-white text-[11px] font-black shadow-sm">
                                {formatCurrency(filteredData.reduce((acc, curr) => acc + (curr.Total || 0), 0))}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* XML Modal */}
            {selectedXml && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-none shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <FileCode size={18} className="text-amber-500" /> Visor de XML CFDI 4.0
                            </h2>
                            <button onClick={() => setSelectedXml(null)} className="p-2 hover:bg-slate-100 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-slate-900 text-emerald-400 font-mono text-xs leading-relaxed select-all">
                            <pre>{selectedXml}</pre>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button 
                                onClick={() => setSelectedXml(null)}
                                className="px-6 py-2 bg-slate-800 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-700"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
