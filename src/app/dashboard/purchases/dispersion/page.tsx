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
    FileText,
    TrendingUp,
    ChevronDown,
    Filter
} from 'lucide-react';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { cn } from '@/lib/utils';

export default function DispersionPagosPage() {
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

    const [fechaInicio, setFechaInicio] = useState(periods[4].start); // Default to Este Mes
    const [fechaFin, setFechaFin] = useState(periods[4].end);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/purchases/dispersion?startDate=${fechaInicio}&endDate=${fechaFin}`);
            const json = await res.json();
            if (json.error) {
                console.error('API Error:', json.error);
                alert('Error al consultar datos de SAP');
            } else {
                setData(json);
            }
        } catch (error) {
            console.error('Error fetching dispersion data:', error);
            alert('Error de conexión con el servidor');
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
            item.Clave_ID?.toLowerCase().includes(search) ||
            item.Cuenta_Destino?.toLowerCase().includes(search) ||
            item.Referencia?.toString().includes(search) ||
            item.RFC?.toLowerCase().includes(search) ||
            item.Descripcion?.toLowerCase().includes(search)
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
        link.setAttribute('download', `dispersion_pagos_${fechaInicio}_${fechaFin}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={cn(
            "flex flex-col h-[calc(100vh-160px)] min-h-[600px]",
            isMaximized && "fixed inset-0 z-[100] bg-slate-50 p-4 sm:p-8 md:p-10 h-screen"
        )}>
            {/* Header with Filters */}
            <div className="bg-slate-50 pb-2 space-y-2 flex-none sticky top-0 z-50">
                {/* Row 1: Title and Periods (Matching Receipts) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-2 px-4 rounded-none shadow-sm border border-slate-100">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
                            <CreditCard size={24} className="text-[#4050B4]" />
                            Dispersión de Pagos
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consulta de pagos SAP B1</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Quick Date Period Buttons */}
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

                        {/* Custom Date Range */}
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#4050B4]/20 transition-all">
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
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#4050B4]/20 transition-all">
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
                            className="p-2.5 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 transition-colors rounded-none shadow-sm group disabled:opacity-50"
                        >
                            <RotateCcw size={18} className={cn("group-hover:rotate-180 transition-transform duration-500", loading && "animate-spin")} />
                        </button>

                        <button 
                            onClick={() => setIsMaximized(!isMaximized)}
                            className={cn(
                                "p-2.5 border transition-all rounded-none shadow-sm group",
                                isMaximized
                                    ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            )}
                        >
                            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                    </div>
                </div>

                {/* Row 2: Search and Export */}
                <div className="flex items-center justify-between gap-4 bg-white/50 py-2 px-4 border border-slate-200 shadow-sm backdrop-blur-sm">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4050B4]" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar en resultados (RFC, Cuenta, Referencia...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#4050B4]/20 transition-all"
                        />
                    </div>

                    <button 
                        onClick={exportToCSV}
                        disabled={filteredData.length === 0}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg active:scale-95"
                    >
                        <FileSpreadsheet size={16} />
                        Exportar CSV para Banco
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="flex-1 bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <RotateCcw size={40} className="text-[#4050B4] animate-spin" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-600">Consultando SAP B1...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse min-w-[1600px]">
                        <thead className="sticky top-0 z-30 bg-slate-50">
                            <tr className="border-b border-slate-200">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Op.</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Clave ID</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cuenta Destino</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Importe</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Referencia</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">M.O.</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">M.D.</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">RFC</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">IVA</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Mail</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">F. Aplicación</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Instrucción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={13} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-30">
                                            <Search size={48} />
                                            <p className="text-[13px] font-black uppercase tracking-widest">No se encontraron pagos en este periodo</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 text-[12px] font-bold text-slate-500 text-center">{item.Operacion}</td>
                                        <td className="p-4 text-[12px] font-black text-slate-800">{item.Clave_ID}</td>
                                        <td className="p-4 text-[12px] font-mono text-slate-600">{item.Cuenta_Destino}</td>
                                        <td className="p-4 text-[13px] font-black text-right text-[#4050B4] bg-blue-50/20">{formatCurrency(item.Importe)}</td>
                                        <td className="p-4 text-[12px] font-bold text-slate-700">{item.Referencia}</td>
                                        <td className="p-4 text-[11px] font-bold text-slate-500 uppercase truncate max-w-[200px]" title={item.Descripcion}>{item.Descripcion}</td>
                                        <td className="p-4 text-[11px] font-bold text-slate-400 text-center">{item.Mon_Origen}</td>
                                        <td className="p-4 text-[11px] font-bold text-slate-400 text-center">{item.Moneda_Des}</td>
                                        <td className="p-4 text-[11px] font-mono font-bold text-slate-600">{item.RFC}</td>
                                        <td className="p-4 text-[11px] font-bold text-slate-400 text-center">{item.IVA}</td>
                                        <td className="p-4 text-[11px] font-bold text-slate-500 lowercase truncate max-w-[150px]" title={item.Mail}>{item.Mail}</td>
                                        <td className="p-4 text-[12px] font-bold text-slate-700">{item.Fecha_Aplicacion}</td>
                                        <td className="p-4 text-[11px] font-bold text-slate-500 uppercase truncate max-w-[200px]" title={item.Instruccion_de_Pago}>{item.Instruccion_de_Pago}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer - Summary */}
                <div className="flex-none bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pagos Encontrados:</span>
                            <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-800 text-[11px] font-black shadow-sm">
                                {filteredData.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Importe Total:</span>
                            <span className="px-2 py-0.5 bg-[#4050B4] text-white text-[11px] font-black shadow-sm">
                                {formatCurrency(filteredData.reduce((acc, curr) => acc + (curr.Importe || 0), 0))}
                            </span>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        Base de Datos: KYKPruebas2014 | Servidor: 192.168.1.200
                    </div>
                </div>
            </div>
        </div>
    );
}
