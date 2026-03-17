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

interface SalesTrendsChartProps {
  data: any[];
  height?: number;
  color?: string;
  groupBy?: 'dia' | 'semana' | 'mes';
  isMulti?: boolean;
}

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

const DEFAULT_COLORS = [
  '#4050B4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'
];

const getStoreColor = (name: string, index: number) => {
  if (!name) return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  const cleanName = name.trim().toUpperCase();
  if (STORE_COLOR_MAP[cleanName]) return STORE_COLOR_MAP[cleanName];
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
};

export function SalesTrendsChart({ data, height = 300, color = "#4050B4", groupBy = 'dia', isMulti = false }: SalesTrendsChartProps) {
  const formatCurrency = (val: number) => {
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

  // Transform data for multi-line: [{ Fecha, Store1: Total, Store2: Total }]
  const transformedData = useMemo(() => {
    if (!isMulti && !data.some(d => d.Tienda)) return data;

    const map = new Map<string, any>();
    data.forEach(item => {
      const date = new Date(item.Fecha).toISOString();
      if (!map.has(date)) {
        map.set(date, { Fecha: item.Fecha });
      }
      const entry = map.get(date);
      const storeKey = item.Tienda || 'Total';
      entry[storeKey] = item.Total;
      entry[`${storeKey}_ops`] = item.Operaciones;
    });

    return Array.from(map.values()).sort((a, b) => new Date(a.Fecha).getTime() - new Date(b.Fecha).getTime());
  }, [data, isMulti]);

  const activeStores = useMemo(() => {
    const stores = new Set<string>();
    data.forEach(item => { if (item.Tienda) stores.add(item.Tienda); });
    return Array.from(stores);
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={transformedData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          {isMulti ? (
            activeStores.map((store, i) => (
              <linearGradient key={store} id={`color_${store}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={getStoreColor(store, i)} stopOpacity={0.1} />
                <stop offset="95%" stopColor={getStoreColor(store, i)} stopOpacity={0} />
              </linearGradient>
            ))
          ) : (
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.1} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          )}
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
          tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
          tick={{ fontSize: 10, fontWeight: "bold", fill: "#94A3B8" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ stroke: isMulti ? '#94A3B8' : color, strokeWidth: 2, strokeDasharray: '5 5' }}
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-slate-900 text-white p-3 rounded-none shadow-2xl border border-white/10 min-w-[180px]">
                  <p className="text-[10px] font-bold text-white/50 uppercase mb-2 border-b border-white/10 pb-1">
                    {formatDate(label as string)}
                  </p>
                  <div className="space-y-2">
                    {payload.map((p: any, i: number) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-[9px] font-black uppercase truncate max-w-[100px]" style={{ color: p.color }}>
                            {p.name}
                          </span>
                          <span className="text-xs font-black text-white">{formatCurrency(p.value as number)}</span>
                        </div>
                        {p.payload[`${p.name}_ops`] && (
                           <div className="flex justify-between items-center opacity-40">
                              <span className="text-[8px] font-bold uppercase">Tickets</span>
                              <span className="text-[9px] font-bold">{p.payload[`${p.name}_ops`]}</span>
                           </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        {isMulti && activeStores.length > 0 && <Legend verticalAlign="top" height={36} content={(props) => {
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
        }} />}
        
        {isMulti ? (
          activeStores.map((store, i) => (
            <Area
              key={store}
              type="monotone"
              dataKey={store}
              name={store}
              stroke={getStoreColor(store, i)}
              strokeWidth={3}
              fillOpacity={1}
              fill={`url(#color_${store})`}
              animationDuration={1000}
            />
          ))
        ) : (
          <Area
            type="monotone"
            dataKey="Total"
            name="Ventas"
            stroke={color}
            strokeWidth={4}
            fillOpacity={1}
            fill="url(#colorTotal)"
            animationDuration={1000}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
