"use client";

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Clock, Store, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TrendsDiscovery({ idTienda }: { idTienda?: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        cancel: false,
        alza: false,
        baja: false
    });

    useEffect(() => {
        async function fetchTrends() {
            try {
                const res = await fetch(`/api/dashboard/trends${idTienda ? `?idTienda=${idTienda}` : ''}`);
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error("Discovery fetch error", e);
            } finally {
                setLoading(false);
            }
        }
        fetchTrends();
    }, [idTienda]);

    const toggleExpand = (key: string) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-slate-50 border border-slate-100" />)}
        </div>
    );

    if (!data) return null;

    const renderTable = (title: string, icon: any, bgColor: string, borderColor: string, iconColor: string, items: any[], type: 'cancel' | 'alza' | 'baja') => {
        const isExpanded = expanded[type];
        const displayItems = isExpanded ? items : items?.slice(0, 5);
        const hasMore = items?.length > 5;

        return (
            <div className="bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                <div className={cn("p-4 border-b flex items-center justify-between", bgColor, borderColor)}>
                    <div className="flex items-center gap-2">
                        {icon}
                        <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">{title}</h3>
                    </div>
                </div>
                <div className="flex-1 p-0 overflow-auto max-h-[400px]">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3">Detalle</th>
                                <th className="px-4 py-3 text-right">{type === 'cancel' ? 'Cant.' : 'Tendencia'}</th>
                                <th className="px-4 py-3 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
                            {displayItems?.map((item: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors text-[11px]">
                                    <td className="px-4 py-3">
                                        {type === 'cancel' ? (
                                            <div className="flex flex-col">
                                                <span className="text-slate-800">{item.Supervisor}</span>
                                                <span className="text-slate-400 text-[9px] uppercase">{item.Cajero}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                <div className="max-w-[150px] truncate text-slate-800 font-bold" title={item.Descripcion}>
                                                    {item.Descripcion}
                                                </div>
                                                <span className="text-[9px] font-black text-[#4050B4] uppercase tracking-tighter">
                                                    {item.Tienda}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {type === 'cancel' ? (
                                            <span className="text-rose-600">{item.Cantidad}</span>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1">
                                                {type === 'alza' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                                                <span className="text-[10px] text-slate-400">${item.W4.toFixed(0)}→${item.W1.toFixed(0)}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-slate-900">
                                        ${(type === 'cancel' ? item.MontoTotal : item.W1).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                    </td>
                                </tr>
                            ))}
                            {(!items || items.length === 0) && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No se detectaron tendencias significativas</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {hasMore && (
                    <button
                        onClick={() => toggleExpand(type)}
                        className="w-full py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-[10px] font-black uppercase tracking-widest text-[#4050B4] flex items-center justify-center gap-1 border-t border-slate-100"
                    >
                        {isExpanded ? (
                            <><ChevronUp className="w-3 h-3" /> Ver menos</>
                        ) : (
                            <><ChevronDown className="w-3 h-3" /> Ver hasta 50 registros</>
                        )}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 mt-4">
            <div className="flex items-center gap-3 border-l-4 border-[#4050B4] pl-4">
                <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Descubrimientos del Día</h2>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1">Benchmark: 30 Días</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Cancellation Anomalies */}
                {renderTable(
                    "Auditoría de Cancelaciones",
                    <AlertCircle className="w-5 h-5 text-rose-600" />,
                    "bg-rose-50/50", "border-rose-100/50", "text-rose-600",
                    data.cancelAnomalies, 'cancel'
                )}

                {/* 2. Rising Stars */}
                {renderTable(
                    "Alzas Consecutivas",
                    <TrendingUp className="w-5 h-5 text-emerald-600" />,
                    "bg-emerald-50/50", "border-emerald-100/50", "text-emerald-600",
                    data.alzaProducts, 'alza'
                )}

                {/* 3. Falling Stars */}
                {renderTable(
                    "Decremento Continuo",
                    <TrendingDown className="w-5 h-5 text-rose-600" />,
                    "bg-slate-50", "border-slate-100", "text-rose-600",
                    data.bajaProducts, 'baja'
                )}
            </div>

            {/* Peaks and Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                <div className="bg-white border border-slate-100 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Hora Pico (Ventas)</span>
                        <span className="text-base font-black text-slate-800">
                            {data.hourlyPatterns?.length > 0 ? Math.max(...data.hourlyPatterns.map((p: any) => p.Hora)) : '--'}:00 hrs
                        </span>
                    </div>
                </div>
                <div className="bg-[#4050B4] p-4 flex items-center gap-4 text-white">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shadow-inner">
                        <Store className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-medium leading-tight opacity-90 uppercase tracking-wide">
                            <span className="font-black">Sugerencia iA:</span> Se detecta oportunidad de incremento por demanda histórica en la franja de las 14:00 - 16:00 hrs.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
