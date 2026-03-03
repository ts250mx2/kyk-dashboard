"use client";

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Clock, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Trend {
    type: 'up' | 'down' | 'alert' | 'info';
    text: string;
}

export function TrendsTicker({ idTienda }: { idTienda?: string }) {
    const [trends, setTrends] = useState<Trend[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTrends() {
            try {
                const res = await fetch(`/api/dashboard/trends${idTienda ? `?idTienda=${idTienda}` : ''}`);
                const data = await res.json();

                const newTrends: Trend[] = [];

                // 1. Sales Trends
                if (data.salesTrends?.length > 1) {
                    const current = data.salesTrends[0].TotalVentas;
                    const prev = data.salesTrends[1].TotalVentas;
                    const diff = ((current - prev) / prev) * 100;
                    if (diff > 5) {
                        newTrends.push({ type: 'up', text: `Ventas hoy ${diff.toFixed(1)}% arriba vs semana pasada` });
                    } else if (diff < -5) {
                        newTrends.push({ type: 'down', text: `Ventas hoy ${Math.abs(diff).toFixed(1)}% abajo vs semana pasada` });
                    }
                }

                // 2. Cancellation Alerts
                if (data.cancelAnomalies?.length > 0) {
                    const topCancel = data.cancelAnomalies[0];
                    newTrends.push({
                        type: 'alert',
                        text: `Alerta: ${topCancel.Supervisor} reporta $${topCancel.MontoTotal.toLocaleString()} en cancelaciones hoy`
                    });
                }

                // 3. Consecutive Alzas
                data.alzaProducts?.forEach((p: any) => {
                    newTrends.push({ type: 'up', text: `Producto Estrella: ${p.Descripcion} con alza consecutiva 4 semanas` });
                });

                // 4. Peak Hours
                if (data.hourlyPatterns?.length > 0) {
                    const peak = [...data.hourlyPatterns].sort((a, b) => b.PromedioVenta - a.PromedioVenta)[0];
                    newTrends.push({ type: 'info', text: `Pico de venta histórico detectado a las ${peak.Hora}:00 hrs` });
                }

                setTrends(newTrends);
            } catch (e) {
                console.error("Ticker fetch error", e);
            } finally {
                setLoading(false);
            }
        }
        fetchTrends();
    }, [idTienda]);

    if (loading || trends.length === 0) return null;

    return (
        <div className="w-full bg-slate-900 text-white py-2 overflow-hidden border-b border-slate-800 shadow-lg relative z-10">
            <div className="flex whitespace-nowrap animate-marquee items-center gap-12 px-4 font-medium uppercase tracking-wider text-[11px]">
                {/* Repeat trends to ensure seamless loop */}
                {[...trends, ...trends, ...trends].map((trend, i) => (
                    <div key={i} className="flex items-center gap-2">
                        {trend.type === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                        {trend.type === 'down' && <TrendingDown className="w-4 h-4 text-rose-400" />}
                        {trend.type === 'alert' && <AlertCircle className="w-4 h-4 text-amber-400" />}
                        {trend.type === 'info' && <Clock className="w-4 h-4 text-indigo-400" />}
                        <span className={cn(
                            trend.type === 'up' && "text-emerald-50",
                            trend.type === 'down' && "text-rose-50",
                            trend.type === 'alert' && "text-amber-50",
                            trend.type === 'info' && "text-indigo-50"
                        )}>
                            {trend.text}
                        </span>
                        <span className="h-1 w-1 bg-slate-700 rounded-full mx-2" />
                    </div>
                ))}
            </div>

            <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
        </div>
    );
}
