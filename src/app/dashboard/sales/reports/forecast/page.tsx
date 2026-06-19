"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    TrendingUp, TrendingDown, Sparkles, Calendar,
    Target, Activity, AlertCircle, RefreshCcw, X, Store as StoreIcon,
    Download, PartyPopper, History, Layers, Check, BadgeCheck, Flag,
    Pencil, Wand2, Undo2, Save, FolderOpen, Trash2, FileText
} from 'lucide-react';
import {
    ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend
} from 'recharts';
import { cn } from '@/lib/utils';
import { SalesForecastChart } from '@/components/dashboard/sales-forecast-chart';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { MultiSelect } from '@/components/ui/multi-select';
import { exportForecastToXlsx, type ForecastExportContext } from '@/lib/forecast/xlsx-export';
import { exportForecastToPdf } from '@/lib/forecast/pdf-export';
import {
    applyOverridesToForecast,
    bucketOverrideToDayOverrides,
    sumStoreForecastOnDate,
    type OverrideMode,
} from '@/lib/forecast/overrides';
import { NarrativeSummary, type PageSummaryContext } from '@/components/narrative-summary';
import { ProductRecommendationsModal } from '@/components/dashboard/product-recommendations-modal';
import { DeepSummaryModal } from '@/components/dashboard/deep-summary-modal';

interface Store { IdTienda: number; Tienda: string; }
interface HistoryPoint { fecha: string; total: number; }
interface ForecastPoint { fecha: string; predicted: number; lower: number; upper: number; }
interface Holiday {
    fecha: string;
    name: string;
    impact: 'high' | 'medium' | 'low';
    multiplier?: number;
    sourceFecha?: string;
}
interface BacktestPoint {
    fecha: string;
    actual: number;
    predicted: number;
    absPctError: number | null;
}
interface MetaProjection {
    idMeta: number;
    fechaInicio: string;
    fechaFin: string;
    daysElapsed: number;
    daysRemaining: number;
    storesIncluded: number;
    storesTotal: number;
    effectiveStoreIds: number[];
    target: number;
    actualToDate: number;
    projectedRemaining: number;
    projectedTotal: number;
    percentExpected: number;
    percentActual: number;
    hasConcepts: boolean;
    extrapolatedDays: number;
    note?: string;
}
interface Metrics {
    trend: number;
    confidence: number;
    mape: number | null;
    totalForecast: number;
    sameLengthHistorySum: number;
    projectedVsHistoryPct: number;
    horizonDays: number;
    historyDays: number;
    stores: { id: number; name: string }[];
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
const STORE_FALLBACK = ['#4050B4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const colorForStore = (name: string, idx: number) => {
    const clean = name?.trim().toUpperCase();
    return STORE_COLOR_MAP[clean] || STORE_FALLBACK[idx % STORE_FALLBACK.length];
};

const HORIZON_OPTIONS = [
    { label: '7 días', value: 7 },
    { label: '14 días', value: 14 },
    { label: '30 días', value: 30 },
    { label: '90 días', value: 90 },
];

type Granularity = 'day' | 'week' | 'month';

const GRANULARITY_OPTIONS: { label: string; value: Granularity }[] = [
    { label: 'Día', value: 'day' },
    { label: 'Semana', value: 'week' },
    { label: 'Mes', value: 'month' },
];

function bucketKey(fecha: string, gran: Granularity): string {
    if (gran === 'day') return fecha;
    const d = new Date(`${fecha}T00:00:00`);
    if (gran === 'month') {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}-01`;
    }
    // week: Monday-start ISO week
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function aggregateHistory(history: HistoryPoint[], gran: Granularity): HistoryPoint[] {
    if (gran === 'day') return history;
    const map = new Map<string, number>();
    for (const h of history) {
        const k = bucketKey(h.fecha, gran);
        map.set(k, (map.get(k) || 0) + h.total);
    }
    return Array.from(map.entries())
        .map(([fecha, total]) => ({ fecha, total }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function aggregateForecast(forecast: ForecastPoint[], gran: Granularity): ForecastPoint[] {
    if (gran === 'day') return forecast;
    const map = new Map<string, { predicted: number; sigmaSq: number }>();
    for (const f of forecast) {
        const k = bucketKey(f.fecha, gran);
        const sigma = (f.upper - f.lower) / 2;
        const cur = map.get(k) || { predicted: 0, sigmaSq: 0 };
        cur.predicted += f.predicted;
        cur.sigmaSq += sigma * sigma;
        map.set(k, cur);
    }
    return Array.from(map.entries())
        .map(([fecha, v]) => {
            const sigma = Math.sqrt(v.sigmaSq);
            return {
                fecha,
                predicted: Math.round(v.predicted),
                lower: Math.max(0, Math.round(v.predicted - sigma)),
                upper: Math.round(v.predicted + sigma),
            };
        })
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const fmtCurrency = (val: number) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
}).format(val);

const fmtPct = (val: number) => `${(val * 100).toFixed(1)}%`;

const fmtDate = (s: string) => {
    const d = new Date(`${s}T00:00:00`);
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
};

const fmtBucket = (s: string, gran: Granularity) => {
    const d = new Date(`${s}T00:00:00`);
    if (gran === 'month') {
        return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    }
    if (gran === 'week') {
        const end = new Date(d);
        end.setDate(d.getDate() + 6);
        const fmt = (x: Date) => x.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        return `${fmt(d)} – ${fmt(end)}`;
    }
    return fmtDate(s);
};

export default function SalesForecastPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
    const [horizonDays, setHorizonDays] = useState(30);
    const [granularity, setGranularity] = useState<Granularity>('day');
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [forecast, setForecast] = useState<ForecastPoint[]>([]);
    const [historyByStore, setHistoryByStore] = useState<Record<number, HistoryPoint[]>>({});
    const [forecastByStore, setForecastByStore] = useState<Record<number, ForecastPoint[]>>({});
    const [lastYear, setLastYear] = useState<HistoryPoint[] | null>(null);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [backtest, setBacktest] = useState<BacktestPoint[]>([]);
    const [metaProjections, setMetaProjections] = useState<MetaProjection[]>([]);
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showLastYear, setShowLastYear] = useState(false);
    const [breakdownByStore, setBreakdownByStore] = useState(false);
    const [aiMode, setAiMode] = useState(false);

    const [dayOverrides, setDayOverrides] = useState<Record<string, number>>({});
    const [editingBucket, setEditingBucket] = useState<{ fecha: string; gran: Granularity } | null>(null);

    // Plan persistence state
    const [currentPlan, setCurrentPlan] = useState<{ id: number; name: string } | null>(null);
    const [pendingOverrides, setPendingOverrides] = useState<Record<string, number> | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);

    // Product recommendations modal
    const [showProductRecsModal, setShowProductRecsModal] = useState(false);
    // Análisis Profundo IA modal
    const [deepSummaryOpen, setDeepSummaryOpen] = useState(false);

    useEffect(() => {
        fetch('/api/stores')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setStores(data); })
            .catch(err => console.error(err));
    }, []);

    const runForecast = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/forecast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeIds: selectedStoreIds.map(Number),
                    horizonDays,
                    // 400d ≈ 1 año + 1 mes, necesario para que computeHolidayBoosts
                    // encuentre el mismo feriado del año anterior con ventana ±14d.
                    historyDays: Math.max(400, horizonDays * 4),
                    includeLastYear: showLastYear,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error generando proyección');
            setHistory(data.history || []);
            setForecast(data.forecast || []);
            setHistoryByStore(data.historyByStore || {});
            setForecastByStore(data.forecastByStore || {});
            setLastYear(data.lastYear || null);
            setHolidays(Array.isArray(data.holidays) ? data.holidays : []);
            setBacktest(Array.isArray(data.backtest) ? data.backtest : []);
            setMetaProjections(Array.isArray(data.metaProjections) ? data.metaProjections : []);
            setMetrics(data.metrics || null);
            setDayOverrides({});
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [selectedStoreIds, horizonDays, showLastYear]);

    useEffect(() => {
        runForecast();
    }, [runForecast]);

    // After a refetch finishes, apply any pending overrides (used when loading a saved plan)
    useEffect(() => {
        if (!loading && pendingOverrides) {
            setDayOverrides(pendingOverrides);
            setPendingOverrides(null);
        }
    }, [loading, pendingOverrides]);

    const handleLoadPlan = useCallback((plan: {
        idPlan: number;
        nombre: string;
        storeIds: number[];
        horizonDays: number;
        overrides: Record<string, number>;
    }) => {
        setSelectedStoreIds(plan.storeIds.map(String));
        setHorizonDays(plan.horizonDays);
        setPendingOverrides(plan.overrides);
        setCurrentPlan({ id: plan.idPlan, name: plan.nombre });
        setShowLoadModal(false);
    }, []);

    const storeOptions = stores.map(s => ({ label: s.Tienda, value: String(s.IdTienda) }));

    const effectiveForecast = useMemo(
        () => applyOverridesToForecast(forecast, dayOverrides),
        [forecast, dayOverrides]
    );
    const aggregatedHistory = useMemo(() => aggregateHistory(history, granularity), [history, granularity]);
    const aggregatedForecast = useMemo(
        () => aggregateForecast(effectiveForecast, granularity),
        [effectiveForecast, granularity]
    );
    const aggregatedLastYear = useMemo(
        () => (lastYear ? aggregateHistory(lastYear, granularity) : null),
        [lastYear, granularity]
    );

    const storeSeries = useMemo(() => {
        if (!metrics?.stores) return [];
        return metrics.stores.map((s, idx) => ({
            id: s.id,
            name: s.name,
            color: colorForStore(s.name, idx),
            history: aggregateHistory(historyByStore[s.id] || [], granularity),
            forecast: aggregateForecast(forecastByStore[s.id] || [], granularity),
        }));
    }, [metrics, historyByStore, forecastByStore, granularity]);

    const hasOverrides = Object.keys(dayOverrides).length > 0;

    const effectiveTotalForecast = useMemo(
        () => effectiveForecast.reduce((a, b) => a + b.predicted, 0),
        [effectiveForecast]
    );

    const effectiveProjectedVsHistoryPct = useMemo(() => {
        if (!metrics || metrics.sameLengthHistorySum <= 0) return 0;
        return (effectiveTotalForecast - metrics.sameLengthHistorySum) / metrics.sameLengthHistorySum;
    }, [effectiveTotalForecast, metrics]);

    const effectiveMetaProjections = useMemo(() => {
        if (!hasOverrides) return metaProjections;
        return metaProjections.map(mp => {
            if (mp.hasConcepts) return mp;
            let delta = 0;
            for (const [fecha, overrideValue] of Object.entries(dayOverrides)) {
                if (fecha < mp.fechaInicio || fecha > mp.fechaFin) continue;
                const totalOrig = forecast.find(p => p.fecha === fecha)?.predicted ?? 0;
                if (totalOrig <= 0) continue;
                const metaShare = sumStoreForecastOnDate(forecastByStore, mp.effectiveStoreIds, fecha);
                const shareRatio = metaShare / totalOrig;
                delta += (overrideValue - totalOrig) * shareRatio;
            }
            const projectedRemaining = mp.projectedRemaining + delta;
            const projectedTotal = mp.actualToDate + projectedRemaining;
            const percentExpected = mp.target > 0 ? projectedTotal / mp.target : 0;
            return { ...mp, projectedRemaining, projectedTotal, percentExpected };
        });
    }, [metaProjections, dayOverrides, forecast, forecastByStore, hasOverrides]);

    const forecastHorizon = useMemo(() => {
        if (forecast.length === 0) return { start: '', end: '' };
        return { start: forecast[0].fecha, end: forecast[forecast.length - 1].fecha };
    }, [forecast]);

    const upcomingHolidays = useMemo(() => {
        if (!forecastHorizon.start) return [];
        return holidays.filter(
            h => h.fecha >= forecastHorizon.start && h.fecha <= forecastHorizon.end && h.impact !== 'low'
        );
    }, [holidays, forecastHorizon]);

    const summaryContext: PageSummaryContext = useMemo(() => {
        const scope = selectedStoreIds.length === 0
            ? `Todas las sucursales (${stores.length})`
            : selectedStoreIds.length === 1
                ? (stores.find(s => String(s.IdTienda) === selectedStoreIds[0])?.Tienda || '1 sucursal')
                : `${selectedStoreIds.length} sucursales`;

        const topStores = metrics?.stores
            ? metrics.stores
                .map(s => {
                    const fc = forecastByStore[s.id] || [];
                    return { name: s.name, value: fc.reduce((a, b) => a + b.predicted, 0) };
                })
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)
            : [];

        const anomalies: string[] = [];

        if (hasOverrides) {
            anomalies.push(
                `MODO PLANEACIÓN ACTIVO: el usuario aplicó ajustes manuales a ${Object.keys(dayOverrides).length} día(s). Los números reflejan el plan ajustado, no la proyección pura del modelo.`
            );
        }

        if (effectiveMetaProjections.length > 0) {
            for (const mp of effectiveMetaProjections) {
                if (mp.hasConcepts) continue;
                const pct = Math.round(mp.percentExpected * 100);
                const delta = mp.projectedTotal - mp.target;
                const sign = delta >= 0 ? 'excede' : 'queda corto en';
                anomalies.push(
                    `Meta ${mp.fechaInicio}–${mp.fechaFin}: proyección de cierre ${pct}% (${sign} ${Math.abs(delta).toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN), faltan ${mp.daysRemaining} días.`
                );
            }
        }

        const impactHolidays = holidays.filter(
            h => forecast.length > 0
                && h.fecha >= forecast[0].fecha
                && h.fecha <= forecast[forecast.length - 1].fecha
                && h.impact !== 'low'
        );
        if (impactHolidays.length > 0) {
            const parts = impactHolidays.slice(0, 3).map(h => {
                const boost = typeof h.multiplier === 'number'
                    ? ` (ajuste ${h.multiplier >= 1 ? '+' : ''}${Math.round((h.multiplier - 1) * 100)}%)`
                    : ' (sin ajuste por histórico insuficiente)';
                return `${h.fecha} ${h.name}${boost}`;
            }).join(', ');
            anomalies.push(`Festivos en horizonte: ${parts}.`);
        }

        if (metrics?.mape !== null && metrics?.mape !== undefined) {
            anomalies.push(`Error promedio del modelo (MAPE últimos 14d): ${(metrics.mape * 100).toFixed(1)}%.`);
        }

        const forecastStart = forecast[0]?.fecha || '';
        const forecastEnd = forecast[forecast.length - 1]?.fecha || '';

        return {
            pageContext: 'Proyección de Ventas',
            period: { fechaInicio: forecastStart, fechaFin: forecastEnd },
            scope,
            kpis: {
                'Proyección total horizonte': effectiveTotalForecast,
                'Histórico mismo número de días': metrics?.sameLengthHistorySum || 0,
                'Variación proyección vs histórico %': Number((effectiveProjectedVsHistoryPct * 100).toFixed(1)),
                'Tendencia mensual %': metrics ? Number((metrics.trend * 100).toFixed(1)) : 0,
                'Días de horizonte': metrics?.horizonDays || horizonDays,
            },
            highlights: {
                topStores,
                anomalies,
            },
        };
    }, [metrics, forecastByStore, effectiveMetaProjections, holidays, forecast, selectedStoreIds, stores, horizonDays, effectiveTotalForecast, effectiveProjectedVsHistoryPct, hasOverrides, dayOverrides]);

    const buildExportContext = (): ForecastExportContext | null => {
        if (aggregatedForecast.length === 0 || !metrics) return null;
        const scope = selectedStoreIds.length === 0
            ? `Todas las sucursales (${stores.length})`
            : selectedStoreIds.length === 1
                ? (stores.find(s => String(s.IdTienda) === selectedStoreIds[0])?.Tienda || '1 sucursal')
                : `${selectedStoreIds.length} sucursales seleccionadas`;
        const granLabel = GRANULARITY_OPTIONS.find(o => o.value === granularity)?.label || 'Día';

        return {
            scope,
            period: {
                start: forecast[0]?.fecha || '',
                end: forecast[forecast.length - 1]?.fecha || '',
            },
            horizonDays,
            granularityLabel: granLabel,
            generatedAt: new Date(),
            aggregatedForecast,
            aggregatedLastYear,
            dayOverrides,
            originalForecast: forecast,
            metrics: {
                totalForecast: effectiveTotalForecast,
                baselineTotalForecast: metrics.totalForecast,
                sameLengthHistorySum: metrics.sameLengthHistorySum,
                projectedVsHistoryPct: effectiveProjectedVsHistoryPct,
                trend: metrics.trend,
                mape: metrics.mape,
            },
            metaProjections: effectiveMetaProjections.map(mp => ({
                fechaInicio: mp.fechaInicio,
                fechaFin: mp.fechaFin,
                target: mp.target,
                actualToDate: mp.actualToDate,
                projectedRemaining: mp.projectedRemaining,
                projectedTotal: mp.projectedTotal,
                percentExpected: mp.percentExpected,
                daysRemaining: mp.daysRemaining,
                storesIncluded: mp.storesIncluded,
                hasConcepts: mp.hasConcepts,
            })),
            holidays,
            planName: currentPlan?.name,
        };
    };

    const handleExportXlsx = () => {
        const ctx = buildExportContext();
        if (ctx) exportForecastToXlsx(ctx);
    };

    const handleExportPdf = () => {
        const ctx = buildExportContext();
        if (ctx) exportForecastToPdf(ctx);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-3 px-6 rounded-none shadow-sm border border-slate-100">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                        <Sparkles className="text-[#4050B4]" />
                        PROYECCIÓN DE VENTAS
                    </h1>
                    <p className="hidden lg:block text-xs text-slate-500 max-w-md">
                        Promedio móvil estacional ponderado + ajuste de tendencia y festivos.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowLoadModal(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-none text-sm font-bold hover:bg-slate-50"
                        title="Cargar un plan guardado"
                    >
                        <FolderOpen className="w-4 h-4" />
                        Planes
                    </button>
                    <button
                        onClick={() => setShowSaveModal(true)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-violet-300 text-violet-700 rounded-none text-sm font-bold hover:bg-violet-50 disabled:opacity-50"
                        title="Guardar plan actual"
                    >
                        <Save className="w-4 h-4" />
                        Guardar
                    </button>
                    <button
                        onClick={handleExportXlsx}
                        disabled={loading || aggregatedForecast.length === 0}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-none text-sm font-bold hover:bg-emerald-50 disabled:opacity-50"
                        title="Exportar a Excel con formato"
                    >
                        <Download className="w-4 h-4" />
                        XLSX
                    </button>
                    <button
                        onClick={handleExportPdf}
                        disabled={loading || aggregatedForecast.length === 0}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-rose-300 text-rose-700 rounded-none text-sm font-bold hover:bg-rose-50 disabled:opacity-50"
                        title="Exportar a PDF"
                    >
                        <FileText className="w-4 h-4" />
                        PDF
                    </button>
                    <button
                        onClick={runForecast}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#4050B4] text-white rounded-none text-sm font-bold hover:bg-[#37469c] disabled:opacity-50"
                    >
                        <RefreshCcw className={cn('w-4 h-4', loading && 'animate-spin')} />
                        Recalcular
                    </button>

                    {/* Modo IA Switch */}
                    <div
                        className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-none shadow-sm h-[38px] cursor-pointer select-none hover:bg-slate-100 transition-all"
                        onClick={() => setAiMode(!aiMode)}
                        title="Activa el Asistente IA para obtener un resumen automático"
                    >
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            🤖 Modo IA
                        </span>
                        <div
                            className={cn(
                                "relative inline-flex h-4.5 w-8.5 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                                aiMode ? "bg-[#4050B4]" : "bg-slate-300"
                            )}
                        >
                            <span
                                className={cn(
                                    "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200",
                                    aiMode ? "translate-x-4" : "translate-x-0"
                                )}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Resumen narrativo automático */}
            {aiMode && !loading && metrics && (
                <NarrativeSummary context={summaryContext} />
            )}


            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1.5 min-w-[260px]">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Sucursales</label>
                        <MultiSelect
                            options={storeOptions}
                            selectedValues={selectedStoreIds}
                            onChange={setSelectedStoreIds}
                            placeholder="Todas las sucursales"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Horizonte</label>
                        <div className="flex gap-1">
                            {HORIZON_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setHorizonDays(opt.value)}
                                    className={cn(
                                        'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                                        horizonDays === opt.value
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">Opciones</label>
                        <div className="flex gap-2">
                            <ToggleChip
                                active={showLastYear}
                                onClick={() => setShowLastYear(v => !v)}
                                icon={<History className="w-3.5 h-3.5" />}
                                label="vs. Año anterior"
                            />
                            <ToggleChip
                                active={breakdownByStore}
                                onClick={() => setBreakdownByStore(v => !v)}
                                icon={<Layers className="w-3.5 h-3.5" />}
                                label="Por sucursal"
                            />
                            <button
                                type="button"
                                onClick={() => setShowProductRecsModal(true)}
                                disabled={loading || !metrics}
                                className="inline-flex items-center gap-2 h-10 px-3 rounded-md text-sm font-medium border bg-gradient-to-r from-[#4050B4] to-violet-600 text-white border-[#4050B4] hover:from-[#37469c] hover:to-violet-700 shadow-sm disabled:opacity-50"
                                title="Sugerencias de ventas con IA"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Sugerencias de ventas
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeepSummaryOpen(true)}
                                disabled={loading || !metrics}
                                className="inline-flex items-center gap-2 h-10 px-3 rounded-md text-sm font-medium border bg-[#4050B4] text-white border-[#4050B4] hover:bg-[#37469c] shadow-sm disabled:opacity-50"
                                title="Análisis profundo con IA de la proyección (hallazgos, oportunidades, riesgos, acciones)"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Análisis Profundo IA
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
                        Filtros activos:
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200">
                        <Calendar className="w-3.5 h-3.5" />
                        {HORIZON_OPTIONS.find(o => o.value === horizonDays)?.label || `${horizonDays} días`}
                    </span>

                    {selectedStoreIds.length === 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full border border-slate-200">
                            <StoreIcon className="w-3.5 h-3.5" />
                            Todas las sucursales ({stores.length})
                        </span>
                    ) : (
                        <>
                            {selectedStoreIds.map(id => {
                                const store = stores.find(s => String(s.IdTienda) === id);
                                if (!store) return null;
                                return (
                                    <span
                                        key={id}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200"
                                    >
                                        <StoreIcon className="w-3.5 h-3.5" />
                                        {store.Tienda}
                                        <button
                                            onClick={() => setSelectedStoreIds(prev => prev.filter(v => v !== id))}
                                            className="ml-0.5 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                                            aria-label={`Quitar ${store.Tienda}`}
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                );
                            })}
                            <button
                                onClick={() => setSelectedStoreIds([])}
                                className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium ml-1"
                            >
                                Limpiar selección
                            </button>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {loading && <LoadingScreen />}

            {!loading && metrics && (
                <>
                    {(hasOverrides || currentPlan) && (
                        <div className="flex items-center justify-between gap-3 bg-violet-50 border border-violet-200 rounded-lg p-3 flex-wrap">
                            <div className="flex items-center gap-2 text-sm text-violet-800 flex-wrap">
                                <Wand2 className="w-4 h-4" />
                                <span className="font-semibold">Modo Planeación activo</span>
                                {currentPlan && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-600 text-white text-xs font-bold rounded-full">
                                        <FolderOpen className="w-3 h-3" />
                                        {currentPlan.name}
                                    </span>
                                )}
                                {hasOverrides && (
                                    <span className="text-violet-600">
                                        · {Object.keys(dayOverrides).length} día(s) ajustados
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {currentPlan && (
                                    <button
                                        onClick={() => setCurrentPlan(null)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-600 text-xs font-bold rounded-md hover:bg-slate-100"
                                        title="Desvincular del plan guardado (la edición no afectará el plan)"
                                    >
                                        Desvincular
                                    </button>
                                )}
                                {hasOverrides && (
                                    <button
                                        onClick={() => setDayOverrides({})}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-violet-300 text-violet-700 text-xs font-bold rounded-md hover:bg-violet-100"
                                    >
                                        <Undo2 className="w-3.5 h-3.5" />
                                        Limpiar ajustes
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {effectiveMetaProjections.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {effectiveMetaProjections.map(mp => (
                                <MetaProjectionCard key={mp.idMeta} mp={mp} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Flag className="w-4 h-4 text-slate-400" />
                                <span>No hay metas activas para este período. Configura una para ver la proyección de cierre vs. meta.</span>
                            </div>
                            <a
                                href="/dashboard/sales/goals"
                                className="text-xs font-bold text-[#4050B4] hover:underline whitespace-nowrap"
                            >
                                Ir a Metas →
                            </a>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KpiCard
                            icon={<Target className="w-5 h-5 text-indigo-600" />}
                            label={`Proyección ${horizonDays} días`}
                            value={fmtCurrency(effectiveTotalForecast)}
                            sub={hasOverrides
                                ? `Base: ${fmtCurrency(metrics.totalForecast)}`
                                : undefined}
                            tone="indigo"
                        />
                        <KpiCard
                            icon={effectiveProjectedVsHistoryPct >= 0
                                ? <TrendingUp className="w-5 h-5 text-emerald-600" />
                                : <TrendingDown className="w-5 h-5 text-rose-600" />}
                            label={`vs. últimos ${horizonDays}d`}
                            value={fmtPct(effectiveProjectedVsHistoryPct)}
                            sub={`Histórico: ${fmtCurrency(metrics.sameLengthHistorySum)}`}
                            tone={effectiveProjectedVsHistoryPct >= 0 ? 'emerald' : 'rose'}
                        />
                        <KpiCard
                            icon={<Activity className="w-5 h-5 text-amber-600" />}
                            label="Tendencia mensual"
                            value={fmtPct(metrics.trend)}
                            sub="Últimos 30d vs. 30d previos"
                            tone="amber"
                        />
                        <KpiCard
                            icon={<Calendar className="w-5 h-5 text-slate-600" />}
                            label="Precisión backtest (MAPE)"
                            value={metrics.mape !== null ? fmtPct(metrics.mape) : 'N/A'}
                            sub={metrics.mape !== null ? 'Error promedio últimos 14d' : 'Histórico insuficiente'}
                            tone="slate"
                        />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                            <h2 className="text-sm font-semibold text-slate-700">
                                Histórico y proyección
                            </h2>
                            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-md">
                                <span className="text-xs font-medium text-slate-500 px-2">Agrupar por:</span>
                                {GRANULARITY_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setGranularity(opt.value)}
                                        className={cn(
                                            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                                            granularity === opt.value
                                                ? 'bg-white text-indigo-700 shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900'
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <SalesForecastChart
                            history={aggregatedHistory}
                            forecast={aggregatedForecast}
                            lastYear={aggregatedLastYear}
                            storeSeries={breakdownByStore ? storeSeries : undefined}
                            holidays={holidays}
                            granularity={granularity}
                            mode={breakdownByStore ? 'byStore' : 'total'}
                        />
                    </div>

                    {upcomingHolidays.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                                <PartyPopper className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-amber-900 mb-1">
                                        Festivos en el horizonte de proyección
                                    </h3>
                                    <p className="text-xs text-amber-700 mb-2">
                                        El modelo ajusta la proyección comparando contra el mismo festivo del año anterior. Los días sin ajuste no tuvieron histórico suficiente.
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {upcomingHolidays.map(h => {
                                            const hasBoost = typeof h.multiplier === 'number';
                                            const boostPct = hasBoost ? Math.round((h.multiplier! - 1) * 100) : 0;
                                            const boostLabel = hasBoost
                                                ? (boostPct >= 0 ? `+${boostPct}%` : `${boostPct}%`)
                                                : 'sin ajuste';
                                            return (
                                                <span
                                                    key={h.fecha}
                                                    title={hasBoost
                                                        ? `Ajustado vs. ${h.sourceFecha} (×${h.multiplier!.toFixed(2)})`
                                                        : 'Sin histórico suficiente para ajuste estacional'}
                                                    className={cn(
                                                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
                                                        h.impact === 'high'
                                                            ? 'bg-red-100 text-red-800 border-red-200'
                                                            : 'bg-amber-100 text-amber-800 border-amber-300'
                                                    )}
                                                >
                                                    {new Date(`${h.fecha}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} · {h.name}
                                                    <span className={cn(
                                                        'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight',
                                                        hasBoost
                                                            ? (boostPct >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white')
                                                            : 'bg-slate-200 text-slate-600'
                                                    )}>
                                                        {boostLabel}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {backtest.length > 0 && <BacktestCard points={backtest} />}

                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200">
                            <h2 className="text-sm font-semibold text-slate-700">
                                Detalle por {GRANULARITY_OPTIONS.find(o => o.value === granularity)?.label.toLowerCase()}
                            </h2>
                            <span className="text-xs text-slate-500">
                                Click en una fila para ajustar manualmente la proyección
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium">Periodo</th>
                                        <th className="px-4 py-2 text-right font-medium">Proyección</th>
                                        <th className="px-4 py-2 text-right font-medium">Mínimo</th>
                                        <th className="px-4 py-2 text-right font-medium">Máximo</th>
                                        <th className="px-4 py-2 text-center font-medium w-16">Ajuste</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aggregatedForecast.map((f) => {
                                        const bucketDays = getBucketDays(effectiveForecast, f.fecha, granularity);
                                        const isOverridden = bucketDays.some(d => d.fecha in dayOverrides);
                                        const originalBucketSum = bucketDays.reduce((acc, d) => {
                                            const orig = forecast.find(p => p.fecha === d.fecha)?.predicted ?? 0;
                                            return acc + orig;
                                        }, 0);
                                        const deltaPct = originalBucketSum > 0
                                            ? (f.predicted - originalBucketSum) / originalBucketSum
                                            : 0;
                                        return (
                                            <tr
                                                key={f.fecha}
                                                onClick={() => setEditingBucket({ fecha: f.fecha, gran: granularity })}
                                                className={cn(
                                                    'border-t border-slate-100 cursor-pointer transition-colors',
                                                    isOverridden ? 'bg-violet-50 hover:bg-violet-100' : 'hover:bg-slate-50'
                                                )}
                                            >
                                                <td className="px-4 py-2 text-slate-700">
                                                    <div className="flex items-center gap-2">
                                                        {fmtBucket(f.fecha, granularity)}
                                                        {isOverridden && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white">
                                                                {deltaPct >= 0 ? '+' : ''}{Math.round(deltaPct * 100)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={cn(
                                                    'px-4 py-2 text-right font-medium',
                                                    isOverridden ? 'text-violet-700' : 'text-slate-900'
                                                )}>
                                                    {fmtCurrency(f.predicted)}
                                                    {isOverridden && (
                                                        <div className="text-[10px] text-slate-400 font-normal line-through">
                                                            {fmtCurrency(originalBucketSum)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-right text-slate-500">{fmtCurrency(f.lower)}</td>
                                                <td className="px-4 py-2 text-right text-slate-500">{fmtCurrency(f.upper)}</td>
                                                <td className="px-4 py-2 text-center">
                                                    {isOverridden ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDayOverrides(prev => {
                                                                    const next = { ...prev };
                                                                    for (const d of bucketDays) delete next[d.fecha];
                                                                    return next;
                                                                });
                                                            }}
                                                            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white border border-violet-300 text-violet-600 hover:bg-violet-100"
                                                            title="Revertir ajuste"
                                                        >
                                                            <Undo2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-300 group-hover:text-slate-500">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {editingBucket && (
                <OverrideEditorModal
                    bucket={editingBucket}
                    forecast={forecast}
                    effectiveForecast={effectiveForecast}
                    onClose={() => setEditingBucket(null)}
                    onApply={(perDay) => {
                        setDayOverrides(prev => ({ ...prev, ...perDay }));
                        setEditingBucket(null);
                    }}
                />
            )}

            {showSaveModal && (
                <SavePlanModal
                    currentPlan={currentPlan}
                    storeIds={selectedStoreIds.map(Number)}
                    horizonDays={horizonDays}
                    overrides={dayOverrides}
                    onClose={() => setShowSaveModal(false)}
                    onSaved={(idPlan, nombre) => {
                        setCurrentPlan({ id: idPlan, name: nombre });
                        setShowSaveModal(false);
                    }}
                />
            )}

            {showLoadModal && (
                <LoadPlanModal
                    onClose={() => setShowLoadModal(false)}
                    onLoad={handleLoadPlan}
                />
            )}

            {showProductRecsModal && (
                <ProductRecommendationsModal
                    storeIds={selectedStoreIds.map(Number)}
                    horizonDays={horizonDays}
                    scopeLabel={
                        selectedStoreIds.length === 0
                            ? `Todas las sucursales (${stores.length})`
                            : selectedStoreIds.length === 1
                                ? (stores.find(s => String(s.IdTienda) === selectedStoreIds[0])?.Tienda || '1 sucursal')
                                : `${selectedStoreIds.length} sucursales`
                    }
                    onClose={() => setShowProductRecsModal(false)}
                />
            )}

            <DeepSummaryModal
                open={deepSummaryOpen}
                onClose={() => setDeepSummaryOpen(false)}
                context={summaryContext}
            />
        </div>
    );
}

function getBucketDays(forecast: ForecastPoint[], bucketFecha: string, gran: Granularity): ForecastPoint[] {
    return forecast.filter(p => bucketKey(p.fecha, gran) === bucketFecha);
}

function ToggleChip({ active, onClick, icon, label }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'inline-flex items-center gap-2 h-10 px-3 rounded-md text-sm font-medium border transition-all',
                active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm hover:bg-indigo-700'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:text-slate-900'
            )}
        >
            <span className={cn(
                'inline-flex items-center justify-center w-4 h-4 rounded-sm border transition-colors',
                active ? 'bg-white border-white text-indigo-700' : 'border-slate-300 text-transparent'
            )}>
                <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            {icon}
            {label}
        </button>
    );
}

interface SavedPlan {
    idPlan: number;
    nombre: string;
    storeIds: number[];
    horizonDays: number;
    overrides: Record<string, number>;
    overridesCount: number;
    fechaAct: string;
}

function SavePlanModal({
    currentPlan,
    storeIds,
    horizonDays,
    overrides,
    onClose,
    onSaved,
}: {
    currentPlan: { id: number; name: string } | null;
    storeIds: number[];
    horizonDays: number;
    overrides: Record<string, number>;
    onClose: () => void;
    onSaved: (idPlan: number, nombre: string) => void;
}) {
    const [nombre, setNombre] = useState(currentPlan?.name || '');
    const [saveAsNew, setSaveAsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isUpdating = !!currentPlan && !saveAsNew && nombre === currentPlan.name;
    const overrideCount = Object.keys(overrides).length;

    const handleSave = async () => {
        const trimmed = nombre.trim();
        if (!trimmed) {
            setError('Nombre requerido');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const body = {
                idPlan: isUpdating ? currentPlan!.id : null,
                nombre: trimmed,
                storeIds,
                horizonDays,
                overrides,
            };
            const res = await fetch('/api/dashboard/forecast/plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');
            onSaved(data.idPlan ?? currentPlan?.id ?? 0, trimmed);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Save className="w-4 h-4 text-violet-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                                {currentPlan ? 'Guardar cambios' : 'Guardar plan nuevo'}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Guardar plan</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Nombre del plan</label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            autoFocus
                            placeholder="Plan Mayo conservador"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleSave(); }}
                        />
                    </div>

                    {currentPlan && (
                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={saveAsNew}
                                onChange={(e) => setSaveAsNew(e.target.checked)}
                                className="w-3.5 h-3.5"
                            />
                            <span>Guardar como nuevo plan (sin modificar &quot;{currentPlan.name}&quot;)</span>
                        </label>
                    )}

                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1 text-xs text-slate-600">
                        <div className="flex justify-between">
                            <span>Sucursales:</span>
                            <span className="font-medium text-slate-800">
                                {storeIds.length === 0 ? 'Todas' : `${storeIds.length} seleccionadas`}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Horizonte:</span>
                            <span className="font-medium text-slate-800">{horizonDays} días</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Días ajustados:</span>
                            <span className="font-medium text-slate-800">{overrideCount}</span>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 mt-5">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !nombre.trim()}
                        className="px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Guardando…' : isUpdating ? 'Actualizar plan' : 'Guardar plan'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function LoadPlanModal({
    onClose,
    onLoad,
}: {
    onClose: () => void;
    onLoad: (plan: SavedPlan) => void;
}) {
    const [plans, setPlans] = useState<SavedPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);

    const fetchPlans = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/forecast/plans');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error cargando planes');
            setPlans(Array.isArray(data) ? data : []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPlans(); }, [fetchPlans]);

    const handleDelete = async (idPlan: number) => {
        if (!confirm('¿Eliminar este plan?')) return;
        setDeleting(idPlan);
        try {
            await fetch(`/api/dashboard/forecast/plans?id=${idPlan}`, { method: 'DELETE' });
            setPlans(prev => prev.filter(p => p.idPlan !== idPlan));
        } catch (e) {
            console.error(e);
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between p-5 border-b border-slate-200">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <FolderOpen className="w-4 h-4 text-violet-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                                Planes guardados
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Cargar plan</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto">
                    {loading && (
                        <div className="p-8 text-center text-sm text-slate-500">Cargando…</div>
                    )}
                    {error && (
                        <div className="m-5 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}
                    {!loading && !error && plans.length === 0 && (
                        <div className="p-8 text-center text-sm text-slate-500">
                            No hay planes guardados todavía. Crea uno con el botón <strong>Guardar</strong> del encabezado.
                        </div>
                    )}
                    {!loading && plans.map(p => (
                        <div
                            key={p.idPlan}
                            className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 hover:bg-slate-50"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-900 truncate">{p.nombre}</div>
                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span>{new Date(p.fechaAct).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    <span>·</span>
                                    <span>{p.storeIds.length === 0 ? 'Todas las sucursales' : `${p.storeIds.length} suc.`}</span>
                                    <span>·</span>
                                    <span>{p.horizonDays}d horizonte</span>
                                    {p.overridesCount > 0 && (
                                        <>
                                            <span>·</span>
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-bold">
                                                <Wand2 className="w-2.5 h-2.5" />
                                                {p.overridesCount} ajuste(s)
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                    onClick={() => onLoad(p)}
                                    className="px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-md hover:bg-violet-700"
                                >
                                    Cargar
                                </button>
                                <button
                                    onClick={() => handleDelete(p.idPlan)}
                                    disabled={deleting === p.idPlan}
                                    className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-md disabled:opacity-50"
                                    title="Eliminar plan"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function OverrideEditorModal({
    bucket,
    forecast,
    effectiveForecast,
    onClose,
    onApply,
}: {
    bucket: { fecha: string; gran: Granularity };
    forecast: ForecastPoint[];
    effectiveForecast: ForecastPoint[];
    onClose: () => void;
    onApply: (perDay: Record<string, number>) => void;
}) {
    const [mode, setMode] = useState<OverrideMode>('pct');
    const [value, setValue] = useState<string>('');

    const bucketDaysOriginal = useMemo(
        () => getBucketDays(forecast, bucket.fecha, bucket.gran),
        [forecast, bucket]
    );
    const bucketDaysEffective = useMemo(
        () => getBucketDays(effectiveForecast, bucket.fecha, bucket.gran),
        [effectiveForecast, bucket]
    );

    const originalSum = bucketDaysOriginal.reduce((a, b) => a + b.predicted, 0);
    const currentSum = bucketDaysEffective.reduce((a, b) => a + b.predicted, 0);

    const numericValue = Number(value);
    const validValue = value !== '' && Number.isFinite(numericValue);

    const previewSum = useMemo(() => {
        if (!validValue) return currentSum;
        if (mode === 'pct') return currentSum * (1 + numericValue / 100);
        if (mode === 'delta') return currentSum + numericValue;
        return numericValue; // replace
    }, [validValue, numericValue, mode, currentSum]);

    const previewDelta = previewSum - originalSum;
    const previewDeltaPct = originalSum > 0 ? previewDelta / originalSum : 0;

    const label = bucket.gran === 'day'
        ? new Date(`${bucket.fecha}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
        : bucket.gran === 'week'
            ? (() => {
                const d = new Date(`${bucket.fecha}T00:00:00`);
                const end = new Date(d);
                end.setDate(d.getDate() + 6);
                const f = (x: Date) => x.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                return `Semana ${f(d)} – ${f(end)}`;
            })()
            : new Date(`${bucket.fecha}T00:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

    const handleApply = () => {
        if (!validValue) return;
        const perDay = bucketOverrideToDayOverrides(bucketDaysEffective, { mode, value: numericValue });
        onApply(perDay);
    };

    const modeButtons: Array<{ value: OverrideMode; label: string; hint: string }> = [
        { value: 'pct', label: '%', hint: 'Porcentaje (ej. 30 = +30%, -10 = -10%)' },
        { value: 'delta', label: '+/- $', hint: 'Sumar o restar pesos (ej. 50000 o -20000)' },
        { value: 'replace', label: 'Reemplazar', hint: 'Establecer el total exacto del período' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Wand2 className="w-4 h-4 text-violet-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                                Ajuste manual
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 capitalize">{label}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            {bucketDaysOriginal.length} día(s) — base modelo: {fmtCurrency(originalSum)}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Tipo de ajuste</label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {modeButtons.map(b => (
                                <button
                                    key={b.value}
                                    onClick={() => setMode(b.value)}
                                    title={b.hint}
                                    className={cn(
                                        'px-2 py-2 rounded-md text-xs font-bold border transition-colors',
                                        mode === b.value
                                            ? 'bg-violet-600 text-white border-violet-600'
                                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                    )}
                                >
                                    {b.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                            {mode === 'pct' ? 'Variación %' : mode === 'delta' ? 'Suma/Resta MXN' : 'Total nuevo MXN'}
                        </label>
                        <input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoFocus
                            placeholder={mode === 'pct' ? '30' : mode === 'delta' ? '50000' : '200000'}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            onKeyDown={(e) => { if (e.key === 'Enter' && validValue) handleApply(); }}
                        />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Actual:</span>
                            <span className="font-medium text-slate-700">{fmtCurrency(currentSum)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Después:</span>
                            <span className="font-bold text-violet-700">{fmtCurrency(Math.max(0, previewSum))}</span>
                        </div>
                        {validValue && Math.abs(previewDelta) > 0.5 && (
                            <div className={cn(
                                'flex items-center justify-between text-xs pt-1.5 border-t border-slate-200',
                                previewDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            )}>
                                <span>vs. modelo:</span>
                                <span className="font-bold">
                                    {previewDelta >= 0 ? '+' : ''}{fmtCurrency(previewDelta)} ({previewDelta >= 0 ? '+' : ''}{(previewDeltaPct * 100).toFixed(1)}%)
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-5">
                    <button
                        onClick={onClose}
                        className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!validValue}
                        className="px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Aplicar ajuste
                    </button>
                </div>
            </div>
        </div>
    );
}

function MetaProjectionCard({ mp }: { mp: MetaProjection }) {
    const fmtRange = () => {
        const s = new Date(`${mp.fechaInicio}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
        const e = new Date(`${mp.fechaFin}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${s} – ${e}`;
    };

    if (mp.hasConcepts) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Flag className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Meta {fmtRange()}</h3>
                </div>
                <div className="text-sm text-slate-500">Meta: {fmtCurrency(mp.target)}</div>
                <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {mp.note}
                </div>
            </div>
        );
    }

    const pctExpected = mp.percentExpected;
    const pctActual = mp.percentActual;
    const tone = pctExpected >= 1 ? 'emerald' : pctExpected >= 0.9 ? 'amber' : 'rose';
    const toneClasses = {
        emerald: { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600' },
        amber: { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600' },
        rose: { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-600' },
    }[tone];

    const delta = mp.projectedTotal - mp.target;
    const deltaLabel = delta >= 0
        ? `Excede meta por ${fmtCurrency(delta)}`
        : `Faltan ${fmtCurrency(Math.abs(delta))} para meta`;

    const barPctExpected = Math.min(100, pctExpected * 100);
    const barPctActual = Math.min(100, pctActual * 100);

    return (
        <div className={cn('border rounded-lg p-4', toneClasses.bg, toneClasses.border)}>
            <div className="flex items-start justify-between mb-3 gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Flag className={cn('w-4 h-4', toneClasses.icon)} />
                        <h3 className="text-sm font-semibold text-slate-800">Meta {fmtRange()}</h3>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        {mp.storesIncluded} de {mp.storesTotal} sucursales · transcurridos {mp.daysElapsed}d · restan {mp.daysRemaining}d
                    </div>
                </div>
                <div className={cn('text-right')}>
                    <div className={cn('text-2xl font-bold', toneClasses.text)}>{Math.round(pctExpected * 100)}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Proyección de cierre</div>
                </div>
            </div>

            <div className="relative h-3 bg-white/60 rounded-full overflow-hidden border border-white">
                <div
                    className="absolute inset-y-0 left-0 bg-slate-400/60"
                    style={{ width: `${barPctActual}%` }}
                    title={`Real al ${new Date(`${mp.fechaInicio}T00:00:00`).toLocaleDateString('es-MX')}: ${Math.round(pctActual * 100)}%`}
                />
                <div
                    className={cn('absolute inset-y-0 left-0 opacity-80', toneClasses.bar)}
                    style={{ width: `${barPctExpected}%`, mixBlendMode: 'multiply' }}
                />
                <div className="absolute inset-y-0 right-0 w-px bg-slate-700" />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div>
                    <div className="text-slate-500">Real a hoy</div>
                    <div className="font-semibold text-slate-800">{fmtCurrency(mp.actualToDate)}</div>
                    <div className="text-[11px] text-slate-500">{Math.round(pctActual * 100)}%</div>
                </div>
                <div>
                    <div className="text-slate-500">Proyección restante</div>
                    <div className="font-semibold text-slate-800">{fmtCurrency(mp.projectedRemaining)}</div>
                    {mp.extrapolatedDays > 0 && (
                        <div className="text-[11px] text-slate-500" title="Días extrapolados con promedio diario">
                            +{mp.extrapolatedDays}d extrapolados
                        </div>
                    )}
                </div>
                <div>
                    <div className="text-slate-500">Meta</div>
                    <div className="font-semibold text-slate-800">{fmtCurrency(mp.target)}</div>
                </div>
            </div>

            <div className={cn('mt-3 text-xs font-medium', toneClasses.text)}>
                {deltaLabel}
            </div>
        </div>
    );
}

function BacktestCard({ points }: { points: BacktestPoint[] }) {
    const validPoints = points.filter(p => p.absPctError !== null);
    const withinBand = validPoints.filter(p => (p.absPctError as number) <= 0.10).length;
    const total = validPoints.length;
    const pctWithin = total > 0 ? Math.round((withinBand / total) * 100) : 0;

    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-semibold text-slate-700">
                        Validación del modelo · últimos {points.length} días
                    </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
                    {withinBand} de {total} días dentro del ±10%  ({pctWithin}%)
                </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
                Para cada día, el modelo predijo usando solo datos previos a esa fecha y se comparó contra la venta real.
            </p>
            <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={points} margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="fecha"
                        tickFormatter={(s) => {
                            const d = new Date(`${s}T00:00:00`);
                            return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
                        }}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        minTickGap={20}
                    />
                    <YAxis
                        tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <Tooltip
                        formatter={(value, name) => [fmtCurrency(Number(value)), String(name)]}
                        labelFormatter={(label) => {
                            const d = new Date(`${String(label)}T00:00:00`);
                            return d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
                        }}
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#4050B4"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Real"
                    />
                    <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#10B981"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={{ r: 3 }}
                        name="Predicho"
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

function KpiCard({ icon, label, value, sub, tone }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    tone: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
}) {
    const toneBg = {
        indigo: 'bg-indigo-50',
        emerald: 'bg-emerald-50',
        rose: 'bg-rose-50',
        amber: 'bg-amber-50',
        slate: 'bg-slate-50',
    }[tone];

    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
                <div className={cn('p-2 rounded-md', toneBg)}>{icon}</div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
    );
}
