"use client";

import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface GoalGaugeProps {
    idMeta: number;
    onClick?: () => void;
    isAlDia?: boolean;
}

export function GoalGauge({ idMeta, onClick, isAlDia }: GoalGaugeProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProgress();
    }, [idMeta]);

    const fetchProgress = async () => {
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

    if (loading) return <div className="h-24 flex items-center justify-center animate-pulse bg-slate-50 border border-slate-100 uppercase text-[8px] font-black italic text-slate-300">Calculando...</div>;
    if (!data) return null;

    const totalPercent = data?.totalPercent || 0;
    
    let displayPercent = totalPercent;
    let label = 'CUMPLIMIENTO';

    if (isAlDia && data.fechaInicio && data.fechaFin) {
        const start = new Date(data.fechaInicio);
        const end = new Date(data.fechaFin);
        const now = new Date();
        
        // Normalize dates to midnight for calculation
        const dStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const dEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const totalDays = Math.ceil((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const elapsedDays = Math.min(Math.max(Math.ceil((dNow.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1, 0), totalDays);

        if (totalDays > 0) {
            const proRatedTarget = (data.totalTarget || 0) * (elapsedDays / totalDays);
            displayPercent = proRatedTarget > 0 ? ((data.totalActual || 0) / proRatedTarget * 100) : 0;
            label = 'CUMP. AL DÍA';
        }
    }

    const percent = Math.min(displayPercent, 100);
    const chartData = [
        { value: percent },
        { value: 100 - percent }
    ];

    const getColor = (p: number) => {
        if (p >= 100) return '#059669'; // Emerald 600
        if (p >= 80) return '#10B981'; // Emerald 500
        if (p >= 50) return '#F59E0B'; // Amber 500
        return '#EF4444'; // Red 500
    };

    return (
        <div 
            className="relative h-40 w-full cursor-pointer group/gauge hover:scale-105 transition-transform" 
            onClick={onClick}
        >
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="85%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="75%"
                        outerRadius="100%"
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                    >
                        <Cell fill={getColor(totalPercent)} />
                        <Cell fill="#f1f5f9" />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 translate-y-1">
                <span className="text-xl font-black text-slate-900 leading-none">
                    {displayPercent.toFixed(1)}%
                </span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    {label}
                </span>
            </div>

            {/* Hover Tooltip cue */}
            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover/gauge:opacity-100 transition-opacity">
                <span className="text-[7px] font-black bg-slate-900 text-white px-1.5 py-0.5 whitespace-nowrap">CLIC PARA DETALLE POR TIENDA</span>
            </div>
        </div>
    );
}
