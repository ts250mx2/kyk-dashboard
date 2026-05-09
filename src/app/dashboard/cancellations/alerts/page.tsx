"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, RefreshCcw, LayoutGrid, ShoppingCart, Trash2, AlertTriangle, Users, Shield, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { CancellationDetailModal } from '@/components/cancellation-detail-modal';

type Metric = 'venta' | 'operaciones' | 'ticket' | 'cantidadDia';

function getMetricValue(item: any, metric: Metric, days: number = 1) {
    if (metric === 'venta') return item.Total || 0;
    if (metric === 'operaciones') return item.Cantidad || 0;
    if (metric === 'cantidadDia') return (item.Cantidad || 0) / Math.max(days, 1);
    return item.PromedioCancelacion || 0;
}

function getAvgValue(avg: any, metric: Metric, days: number = 1) {
    if (metric === 'venta') return avg?.PromedioTotalPorTienda || 0;
    if (metric === 'operaciones') return avg?.PromedioCantidadPorTienda || 0;
    if (metric === 'cantidadDia') return (avg?.PromedioCantidadPorTienda || 0) / Math.max(days, 1);
    return (avg?.PromedioTotalPorTienda || 0) / Math.max(avg?.PromedioCantidadPorTienda || 1, 1);
}

export default function CancellationAlertsPage() {
    const mtyDate = (offset = 0) => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' })); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };
    const mtyMonth = (mo = 0) => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' })); d.setMonth(d.getMonth() + mo); return d; };
    const today = mtyDate();
    const monthStart = (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })();

    const [fechaInicio, setFechaInicio] = useState(monthStart);
    const [fechaFin, setFechaFin] = useState(today);
    const [groupBy, setGroupBy] = useState<'dia'|'semana'|'mes'>('dia');
    const [metric, setMetric] = useState<Metric>('operaciones');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [aiSummary, setAiSummary] = useState<string|null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [detailModal, setDetailModal] = useState<{
        isOpen: boolean;
        idTienda?: string;
        storeName?: string;
        idUsuario?: string;
        userName?: string;
        role?: 'cajeros' | 'supervisores';
    }>({ isOpen: false });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/dashboard/cancellations/alerts?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&groupBy=${groupBy}`);
            setData(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [fechaInicio, fechaFin, groupBy]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openDetail = (idUsuario: number, role: 'cajeros' | 'supervisores', name: string, tienda: string) => {
        setDetailModal({
            isOpen: true,
            idUsuario: idUsuario.toString(),
            userName: name,
            role: role,
            storeName: tienda
        });
    };

    const openStoreDetail = (idTienda: string, storeName: string) => {
        setDetailModal({
            isOpen: true,
            idTienda: idTienda,
            storeName: storeName
        });
    };

    const generateAISummary = async () => {
        if (!data) return;
        setAiLoading(true); setAiSummary('');
        try {
            const selectedModel = typeof window !== 'undefined' ? localStorage.getItem('ai_query_model') || 'gpt-4o' : 'gpt-4o';
            const res = await fetch('/api/dashboard/cancellations/alerts/summary', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechaInicio, fechaFin, model: selectedModel, avgPerStore: data.avgPerStore, topCajeros: data.topCajeros, topSupervisores: data.topSupervisores, perStore: data.perStore, hourly: data.hourly })
            });
            const json = await res.json();
            setAiSummary(json.summary || 'No se pudo generar el resumen.');
        } catch (e) { console.error(e); setAiSummary('Error al generar resumen.'); }
        finally { setAiLoading(false); }
    };

    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);
    const fmtMetric = (v: number) => metric === 'venta' ? fmt(v) : metric === 'ticket' ? fmt(v) : v.toLocaleString();

    const periods = [
        { label: 'Mes', start: monthStart, end: today },
        { label: '3M', start: (() => { const d = mtyMonth(-3); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: today },
        { label: '6M', start: (() => { const d = mtyMonth(-6); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: today },
        { label: '1A', start: (() => { const d = mtyMonth(-12); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: today },
    ];

    const numDays = useMemo(() => {
        const start = new Date(fechaInicio);
        const end = new Date(fechaFin);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }, [fechaInicio, fechaFin]);

    const avg = data?.avgPerStore || {};
    const avgVal = getAvgValue(avg, metric, numDays);
    const totalCanc = data?.timeSeries?.reduce((a: number, c: any) => a + c.Total, 0) || 0;
    const totalOps = data?.timeSeries?.reduce((a: number, c: any) => a + c.Operaciones, 0) || 0;

    // Alert levels ALWAYS based on Cantidad (operations count) — quantity matters most
    const avgCantidad = avg?.PromedioCantidadPorTienda || 0;
    // Per-cajero and per-supervisor averages (for top 10 alert comparison)
    const allCajeros = data?.topCajeros || [];
    const avgCajeroCantidad = allCajeros.length > 0 ? allCajeros.reduce((a: number, c: any) => a + (Number(c.Cantidad)||0), 0) / allCajeros.length : 0;
    const allSups = data?.topSupervisores || [];
    const avgSupCantidad = allSups.length > 0 ? allSups.reduce((a: number, s: any) => a + (Number(s.Cantidad)||0), 0) / allSups.length : 0;

    const getLevelByCantidad = (cantidad: number, avg: number) => { if (!avg) return 'normal'; const r = cantidad/avg; return r >= 1.3 ? 'critical' : r >= 1.2 ? 'warning' : r >= 1.15 ? 'elevated' : 'normal'; };
    const getLevel = (val: number) => { if (!avgVal) return 'normal'; const r = val/avgVal; return r >= 1.3 ? 'critical' : r >= 1.2 ? 'warning' : r >= 1.15 ? 'elevated' : 'normal'; };
    const colors: Record<string,{bg:string;text:string;badge:string}> = {
        critical: { bg:'bg-rose-50', text:'text-rose-700', badge:'bg-rose-600 text-white' },
        warning: { bg:'bg-amber-50', text:'text-amber-700', badge:'bg-amber-500 text-white' },
        elevated: { bg:'bg-orange-50', text:'text-orange-600', badge:'bg-orange-400 text-white' },
        normal: { bg:'bg-slate-50', text:'text-slate-600', badge:'bg-slate-400 text-white' },
    };
    const labels: Record<string,string> = { critical:'CRÍTICO', warning:'ALTO', elevated:'ELEVADO', normal:'NORMAL' };
    const metricLabel = metric === 'venta' ? 'Total $' : metric === 'operaciones' ? 'Cantidad' : metric === 'cantidadDia' ? 'Cant. x Día' : 'Promedio $';

    const sortedCajeros = [...allCajeros].sort((a,b) => getMetricValue(b, metric, numDays) - getMetricValue(a, metric, numDays)).slice(0,10);
    const sortedSups = [...allSups].sort((a,b) => getMetricValue(b, metric, numDays) - getMetricValue(a, metric, numDays)).slice(0,10);
    const sortedStores = [...(data?.perStore || [])].sort((a,b) => getMetricValue(b, metric, numDays) - getMetricValue(a, metric, numDays));

    // Chart data: stores vs average
    const chartData = (data?.perStore || []).map((st: any) => {
        let val = 0;
        if (metric === 'venta') val = Number(st.Total) || 0;
        else if (metric === 'operaciones') val = Number(st.Cantidad) || 0;
        else if (metric === 'cantidadDia') val = (Number(st.Cantidad) || 0) / Math.max(numDays, 1);
        else val = (Number(st.Total) || 0) / (Math.max(Number(st.Cantidad) || 1, 1));
        
        const level = getLevelByCantidad(Number(st.Cantidad)||0, avgCantidad);
        return { name: st.Tienda || '', value: val, cantidad: Number(st.Cantidad)||0, level };
    }).sort((a: any, b: any) => b.value - a.value);
    const barColors: Record<string,string> = { critical:'#E11D48', warning:'#F59E0B', elevated:'#F97316', normal:'#94A3B8' };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-3 px-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                        <AlertTriangle className="text-[#E11D48]" /> ALERTAS
                    </h1>
                    <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5">
                        {periods.map(p => (
                            <button key={p.label} onClick={() => { setFechaInicio(p.start); setFechaFin(p.end); }}
                                className={cn('px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                                    fechaInicio===p.start&&fechaFin===p.end ? 'bg-[#E11D48] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                )}>{p.label}</button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5">
                        <Calendar size={16} className="text-[#E11D48]" />
                        <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto w-32" />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5">
                        <Calendar size={16} className="text-[#E11D48]" />
                        <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto w-32" />
                    </div>
                    <button onClick={fetchData} className="p-2.5 bg-slate-50 border border-slate-200 text-[#E11D48] hover:bg-slate-100 transition-colors">
                        <RefreshCcw size={18} className={cn(loading&&"animate-spin")} />
                    </button>
                    <button onClick={generateAISummary} disabled={aiLoading||!data}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20">
                        <Sparkles size={14} className={cn(aiLoading&&"animate-spin")} /> Resumen IA
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10"><Trash2 size={80} className="text-rose-500" /></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Total Cancelado</span>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">{fmt(totalCanc)}</h2>
                    <div className="flex justify-between items-center text-xs font-bold border-t border-slate-50 pt-4 mt-2">
                        <span className="text-slate-500">Cancelaciones</span><span className="text-rose-600">{totalOps}</span>
                    </div>
                </div>
                <div className="bg-white p-4 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10"><LayoutGrid size={80} className="text-amber-500" /></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Prom. por Sucursal ({metricLabel})</span>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">{fmtMetric(avgVal)}</h2>
                    <div className="flex justify-between items-center text-xs font-bold border-t border-slate-50 pt-4 mt-2">
                        <span className="text-slate-500">Sucursales</span><span className="text-amber-600">{avg.NumTiendas||0}</span>
                    </div>
                </div>
                <div className="bg-white p-4 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10"><Users size={80} className="text-blue-500" /></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cajeros en Alerta</span>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">{allCajeros.filter((c: any) => getLevelByCantidad(Number(c.Cantidad)||0, avgCajeroCantidad) !== 'normal').length}</h2>
                    <div className="flex justify-between items-center text-xs font-bold border-t border-slate-50 pt-4 mt-2">
                        <span className="text-slate-500">Sobre prom. cantidad</span><span className="text-blue-600">{(data?.topCajeros || []).length} monitoreados</span>
                    </div>
                </div>
                <div className="p-4 shadow-xl shadow-rose-500/20 relative overflow-hidden bg-[#E11D48]">
                    <div className="absolute top-0 right-0 p-3 opacity-20"><AlertTriangle size={80} className="text-white" /></div>
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 block">Métrica Activa</span>
                    <h2 className="text-2xl font-black text-white mb-2 uppercase">{metricLabel}</h2>
                    <div className="w-full bg-white/10 h-1 rounded-full mt-4 overflow-hidden"><div className="bg-white h-full rounded-full w-[85%]" /></div>
                </div>
            </div>

            {/* Bar Chart: Store vs Average */}
            <div className="bg-white border border-slate-100 shadow-sm p-4 flex flex-col" style={{minHeight: 380}}>
                <div className="mb-3 pb-2 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E11D48]" /> Cancelaciones por Sucursal vs Promedio
                        <span className="text-slate-300 mx-1">·</span>
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 border border-rose-100">PROM: {fmtMetric(avgVal)}</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5">
                            {([['operaciones','Cantidad'],['cantidadDia','Cant x Día'],['venta','Total'],['ticket','Promedio']] as const).map(([m,l]) => (
                                <button key={m} onClick={()=>setMetric(m)} className={cn('px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                                    metric===m ? 'bg-[#E11D48] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                )}>{l}</button>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={{width: '100%', height: 300}}>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} height={70} />
                            <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 0, fontSize: 12, fontWeight: 700, color: '#fff' }} formatter={(value: number) => [metric === 'operaciones' ? value.toLocaleString() : fmt(value), metricLabel]} labelStyle={{ fontWeight: 900, textTransform: 'uppercase' as const }} />
                            <ReferenceLine y={avgVal} stroke="#E11D48" strokeWidth={3} strokeDasharray="8 4" label={{ value: `PROM: ${metric === 'operaciones' ? Math.round(avgVal) : fmt(avgVal)}`, position: 'insideTopRight', fill: '#E11D48', fontSize: 11, fontWeight: 900 }} />
                            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                {chartData.map((entry: any, index: number) => (
                                    <Cell key={index} fill={barColors[entry.level] || '#94A3B8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Cajeros + Supervisores */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cajeros */}
                <div className="bg-white border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Users size={14} className="text-rose-500" /> Top 10 Cajeros — {metricLabel}
                        </h2>
                        <div className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-1 border border-slate-200">Prom: {fmtMetric(avgVal)}</div>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {sortedCajeros.map((c: any, i: number) => {
                            const val = getMetricValue(c, metric, numDays);
                            const level = getLevelByCantidad(c.Cantidad, avgCajeroCantidad);
                            const col = colors[level];
                            const pct = avgVal > 0 ? ((val/avgVal)*100).toFixed(0) : '0';
                            return (
                                <div key={`${c.IdUsuario}-${c.Tienda}`} onClick={()=>openDetail(c.IdUsuario,'cajeros',c.Cajero,c.Tienda)}
                                    className={cn("p-3 flex items-center gap-3 cursor-pointer hover:ring-2 hover:ring-rose-200 transition-all", col.bg)}>
                                    <div className={cn("w-7 h-7 flex items-center justify-center text-xs font-black shrink-0", col.badge)}>{i+1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-xs font-black text-slate-800 uppercase truncate">{c.Cajero}</span>
                                            <span className={cn("text-[7px] font-black uppercase px-1 py-0.5", col.badge)}>{labels[level]}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{c.Tienda} · {c.Cantidad} cancelaciones</span>
                                        <div className="mt-1 w-full bg-slate-200 h-1 overflow-hidden rounded-full">
                                            <div className="h-full rounded-full" style={{ width:`${Math.min(+pct,300)/3}%`, backgroundColor: barColors[level] }} />
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className={cn("text-sm font-black", col.text)}>{fmtMetric(val)}</div>
                                        <div className="text-[9px] font-bold text-slate-400">{pct}% prom.</div>
                                    </div>
                                </div>
                            );
                        })}
                        {sortedCajeros.length===0 && <div className="p-8 text-center text-slate-400 text-sm">Sin datos</div>}
                    </div>
                </div>
                {/* Supervisores */}
                <div className="bg-white border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Shield size={14} className="text-amber-500" /> Top 10 Supervisores — {metricLabel}
                        </h2>
                        <div className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-1 border border-slate-200">Prom: {fmtMetric(avgVal)}</div>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {sortedSups.map((s: any, i: number) => {
                            const val = getMetricValue(s, metric, numDays);
                            const level = getLevelByCantidad(s.Cantidad, avgSupCantidad);
                            const col = colors[level];
                            const pct = avgVal > 0 ? ((val/avgVal)*100).toFixed(0) : '0';
                            return (
                                <div key={`${s.IdUsuario}-${s.Tienda}`} onClick={()=>openDetail(s.IdUsuario,'supervisores',s.Supervisor,s.Tienda)}
                                    className={cn("p-3 flex items-center gap-3 cursor-pointer hover:ring-2 hover:ring-amber-200 transition-all", col.bg)}>
                                    <div className={cn("w-7 h-7 flex items-center justify-center text-xs font-black shrink-0", col.badge)}>{i+1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-xs font-black text-slate-800 uppercase truncate">{s.Supervisor}</span>
                                            <span className={cn("text-[7px] font-black uppercase px-1 py-0.5", col.badge)}>{labels[level]}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{s.Tienda} · {s.Cantidad} cancelaciones</span>
                                        <div className="mt-1 w-full bg-slate-200 h-1 overflow-hidden rounded-full">
                                            <div className="h-full rounded-full" style={{ width:`${Math.min(+pct,300)/3}%`, backgroundColor: barColors[level] }} />
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className={cn("text-sm font-black", col.text)}>{fmtMetric(val)}</div>
                                        <div className="text-[9px] font-bold text-slate-400">{pct}% prom.</div>
                                    </div>
                                </div>
                            );
                        })}
                        {sortedSups.length===0 && <div className="p-8 text-center text-slate-400 text-sm">Sin datos</div>}
                    </div>
                </div>
            </div>

            {/* Per Store */}
            <div className="bg-white border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <LayoutGrid size={14} /> Sucursales vs Promedio — {metricLabel}
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 divide-x divide-y divide-slate-100">
                    {sortedStores.map((st: any) => {
                        let val = 0;
                        if (metric === 'venta') val = Number(st.Total) || 0;
                        else if (metric === 'operaciones') val = Number(st.Cantidad) || 0;
                        else if (metric === 'cantidadDia') val = (Number(st.Cantidad) || 0) / Math.max(numDays, 1);
                        else val = (Number(st.Total) || 0) / (Math.max(Number(st.Cantidad) || 1, 1));

                        const diff = avgVal > 0 ? ((val-avgVal)/avgVal)*100 : 0;
                        const above = diff > 0;
                        const level = getLevel(val);
                        const col = colors[level];
                        return (
                            <div 
                                key={st.IdTienda} 
                                onClick={() => openStoreDetail(st.IdTienda.toString(), st.Tienda)}
                                className={cn(
                                    "p-4 hover:bg-slate-50 transition-colors border-l-4 cursor-pointer hover:shadow-md", 
                                    above ? 'border-l-rose-400' : 'border-l-emerald-400'
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-black text-slate-800 uppercase truncate">{st.Tienda}</span>
                                    <div className="flex items-center gap-1">
                                        <span className={cn("text-[7px] font-black uppercase px-1 py-0.5", col.badge)}>{labels[level]}</span>
                                        <span className={cn("text-[10px] font-black", above?"text-rose-600":"text-emerald-600")}>{above?'+':''}{diff.toFixed(0)}%</span>
                                    </div>
                                </div>
                                <div className="text-lg font-black text-slate-900">{fmtMetric(val)}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-1">{st.Cantidad} canc. · {fmt(st.Total)}</div>
                                <div className="mt-2 w-full bg-slate-200 h-1 overflow-hidden rounded-full">
                                    <div className="h-full rounded-full" style={{ width:`${Math.min((val/(avgVal*2))*100,100)}%`, backgroundColor: above?'#E11D48':'#10B981' }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Detail Modal */}
            <CancellationDetailModal
                isOpen={detailModal.isOpen}
                onClose={() => setDetailModal({ ...detailModal, isOpen: false })}
                idTienda={detailModal.idTienda}
                storeName={detailModal.storeName}
                idUsuario={detailModal.idUsuario}
                userName={detailModal.userName}
                role={detailModal.role}
                fechaInicio={fechaInicio}
                fechaFin={fechaFin}
            />

            {/* AI Summary Modal */}
            {aiSummary !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={()=>setAiSummary(null)}>
                    <div className="bg-white w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e=>e.stopPropagation()}>
                        <div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-between shrink-0">
                            <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2"><Sparkles size={16} /> Resumen IA — Cancelaciones</h3>
                            <button onClick={()=>setAiSummary(null)} className="p-1 text-white/70 hover:text-white transition-colors"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            {aiLoading ? (
                                <div className="p-12 text-center text-slate-400"><Sparkles size={32} className="animate-pulse mx-auto mb-3 text-purple-400" /><p className="text-sm font-bold">Analizando datos de cancelaciones...</p></div>
                            ) : (
                                <div className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-strong:text-slate-800 prose-li:text-slate-600" dangerouslySetInnerHTML={{ __html: (aiSummary || '').replace(/\n/g, '<br>').replace(/#{1,3} (.+)/g, '<h3 class="text-base font-black uppercase tracking-tight mt-4 mb-2">$1</h3>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                            )}
                        </div>
                        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase shrink-0">
                            Periodo: {fechaInicio} a {fechaFin} · Generado por GPT-4o
                        </div>
                    </div>
                </div>
            )}

            {loading && <LoadingScreen />}
        </div>
    );
}
