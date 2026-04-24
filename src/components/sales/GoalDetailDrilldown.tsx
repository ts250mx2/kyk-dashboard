"use client";

import React, { useEffect, useState } from 'react';
import { X, Home, ArrowUpRight, TrendingUp, Target, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface GoalDetailDrilldownProps {
    isOpen: boolean;
    onClose: () => void;
    idMeta: number | null;
    metaName?: string;
}

export function GoalDetailDrilldown({ isOpen, onClose, idMeta, metaName }: GoalDetailDrilldownProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && idMeta) {
            fetchProgress();
        }
    }, [isOpen, idMeta]);

    const fetchProgress = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/dashboard/sales/goals/progress?idMeta=${idMeta}`);
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(val);
    };

    const COLORS = ['#4050B4', '#0EA5E9', '#059669', '#F59E0B', '#EF4444', '#8B5CF6'];

    return (
        <div className="fixed inset-0 z-[13000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <div className="bg-white shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20 rounded-none">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#4050B4] text-white">
                            <TrendingUp size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{metaName || 'Detalle de Meta'}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Analítica Comparativa por Sucursal</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-rose-50 text-rose-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-slate-50/50 space-y-8">
                    {loading ? (
                        <div className="h-60 flex flex-col items-center justify-center space-y-4">
                            <div className="w-8 h-8 border-4 border-[#4050B4] border-t-transparent animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Procesando métricas...</span>
                        </div>
                    ) : data && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Venta Actual</p>
                                        <p className="text-xl font-black text-slate-900 leading-none">{formatCurrency(data.totalActual)}</p>
                                    </div>
                                    <BarChart2 className="text-emerald-500" size={24} />
                                </div>
                                <div className="bg-white p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Global</p>
                                        <p className="text-xl font-black text-slate-900 leading-none">{formatCurrency(data.totalTarget)}</p>
                                    </div>
                                    <Target className="text-[#4050B4]" size={24} />
                                </div>
                                <div className="bg-white p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cump. Global</p>
                                        <p className="text-xl font-black text-emerald-600 leading-none">{(data?.totalPercent || 0).toFixed(1)}%</p>
                                    </div>
                                    <div className="w-12 h-12 flex items-center justify-center bg-emerald-50 border border-emerald-100 italic font-black text-emerald-600">
                                        GA
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-white border border-slate-200 p-6 h-[350px] shadow-sm">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800 mb-6 flex items-center gap-2">
                                    <ArrowUpRight size={14} className="text-[#4050B4]" />
                                    Venta Real vs Meta (Asignada)
                                </h4>
                                <ResponsiveContainer width="100%" height="90%">
                                    <BarChart data={data?.details || []} barGap={0}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="Tienda" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} 
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 9, fill: '#94a3b8' }} 
                                            tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} 
                                        />
                                        <Tooltip 
                                            cursor={{ fill: '#f8fafc' }}
                                            content={({ active, payload }) => {
                                                if (active && payload?.length) {
                                                    const d = payload[0].payload;
                                                    return (
                                                        <div className="bg-white border border-slate-200 p-3 shadow-2xl space-y-2">
                                                            <p className="text-[10px] font-black uppercase text-slate-900 border-b border-slate-100 pb-1">{d.Tienda}</p>
                                                            <div className="space-y-1">
                                                                <p className="text-[9px] font-bold text-emerald-600 flex justify-between gap-4">ACTUAL: <span>{formatCurrency(d.Actual)}</span></p>
                                                                <p className="text-[9px] font-bold text-[#4050B4] flex justify-between gap-4">META: <span>{formatCurrency(d.Target)}</span></p>
                                                                <p className="text-[9px] font-black text-slate-900 border-t border-slate-50 pt-1 flex justify-between gap-4">CUMP: <span>{(d?.Percent || 0).toFixed(1)}%</span></p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="Actual" radius={[2, 2, 0, 0]} barSize={25}>
                                            {(data?.details || []).map((_: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                        <Bar dataKey="Target" fill="#f1f5f9" radius={[2, 2, 0, 0]} barSize={10} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Table List */}
                            <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tienda</th>
                                            <th className="px-4 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Real</th>
                                            <th className="px-4 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Meta</th>
                                            <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {(data?.details || []).map((d: any, i: number) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2 font-black text-[10px] text-slate-700 uppercase tracking-tighter">
                                                        <Home size={10} className="text-slate-300" />
                                                        {d.Tienda}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-[10px] font-bold text-slate-600">{formatCurrency(d.Actual)}</td>
                                                <td className="px-4 py-3 text-right text-[10px] font-bold text-slate-400">{formatCurrency(d.Target)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 text-[8px] font-black uppercase italic",
                                                        (d?.Percent || 0) >= 100 ? "bg-emerald-100 text-emerald-700" :
                                                        (d?.Percent || 0) >= 80 ? "bg-blue-100 text-blue-700" :
                                                        "bg-rose-100 text-rose-700"
                                                    )}>
                                                        {(d?.Percent || 0).toFixed(0)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
