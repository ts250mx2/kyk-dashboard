import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ForecastExportContext } from './xlsx-export';

const BRAND: [number, number, number] = [64, 80, 180];
const VIOLET: [number, number, number] = [109, 40, 217];
const VIOLET_LIGHT: [number, number, number] = [237, 233, 254];
const DARK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [241, 245, 249];
const EMERALD: [number, number, number] = [4, 120, 87];
const AMBER: [number, number, number] = [180, 83, 9];
const ROSE: [number, number, number] = [185, 28, 28];

const fmtCurrency = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

function fmtDateLong(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'short', year: 'numeric',
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

export function exportForecastToPdf(ctx: ForecastExportContext): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const usableWidth = pageWidth - margin * 2;

    // === HEADER BAND ===
    doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.rect(0, 0, pageWidth, 66, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('PROYECCIÓN DE VENTAS', margin, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${ctx.scope}  ·  ${ctx.horizonDays} días  ·  ${fmtDateLong(ctx.period.start)} – ${fmtDateLong(ctx.period.end)}`, margin, 50);

    const generatedText = `Generado: ${ctx.generatedAt.toLocaleString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`;
    doc.text(generatedText, pageWidth - margin, 50, { align: 'right' });

    let y = 86;

    // Plan name strip
    if (ctx.planName) {
        doc.setFillColor(VIOLET_LIGHT[0], VIOLET_LIGHT[1], VIOLET_LIGHT[2]);
        doc.rect(margin, y - 10, usableWidth, 22, 'F');
        doc.setTextColor(VIOLET[0], VIOLET[1], VIOLET[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`PLAN: ${ctx.planName}`, margin + 10, y + 5);
        y += 30;
    }

    // === KPIs section ===
    y = drawSectionHeader(doc, 'RESUMEN', margin, y, usableWidth);

    const hasOverrides = Object.keys(ctx.dayOverrides).length > 0;
    const overrideDelta = ctx.metrics.totalForecast - ctx.metrics.baselineTotalForecast;

    type KpiRow = { label: string; value: string; valueColor?: [number, number, number]; bold?: boolean };
    const kpiRows: KpiRow[] = [
        { label: `Proyección horizonte ${ctx.horizonDays}d`, value: fmtCurrency(ctx.metrics.totalForecast), bold: true },
    ];
    if (hasOverrides) {
        kpiRows.push({ label: '   ↳ Base modelo', value: fmtCurrency(ctx.metrics.baselineTotalForecast) });
        kpiRows.push({
            label: '   ↳ Ajuste manual',
            value: (overrideDelta >= 0 ? '+' : '') + fmtCurrency(overrideDelta),
            valueColor: overrideDelta >= 0 ? EMERALD : ROSE,
        });
    }
    kpiRows.push({ label: `Histórico mismos ${ctx.horizonDays}d`, value: fmtCurrency(ctx.metrics.sameLengthHistorySum) });
    kpiRows.push({
        label: 'Variación vs. histórico',
        value: (ctx.metrics.projectedVsHistoryPct >= 0 ? '+' : '') + fmtPct(ctx.metrics.projectedVsHistoryPct),
        valueColor: ctx.metrics.projectedVsHistoryPct >= 0 ? EMERALD : ROSE,
        bold: true,
    });
    kpiRows.push({
        label: 'Tendencia mensual',
        value: (ctx.metrics.trend >= 0 ? '+' : '') + fmtPct(ctx.metrics.trend),
        valueColor: ctx.metrics.trend >= 0 ? EMERALD : ROSE,
    });
    if (ctx.metrics.mape !== null) {
        kpiRows.push({ label: 'Precisión backtest (MAPE 14d)', value: fmtPct(ctx.metrics.mape) });
    }

    y = drawKpiTable(doc, kpiRows, margin, y, usableWidth);

    // === Metas ===
    const activeMetas = ctx.metaProjections.filter(m => !m.hasConcepts);
    if (activeMetas.length > 0) {
        y = ensureSpace(doc, y, 120, margin);
        y = drawSectionHeader(doc, 'METAS DEL PERÍODO', margin, y, usableWidth);

        const metaBody: string[][] = [];
        const metaPercents: number[] = [];
        for (const mp of activeMetas) {
            const pct = mp.percentExpected;
            metaPercents.push(pct);
            metaBody.push([
                `${fmtDateLong(mp.fechaInicio)} – ${fmtDateLong(mp.fechaFin)}\n(${mp.storesIncluded} suc · faltan ${mp.daysRemaining}d)`,
                fmtCurrency(mp.target),
                fmtCurrency(mp.actualToDate),
                fmtCurrency(mp.projectedTotal),
                `${Math.round(pct * 100)}%`,
            ]);
        }

        autoTable(doc, {
            startY: y,
            head: [['Período', 'Meta', 'Real a hoy', 'Proy. cierre', '% cierre']],
            body: metaBody,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 6, textColor: DARK, lineColor: [203, 213, 225], lineWidth: 0.3, valign: 'middle' },
            headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 6, halign: 'left' },
            margin: { left: margin, right: margin, top: 60, bottom: 40 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 75, halign: 'right' },
                2: { cellWidth: 75, halign: 'right' },
                3: { cellWidth: 75, halign: 'right' },
                4: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
            },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                if (data.column.index === 4) {
                    const pct = metaPercents[data.row.index];
                    if (pct >= 1) data.cell.styles.textColor = EMERALD;
                    else if (pct >= 0.9) data.cell.styles.textColor = AMBER;
                    else data.cell.styles.textColor = ROSE;
                }
            },
        });
        // @ts-expect-error lastAutoTable not in jsPDF types
        y = doc.lastAutoTable.finalY + 16;
    }

    // === Festivos ===
    const upcomingHolidays = ctx.holidays.filter(
        h => h.impact !== 'low' && h.fecha >= ctx.period.start && h.fecha <= ctx.period.end
    );
    if (upcomingHolidays.length > 0) {
        y = ensureSpace(doc, y, 100, margin);
        y = drawSectionHeader(doc, 'FESTIVOS EN EL HORIZONTE', margin, y, usableWidth);

        const holidayBody: string[][] = upcomingHolidays.map(h => {
            const adj = typeof h.multiplier === 'number'
                ? `×${h.multiplier.toFixed(2)} (${h.multiplier >= 1 ? '+' : ''}${Math.round((h.multiplier - 1) * 100)}%)`
                : 'sin ajuste';
            return [
                fmtDateLong(h.fecha),
                h.name,
                h.impact === 'high' ? 'Alto' : 'Medio',
                adj,
            ];
        });
        const holidayImpacts = upcomingHolidays.map(h => h.impact);

        autoTable(doc, {
            startY: y,
            head: [['Fecha', 'Festivo', 'Impacto', 'Ajuste vs. año anterior']],
            body: holidayBody,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 5, textColor: DARK, lineColor: [203, 213, 225], lineWidth: 0.3, valign: 'middle' },
            headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 6, halign: 'left' },
            margin: { left: margin, right: margin, top: 60, bottom: 40 },
            columnStyles: {
                0: { cellWidth: 130 },
                1: { cellWidth: 'auto', fontStyle: 'bold' },
                2: { cellWidth: 60, halign: 'center', fontStyle: 'bold' },
                3: { cellWidth: 130, halign: 'right' },
            },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                if (data.column.index === 2) {
                    const impact = holidayImpacts[data.row.index];
                    if (impact === 'high') data.cell.styles.textColor = ROSE;
                    else if (impact === 'medium') data.cell.styles.textColor = AMBER;
                }
            },
        });
        // @ts-expect-error lastAutoTable not in jsPDF types
        y = doc.lastAutoTable.finalY + 16;
    }

    // === Detalle ===
    if (ctx.aggregatedForecast.length > 0) {
        y = ensureSpace(doc, y, 120, margin);
        y = drawSectionHeader(doc, `DETALLE POR ${ctx.granularityLabel.toUpperCase()}`, margin, y, usableWidth);

        const includeLastYear = !!ctx.aggregatedLastYear && ctx.aggregatedLastYear.length > 0;
        const lyMap = new Map((ctx.aggregatedLastYear || []).map(p => [p.fecha, p.total]));
        const overrideDays = new Set(Object.keys(ctx.dayOverrides));

        let totalPred = 0;
        let totalMin = 0;
        let totalMax = 0;
        let totalLy = 0;

        const body: string[][] = [];
        const overriddenRows: boolean[] = [];

        ctx.aggregatedForecast.forEach((p, idx) => {
            const bucketHasOverride = (() => {
                if (overrideDays.has(p.fecha)) return true;
                const next = ctx.aggregatedForecast[idx + 1]?.fecha;
                for (const f of overrideDays) {
                    if (f >= p.fecha && (!next || f < next)) return true;
                }
                return false;
            })();
            overriddenRows.push(bucketHasOverride);

            const baseSum = (() => {
                const next = ctx.aggregatedForecast[idx + 1]?.fecha;
                let s = 0;
                for (const op of ctx.originalForecast) {
                    if (op.fecha >= p.fecha && (!next || op.fecha < next)) s += op.predicted;
                }
                return s;
            })();

            const label = bucketHasOverride
                ? `${bucketLabel(p.fecha, ctx.granularityLabel)}  ✏  base ${fmtCurrency(baseSum)}`
                : bucketLabel(p.fecha, ctx.granularityLabel);

            const row = [
                label,
                fmtCurrency(p.predicted),
                fmtCurrency(p.lower),
                fmtCurrency(p.upper),
            ];
            if (includeLastYear) {
                const ly = lyMap.get(p.fecha);
                row.push(ly !== undefined ? fmtCurrency(ly) : '—');
                if (ly !== undefined) totalLy += ly;
            }
            body.push(row);
            totalPred += p.predicted;
            totalMin += p.lower;
            totalMax += p.upper;
        });

        // Total row
        const totalRow = ['TOTAL', fmtCurrency(totalPred), fmtCurrency(totalMin), fmtCurrency(totalMax)];
        if (includeLastYear) totalRow.push(fmtCurrency(totalLy));
        body.push(totalRow);
        overriddenRows.push(false);

        const head = ['Período', 'Proyección', 'Mínimo', 'Máximo'];
        if (includeLastYear) head.push('Año anterior');

        const columnStyles: Record<number, { cellWidth?: number | 'auto'; halign?: 'left' | 'center' | 'right' }> = {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 75, halign: 'right' },
            2: { cellWidth: 65, halign: 'right' },
            3: { cellWidth: 65, halign: 'right' },
        };
        if (includeLastYear) columnStyles[4] = { cellWidth: 75, halign: 'right' };

        autoTable(doc, {
            startY: y,
            head: [head],
            body,
            theme: 'plain',
            styles: { fontSize: 8.5, cellPadding: 4.5, textColor: DARK, lineColor: [203, 213, 225], lineWidth: 0.3, valign: 'middle' },
            headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: 5, halign: 'left' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: margin, right: margin, top: 60, bottom: 40 },
            columnStyles,
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                const isTotal = data.row.index === body.length - 1;
                if (isTotal) {
                    data.cell.styles.fillColor = [224, 231, 255];
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.textColor = DARK;
                    return;
                }
                if (overriddenRows[data.row.index]) {
                    data.cell.styles.fillColor = VIOLET_LIGHT;
                    data.cell.styles.textColor = VIOLET;
                    data.cell.styles.fontStyle = 'bold';
                }
            },
        });
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
        doc.text('Proyección de Ventas · Promedio móvil estacional ponderado + ajuste de tendencia y festivos', margin, pageHeight - 14);
        doc.text(`${i} / ${pageCount}`, pageWidth - margin, pageHeight - 14, { align: 'right' });
    }

    const stamp = ctx.generatedAt.toISOString().split('T')[0];
    const slug = ctx.planName
        ? ctx.planName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40)
        : null;
    const filename = slug
        ? `Proyeccion_Ventas_${slug}_${stamp}.pdf`
        : `Proyeccion_Ventas_${stamp}.pdf`;
    doc.save(filename);
}

// --- Helpers ---

function drawSectionHeader(doc: jsPDF, label: string, margin: number, y: number, width: number): number {
    doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.rect(margin, y - 12, width, 18, 'F');
    doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, y + 6, margin + width, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.text(label, margin + 8, y + 2);
    return y + 22;
}

function drawKpiTable(
    doc: jsPDF,
    rows: Array<{ label: string; value: string; valueColor?: [number, number, number]; bold?: boolean }>,
    margin: number,
    y: number,
    width: number
): number {
    const rowHeight = 18;
    const labelColX = margin + 8;
    const valueColX = margin + width - 8;
    for (const r of rows) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(r.label, labelColX, y);

        doc.setFont('helvetica', r.bold ? 'bold' : 'normal');
        const c = r.valueColor || DARK;
        doc.setTextColor(c[0], c[1], c[2]);
        doc.text(r.value, valueColX, y, { align: 'right' });

        y += rowHeight;
    }
    return y + 6;
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - margin) {
        doc.addPage();
        return margin;
    }
    return y;
}
