import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockoutItem {
    codigoInterno: number;
    descripcion: string;
    depto: string;
    idTienda: number;
    tienda: string;
    stockActual: number;
    costo: number;
    fechaAct: string | null;
    total30d: number;
    unidades30d: number;
    avgDailyRevenue: number;
    avgDailyUnits: number;
    estimatedLostRevenue: number;
    estimatedLostUnits: number;
    severity: 'critico' | 'alto' | 'medio';
}

interface StockoutsResponse {
    scope: { storeIds: number[]; label: string };
    filters: { threshold: number; lookbackDays: number; horizonDays: number };
    kpis: {
        skusInBreakdown: number;
        storesAffected: number;
        estimatedLostRevenue: number;
        estimatedLostUnits: number;
        avgDailyLostRevenue: number;
        totalSkusWithSales: number;
    };
    byStore: Array<{ idTienda: number; tienda: string; skus: number; estimatedLostRevenue: number }>;
    byDepto: Array<{ depto: string; skus: number; estimatedLostRevenue: number }>;
}

type CellStyle = Record<string, unknown>;
type Cell = { v: string | number; t?: 's' | 'n'; s?: CellStyle };
const txt = (v: string, s?: CellStyle): Cell => ({ v, t: 's', s });
const num = (v: number, s?: CellStyle): Cell => ({ v, t: 'n', s });
const blank = (): Cell => ({ v: '', t: 's' });

const fmtCurrency = (v: number) => '$' + Math.round(v).toLocaleString('es-MX');

const SEVERITY_XLSX = {
    critico: { bg: 'FEE2E2', text: '991B1B' },
    alto: { bg: 'FEF3C7', text: 'B45309' },
    medio: { bg: 'F1F5F9', text: '475569' },
} as const;

const SEVERITY_PDF: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
    critico: { bg: [254, 226, 226], text: [153, 27, 27] },
    alto: { bg: [254, 243, 199], text: [180, 83, 9] },
    medio: { bg: [241, 245, 249], text: [71, 85, 105] },
};

const ROSE = 'BE123C';
const ROSE_RGB: [number, number, number] = [190, 18, 60];
const SLATE_LIGHT = 'F1F5F9';
const BORDER = 'CBD5E1';
const SLATE_HEADER = '1E293B';
const DARK_RGB: [number, number, number] = [30, 41, 59];
const MUTED_RGB: [number, number, number] = [100, 116, 139];
const LIGHT_RGB: [number, number, number] = [241, 245, 249];

// === XLSX ===

export function exportStockoutsToXlsx(data: StockoutsResponse, items: StockoutItem[]) {
    const wb = XLSX.utils.book_new();

    const titleStyle: CellStyle = {
        font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: ROSE } },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    };
    const subtitleStyle: CellStyle = {
        font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '475569' } },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    };
    const sectionStyle: CellStyle = {
        font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: ROSE } },
        fill: { patternType: 'solid', fgColor: { rgb: SLATE_LIGHT } },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
        border: { bottom: { style: 'medium', color: { rgb: ROSE } } },
    };
    const kpiLabelStyle: CellStyle = {
        font: { name: 'Calibri', sz: 10, color: { rgb: '64748B' } },
        alignment: { horizontal: 'right', vertical: 'center' },
    };
    const kpiValueCurr: CellStyle = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: SLATE_HEADER } },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
        numFmt: '"$"#,##0',
    };
    const kpiValueNum: CellStyle = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: SLATE_HEADER } },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    };
    const headerStyle: CellStyle = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: ROSE } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: { bottom: { style: 'thin', color: { rgb: BORDER } } },
    };
    const rowBase: CellStyle = {
        font: { name: 'Calibri', sz: 10, color: { rgb: SLATE_HEADER } },
        alignment: { vertical: 'center', indent: 1 },
        border: { bottom: { style: 'hair', color: { rgb: BORDER } } },
    };
    const rowCurrency: CellStyle = {
        ...rowBase,
        numFmt: '"$"#,##0',
        alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
    };
    const lostStyle: CellStyle = {
        ...rowCurrency,
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '991B1B' } },
    };

    const rows: Cell[][] = [];
    const merges: XLSX.Range[] = [];

    rows.push([txt('  QUIEBRES DE STOCK · VENTA PERDIDA ESTIMADA', titleStyle), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });

    rows.push([txt(`  ${data.scope.label}  ·  Stock ${data.filters.threshold === 0 ? '= 0' : '≤ ' + data.filters.threshold}  ·  Histórico ${data.filters.lookbackDays}d  ·  Proyección ${data.filters.horizonDays}d  ·  generado ${new Date().toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, subtitleStyle), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });
    rows.push([blank()]);

    rows.push([txt('  RESUMEN', sectionStyle), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 7 } });

    const kpis: Array<[string, number, CellStyle]> = [
        ['SKUs en quiebre', data.kpis.skusInBreakdown, kpiValueNum],
        [`SKUs con venta reciente (denominador)`, data.kpis.totalSkusWithSales, kpiValueNum],
        ['Sucursales afectadas', data.kpis.storesAffected, kpiValueNum],
        [`Venta perdida estimada (${data.filters.horizonDays}d)`, data.kpis.estimatedLostRevenue, kpiValueCurr],
        ['  → promedio diario', data.kpis.avgDailyLostRevenue, kpiValueCurr],
        ['Unidades faltantes estimadas', Math.round(data.kpis.estimatedLostUnits), kpiValueNum],
    ];
    for (const [label, value, style] of kpis) {
        rows.push([txt(label, kpiLabelStyle), num(value, style), blank(), blank(), blank(), blank(), blank(), blank()]);
        merges.push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: 7 } });
    }
    rows.push([blank()]);

    // Detail
    rows.push([txt('  DETALLE POR SKU', sectionStyle), blank(), blank(), blank(), blank(), blank(), blank(), blank()]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 7 } });
    rows.push([
        txt('Código', headerStyle),
        txt('Producto', headerStyle),
        txt('Departamento', headerStyle),
        txt('Sucursal', headerStyle),
        txt('Severidad', headerStyle),
        txt('Stock', headerStyle),
        txt('Venta promedio diaria', headerStyle),
        txt('Venta perdida estimada', headerStyle),
    ]);
    for (const it of items) {
        const sevStyle: CellStyle = {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: SEVERITY_XLSX[it.severity].text } },
            fill: { patternType: 'solid', fgColor: { rgb: SEVERITY_XLSX[it.severity].bg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: { bottom: { style: 'hair', color: { rgb: BORDER } } },
        };
        const stockStyle: CellStyle = {
            ...rowCurrency,
            numFmt: '0.##',
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: it.stockActual <= 0 ? '991B1B' : 'B45309' } },
        };
        rows.push([
            txt(String(it.codigoInterno), rowBase),
            txt(it.descripcion, rowBase),
            txt(it.depto || '—', rowBase),
            txt(it.tienda, rowBase),
            txt(it.severity.toUpperCase(), sevStyle),
            num(it.stockActual, stockStyle),
            num(it.avgDailyRevenue, rowCurrency),
            num(it.estimatedLostRevenue, lostStyle),
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 24 }];
    ws['!rows'] = [{ hpt: 34 }];
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'Quiebres');

    // Aggregate sheets
    if (data.byStore.length > 0) {
        const sRows: Cell[][] = [];
        sRows.push([txt('Sucursal', headerStyle), txt('SKUs en quiebre', headerStyle), txt('Venta perdida estimada', headerStyle)]);
        for (const b of data.byStore) sRows.push([txt(b.tienda, rowBase), num(b.skus, rowBase), num(b.estimatedLostRevenue, lostStyle)]);
        const sWs = XLSX.utils.aoa_to_sheet(sRows);
        sWs['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 24 }];
        XLSX.utils.book_append_sheet(wb, sWs, 'Por sucursal');
    }
    if (data.byDepto.length > 0) {
        const dRows: Cell[][] = [];
        dRows.push([txt('Departamento', headerStyle), txt('SKUs en quiebre', headerStyle), txt('Venta perdida estimada', headerStyle)]);
        for (const b of data.byDepto) dRows.push([txt(b.depto, rowBase), num(b.skus, rowBase), num(b.estimatedLostRevenue, lostStyle)]);
        const dWs = XLSX.utils.aoa_to_sheet(dRows);
        dWs['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 24 }];
        XLSX.utils.book_append_sheet(wb, dWs, 'Por depto');
    }

    const stamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Quiebres_Stock_${stamp}.xlsx`);
}

// === PDF ===

export function exportStockoutsToPdf(data: StockoutsResponse, items: StockoutItem[]) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const usableWidth = pageWidth - margin * 2;

    // Header band
    doc.setFillColor(ROSE_RGB[0], ROSE_RGB[1], ROSE_RGB[2]);
    doc.rect(0, 0, pageWidth, 66, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('QUIEBRES DE STOCK', margin, 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const subtitle = `${data.scope.label}  ·  Stock ${data.filters.threshold === 0 ? '= 0' : '≤ ' + data.filters.threshold}  ·  Histórico ${data.filters.lookbackDays}d  ·  Proyección ${data.filters.horizonDays}d`;
    doc.text(subtitle, margin, 48);
    doc.text(
        `Generado: ${new Date().toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        pageWidth - margin, 48, { align: 'right' }
    );

    let y = 86;

    // Section: resumen
    y = drawSectionHeader(doc, 'RESUMEN', margin, y, usableWidth);
    const kpiRows: Array<{ label: string; value: string; bold?: boolean }> = [
        { label: 'SKUs en quiebre', value: data.kpis.skusInBreakdown.toLocaleString('es-MX'), bold: true },
        { label: `de ${data.kpis.totalSkusWithSales.toLocaleString('es-MX')} con venta reciente`, value: '' },
        { label: 'Sucursales afectadas', value: String(data.kpis.storesAffected) },
        { label: `Venta perdida estimada (${data.filters.horizonDays}d)`, value: fmtCurrency(data.kpis.estimatedLostRevenue), bold: true },
        { label: '  → promedio diario', value: fmtCurrency(data.kpis.avgDailyLostRevenue) },
        { label: 'Unidades faltantes estimadas', value: Math.round(data.kpis.estimatedLostUnits).toLocaleString('es-MX') },
    ];
    for (const r of kpiRows) {
        if (!r.value) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
            doc.text(r.label, margin + 8, y);
            y += 14;
            continue;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
        doc.text(r.label, margin + 8, y);
        doc.setFont('helvetica', r.bold ? 'bold' : 'normal');
        doc.setTextColor(DARK_RGB[0], DARK_RGB[1], DARK_RGB[2]);
        doc.text(r.value, pageWidth - margin - 8, y, { align: 'right' });
        y += 16;
    }
    y += 4;

    // Section: detalle SKU
    if (items.length > 0) {
        y = ensureSpace(doc, y, 100, margin, pageHeight);
        y = drawSectionHeader(doc, 'DETALLE POR SKU', margin, y, usableWidth);
        const severities = items.map(it => it.severity);
        autoTable(doc, {
            startY: y,
            head: [['Producto', 'Sucursal', 'Sev.', 'Stock', 'Venta/día', 'Venta perdida']],
            body: items.map(it => [
                `${it.descripcion}\n#${it.codigoInterno}${it.depto ? ` · ${it.depto}` : ''}`,
                it.tienda,
                it.severity.toUpperCase(),
                Number(it.stockActual).toFixed(it.stockActual % 1 ? 2 : 0),
                fmtCurrency(it.avgDailyRevenue),
                fmtCurrency(it.estimatedLostRevenue),
            ]),
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 4, textColor: DARK_RGB, lineColor: [203, 213, 225], lineWidth: 0.3, valign: 'middle', overflow: 'linebreak' },
            headStyles: { fillColor: ROSE_RGB, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: 5, halign: 'left' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: margin, right: margin, top: 60, bottom: 40 },
            columnStyles: {
                0: { cellWidth: 180, fontStyle: 'bold' },
                1: { cellWidth: 90 },
                2: { cellWidth: 44, halign: 'center', fontStyle: 'bold' },
                3: { cellWidth: 36, halign: 'right' },
                4: { cellWidth: 56, halign: 'right' },
                5: { cellWidth: 70, halign: 'right' },
            },
            didParseCell: (cellData) => {
                if (cellData.section !== 'body') return;
                if (cellData.column.index === 2) {
                    const sev = severities[cellData.row.index];
                    const colors = SEVERITY_PDF[sev];
                    if (colors) {
                        cellData.cell.styles.fillColor = colors.bg;
                        cellData.cell.styles.textColor = colors.text;
                    }
                }
                if (cellData.column.index === 5) {
                    cellData.cell.styles.textColor = [153, 27, 27];
                    cellData.cell.styles.fontStyle = 'bold';
                }
                if (cellData.column.index === 3) {
                    const stockVal = items[cellData.row.index]?.stockActual ?? 0;
                    if (stockVal <= 0) cellData.cell.styles.textColor = [153, 27, 27];
                    else cellData.cell.styles.textColor = [180, 83, 9];
                    cellData.cell.styles.fontStyle = 'bold';
                }
            },
        });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(LIGHT_RGB[0], LIGHT_RGB[1], LIGHT_RGB[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
        doc.text('Quiebres de stock · Detecta SKUs sin existencia con venta reciente · Venta perdida ≈ promedio diario × horizonte', margin, pageHeight - 14);
        doc.text(`${i} / ${pageCount}`, pageWidth - margin, pageHeight - 14, { align: 'right' });
    }

    const stamp = new Date().toISOString().split('T')[0];
    doc.save(`Quiebres_Stock_${stamp}.pdf`);
}

function drawSectionHeader(doc: jsPDF, label: string, margin: number, y: number, width: number): number {
    doc.setFillColor(LIGHT_RGB[0], LIGHT_RGB[1], LIGHT_RGB[2]);
    doc.rect(margin, y - 12, width, 18, 'F');
    doc.setDrawColor(ROSE_RGB[0], ROSE_RGB[1], ROSE_RGB[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, y + 6, margin + width, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(ROSE_RGB[0], ROSE_RGB[1], ROSE_RGB[2]);
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
