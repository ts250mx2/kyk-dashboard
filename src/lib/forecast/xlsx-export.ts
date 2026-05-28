import * as XLSX from 'xlsx-js-style';
import type { ForecastPoint, HistoryPoint } from './seasonal-moving-average';

type CellStyle = Record<string, unknown>;
type Cell = { v: string | number; t?: 's' | 'n'; s?: CellStyle; z?: string };

interface HolidayInfo {
    fecha: string;
    name: string;
    impact: 'high' | 'medium' | 'low';
    multiplier?: number;
}

interface MetaInfo {
    fechaInicio: string;
    fechaFin: string;
    target: number;
    actualToDate: number;
    projectedRemaining: number;
    projectedTotal: number;
    percentExpected: number;
    daysRemaining: number;
    storesIncluded: number;
    hasConcepts: boolean;
}

export interface ForecastExportContext {
    scope: string;
    period: { start: string; end: string };
    horizonDays: number;
    granularityLabel: string;
    generatedAt: Date;

    aggregatedForecast: ForecastPoint[];
    aggregatedLastYear: HistoryPoint[] | null;

    dayOverrides: Record<string, number>;
    originalForecast: ForecastPoint[];

    metrics: {
        totalForecast: number;
        baselineTotalForecast: number;
        sameLengthHistorySum: number;
        projectedVsHistoryPct: number;
        trend: number;
        mape: number | null;
    };

    metaProjections: MetaInfo[];
    holidays: HolidayInfo[];

    planName?: string;
}

// --- Styles ---

const BRAND = '4050B4';
const BRAND_LIGHT = 'E0E7FF';
const VIOLET = '6D28D9';
const VIOLET_LIGHT = 'EDE9FE';
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
const kpiLabelStyle: CellStyle = {
    font: { name: 'Calibri', sz: 10, color: { rgb: '64748B' } },
    alignment: { horizontal: 'right', vertical: 'center' },
};
const kpiValueStyle: CellStyle = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: SLATE_HEADER } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
};
const kpiCurrencyStyle: CellStyle = {
    ...kpiValueStyle,
    numFmt: '"$"#,##0_);[Red]"-$"#,##0',
};
const kpiPercentStyle: CellStyle = {
    ...kpiValueStyle,
    numFmt: '0.0%;[Red]-0.0%',
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
const rowStyle: CellStyle = {
    font: { name: 'Calibri', sz: 10, color: { rgb: SLATE_HEADER } },
    alignment: { vertical: 'center', indent: 1 },
    border: { bottom: { style: 'hair', color: { rgb: BORDER } } },
};
const rowAltStyle: CellStyle = {
    ...rowStyle,
    fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
};
const rowCurrencyStyle: CellStyle = {
    ...rowStyle,
    numFmt: '"$"#,##0',
    alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
};
const rowCurrencyAltStyle: CellStyle = {
    ...rowAltStyle,
    numFmt: '"$"#,##0',
    alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
};
const overrideRowStyle: CellStyle = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: VIOLET } },
    fill: { patternType: 'solid', fgColor: { rgb: VIOLET_LIGHT } },
    alignment: { vertical: 'center', indent: 1 },
    border: { bottom: { style: 'hair', color: { rgb: BORDER } } },
};
const overrideCurrencyStyle: CellStyle = {
    ...overrideRowStyle,
    numFmt: '"$"#,##0',
    alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
};
const totalRowStyle: CellStyle = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: SLATE_HEADER } },
    fill: { patternType: 'solid', fgColor: { rgb: BRAND_LIGHT } },
    alignment: { vertical: 'center', indent: 1 },
    border: {
        top: { style: 'medium', color: { rgb: BRAND } },
        bottom: { style: 'medium', color: { rgb: BRAND } },
    },
};
const totalCurrencyStyle: CellStyle = {
    ...totalRowStyle,
    numFmt: '"$"#,##0',
    alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
};

const noteStyle: CellStyle = {
    font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '64748B' } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1, wrapText: true },
};

// --- Helpers ---

const txt = (v: string, s?: CellStyle): Cell => ({ v, t: 's', s });
const num = (v: number, s?: CellStyle): Cell => ({ v, t: 'n', s });
const blank = (): Cell => ({ v: '', t: 's' });

function fmtDateLong(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
}

function bucketLabel(iso: string, granLabel: string): string {
    const d = new Date(`${iso}T00:00:00`);
    if (granLabel.toLowerCase() === 'mes') {
        return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    }
    if (granLabel.toLowerCase() === 'semana') {
        const end = new Date(d);
        end.setDate(d.getDate() + 6);
        const f = (x: Date) => x.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
        return `Sem ${f(d)} – ${f(end)}`;
    }
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

// --- Sheet builders ---

function buildResumenSheet(ctx: ForecastExportContext): XLSX.WorkSheet {
    const rows: Cell[][] = [];
    const merges: XLSX.Range[] = [];

    // Title row
    rows.push([txt('  PROYECCIÓN DE VENTAS', titleStyle), blank(), blank(), blank()]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
    rows.push([txt(`  ${ctx.scope} · ${ctx.horizonDays} días · generado ${ctx.generatedAt.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`, subtitleStyle), blank(), blank(), blank()]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } });

    if (ctx.planName) {
        rows.push([txt(`  Plan: ${ctx.planName}`, { ...subtitleStyle, font: { ...(subtitleStyle.font as object), bold: true, italic: false, color: { rgb: VIOLET } } }), blank(), blank(), blank()]);
        merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 3 } });
    }

    rows.push([blank(), blank(), blank(), blank()]);

    // KPIs section
    rows.push([txt('  RESUMEN', sectionStyle), blank(), blank(), blank()]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 3 } });

    const hasOverrides = Object.keys(ctx.dayOverrides).length > 0;
    const overrideDelta = ctx.metrics.totalForecast - ctx.metrics.baselineTotalForecast;

    const kpiRows: Array<[string, number, CellStyle]> = [
        [`Proyección horizonte ${ctx.horizonDays}d`, ctx.metrics.totalForecast, kpiCurrencyStyle],
    ];
    if (hasOverrides) {
        kpiRows.push(['  → Base modelo', ctx.metrics.baselineTotalForecast, kpiCurrencyStyle]);
        kpiRows.push(['  → Ajuste manual', overrideDelta, kpiCurrencyStyle]);
    }
    kpiRows.push([`Histórico mismos ${ctx.horizonDays}d`, ctx.metrics.sameLengthHistorySum, kpiCurrencyStyle]);
    kpiRows.push(['Variación proyectado vs histórico', ctx.metrics.projectedVsHistoryPct, kpiPercentStyle]);
    kpiRows.push(['Tendencia mensual', ctx.metrics.trend, kpiPercentStyle]);
    if (ctx.metrics.mape !== null) {
        kpiRows.push(['Precisión backtest (MAPE 14d)', ctx.metrics.mape, kpiPercentStyle]);
    }

    for (const [label, value, style] of kpiRows) {
        rows.push([txt(label, kpiLabelStyle), num(value, style), blank(), blank()]);
        merges.push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: 3 } });
    }

    rows.push([blank(), blank(), blank(), blank()]);

    // Metas
    const activeMetas = ctx.metaProjections.filter(m => !m.hasConcepts);
    if (activeMetas.length > 0) {
        rows.push([txt('  METAS DEL PERÍODO', sectionStyle), blank(), blank(), blank()]);
        merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 3 } });

        rows.push([
            txt('Período', tableHeaderStyle),
            txt('Meta', tableHeaderStyle),
            txt('Real a hoy', tableHeaderStyle),
            txt('Proyección cierre', tableHeaderStyle),
        ]);

        for (const mp of activeMetas) {
            const pct = mp.percentExpected;
            const pctStyle: CellStyle = {
                ...rowCurrencyStyle,
                numFmt: '0.0%',
                font: {
                    ...(rowCurrencyStyle.font as object),
                    bold: true,
                    color: { rgb: pct >= 1 ? '047857' : pct >= 0.9 ? 'D97706' : 'B91C1C' },
                },
            };
            rows.push([
                txt(`${fmtDateLong(mp.fechaInicio)} – ${fmtDateLong(mp.fechaFin)} (${mp.storesIncluded} suc.)`, rowStyle),
                num(mp.target, rowCurrencyStyle),
                num(mp.actualToDate, rowCurrencyStyle),
                num(mp.projectedTotal, rowCurrencyStyle),
            ]);
            rows.push([
                txt('   ↳ % esperado de cierre', noteStyle),
                num(pct, pctStyle),
                txt(`Faltan ${mp.daysRemaining}d`, noteStyle),
                txt(pct >= 1
                    ? `Excede meta por $${Math.round(mp.projectedTotal - mp.target).toLocaleString('es-MX')}`
                    : `Faltan $${Math.round(mp.target - mp.projectedTotal).toLocaleString('es-MX')} para meta`,
                    { ...noteStyle, font: { ...(noteStyle.font as object), bold: true, color: { rgb: pct >= 1 ? '047857' : pct >= 0.9 ? 'D97706' : 'B91C1C' } } }),
            ]);
        }
        rows.push([blank(), blank(), blank(), blank()]);
    }

    // Festivos
    const upcomingHolidays = ctx.holidays.filter(
        h => h.impact !== 'low' && h.fecha >= ctx.period.start && h.fecha <= ctx.period.end
    );
    if (upcomingHolidays.length > 0) {
        rows.push([txt('  FESTIVOS EN EL HORIZONTE', sectionStyle), blank(), blank(), blank()]);
        merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 3 } });
        rows.push([
            txt('Fecha', tableHeaderStyle),
            txt('Festivo', tableHeaderStyle),
            txt('Impacto', tableHeaderStyle),
            txt('Ajuste vs. año anterior', tableHeaderStyle),
        ]);
        for (const h of upcomingHolidays) {
            const hasMult = typeof h.multiplier === 'number';
            const adj = hasMult
                ? `×${h.multiplier!.toFixed(2)} (${h.multiplier! >= 1 ? '+' : ''}${Math.round((h.multiplier! - 1) * 100)}%)`
                : 'sin ajuste';
            rows.push([
                txt(fmtDateLong(h.fecha), rowStyle),
                txt(h.name, rowStyle),
                txt(h.impact === 'high' ? 'Alto' : 'Medio', { ...rowStyle, font: { ...(rowStyle.font as object), bold: true, color: { rgb: h.impact === 'high' ? 'B91C1C' : 'D97706' } } }),
                txt(adj, rowStyle),
            ]);
        }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 36 }];
    ws['!rows'] = [{ hpt: 34 }];
    ws['!merges'] = merges;
    return ws;
}

function buildDetalleSheet(ctx: ForecastExportContext): XLSX.WorkSheet {
    const includeLastYear = ctx.aggregatedLastYear !== null && ctx.aggregatedLastYear.length > 0;
    const lyMap = new Map((ctx.aggregatedLastYear || []).map(p => [p.fecha, p.total]));
    const baseTotalByDate = new Map(ctx.originalForecast.map(p => [p.fecha, p.predicted]));
    // For bucket views, baseline sum is per-bucket; we'll mark "ajustado" if any day in the bucket has an override.
    const overrideDays = new Set(Object.keys(ctx.dayOverrides));

    const rows: Cell[][] = [];

    // Title strip
    rows.push([txt(`  DETALLE POR ${ctx.granularityLabel.toUpperCase()}`, titleStyle), blank(), blank(), blank(), ...(includeLastYear ? [blank()] : [])]);

    // Header
    const headerCells: Cell[] = [
        txt('Período', tableHeaderStyle),
        txt('Proyección', tableHeaderStyle),
        txt('Mínimo', tableHeaderStyle),
        txt('Máximo', tableHeaderStyle),
    ];
    if (includeLastYear) headerCells.push(txt('Año anterior', tableHeaderStyle));
    rows.push(headerCells);

    let totalPred = 0;
    let totalMin = 0;
    let totalMax = 0;
    let totalLy = 0;

    ctx.aggregatedForecast.forEach((p, idx) => {
        // Determine if this bucket has any overridden day
        const bucketHasOverride = (() => {
            // For day granularity, exact match
            if (overrideDays.has(p.fecha)) return true;
            // For week/month, check if any override date falls within bucket label range
            // Simpler heuristic: compute base total for this bucket date (only matches in day mode);
            // in week/month, fall back to: any override date strictly between p.fecha and next bucket's fecha
            const next = ctx.aggregatedForecast[idx + 1]?.fecha;
            for (const fechaOverride of overrideDays) {
                if (fechaOverride >= p.fecha && (!next || fechaOverride < next)) return true;
            }
            return false;
        })();

        const baseForBucket = (() => {
            // Day case: direct match in baseTotalByDate
            const direct = baseTotalByDate.get(p.fecha);
            if (direct !== undefined && !bucketHasOverride && ctx.granularityLabel.toLowerCase() === 'día') {
                return direct;
            }
            // For week/month or overridden: recompute from originalForecast in [p.fecha, next.fecha)
            const next = ctx.aggregatedForecast[idx + 1]?.fecha;
            let s = 0;
            for (const op of ctx.originalForecast) {
                if (op.fecha >= p.fecha && (!next || op.fecha < next)) s += op.predicted;
            }
            return s;
        })();

        const rs = bucketHasOverride ? overrideRowStyle : (idx % 2 === 0 ? rowStyle : rowAltStyle);
        const cs = bucketHasOverride ? overrideCurrencyStyle : (idx % 2 === 0 ? rowCurrencyStyle : rowCurrencyAltStyle);

        const label = bucketHasOverride
            ? `${bucketLabel(p.fecha, ctx.granularityLabel)}  ✏︎ (base $${baseForBucket.toLocaleString('es-MX')})`
            : bucketLabel(p.fecha, ctx.granularityLabel);

        const dataRow: Cell[] = [
            txt(label, rs),
            num(p.predicted, cs),
            num(p.lower, cs),
            num(p.upper, cs),
        ];
        if (includeLastYear) {
            const ly = lyMap.get(p.fecha);
            dataRow.push(ly !== undefined ? num(ly, cs) : txt('—', rs));
            if (ly !== undefined) totalLy += ly;
        }
        rows.push(dataRow);
        totalPred += p.predicted;
        totalMin += p.lower;
        totalMax += p.upper;
    });

    const totalRow: Cell[] = [
        txt('TOTAL', totalRowStyle),
        num(totalPred, totalCurrencyStyle),
        num(totalMin, totalCurrencyStyle),
        num(totalMax, totalCurrencyStyle),
    ];
    if (includeLastYear) totalRow.push(num(totalLy, totalCurrencyStyle));
    rows.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const cols: XLSX.ColInfo[] = [
        { wch: 36 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
    ];
    if (includeLastYear) cols.push({ wch: 18 });
    ws['!cols'] = cols;
    ws['!rows'] = [{ hpt: 34 }, { hpt: 26 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }];
    return ws;
}

// --- Entry point ---

export function exportForecastToXlsx(ctx: ForecastExportContext): void {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildResumenSheet(ctx), 'Resumen');
    XLSX.utils.book_append_sheet(wb, buildDetalleSheet(ctx), 'Detalle');

    const stamp = ctx.generatedAt.toISOString().split('T')[0];
    const slug = ctx.planName
        ? ctx.planName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40)
        : null;
    const filename = slug
        ? `Proyeccion_Ventas_${slug}_${stamp}.xlsx`
        : `Proyeccion_Ventas_${stamp}.xlsx`;
    XLSX.writeFile(wb, filename);
}
