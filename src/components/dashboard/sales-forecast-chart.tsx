"use client";

import { useMemo } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ReferenceDot,
} from 'recharts';

interface HistoryPoint { fecha: string; total: number; }
interface ForecastPoint { fecha: string; predicted: number; lower: number; upper: number; }
interface Holiday { fecha: string; name: string; impact: 'high' | 'medium' | 'low'; }
interface StoreSeries { id: number; name: string; color: string; history: HistoryPoint[]; forecast: ForecastPoint[]; }

type Granularity = 'day' | 'week' | 'month';

interface SalesForecastChartProps {
    history: HistoryPoint[];
    forecast: ForecastPoint[];
    lastYear?: HistoryPoint[] | null;
    storeSeries?: StoreSeries[];
    holidays?: Holiday[];
    height?: number;
    granularity?: Granularity;
    mode: 'total' | 'byStore';
}

type ChartRow = {
    fecha: string;
    historico: number | null;
    proyeccion: number | null;
    rango: [number, number] | null;
    anioAnterior: number | null;
    [storeKey: string]: number | string | [number, number] | null;
};

const fmtCurrency = (val: number) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
}).format(val);

const fmtTick = (s: string, gran: Granularity) => {
    const d = new Date(`${s}T00:00:00`);
    if (gran === 'month') return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

const fmtTooltipLabel = (s: string, gran: Granularity) => {
    const d = new Date(`${s}T00:00:00`);
    if (gran === 'month') return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    if (gran === 'week') {
        const end = new Date(d);
        end.setDate(d.getDate() + 6);
        const f = (x: Date) => x.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        return `Semana ${f(d)} – ${f(end)}`;
    }
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
};

export function SalesForecastChart({
    history,
    forecast,
    lastYear,
    storeSeries,
    holidays,
    height = 380,
    granularity = 'day',
    mode = 'total',
}: SalesForecastChartProps) {
    const data: ChartRow[] = useMemo(() => {
        const byDate = new Map<string, ChartRow>();

        const ensure = (fecha: string): ChartRow => {
            let row = byDate.get(fecha);
            if (!row) {
                row = { fecha, historico: null, proyeccion: null, rango: null, anioAnterior: null };
                byDate.set(fecha, row);
            }
            return row;
        };

        if (mode === 'total') {
            for (const h of history) ensure(h.fecha).historico = h.total;
            for (const f of forecast) {
                const row = ensure(f.fecha);
                row.proyeccion = f.predicted;
                row.rango = [f.lower, f.upper];
            }
            if (history.length > 0 && forecast.length > 0) {
                const last = history[history.length - 1];
                const row = ensure(last.fecha);
                row.proyeccion = last.total;
                row.rango = [last.total, last.total];
            }
        } else if (storeSeries) {
            for (const s of storeSeries) {
                for (const h of s.history) ensure(h.fecha)[`hist_${s.id}`] = h.total;
                for (const f of s.forecast) ensure(f.fecha)[`pred_${s.id}`] = f.predicted;
                if (s.history.length > 0 && s.forecast.length > 0) {
                    const last = s.history[s.history.length - 1];
                    ensure(last.fecha)[`pred_${s.id}`] = last.total;
                }
            }
        }

        if (lastYear) {
            for (const ly of lastYear) ensure(ly.fecha).anioAnterior = ly.total;
        }

        return Array.from(byDate.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
    }, [history, forecast, lastYear, storeSeries, mode]);

    const lastHistoryDate = history.length > 0 ? history[history.length - 1].fecha : null;

    const holidayMap = useMemo(() => {
        const m = new Map<string, Holiday>();
        if (holidays) for (const h of holidays) m.set(h.fecha, h);
        return m;
    }, [holidays]);

    const visibleHolidays = useMemo(() => {
        if (!holidays || data.length === 0) return [];
        const dates = new Set(data.map(d => d.fecha));
        return holidays.filter(h => dates.has(h.fecha) && h.impact !== 'low');
    }, [holidays, data]);

    const holidayColor = (impact: Holiday['impact']) => {
        if (impact === 'high') return '#dc2626';
        if (impact === 'medium') return '#f59e0b';
        return '#94a3b8';
    };

    return (
        <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                    dataKey="fecha"
                    tickFormatter={(s) => fmtTick(s, granularity)}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    minTickGap={20}
                />
                <YAxis
                    tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                    formatter={(value, name) => {
                        if (value === null || value === undefined) return ['—', String(name)];
                        if (Array.isArray(value)) {
                            const [a, b] = value as [number, number];
                            return [`${fmtCurrency(a)} – ${fmtCurrency(b)}`, 'Rango'];
                        }
                        return [fmtCurrency(Number(value)), String(name)];
                    }}
                    labelFormatter={(label) => {
                        const base = fmtTooltipLabel(String(label), granularity);
                        const h = holidayMap.get(String(label));
                        return h ? `${base} · 🎉 ${h.name}` : base;
                    }}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />

                {mode === 'total' && (
                    <>
                        <Area
                            type="monotone"
                            dataKey="rango"
                            stroke="none"
                            fill="#4050B4"
                            fillOpacity={0.12}
                            name="Banda de confianza"
                            activeDot={false}
                            isAnimationActive={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="historico"
                            stroke="#4050B4"
                            strokeWidth={2}
                            dot={false}
                            name="Histórico"
                            connectNulls={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="proyeccion"
                            stroke="#10B981"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            dot={false}
                            name="Proyección"
                            connectNulls={false}
                        />
                    </>
                )}

                {mode === 'byStore' && storeSeries && storeSeries.map(s => (
                    <Line
                        key={`hist_${s.id}`}
                        type="monotone"
                        dataKey={`hist_${s.id}`}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={false}
                        name={s.name}
                        connectNulls={false}
                    />
                ))}
                {mode === 'byStore' && storeSeries && storeSeries.map(s => (
                    <Line
                        key={`pred_${s.id}`}
                        type="monotone"
                        dataKey={`pred_${s.id}`}
                        stroke={s.color}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        name={`${s.name} (proy.)`}
                        connectNulls={false}
                        legendType="none"
                    />
                ))}

                {lastYear && (
                    <Line
                        type="monotone"
                        dataKey="anioAnterior"
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        strokeDasharray="2 3"
                        dot={false}
                        name="Año anterior"
                        connectNulls={false}
                    />
                )}

                {lastHistoryDate && (
                    <ReferenceLine
                        x={lastHistoryDate}
                        stroke="#94a3b8"
                        strokeDasharray="2 2"
                        label={{ value: 'Hoy', position: 'top', fontSize: 10, fill: '#64748b' }}
                    />
                )}

                {visibleHolidays.map(h => (
                    <ReferenceDot
                        key={h.fecha}
                        x={h.fecha}
                        y={0}
                        r={5}
                        fill={holidayColor(h.impact)}
                        stroke="white"
                        strokeWidth={1.5}
                        ifOverflow="extendDomain"
                    />
                ))}
            </ComposedChart>
        </ResponsiveContainer>
    );
}
