"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    X, RefreshCw, AlertTriangle, Sparkles, Package, Store as StoreIcon,
    CalendarDays, TrendingUp, TrendingDown, Boxes, Megaphone, Eye, ArrowDown, FileText
} from 'lucide-react';
import {
    ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, BarChart, Bar, Cell
} from 'recharts';
import jsPDF from 'jspdf';
import { cn } from '@/lib/utils';
import { InlineMarkdown } from '@/components/inline-markdown';

type Action = 'stock_up' | 'push' | 'monitor' | 'reduce';

interface DailyPoint { fecha: string; total: number; unidades: number; }
interface DowPoint { dow: number; name: string; avgTotal: number; }
interface StoreTotal { idTienda: number; tienda: string; total: number; unidades: number; }

interface ExplainResponse {
    product: { codigoInterno: number; descripcion: string; depto: string; familia: string };
    action: Action;
    reasonShort: string;
    analysis: string;
    keyInsights: string[];
    metrics: {
        totalRecent: number;
        last14Growth: number;
        lyHorizonTotal: number;
        lyHorizonUnits: number;
        horizonDays: number;
    };
    recentDaily: DailyPoint[];
    lyDailyShifted: DailyPoint[];
    dowPattern: DowPoint[];
    topStores: StoreTotal[];
    generatedAt: string;
}

const ACTION_META: Record<Action, { label: string; icon: React.ElementType; bg: string; text: string; border: string }> = {
    stock_up: { label: 'Cargar', icon: Boxes, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    push: { label: 'Empujar', icon: Megaphone, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    monitor: { label: 'Monitorear', icon: Eye, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    reduce: { label: 'Reducir', icon: ArrowDown, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

const fmtCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
const fmtPct = (val: number) => `${(val * 100).toFixed(0)}%`;
const fmtDateShort = (s: string) => {
    const d = new Date(`${s}T00:00:00`);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

interface ProductExplainModalProps {
    codigoInterno: number;
    storeIds: number[];
    horizonDays: number;
    scopeLabel: string;
    initialAction: Action;
    initialReason: string;
    onClose: () => void;
}

export function ProductExplainModal({
    codigoInterno, storeIds, horizonDays, scopeLabel, initialAction, initialReason, onClose,
}: ProductExplainModalProps) {
    const [data, setData] = useState<ExplainResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchExplain = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/forecast/product-explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    codigoInterno, storeIds, horizonDays,
                    action: initialAction, reason: initialReason,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Error al generar explicación');
            setData(json);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [codigoInterno, storeIds, horizonDays, initialAction, initialReason]);

    useEffect(() => { fetchExplain(); }, [fetchExplain]);

    const actionMeta = ACTION_META[data?.action || initialAction];
    const ActionIcon = actionMeta.icon;

    // Merge recent + LY daily into one chart series
    const chartData = data
        ? (() => {
            const map = new Map<string, { fecha: string; reciente: number | null; anioAnterior: number | null }>();
            for (const r of data.recentDaily) {
                map.set(r.fecha, { fecha: r.fecha, reciente: r.total, anioAnterior: null });
            }
            for (const r of data.lyDailyShifted) {
                const cur = map.get(r.fecha) || { fecha: r.fecha, reciente: null, anioAnterior: null };
                cur.anioAnterior = r.total;
                map.set(r.fecha, cur);
            }
            return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
        })()
        : [];

    const maxDowVal = data ? Math.max(...data.dowPattern.map(d => d.avgTotal), 1) : 1;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-[#4050B4]/10 rounded-md">
                            <Package className="w-5 h-5 text-[#4050B4]" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base font-bold text-slate-900 truncate" title={data?.product.descripcion}>
                                    {data?.product.descripcion || 'Cargando…'}
                                </h2>
                                <span className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap',
                                    actionMeta.bg, actionMeta.text, actionMeta.border
                                )}>
                                    <ActionIcon className="w-3 h-3" />
                                    {actionMeta.label}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-700 whitespace-nowrap">
                                    <StoreIcon className="w-3 h-3" />
                                    {scopeLabel}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                                #{codigoInterno}
                                {data?.product.depto && ` · ${data.product.depto}`}
                                {data?.product.familia && ` · ${data.product.familia}`}
                                {` · horizonte ${horizonDays} días`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => data && exportProductExplainToPdf({ data, codigoInterno, horizonDays, scopeLabel })}
                            disabled={!data || loading}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-rose-300 text-rose-700 rounded-none text-xs font-bold hover:bg-rose-50 disabled:opacity-50"
                            title="Exportar análisis a PDF"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            PDF
                        </button>
                        <button
                            onClick={fetchExplain}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-none text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
                            title="Regenerar análisis"
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                            Regenerar
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-md"
                            title="Cerrar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading && !data && (
                        <div className="p-10 flex flex-col items-center gap-3 text-sm text-slate-500">
                            <RefreshCw className="w-6 h-6 animate-spin text-[#4050B4]" />
                            Cargando histórico, comparando con año pasado y consultando a Kesito…
                        </div>
                    )}

                    {error && (
                        <div className="m-5 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">{error}</span>
                            <button onClick={fetchExplain} className="text-xs font-bold underline">Reintentar</button>
                        </div>
                    )}

                    {data && (
                        <div className="p-5 space-y-5">
                            {/* AI Analysis */}
                            <div className="bg-white border-l-4 border-[#4050B4] p-4 rounded-r-md bg-gradient-to-r from-slate-50 to-white">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-3.5 h-3.5 text-[#4050B4]" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4050B4]">
                                        Análisis detallado · Generado por Kesito
                                    </span>
                                </div>
                                <InlineMarkdown
                                    text={data.analysis}
                                    className="text-sm leading-relaxed text-slate-700 font-medium"
                                />
                            </div>

                            {/* Key insights */}
                            {data.keyInsights.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {data.keyInsights.map((ins, i) => (
                                        <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
                                            <span className="text-[10px] font-black text-[#4050B4] mt-0.5">●</span>
                                            <InlineMarkdown text={ins} className="text-xs text-slate-700 leading-snug" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* KPIs strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <MetricCard
                                    label="Reciente 90d"
                                    value={fmtCurrency(data.metrics.totalRecent)}
                                    tone="indigo"
                                />
                                <MetricCard
                                    label="Crec. últimas 2 sem"
                                    value={(data.metrics.last14Growth >= 0 ? '+' : '') + fmtPct(data.metrics.last14Growth)}
                                    tone={data.metrics.last14Growth >= 0 ? 'emerald' : 'rose'}
                                    icon={data.metrics.last14Growth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                />
                                <MetricCard
                                    label={`LY próximos ${data.metrics.horizonDays}d`}
                                    value={fmtCurrency(data.metrics.lyHorizonTotal)}
                                    sub={`${data.metrics.lyHorizonUnits.toLocaleString('es-MX')} unidades`}
                                    tone="amber"
                                />
                                <MetricCard
                                    label="Días con venta"
                                    value={String(data.recentDaily.length)}
                                    sub="en últimos 90"
                                    tone="slate"
                                />
                            </div>

                            {/* Chart: daily recent vs LY */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                        <CalendarDays className="w-3.5 h-3.5" />
                                        Ventas diarias últimos 90 días vs. mismo período del año pasado
                                    </h3>
                                </div>
                                {chartData.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-slate-400">Sin datos</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey="fecha"
                                                tickFormatter={fmtDateShort}
                                                tick={{ fontSize: 10, fill: '#64748b' }}
                                                minTickGap={28}
                                            />
                                            <YAxis
                                                tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                                                tick={{ fontSize: 10, fill: '#64748b' }}
                                            />
                                            <Tooltip
                                                formatter={(value, name) => {
                                                    if (value === null || value === undefined) return ['—', String(name)];
                                                    return [fmtCurrency(Number(value)), String(name)];
                                                }}
                                                labelFormatter={(label) => {
                                                    const d = new Date(`${String(label)}T00:00:00`);
                                                    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
                                                }}
                                                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            <Line
                                                type="monotone"
                                                dataKey="anioAnterior"
                                                name="Año anterior"
                                                stroke="#94a3b8"
                                                strokeWidth={1.5}
                                                strokeDasharray="3 3"
                                                dot={false}
                                                connectNulls
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="reciente"
                                                name="Reciente"
                                                stroke="#4050B4"
                                                strokeWidth={2}
                                                dot={false}
                                                connectNulls
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Two-column: DOW pattern + top stores */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                                        <CalendarDays className="w-3.5 h-3.5" />
                                        Patrón por día de semana
                                    </h3>
                                    {data.dowPattern.every(d => d.avgTotal === 0) ? (
                                        <div className="p-6 text-center text-xs text-slate-400">Sin datos</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={data.dowPattern} margin={{ top: 5, right: 8, left: 0, bottom: 4 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                                                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 10, fill: '#64748b' }} />
                                                <Tooltip
                                                    formatter={(value) => [fmtCurrency(Number(value)), 'Promedio']}
                                                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                                />
                                                <Bar dataKey="avgTotal" radius={[4, 4, 0, 0]}>
                                                    {data.dowPattern.map((d, i) => (
                                                        <Cell
                                                            key={`cell-${i}`}
                                                            fill={d.avgTotal === maxDowVal ? '#4050B4' : '#cbd5e1'}
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                                        <StoreIcon className="w-3.5 h-3.5" />
                                        Top sucursales (últimos 90d)
                                    </h3>
                                    {data.topStores.length === 0 ? (
                                        <div className="p-6 text-center text-xs text-slate-400">Sin datos</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {data.topStores.map((s, idx) => {
                                                const pct = data.metrics.totalRecent > 0 ? (s.total / data.metrics.totalRecent) : 0;
                                                return (
                                                    <div key={s.idTienda}>
                                                        <div className="flex items-center justify-between text-xs mb-1">
                                                            <span className="font-bold text-slate-700 truncate" title={s.tienda}>
                                                                {idx + 1}. {s.tienda}
                                                            </span>
                                                            <span className="text-slate-500 font-semibold tabular-nums">
                                                                {fmtCurrency(s.total)} · {fmtPct(pct)}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-[#4050B4] to-violet-500"
                                                                style={{ width: `${Math.min(100, pct * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// === PDF Export ===

const PDF_ACTION_COLORS: Record<Action, { bg: [number, number, number]; text: [number, number, number] }> = {
    stock_up: { bg: [209, 250, 229], text: [4, 120, 87] },
    push: { bg: [224, 231, 255], text: [55, 48, 163] },
    monitor: { bg: [254, 243, 199], text: [180, 83, 9] },
    reduce: { bg: [241, 245, 249], text: [71, 85, 105] },
};

function exportProductExplainToPdf(args: {
    data: ExplainResponse;
    codigoInterno: number;
    horizonDays: number;
    scopeLabel: string;
}) {
    const { data, codigoInterno, horizonDays, scopeLabel } = args;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const usableWidth = pageWidth - margin * 2;

    const BRAND: [number, number, number] = [64, 80, 180];
    const DARK: [number, number, number] = [30, 41, 59];
    const MUTED: [number, number, number] = [100, 116, 139];
    const LIGHT: [number, number, number] = [241, 245, 249];
    const VIOLET: [number, number, number] = [109, 40, 217];
    const GRAY_LINE: [number, number, number] = [203, 213, 225];
    const EMERALD: [number, number, number] = [4, 120, 87];
    const ROSE: [number, number, number] = [185, 28, 28];

    const actionColors = PDF_ACTION_COLORS[data.action];

    // === Header band ===
    doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.rect(0, 0, pageWidth, 70, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('ANÁLISIS DETALLADO DE PRODUCTO', margin, 22);

    doc.setFontSize(15);
    const titleLines = doc.splitTextToSize(data.product.descripcion, usableWidth - 8);
    doc.text(titleLines.slice(0, 1), margin, 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const subtitleBits = [
        `#${codigoInterno}`,
        data.product.depto && `Depto: ${data.product.depto}`,
        data.product.familia && `Familia: ${data.product.familia}`,
        scopeLabel,
        `Horizonte ${horizonDays}d`,
    ].filter(Boolean).join('  ·  ');
    doc.text(subtitleBits, margin, 58);

    const generatedText = `Generado: ${new Date(data.generatedAt).toLocaleString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`;
    doc.text(generatedText, pageWidth - margin, 58, { align: 'right' });

    let y = 90;

    // === Action chip + reason ===
    const chipLabel = data.action.toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const chipW = doc.getTextWidth(chipLabel) + 16;
    doc.setFillColor(actionColors.bg[0], actionColors.bg[1], actionColors.bg[2]);
    doc.roundedRect(margin, y - 12, chipW, 18, 4, 4, 'F');
    doc.setTextColor(actionColors.text[0], actionColors.text[1], actionColors.text[2]);
    doc.text(chipLabel, margin + 8, y + 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    const reasonText = `Razón inicial: ${data.reasonShort || 'sin razón corta'}`;
    const reasonLines = doc.splitTextToSize(reasonText, usableWidth - chipW - 16);
    doc.text(reasonLines, margin + chipW + 12, y + 1);
    y += 28;

    // === Análisis IA ===
    y = drawSectionHeader(doc, 'ANÁLISIS DETALLADO (IA)', margin, y, usableWidth, BRAND, LIGHT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    const cleanAnalysis = data.analysis.replace(/\*\*/g, '').replace(/\*/g, '');
    const analysisLines = doc.splitTextToSize(cleanAnalysis, usableWidth);
    doc.text(analysisLines, margin, y, { lineHeightFactor: 1.45 });
    y += analysisLines.length * 15 + 12;

    // === Key insights ===
    if (data.keyInsights.length > 0) {
        y = ensureSpace(doc, y, 60 + data.keyInsights.length * 16, margin, pageHeight);
        y = drawSectionHeader(doc, 'HALLAZGOS CLAVE', margin, y, usableWidth, BRAND, LIGHT);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        for (const insight of data.keyInsights) {
            const clean = insight.replace(/\*\*/g, '').replace(/\*/g, '');
            const lines = doc.splitTextToSize(`•  ${clean}`, usableWidth - 12);
            doc.text(lines, margin + 4, y);
            y += lines.length * 13 + 2;
        }
        y += 8;
    }

    // === Métricas ===
    y = ensureSpace(doc, y, 80, margin, pageHeight);
    y = drawSectionHeader(doc, 'MÉTRICAS', margin, y, usableWidth, BRAND, LIGHT);
    const fmtCurrencyShort = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
    const fmtPctShort = (n: number) => `${(n * 100).toFixed(0)}%`;
    const kpis: Array<{ label: string; value: string; color?: [number, number, number] }> = [
        { label: 'Reciente 90d', value: fmtCurrencyShort(data.metrics.totalRecent) },
        {
            label: 'Crec. últimas 2 sem',
            value: (data.metrics.last14Growth >= 0 ? '+' : '') + fmtPctShort(data.metrics.last14Growth),
            color: data.metrics.last14Growth >= 0 ? EMERALD : ROSE,
        },
        { label: `LY próximos ${data.metrics.horizonDays}d`, value: fmtCurrencyShort(data.metrics.lyHorizonTotal) },
        { label: 'Días con venta', value: String(data.recentDaily.length) + ' / 90' },
    ];
    const kpiW = usableWidth / 4;
    const kpiY = y;
    for (let i = 0; i < kpis.length; i++) {
        const k = kpis[i];
        const xBox = margin + i * kpiW;
        doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2]);
        doc.setLineWidth(0.5);
        doc.rect(xBox + 4, kpiY - 12, kpiW - 8, 50, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(k.label.toUpperCase(), xBox + 12, kpiY);
        doc.setFontSize(13);
        const c = k.color || DARK;
        doc.setTextColor(c[0], c[1], c[2]);
        doc.text(k.value, xBox + 12, kpiY + 18);
    }
    y += 50;

    // === Daily chart (línea: reciente vs LY) ===
    if (data.recentDaily.length > 0 || data.lyDailyShifted.length > 0) {
        y = ensureSpace(doc, y, 180, margin, pageHeight);
        y = drawSectionHeader(doc, 'VENTAS DIARIAS · ÚLTIMOS 90D VS. MISMO PERÍODO LY', margin, y, usableWidth, BRAND, LIGHT);
        const chartH = 130;
        drawDailyChart(doc, {
            x: margin,
            y,
            w: usableWidth,
            h: chartH,
            recentDaily: data.recentDaily,
            lyDailyShifted: data.lyDailyShifted,
            colors: { brand: BRAND, muted: MUTED, gridLine: GRAY_LINE },
        });
        y += chartH + 16;
    }

    // === DOW pattern ===
    if (data.dowPattern.some(d => d.avgTotal > 0)) {
        y = ensureSpace(doc, y, 130, margin, pageHeight);
        y = drawSectionHeader(doc, 'PATRÓN POR DÍA DE SEMANA', margin, y, usableWidth, BRAND, LIGHT);
        const chartH = 90;
        drawDowChart(doc, {
            x: margin,
            y,
            w: usableWidth,
            h: chartH,
            dow: data.dowPattern,
            colors: { brand: BRAND, mutedBar: GRAY_LINE, muted: MUTED },
        });
        y += chartH + 12;
    }

    // === Top stores ===
    if (data.topStores.length > 0) {
        y = ensureSpace(doc, y, 30 + data.topStores.length * 18, margin, pageHeight);
        y = drawSectionHeader(doc, 'TOP SUCURSALES · ÚLTIMOS 90D', margin, y, usableWidth, BRAND, LIGHT);
        const totalRecent = data.metrics.totalRecent;
        const maxBarWidth = usableWidth - 220;
        for (const s of data.topStores) {
            const pct = totalRecent > 0 ? s.total / totalRecent : 0;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(DARK[0], DARK[1], DARK[2]);
            doc.text(s.tienda, margin, y);
            // bar
            doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
            doc.rect(margin + 150, y - 8, pct * maxBarWidth, 10, 'F');
            // bg
            doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2]);
            doc.setLineWidth(0.3);
            doc.rect(margin + 150, y - 8, maxBarWidth, 10, 'S');
            // value
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
            doc.text(
                `${fmtCurrencyShort(s.total)}  ·  ${fmtPctShort(pct)}`,
                pageWidth - margin,
                y,
                { align: 'right' }
            );
            y += 18;
        }
    }

    // === Footer ===
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text('Análisis detallado · Generado por Kesito · Cruza venta reciente con mismo período LY', margin, pageHeight - 14);
        doc.text(`${i} / ${pageCount}`, pageWidth - margin, pageHeight - 14, { align: 'right' });
    }

    const stamp = new Date().toISOString().split('T')[0];
    const slug = data.product.descripcion
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 40);
    doc.save(`Analisis_${slug}_${codigoInterno}_${stamp}.pdf`);
    void VIOLET; // (reservado para futuro highlight)
}

function drawSectionHeader(
    doc: jsPDF,
    label: string,
    margin: number,
    y: number,
    width: number,
    brand: [number, number, number],
    light: [number, number, number]
): number {
    doc.setFillColor(light[0], light[1], light[2]);
    doc.rect(margin, y - 12, width, 18, 'F');
    doc.setDrawColor(brand[0], brand[1], brand[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, y + 6, margin + width, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(brand[0], brand[1], brand[2]);
    doc.text(label, margin + 8, y + 2);
    return y + 22;
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number, pageHeight: number): number {
    if (y + needed > pageHeight - margin) {
        doc.addPage();
        return margin;
    }
    return y;
}

function drawDailyChart(doc: jsPDF, opts: {
    x: number; y: number; w: number; h: number;
    recentDaily: DailyPoint[];
    lyDailyShifted: DailyPoint[];
    colors: { brand: [number, number, number]; muted: [number, number, number]; gridLine: [number, number, number] };
}) {
    const { x, y, w, h, recentDaily, lyDailyShifted, colors } = opts;
    const padL = 36, padR = 8, padT = 6, padB = 18;
    const plotX = x + padL, plotY = y, plotW = w - padL - padR, plotH = h - padT - padB;

    // Merge by date
    const map = new Map<string, { rec: number | null; ly: number | null }>();
    for (const r of recentDaily) {
        const cur = map.get(r.fecha) || { rec: null, ly: null };
        cur.rec = r.total;
        map.set(r.fecha, cur);
    }
    for (const r of lyDailyShifted) {
        const cur = map.get(r.fecha) || { rec: null, ly: null };
        cur.ly = r.total;
        map.set(r.fecha, cur);
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (sorted.length === 0) return;

    let maxVal = 1;
    for (const [, v] of sorted) {
        if (v.rec !== null && v.rec > maxVal) maxVal = v.rec;
        if (v.ly !== null && v.ly > maxVal) maxVal = v.ly;
    }

    // Axis grid (3 horizontal lines + bottom)
    doc.setDrawColor(colors.gridLine[0], colors.gridLine[1], colors.gridLine[2]);
    doc.setLineWidth(0.3);
    for (let i = 0; i <= 3; i++) {
        const gy = plotY + plotT(i, 3, plotH);
        doc.line(plotX, gy, plotX + plotW, gy);
    }

    // Y-axis labels
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    for (let i = 0; i <= 3; i++) {
        const v = maxVal * (1 - i / 3);
        const label = '$' + Math.round(v / 1000) + 'k';
        const gy = plotY + plotT(i, 3, plotH);
        doc.text(label, plotX - 4, gy + 3, { align: 'right' });
    }

    // X-axis labels (start, mid, end dates)
    const labelIdxs = [0, Math.floor(sorted.length / 2), sorted.length - 1];
    for (const idx of labelIdxs) {
        if (idx < 0 || idx >= sorted.length) continue;
        const d = new Date(`${sorted[idx][0]}T00:00:00`);
        const label = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        const cx = plotX + (idx / Math.max(1, sorted.length - 1)) * plotW;
        doc.text(label, cx, plotY + plotH + 12, { align: 'center' });
    }

    // LY line (gray dashed-look via short segments)
    drawSeries(doc, sorted, 'ly', plotX, plotY, plotW, plotH, maxVal, colors.muted, true);
    // Recent line (brand)
    drawSeries(doc, sorted, 'rec', plotX, plotY, plotW, plotH, maxVal, colors.brand, false);

    // Legend
    const lgY = plotY - 2;
    doc.setFillColor(colors.brand[0], colors.brand[1], colors.brand[2]);
    doc.rect(plotX + plotW - 110, lgY - 4, 10, 2, 'F');
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    doc.setFontSize(8);
    doc.text('Reciente', plotX + plotW - 96, lgY - 1);
    doc.setFillColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    doc.rect(plotX + plotW - 50, lgY - 4, 10, 2, 'F');
    doc.text('Año anterior', plotX + plotW - 36, lgY - 1);
}

function drawSeries(
    doc: jsPDF,
    sorted: Array<[string, { rec: number | null; ly: number | null }]>,
    key: 'rec' | 'ly',
    plotX: number, plotY: number, plotW: number, plotH: number,
    maxVal: number,
    color: [number, number, number],
    dashed: boolean
) {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(dashed ? 0.8 : 1.2);
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < sorted.length; i++) {
        const v = sorted[i][1][key];
        if (v === null) {
            prev = null;
            continue;
        }
        const px = plotX + (i / Math.max(1, sorted.length - 1)) * plotW;
        const py = plotY + plotH - (v / maxVal) * plotH;
        if (prev) {
            if (dashed) {
                // simulate dashed by drawing short line every other
                if (i % 2 === 0) doc.line(prev.x, prev.y, px, py);
            } else {
                doc.line(prev.x, prev.y, px, py);
            }
        }
        prev = { x: px, y: py };
    }
}

function plotT(i: number, of: number, plotH: number): number {
    return (i / of) * plotH;
}

function drawDowChart(doc: jsPDF, opts: {
    x: number; y: number; w: number; h: number;
    dow: DowPoint[];
    colors: { brand: [number, number, number]; mutedBar: [number, number, number]; muted: [number, number, number] };
}) {
    const { x, y, w, h, dow, colors } = opts;
    const padL = 30, padR = 8, padT = 6, padB = 14;
    const plotX = x + padL, plotY = y, plotW = w - padL - padR, plotH = h - padT - padB;
    const maxVal = Math.max(...dow.map(d => d.avgTotal), 1);
    const peakIdx = dow.reduce((acc, d, i) => d.avgTotal > dow[acc].avgTotal ? i : acc, 0);

    // Y axis
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    for (let i = 0; i <= 2; i++) {
        const v = maxVal * (1 - i / 2);
        const gy = plotY + (i / 2) * plotH;
        doc.text('$' + Math.round(v / 1000) + 'k', plotX - 3, gy + 3, { align: 'right' });
    }

    const barW = plotW / dow.length * 0.7;
    const slot = plotW / dow.length;
    for (let i = 0; i < dow.length; i++) {
        const d = dow[i];
        const hBar = (d.avgTotal / maxVal) * plotH;
        const bx = plotX + i * slot + (slot - barW) / 2;
        const by = plotY + plotH - hBar;
        const color = i === peakIdx ? colors.brand : colors.mutedBar;
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(bx, by, barW, hBar, 'F');

        // Label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
        doc.text(d.name, bx + barW / 2, plotY + plotH + 10, { align: 'center' });
    }
}

function MetricCard({
    label, value, sub, tone, icon,
}: {
    label: string;
    value: string;
    sub?: string;
    tone: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
    icon?: React.ReactNode;
}) {
    const toneText: Record<typeof tone, string> = {
        indigo: 'text-[#4050B4]',
        emerald: 'text-emerald-700',
        rose: 'text-rose-700',
        amber: 'text-amber-700',
        slate: 'text-slate-700',
    };
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
            <div className={cn('text-lg font-bold tabular-nums flex items-center gap-1', toneText[tone])}>
                {icon}
                {value}
            </div>
            {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
        </div>
    );
}
