"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Sparkles, AlertTriangle, TrendingUp, TrendingDown,
    Boxes, Megaphone, Eye, ArrowDown, RefreshCw, X, Download, FileText, HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { InlineMarkdown } from '@/components/inline-markdown';
import { ProductExplainModal } from '@/components/dashboard/product-explain-modal';

type Action = 'stock_up' | 'push' | 'monitor' | 'reduce';

interface ProductRec {
    codigoInterno: number;
    descripcion: string;
    depto: string;
    action: Action;
    reason: string;
    recentTotal: number;
    recentUnits: number;
    recentGrowthPct: number;
    lyHorizonTotal: number;
    lyHorizonUnits: number;
    seasonalityRatio: number;
}

interface RecommendationsResponse {
    narrative: string;
    tone: 'positive' | 'attention' | 'neutral';
    products: ProductRec[];
    generatedAt: string;
}

const ACTION_META: Record<Action, { label: string; icon: React.ElementType; bg: string; text: string; border: string; xlsxBg: string; xlsxText: string }> = {
    stock_up: { label: 'Cargar', icon: Boxes, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', xlsxBg: 'D1FAE5', xlsxText: '047857' },
    push: { label: 'Empujar', icon: Megaphone, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', xlsxBg: 'E0E7FF', xlsxText: '3730A3' },
    monitor: { label: 'Monitorear', icon: Eye, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', xlsxBg: 'FEF3C7', xlsxText: 'B45309' },
    reduce: { label: 'Reducir', icon: ArrowDown, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', xlsxBg: 'F1F5F9', xlsxText: '475569' },
};

const TONE_META: Record<RecommendationsResponse['tone'], { bar: string; icon: React.ElementType; iconColor: string; label: string }> = {
    positive: { bar: 'bg-emerald-500', icon: TrendingUp, iconColor: 'text-emerald-500', label: 'Oportunidad' },
    attention: { bar: 'bg-amber-500', icon: AlertTriangle, iconColor: 'text-amber-500', label: 'Atención' },
    neutral: { bar: 'bg-[#4050B4]', icon: Sparkles, iconColor: 'text-[#4050B4]', label: 'Sugerencias' },
};

const fmtCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
const fmtPct = (val: number) => `${(val * 100).toFixed(0)}%`;

interface ProductRecommendationsModalProps {
    storeIds: number[];
    horizonDays: number;
    scopeLabel: string;
    onClose: () => void;
}

export function ProductRecommendationsModal({ storeIds, horizonDays, scopeLabel, onClose }: ProductRecommendationsModalProps) {
    const [data, setData] = useState<RecommendationsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionFilter, setActionFilter] = useState<Action | 'all'>('all');
    const [explainProduct, setExplainProduct] = useState<ProductRec | null>(null);

    const fetchKey = useMemo(() => `${horizonDays}-${[...storeIds].sort((a, b) => a - b).join(',')}`, [storeIds, horizonDays]);

    const fetchRecommendations = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/forecast/product-recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeIds, horizonDays }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Error generando sugerencias');
            setData(json);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [storeIds, horizonDays]);

    useEffect(() => {
        fetchRecommendations();
    }, [fetchKey, fetchRecommendations]);

    const handleExportXlsx = () => {
        if (!data || data.products.length === 0) return;
        exportRecommendationsToXlsx({ data, scopeLabel, horizonDays });
    };

    const handleExportPdf = () => {
        if (!data || data.products.length === 0) return;
        exportRecommendationsToPdf({ data, scopeLabel, horizonDays });
    };

    const filteredProducts = useMemo(() => {
        if (!data) return [];
        return actionFilter === 'all' ? data.products : data.products.filter(p => p.action === actionFilter);
    }, [data, actionFilter]);

    const actionCounts = useMemo(() => {
        const counts: Record<Action, number> = { stock_up: 0, push: 0, monitor: 0, reduce: 0 };
        if (!data) return counts;
        for (const p of data.products) counts[p.action]++;
        return counts;
    }, [data]);

    const tone = data ? TONE_META[data.tone] : TONE_META.neutral;
    const ToneIcon = tone.icon;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-[#4050B4]/10 rounded-md">
                            <Sparkles className="w-5 h-5 text-[#4050B4]" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-900 truncate">Sugerencias de ventas</h2>
                                {data && (
                                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold', tone.iconColor)}>
                                        <ToneIcon className="w-3 h-3" /> {tone.label.toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                                {scopeLabel} · próximos {horizonDays} días · generado por Kesito
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleExportXlsx}
                            disabled={!data || loading || data.products.length === 0}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-none text-xs font-bold hover:bg-emerald-50 disabled:opacity-50"
                            title="Exportar sugerencias a Excel"
                        >
                            <Download className="w-3.5 h-3.5" />
                            XLSX
                        </button>
                        <button
                            onClick={handleExportPdf}
                            disabled={!data || loading || data.products.length === 0}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-rose-300 text-rose-700 rounded-none text-xs font-bold hover:bg-rose-50 disabled:opacity-50"
                            title="Exportar sugerencias a PDF"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            PDF
                        </button>
                        <button
                            onClick={fetchRecommendations}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-none text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
                            title="Regenerar sugerencias"
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
                            Analizando ventas históricas y mismo período del año pasado…
                        </div>
                    )}

                    {error && (
                        <div className="m-5 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">{error}</span>
                            <button onClick={fetchRecommendations} className="text-xs font-bold underline">Reintentar</button>
                        </div>
                    )}

                    {data && (
                        <div className="p-5 space-y-4">
                            {/* Narrative */}
                            <div className={cn('relative overflow-hidden bg-slate-50 border-l-4 p-4 rounded-r-md',
                                data.tone === 'positive' ? 'border-emerald-500' :
                                data.tone === 'attention' ? 'border-amber-500' : 'border-[#4050B4]'
                            )}>
                                <InlineMarkdown
                                    text={data.narrative}
                                    className="text-sm leading-relaxed text-slate-700 font-medium"
                                />
                            </div>

                            {/* Action filter chips */}
                            {data.products.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        onClick={() => setActionFilter('all')}
                                        className={cn(
                                            'text-xs font-bold px-3 py-1.5 rounded-full border transition-colors',
                                            actionFilter === 'all'
                                                ? 'bg-slate-800 text-white border-slate-800'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                        )}
                                    >
                                        Todos ({data.products.length})
                                    </button>
                                    {(Object.keys(ACTION_META) as Action[]).map(key => {
                                        const meta = ACTION_META[key];
                                        const Icon = meta.icon;
                                        const count = actionCounts[key];
                                        if (count === 0) return null;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setActionFilter(key)}
                                                className={cn(
                                                    'inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors',
                                                    actionFilter === key
                                                        ? `${meta.bg} ${meta.text} ${meta.border} border-2`
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                                )}
                                            >
                                                <Icon className="w-3 h-3" />
                                                {meta.label} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Products table */}
                            {data.products.length === 0 ? (
                                <div className="p-10 text-center text-sm text-slate-500">
                                    No hay datos suficientes para generar sugerencias en este período/scope.
                                </div>
                            ) : (
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 text-slate-500">
                                            <tr>
                                                <th className="text-left px-4 py-2.5 font-bold uppercase tracking-wider">Producto</th>
                                                <th className="text-left px-3 py-2.5 font-bold uppercase tracking-wider">Acción</th>
                                                <th className="text-left px-3 py-2.5 font-bold uppercase tracking-wider">Razón</th>
                                                <th className="text-right px-3 py-2.5 font-bold uppercase tracking-wider whitespace-nowrap">Reciente 30d</th>
                                                <th className="text-right px-3 py-2.5 font-bold uppercase tracking-wider whitespace-nowrap">Mismo período LY</th>
                                                <th className="text-center px-3 py-2.5 font-bold uppercase tracking-wider w-20">Detalle</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredProducts.map(p => {
                                                const meta = ACTION_META[p.action];
                                                const Icon = meta.icon;
                                                return (
                                                    <tr key={p.codigoInterno} className="border-t border-slate-100 hover:bg-slate-50">
                                                        <td className="px-4 py-2.5 align-top">
                                                            <div className="font-bold text-slate-800 max-w-[300px] truncate" title={p.descripcion}>
                                                                {p.descripcion}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                                                                #{p.codigoInterno}{p.depto && ` · ${p.depto}`}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 align-top">
                                                            <span className={cn(
                                                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap',
                                                                meta.bg, meta.text, meta.border
                                                            )}>
                                                                <Icon className="w-3 h-3" />
                                                                {meta.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 align-top text-slate-600 max-w-[320px]">
                                                            {p.reason || '—'}
                                                        </td>
                                                        <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                                                            <div className="font-semibold text-slate-800">{fmtCurrency(p.recentTotal)}</div>
                                                            <div className={cn(
                                                                'text-[10px] font-bold flex items-center justify-end gap-0.5',
                                                                p.recentGrowthPct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                                            )}>
                                                                {p.recentGrowthPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                                {p.recentGrowthPct >= 0 ? '+' : ''}{fmtPct(p.recentGrowthPct)}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                                                            <div className="font-semibold text-slate-800">{fmtCurrency(p.lyHorizonTotal)}</div>
                                                            {p.seasonalityRatio !== 1 && (
                                                                <div className="text-[10px] text-slate-500">
                                                                    ×{p.seasonalityRatio.toFixed(2)} estacional
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5 align-middle text-center">
                                                            <button
                                                                onClick={() => setExplainProduct(p)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-[#4050B4] text-[#4050B4] text-[10px] font-bold rounded-md hover:bg-[#4050B4] hover:text-white transition-colors"
                                                                title="Ver análisis detallado y gráficas"
                                                            >
                                                                <HelpCircle className="w-3 h-3" />
                                                                Explicar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {explainProduct && (
                <ProductExplainModal
                    codigoInterno={explainProduct.codigoInterno}
                    storeIds={storeIds}
                    horizonDays={horizonDays}
                    scopeLabel={scopeLabel}
                    initialAction={explainProduct.action}
                    initialReason={explainProduct.reason}
                    onClose={() => setExplainProduct(null)}
                />
            )}
        </div>
    );
}

// --- XLSX Export ---

type CellStyle = Record<string, unknown>;
type Cell = { v: string | number; t?: 's' | 'n'; s?: CellStyle };

const txt = (v: string, s?: CellStyle): Cell => ({ v, t: 's', s });
const num = (v: number, s?: CellStyle): Cell => ({ v, t: 'n', s });
const blank = (): Cell => ({ v: '', t: 's' });

function exportRecommendationsToXlsx(args: {
    data: RecommendationsResponse;
    scopeLabel: string;
    horizonDays: number;
}) {
    const { data, scopeLabel, horizonDays } = args;

    const BRAND = '4050B4';
    const SLATE_HEADER = '1E293B';
    const SLATE_LIGHT = 'F1F5F9';
    const BORDER = 'CBD5E1';

    const titleStyle: CellStyle = {
        font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: BRAND } },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    };
    const subtitleStyle: CellStyle = {
        font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '475569' } },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    };
    const sectionStyle: CellStyle = {
        font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: BRAND } },
        fill: { patternType: 'solid', fgColor: { rgb: SLATE_LIGHT } },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
        border: { bottom: { style: 'medium', color: { rgb: BRAND } } },
    };
    const narrativeStyle: CellStyle = {
        font: { name: 'Calibri', sz: 11, color: { rgb: SLATE_HEADER } },
        alignment: { horizontal: 'left', vertical: 'top', indent: 1, wrapText: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
    };
    const tableHeaderStyle: CellStyle = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: BRAND } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
            top: { style: 'thin', color: { rgb: BORDER } },
            bottom: { style: 'thin', color: { rgb: BORDER } },
            left: { style: 'thin', color: { rgb: BORDER } },
            right: { style: 'thin', color: { rgb: BORDER } },
        },
    };
    const rowBase: CellStyle = {
        font: { name: 'Calibri', sz: 10, color: { rgb: SLATE_HEADER } },
        alignment: { vertical: 'center', indent: 1, wrapText: true },
        border: { bottom: { style: 'hair', color: { rgb: BORDER } } },
    };
    const currencyBase: CellStyle = {
        ...rowBase,
        numFmt: '"$"#,##0',
        alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
    };
    const pctBase: CellStyle = {
        ...rowBase,
        numFmt: '+0%;-0%;0%',
        alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
    };

    const rows: Cell[][] = [];
    const merges: XLSX.Range[] = [];

    // Title strip
    rows.push([txt('  SUGERENCIAS DE VENTAS', titleStyle), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
    rows.push([txt(`  ${scopeLabel} · próximos ${horizonDays} días · generado ${new Date(data.generatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, subtitleStyle), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });

    rows.push([blank()]);

    // Narrative section
    rows.push([txt('  NARRATIVA', sectionStyle), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 7 } });

    const cleanNarrative = data.narrative.replace(/\*\*/g, '').replace(/\*/g, '');
    rows.push([txt(`  ${cleanNarrative}`, narrativeStyle), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 7 } });

    rows.push([blank()]);

    // Products table
    rows.push([txt('  PRODUCTOS RECOMENDADOS', sectionStyle), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 7 } });

    rows.push([
        txt('Código', tableHeaderStyle),
        txt('Producto', tableHeaderStyle),
        txt('Departamento', tableHeaderStyle),
        txt('Acción', tableHeaderStyle),
        txt('Razón', tableHeaderStyle),
        txt('Ventas últimos 30d', tableHeaderStyle),
        txt('Crecimiento vs. 30d previos', tableHeaderStyle),
        txt('Ventas mismo período LY', tableHeaderStyle),
    ]);

    for (const p of data.products) {
        const meta = ACTION_META[p.action];
        const actionStyle: CellStyle = {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: meta.xlsxText } },
            fill: { patternType: 'solid', fgColor: { rgb: meta.xlsxBg } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: { bottom: { style: 'hair', color: { rgb: BORDER } } },
        };
        const growthStyle: CellStyle = {
            ...pctBase,
            font: {
                name: 'Calibri', sz: 10, bold: true,
                color: { rgb: p.recentGrowthPct >= 0 ? '047857' : 'B91C1C' },
            },
        };

        rows.push([
            txt(String(p.codigoInterno), rowBase),
            txt(p.descripcion, rowBase),
            txt(p.depto || '—', rowBase),
            txt(meta.label.toUpperCase(), actionStyle),
            txt(p.reason || '—', rowBase),
            num(p.recentTotal, currencyBase),
            num(p.recentGrowthPct, growthStyle),
            num(p.lyHorizonTotal, currencyBase),
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
        { wch: 10 },
        { wch: 38 },
        { wch: 16 },
        { wch: 14 },
        { wch: 42 },
        { wch: 18 },
        { wch: 16 },
        { wch: 20 },
    ];
    ws['!rows'] = [{ hpt: 34 }];
    ws['!merges'] = merges;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sugerencias');

    const stamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Sugerencias_Ventas_${stamp}.xlsx`);
}

// --- PDF Export ---

const ACTION_PDF_COLORS: Record<Action, { bg: [number, number, number]; text: [number, number, number] }> = {
    stock_up: { bg: [209, 250, 229], text: [4, 120, 87] },
    push: { bg: [224, 231, 255], text: [55, 48, 163] },
    monitor: { bg: [254, 243, 199], text: [180, 83, 9] },
    reduce: { bg: [241, 245, 249], text: [71, 85, 105] },
};

function exportRecommendationsToPdf(args: {
    data: RecommendationsResponse;
    scopeLabel: string;
    horizonDays: number;
}) {
    const { data, scopeLabel, horizonDays } = args;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const usableWidth = pageWidth - margin * 2;

    const BRAND: [number, number, number] = [64, 80, 180];
    const DARK: [number, number, number] = [30, 41, 59];
    const MUTED: [number, number, number] = [100, 116, 139];
    const LIGHT: [number, number, number] = [241, 245, 249];

    // Header band
    doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.rect(0, 0, pageWidth, 60, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('SUGERENCIAS DE VENTAS', margin, 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${scopeLabel}  ·  próximos ${horizonDays} días`, margin, 47);

    const generatedText = `Generado: ${new Date(data.generatedAt).toLocaleString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`;
    doc.text(generatedText, pageWidth - margin, 47, { align: 'right' });

    let y = 84;

    // Narrative section header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('NARRATIVA', margin, y);
    y += 14;

    // Narrative text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    const cleanNarrative = data.narrative.replace(/\*\*/g, '').replace(/\*/g, '');
    const narrativeLines = doc.splitTextToSize(cleanNarrative, usableWidth);
    doc.text(narrativeLines, margin, y, { lineHeightFactor: 1.45 });
    y += narrativeLines.length * 15 + 16;

    // Action distribution chips
    const actionCounts: Record<Action, number> = { stock_up: 0, push: 0, monitor: 0, reduce: 0 };
    for (const p of data.products) actionCounts[p.action]++;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('DISTRIBUCIÓN', margin, y);
    y += 14;

    let chipX = margin;
    const chipHeight = 18;
    const drawChip = (label: string, count: number, action: Action) => {
        if (count === 0) return;
        const text = `${label} (${count})`;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        const width = doc.getTextWidth(text) + 16;
        const { bg, text: tc } = ACTION_PDF_COLORS[action];
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.roundedRect(chipX, y - 12, width, chipHeight, 4, 4, 'F');
        doc.setTextColor(tc[0], tc[1], tc[2]);
        doc.text(text, chipX + 8, y);
        chipX += width + 6;
    };
    drawChip('Cargar', actionCounts.stock_up, 'stock_up');
    drawChip('Empujar', actionCounts.push, 'push');
    drawChip('Monitorear', actionCounts.monitor, 'monitor');
    drawChip('Reducir', actionCounts.reduce, 'reduce');

    y += 22;

    // Products table
    const tableActions = data.products.map(p => p.action);
    const tableGrowth = data.products.map(p => p.recentGrowthPct);
    const tableSeasonality = data.products.map(p => p.seasonalityRatio);

    const tableData = data.products.map(p => [
        p.descripcion,
        ACTION_META[p.action].label,
        p.reason || '—',
        fmtCurrency(p.recentTotal),
        (p.recentGrowthPct >= 0 ? '+' : '') + fmtPct(p.recentGrowthPct),
        fmtCurrency(p.lyHorizonTotal),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Producto', 'Acción', 'Razón', 'Reciente 30d', 'Crec.', 'LY mismo período']],
        body: tableData,
        theme: 'plain',
        styles: {
            fontSize: 8,
            cellPadding: 5,
            textColor: DARK,
            lineColor: [203, 213, 225],
            lineWidth: 0.3,
            overflow: 'linebreak',
            valign: 'middle',
        },
        headStyles: {
            fillColor: BRAND,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            cellPadding: 6,
            halign: 'left',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin, top: 60, bottom: 40 },
        columnStyles: {
            0: { cellWidth: 130, fontStyle: 'bold' },
            1: { cellWidth: 60, halign: 'center', fontStyle: 'bold' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 56, halign: 'right' },
            4: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
            5: { cellWidth: 70, halign: 'right' },
        },
        didParseCell: (data) => {
            if (data.section !== 'body') return;
            const rowIdx = data.row.index;
            // Color the Acción cell by action
            if (data.column.index === 1) {
                const action = tableActions[rowIdx];
                const colors = ACTION_PDF_COLORS[action];
                data.cell.styles.fillColor = colors.bg;
                data.cell.styles.textColor = colors.text;
            }
            // Color growth column by sign
            if (data.column.index === 4) {
                const g = tableGrowth[rowIdx];
                if (g > 0) data.cell.styles.textColor = [4, 120, 87];
                else if (g < 0) data.cell.styles.textColor = [185, 28, 28];
            }
            // Add seasonal hint to LY column when ratio > 1.2 or < 0.8
            if (data.column.index === 5) {
                const ratio = tableSeasonality[rowIdx];
                if (ratio > 1.2 || ratio < 0.8) {
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        },
    });

    // Footer with page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text('Generado por Kesito · IA aplicada a histórico y mismo período del año anterior', margin, pageHeight - 18);
        doc.text(`${i} / ${pageCount}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
        // Thin top divider for footer
        doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
    }

    const stamp = new Date().toISOString().split('T')[0];
    doc.save(`Sugerencias_Ventas_${stamp}.pdf`);
}
