"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    Calendar,
    RotateCcw,
    Store,
    Flame,
    LayoutGrid,
    ChevronRight
} from 'lucide-react';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { cn } from '@/lib/utils';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

const STORE_COLOR_MAP: Record<string, string> = {
    'BODEGA 238': '#35e844',
    'ARAMBERRI 210': '#eb0258',
    'LINCOLN': '#fcc442',
    'LEONES': '#4ecdc4',
    'ZUAZUA': '#de6262',
    'VALLE SOLEADO': '#ff0f35',
    'RUPERTO MTZ QCF': '#029913',
    'SANTA CATARINA QCF': '#fea189',
    'SOLIDARIDAD': '#566965',
    'MERKADON': '#fcea42',
    'MERKDON': '#fcea42',
};

const STORE_COLORS = [
    '#2563EB', '#3B82F6', '#DC2626', '#EF4444', '#0D9488', '#14B8A6', '#D97706', '#F59E0B',
    '#16A34A', '#22C55E', '#064E3B', '#DCFCE7', '#7C3AED', '#8B5CF6', '#713F12', '#92400E',
    '#EAB308', '#CA8A04', '#0F172A', '#334155', '#EA580C', '#F97316'
];

const getStoreColor = (name: string) => {
    if (!name) return STORE_COLORS[0];
    const cleanName = name.trim().toUpperCase();
    if (STORE_COLOR_MAP[cleanName]) return STORE_COLOR_MAP[cleanName];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % STORE_COLORS.length;
    return STORE_COLORS[index];
};

export default function HeatmapPage() {
    const getMonterreyDate = () => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Monterrey',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    };

    // Default period: Current Month
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
    const currentMonthStart = (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })();

    const [fechaInicio, setFechaInicio] = useState(currentMonthStart);
    const [fechaFin, setFechaFin] = useState(today);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
    const [selectedMetric, setSelectedMetric] = useState<'ventas' | 'operaciones' | 'ticket_promedio'>('ventas');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const url = `/api/dashboard/sales/heatmap?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&idTienda=${selectedStoreId}`;
            const res = await fetch(url);
            const json = await res.json();
            setData(json.data || []);
            setStores(json.stores || []);
        } catch (err) {
            console.error('Error fetching heatmap data:', err);
        } finally {
            setLoading(false);
        }
    }, [fechaInicio, fechaFin, selectedStoreId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getIntensityColor = (value: number, max: number) => {
        if (value === 0) return 'bg-slate-50';
        const ratio = value / max;
        
        if (selectedMetric === 'ventas') {
            if (ratio < 0.2) return 'bg-[#4050B4]/10';
            if (ratio < 0.4) return 'bg-[#4050B4]/30';
            if (ratio < 0.6) return 'bg-[#4050B4]/50';
            if (ratio < 0.8) return 'bg-[#4050B4]/70';
            return 'bg-[#4050B4] text-white';
        } else if (selectedMetric === 'operaciones') {
            if (ratio < 0.2) return 'bg-[#10b981]/10';
            if (ratio < 0.4) return 'bg-[#10b981]/30';
            if (ratio < 0.6) return 'bg-[#10b981]/50';
            if (ratio < 0.8) return 'bg-[#10b981]/70';
            return 'bg-[#10b981] text-white';
        } else {
            // Ticket Promedio - Amber
            if (ratio < 0.2) return 'bg-amber-500/10';
            if (ratio < 0.4) return 'bg-amber-500/30';
            if (ratio < 0.6) return 'bg-amber-500/50';
            if (ratio < 0.8) return 'bg-amber-500/70';
            return 'bg-amber-500 text-white';
        }
    };

    const maxValue = Math.max(...data.map(d => {
        if (selectedMetric === 'ventas') return d.TotalVentas;
        if (selectedMetric === 'operaciones') return d.CantidadTickets;
        return d.TotalVentas / (d.CantidadTickets || 1);
    }), 1);

    // Create a 7x24 matrix for easy lookup
    const matrix: Record<string, number> = {};
    data.forEach(d => {
        const val = selectedMetric === 'ventas' ? d.TotalVentas : 
                   selectedMetric === 'operaciones' ? d.CantidadTickets :
                   d.TotalVentas / (d.CantidadTickets || 1);
        matrix[`${d.DiaSemana}-${d.Hora}`] = val;
        // Keep tickets stored for the tooltip when in sales mode
        matrix[`${d.DiaSemana}-${d.Hora}-tickets`] = d.CantidadTickets;
    });

    const periods = [
        { label: 'Hoy', start: today, end: today },
        { label: 'Ayer', start: mtyDate(-1), end: mtyDate(-1) },
        {
            label: 'Semana',
            start: (() => { 
                const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' })); 
                const day = d.getDay();
                const diff = (day + 6) % 7;
                d.setDate(d.getDate() - diff); 
                return d.toLocaleDateString('en-CA'); 
            })(),
            end: today
        },
        { label: '7 días', start: mtyDate(-6), end: today },
        {
            label: 'Este mes',
            start: currentMonthStart,
            end: today
        },
        {
            label: 'Mes ant.',
            start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
            end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })()
        },
    ];

    const formatValue = (val: number) => {
        if (selectedMetric === 'ventas' || selectedMetric === 'ticket_promedio') {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
        }
        return new Intl.NumberFormat('es-MX').format(val);
    };

    return (
        <div className="space-y-6">
            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-3 px-6 rounded-none shadow-sm border border-slate-100">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                        <Flame 
                            className={cn(
                                "transition-colors", 
                                selectedMetric === 'ventas' ? "text-[#4050B4]" : 
                                selectedMetric === 'operaciones' ? "text-[#10b981]" : "text-amber-500"
                            )} 
                            fill="currentColor" 
                        />
                        MAPA DE CALOR
                    </h1>

                    <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-none p-0.5">
                        <button
                            onClick={() => setSelectedMetric('ventas')}
                            className={cn(
                                'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                selectedMetric === 'ventas' ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            )}
                        >
                            Venta
                        </button>
                        <button
                            onClick={() => setSelectedMetric('operaciones')}
                            className={cn(
                                'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                selectedMetric === 'operaciones' ? 'bg-[#10b981] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            )}
                        >
                            Operaciones
                        </button>
                        <button
                            onClick={() => setSelectedMetric('ticket_promedio')}
                            className={cn(
                                'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                selectedMetric === 'ticket_promedio' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            )}
                        >
                            Ticket Promedio
                        </button>
                    </div>
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
                                        'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                        isActive ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                    )}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5">
                            <Calendar size={16} className="text-[#4050B4]" />
                            <input
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto w-32"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5">
                            <Calendar size={16} className="text-[#4050B4]" />
                            <input
                                type="date"
                                value={fechaFin}
                                onChange={(e) => setFechaFin(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto w-32"
                            />
                        </div>
                        <button
                            onClick={fetchData}
                            className="p-2.5 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 transition-colors rounded-none"
                            title="Actualizar Datos"
                        >
                            <RotateCcw size={18} className={cn(loading && "animate-spin")} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-[580px]">
                <div className="lg:w-72 shrink-0">
                    <div className="bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Store size={14} />
                                Seleccionar Sucursal
                             </h2>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                            <button
                                onClick={() => setSelectedStoreId('all')}
                                className={cn(
                                    "w-full flex items-center justify-between p-3 transition-all border-l-4 group",
                                    selectedStoreId === 'all' 
                                        ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                        : "bg-white text-slate-600 border-transparent hover:bg-slate-50 hover:border-slate-200"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-none flex items-center justify-center text-xs font-black",
                                        selectedStoreId === 'all' ? "bg-white/20" : "bg-slate-100"
                                    )}>
                                        AZ
                                    </div>
                                    <span className="text-[13px] font-bold tracking-tight uppercase">Todas las sucursales</span>
                                </div>
                                <ChevronRight size={14} className={cn(
                                    "transition-transform",
                                    selectedStoreId === 'all' ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                                )} />
                            </button>

                            {stores.map((store) => {
                                const isActive = selectedStoreId === store.IdTienda.toString();
                                const color = getStoreColor(store.Tienda);
                                return (
                                    <button
                                        key={store.IdTienda}
                                        onClick={() => setSelectedStoreId(store.IdTienda.toString())}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 transition-all border-l-4 group",
                                            isActive 
                                                ? "bg-white text-slate-900 shadow-lg ring-1 ring-slate-200"
                                                : "bg-white text-slate-600 border-transparent hover:bg-slate-50"
                                        )}
                                        style={{ borderLeftColor: isActive ? color : 'transparent' }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-8 h-8 rounded-none flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                                                style={{ backgroundColor: color }}
                                            >
                                                {store.Tienda.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-[13px] font-bold tracking-tight uppercase">{store.Tienda}</span>
                                        </div>
                                        <ChevronRight size={14} className={cn(
                                            "transition-transform text-slate-400",
                                            isActive ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                                        )} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Heatmap Grid Area */}
                <div className="flex-1 min-w-0">
                    <div className="bg-white border border-slate-100 shadow-sm relative p-4 h-full">
                        <div className="mb-6 pb-4 border-b border-slate-50">
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <span className={cn(
                                    "w-2 h-2 rounded-full",
                                    selectedMetric === 'ventas' ? "bg-[#4050B4]" : 
                                    selectedMetric === 'operaciones' ? "bg-[#10b981]" : "bg-amber-500"
                                )} />
                                {selectedMetric === 'ventas' ? 'Ventas' : selectedMetric === 'operaciones' ? 'Operaciones' : 'Ticket Promedio'}
                                <span className="text-slate-300 font-light mx-1">/</span>
                                <span className="text-[#4050B4]">
                                    {selectedStoreId === 'all' ? 'Todas las sucursales' : stores.find(s => s.IdTienda.toString() === selectedStoreId)?.Tienda}
                                </span>
                            </h2>
                        </div>

                        {loading && (
                            <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-3">
                                <div className="w-8 h-8 border-4 border-slate-200 border-t-[#4050B4] rounded-full animate-spin" />
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Generando Mapa...</p>
                            </div>
                        )}

                        <div className="overflow-x-auto custom-scrollbar pb-4">
                            <div className="min-w-[1200px]">
                                {/* Heatmap Header - Hours */}
                                <div className="flex mb-2">
                                    <div className="w-32 shrink-0" /> {/* Spacer for Days column */}
                                    <div className="flex-1 flex">
                                        {HOURS.map(hour => (
                                            <div key={hour} className="flex-1 text-center">
                                                <span className="text-[10px] font-black text-slate-400 text-center block rotate-[-45deg] origin-center -translate-y-2">
                                                    {hour}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Heatmap Rows - Days */}
                                <div className="space-y-1">
                                    {DAYS.map((day, dIdx) => {
                                        // SQL Server (DATEFIRST 7): 1=Sunday, 2=Monday... 7=Saturday
                                        // Our DAYS: Lunes(0), Martes(1) ... Domingo(6)
                                        const diaId = ((dIdx + 1) % 7) + 1; 

                                        return (
                                            <div key={day} className="flex items-center">
                                                <div className="w-32 shrink-0 pr-4">
                                                    <span className="text-xs font-black text-slate-600 uppercase tracking-tighter text-right block">
                                                        {day}
                                                    </span>
                                                </div>
                                                <div className="flex-1 flex gap-1 h-12">
                                                    {Array.from({ length: 24 }).map((_, h) => {
                                                        const val = matrix[`${diaId}-${h}`] || 0;
                                                        const colorClass = getIntensityColor(val, maxValue);
                                                        
                                                        return (
                                                            <div 
                                                                key={h}
                                                                className={cn(
                                                                    "flex-1 transition-all duration-300 flex flex-col items-center justify-center group relative border-r border-white/5 last:border-0",
                                                                    colorClass
                                                                )}
                                                            >
                                                                {val > 0 && (
                                                                    <div className={cn(
                                                                        "absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-900 text-white z-50 transition-all pointer-events-none p-2 shadow-2xl border border-white/10 w-40",
                                                                        dIdx < 3 ? "top-full mt-2" : "bottom-full mb-2"
                                                                    )}>
                                                                        <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1 text-center">{day} {h}:00</p>
                                                                        <p className="text-sm font-black whitespace-nowrap text-center">{formatValue(val)}</p>
                                                                        {(selectedMetric === 'ventas' || selectedMetric === 'ticket_promedio') && (
                                                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase text-center border-t border-white/10 pt-1">
                                                                                {matrix[`${diaId}-${h}-tickets`] ?? data.find(d => d.DiaSemana === diaId && d.Hora === h)?.CantidadTickets} Tickets
                                                                            </p>
                                                                        )}
                                                                        {selectedMetric === 'operaciones' && (
                                                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase text-center border-t border-white/10 pt-1">
                                                                                Venta: {formatValue(data.find(d => d.DiaSemana === diaId && d.Hora === h)?.TotalVentas || 0)}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="mt-8 flex items-center justify-end gap-4 border-t border-slate-50 pt-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                Intensidad ({selectedMetric === 'ventas' ? 'Venta' : selectedMetric === 'operaciones' ? 'Operaciones' : 'Ticket Promedio'}):
                            </span>
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-slate-400 mr-1">Menor</span>
                                <div className="w-5 h-5 bg-slate-100" />
                                <div className={cn("w-5 h-5", 
                                    selectedMetric === 'ventas' ? "bg-[#4050B4]/10" : 
                                    selectedMetric === 'operaciones' ? "bg-[#10b981]/10" : "bg-amber-500/10"
                                )} />
                                <div className={cn("w-5 h-5", 
                                    selectedMetric === 'ventas' ? "bg-[#4050B4]/30" : 
                                    selectedMetric === 'operaciones' ? "bg-[#10b981]/30" : "bg-amber-500/30"
                                )} />
                                <div className={cn("w-5 h-5", 
                                    selectedMetric === 'ventas' ? "bg-[#4050B4]/50" : 
                                    selectedMetric === 'operaciones' ? "bg-[#10b981]/50" : "bg-amber-500/50"
                                )} />
                                <div className={cn("w-5 h-5", 
                                    selectedMetric === 'ventas' ? "bg-[#4050B4]/70" : 
                                    selectedMetric === 'operaciones' ? "bg-[#10b981]/70" : "bg-amber-500/70"
                                )} />
                                <div className={cn("w-5 h-5 shadow-lg", 
                                    selectedMetric === 'ventas' ? "bg-[#4050B4]" : 
                                    selectedMetric === 'operaciones' ? "bg-[#10b981]" : "bg-amber-500"
                                )} />
                                <span className="text-[9px] font-bold text-slate-400 ml-1">Mayor</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
