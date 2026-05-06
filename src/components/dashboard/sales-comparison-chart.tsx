"use client";

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface SalesComparisonChartProps {
  groupA: any[];
  groupB: any[];
  height?: number;
  groupBy?: 'dia' | 'semana' | 'mes';
  metric?: 'venta' | 'operaciones' | 'ticket';
  nameA?: string;
  nameB?: string;
}

export function SalesComparisonChart({ 
  groupA, 
  groupB,
  height = 300, 
  groupBy = 'dia', 
  metric = 'venta',
  nameA = 'Grupo A',
  nameB = 'Grupo B'
}: SalesComparisonChartProps) {
  const formatValue = (val: number) => {
    if (metric === 'operaciones') return new Intl.NumberFormat('es-MX').format(val);
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (groupBy === 'mes') {
      return d.toLocaleDateString("es-MX", {
        month: "short",
        year: "2-digit",
      });
    }
    if (groupBy === 'semana') {
      return `S${d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`;
    }
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    });
  };

  const transformedData = useMemo(() => {
    const map = new Map<string, any>();
    
    groupA.forEach(item => {
      const date = new Date(item.Fecha).toISOString();
      if (!map.has(date)) map.set(date, { Fecha: item.Fecha });
      const entry = map.get(date);
      
      let val = item.Total;
      if (metric === 'operaciones') val = item.Operaciones;
      else if (metric === 'ticket') val = item.Operaciones > 0 ? item.Total / item.Operaciones : 0;
      
      entry['Grupo A'] = val;
    });

    groupB.forEach(item => {
      const date = new Date(item.Fecha).toISOString();
      if (!map.has(date)) map.set(date, { Fecha: item.Fecha });
      const entry = map.get(date);
      
      let val = item.Total;
      if (metric === 'operaciones') val = item.Operaciones;
      else if (metric === 'ticket') val = item.Operaciones > 0 ? item.Total / item.Operaciones : 0;
      
      entry['Grupo B'] = val;
    });

    return Array.from(map.values()).sort((a, b) => new Date(a.Fecha).getTime() - new Date(b.Fecha).getTime());
  }, [groupA, groupB, metric]);

  const metricLabel = useMemo(() => {
    if (metric === 'venta') return 'Ventas';
    if (metric === 'operaciones') return 'Operaciones';
    return 'Ticket Promedio';
  }, [metric]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={transformedData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4050B4" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#4050B4" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
        <XAxis
          dataKey="Fecha"
          tickFormatter={formatDate}
          tick={{ fontSize: 10, fontWeight: "bold", fill: "#94A3B8" }}
          axisLine={false}
          tickLine={false}
          dy={10}
        />
        <YAxis
          tickFormatter={(value) => {
            if (metric === 'operaciones') return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value;
            return `$${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`;
          }}
          tick={{ fontSize: 10, fontWeight: "bold", fill: "#94A3B8" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ stroke: '#94A3B8', strokeWidth: 2, strokeDasharray: '5 5' }}
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-slate-900 text-white p-3 rounded-none shadow-2xl border border-white/10 min-w-[200px]">
                  <p className="text-[10px] font-bold text-white/50 uppercase mb-2 border-b border-white/10 pb-1">
                    {formatDate(label as string)}
                  </p>
                  <div className="space-y-2">
                    {payload.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between items-center gap-4">
                        <span className="text-[9px] font-black uppercase" style={{ color: p.color }}>
                          {p.name}
                        </span>
                        <span className="text-xs font-black text-white">{formatValue(p.value as number)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend verticalAlign="top" height={36} content={(props) => {
            const { payload } = props;
            return (
                <div className="flex flex-wrap gap-4 mb-4">
                    {payload?.map((entry: any, index: number) => (
                        <div key={`item-${index}`} className="flex items-center gap-2">
                            <div className="w-2 h-2" style={{ backgroundColor: entry.color }} />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{entry.value}</span>
                        </div>
                    ))}
                </div>
            )
        }} />
        
        <Area
          type="monotone"
          dataKey="Grupo A"
          name={nameA}
          stroke="#4050B4"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorA)"
          animationDuration={1000}
        />
        <Area
          type="monotone"
          dataKey="Grupo B"
          name={nameB}
          stroke="#10B981"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorB)"
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
