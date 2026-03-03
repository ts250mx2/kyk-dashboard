"use client";

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Clock, Store, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TrendsDiscovery({ idTienda }: { idTienda?: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [maximized, setMaximized] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        cancel: false,
        users: false,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse mt-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-slate-50 border border-slate-100 rounded-2xl" />)}
        </div>
    );

    if (!data) return null;

    const renderTable = (title: string, icon: any, bgColor: string, borderColor: string, iconColor: string, items: any[], type: 'cancel' | 'alza' | 'baja' | 'users') => {
        const isExpanded = expanded[type];
        const isMaximized = maximized === type;
        const displayItems = (isExpanded || isMaximized) ? items : items?.slice(0, 5);
        const hasMore = items?.length > 5;

        const tableContent = (
            <div className={cn(
                "bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all duration-300",
                isMaximized ? "fixed inset-4 md:inset-10 lg:inset-20 z-[100] shadow-2xl rounded-3xl border-2 border-[#4050B4]/20" : "h-full rounded-2xl"
            )}>
                <div className={cn("p-4 border-b flex items-center justify-between", bgColor, borderColor)}>
                    <div className="flex items-center gap-2">
                        {icon}
                        <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">{title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setMaximized(isMaximized ? null : type)}
                            type="button"
                            className="p-1.5 hover:bg-white/50 rounded-lg transition-colors text-slate-500 hover:text-[#4050B4]"
                            title={isMaximized ? "Minimizar" : "Maximizar"}
                        >
                            {isMaximized ? (
                                <ChevronUp className="w-4 h-4 rotate-180" />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                            )}
                        </button>
                    </div>
                </div>
                <div className={cn("flex-1 p-0 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent", isMaximized ? "max-h-full" : "max-h-[300px]")}>
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-400 font-bold uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3">{type === 'users' ? 'Colaborador' : 'Detalle'}</th>
                                <th className="px-4 py-3 text-right">{type === 'cancel' || type === 'users' ? 'Cant.' : 'Tendencia'}</th>
                                <th className="px-4 py-3 text-right">{type === 'users' ? '' : 'Monto'}</th>
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
                                        ) : type === 'users' ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-[9px]">
                                                    {item.Usuario?.charAt(0)}
                                                </div>
                                                <span className="text-slate-800 font-bold uppercase tracking-tighter truncate max-w-[150px]">{item.Usuario}</span>
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
                                        {type === 'cancel' || type === 'users' ? (
                                            <span className="text-rose-600 font-black">{item.Cantidad}</span>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1">
                                                {type === 'alza' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                                                <span className="text-[10px] text-slate-400">${item.W4.toFixed(0)}→${item.W1.toFixed(0)}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-slate-900">
                                        {type === 'users' ? '' : `$${(type === 'cancel' ? item.MontoTotal : item.W1).toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
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
                {hasMore && !isMaximized && (
                    <button
                        onClick={() => toggleExpand(type)}
                        type="button"
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

        return (
            <div key={type}>
                {isMaximized && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] animate-in fade-in duration-300" onClick={() => setMaximized(null)} />
                )}
                {tableContent}
            </div>
        );
    };

    return (
        <div className="space-y-6 mt-4">
            <div className="flex items-center gap-3 border-l-4 border-[#4050B4] pl-4">
                <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Descubrimientos del Día</h2>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 italic">Benchmark: Dinámico</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Cancellation Anomalies (Today) */}
                {renderTable(
                    "Cancelaciones (Hoy)",
                    <AlertCircle className="w-5 h-5 text-rose-600" />,
                    "bg-rose-50/50", "border-rose-100/50", "text-rose-600",
                    data.cancelAnomalies, 'cancel'
                )}

                {/* 2. Top Users (Last 7 Days) */}
                {renderTable(
                    "Auditoría Usuarios (7D)",
                    <div className="bg-rose-600 text-white text-[9px] px-1 rounded font-black">TOP</div>,
                    "bg-rose-50/30", "border-rose-100/30", "text-rose-600",
                    data.cancelUsers, 'users'
                )}

                {/* 3. Rising Stars */}
                {renderTable(
                    "Alzas Consecutivas",
                    <TrendingUp className="w-5 h-5 text-emerald-600" />,
                    "bg-emerald-50/50", "border-emerald-100/50", "text-emerald-600",
                    data.alzaProducts, 'alza'
                )}

                {/* 4. Falling Stars */}
                {renderTable(
                    "Decremento Continuo",
                    <TrendingDown className="w-5 h-5 text-rose-600" />,
                    "bg-slate-50", "border-slate-100", "text-rose-600",
                    data.bajaProducts, 'baja'
                )}
            </div>

            {/* Peaks and Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                <div className="bg-white border border-slate-100 p-4 flex items-center gap-4 rounded-2xl">
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
                <div className="bg-[#4050B4] p-4 flex items-center gap-4 text-white rounded-2xl shadow-xl shadow-blue-500/20">
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
